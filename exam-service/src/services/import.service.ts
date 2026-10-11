import * as XLSX from 'xlsx';
import { AppError } from '../middleware/errorHandler.middleware';
import { logger } from '../utils/logger';
import {
  buildInstructionRows,
  IMPORT_COLUMNS,
  mapImportRow,
  MAX_IMPORT_ROWS,
  rowsFromCells,
  TEMPLATE_EXAMPLES,
} from '../utils/questionImport';
import { QuestionService } from './question.service';

export interface ImportRowError {
  row: number;
  message: string;
}

export interface ImportResult {
  /** Rows with data (empty rows are skipped): imported + drafts + failed. */
  total: number;
  /** Created and active. */
  imported: number;
  /** Created inactive because the listening audio is missing. */
  drafts: number;
  /** Spreadsheet rows (1 = header) of the drafts. */
  draftRows: number[];
  failed: number;
  errors: ImportRowError[];
}

const DRAFT_NOTICE = 'importada como borrador: falta audio';

export class ImportService {
  private questionService: QuestionService;

  constructor() {
    this.questionService = new QuestionService();
  }

  async importQuestionsFromFile(file: Express.Multer.File, userId: string): Promise<ImportResult> {
    const extension = file.originalname.split('.').pop()?.toLowerCase();
    if (extension !== 'xlsx' && extension !== 'xls' && extension !== 'csv') {
      throw new AppError('Formato no soportado. Usa un archivo Excel (.xlsx) o CSV (.csv).', 400);
    }
    const cells = this.readCells(file.buffer, extension === 'csv');
    return this.processCells(cells, userId);
  }

  /** First sheet named "Preguntas" (the template), else the first sheet; rows as arrays so row numbers stay true. */
  private readCells(buffer: Buffer, isCsv: boolean): unknown[][] {
    let workbook: XLSX.WorkBook;
    try {
      workbook = isCsv ? XLSX.read(buffer.toString('utf8'), { type: 'string' }) : XLSX.read(buffer, { type: 'buffer' });
    } catch (error) {
      logger.error('Could not read spreadsheet:', error);
      throw new AppError('No se pudo leer el archivo. Verifica que sea un Excel o CSV válido.', 400);
    }
    const name = workbook.SheetNames.find((n) => n.trim().toLowerCase() === 'preguntas') ?? workbook.SheetNames[0];
    const sheet = name ? workbook.Sheets[name] : undefined;
    if (!sheet) throw new AppError('El archivo no tiene ninguna hoja con datos.', 400);
    return XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '', blankrows: true, raw: true });
  }

  async processCells(cells: unknown[][], userId: string): Promise<ImportResult> {
    const { rows, missing } = rowsFromCells(cells);
    if (missing.length) {
      throw new AppError(
        `Faltan columnas obligatorias en la primera fila: ${missing.join(', ')}. Descarga la plantilla y copia tus preguntas en ella.`,
        400
      );
    }
    if (rows.length > MAX_IMPORT_ROWS) {
      throw new AppError(`El archivo tiene ${rows.length} preguntas; el máximo por importación es ${MAX_IMPORT_ROWS}. Divídelo en varios archivos.`, 400);
    }

    const result: ImportResult = { total: rows.length, imported: 0, drafts: 0, draftRows: [], failed: 0, errors: [] };

    for (const { row, values } of rows) {
      const mapped = mapImportRow(values);
      if (mapped.error || !mapped.data) {
        result.failed++;
        result.errors.push({ row, message: mapped.error ?? 'Fila no válida' });
        continue;
      }
      try {
        await this.questionService.create({ ...mapped.data, createdBy: userId as never });
        if (mapped.draft) {
          result.drafts++;
          result.draftRows.push(row);
        } else {
          result.imported++;
        }
      } catch (error) {
        result.failed++;
        result.errors.push({ row, message: error instanceof Error ? error.message : 'Error desconocido' });
      }
    }

    logger.info(
      `Question import: ${result.imported} imported, ${result.drafts} drafts (${DRAFT_NOTICE}), ${result.failed} failed of ${result.total}`
    );
    return result;
  }

  /** .xlsx with the "Preguntas" sheet (one valid example per format) and the "Instrucciones" sheet. */
  generateExcelTemplate(): Buffer {
    const header = [...IMPORT_COLUMNS] as string[];
    const questions = XLSX.utils.aoa_to_sheet([
      header,
      ...TEMPLATE_EXAMPLES.map((example) => header.map((column) => example[column as keyof typeof example] ?? '')),
    ]);
    questions['!cols'] = header.map((column) => ({
      wch: column === 'pregunta' || column === 'texto_lectura' || column === 'opciones' ? 48 : column === 'tipo' || column === 'competencia' ? 20 : 16,
    }));
    questions['!freeze'] = { xSplit: 0, ySplit: 1 };

    const instructions = XLSX.utils.aoa_to_sheet(buildInstructionRows());
    instructions['!cols'] = [{ wch: 22 }, { wch: 24 }, { wch: 90 }, { wch: 30 }];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, questions, 'Preguntas');
    XLSX.utils.book_append_sheet(workbook, instructions, 'Instrucciones');
    return Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
  }
}

export const importService = new ImportService();
