import * as XLSX from 'xlsx';
import { AppError } from '../middleware/errorHandler.middleware';
import { logger } from '../utils/logger';
import {
  buildInstructionRows,
  canonicalHeader,
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

/** .xlsx is a zip (PK\x03\x04); .xls is an OLE compound file (D0 CF 11 E0). */
export function isWorkbookBuffer(buffer: Buffer): boolean {
  const zip = buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04;
  const ole = buffer.length >= 4 && buffer[0] === 0xd0 && buffer[1] === 0xcf && buffer[2] === 0x11 && buffer[3] === 0xe0;
  return zip || ole;
}

/**
 * CSV text: UTF-8 (BOM stripped) when it decodes cleanly, else Windows-1252,
 * which is what Excel in Spanish writes for "CSV (delimitado por comas)".
 */
export function decodeCsv(buffer: Buffer): string {
  const body = buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf ? buffer.subarray(3) : buffer;
  const utf8 = body.toString('utf8');
  if (!utf8.includes('\uFFFD')) return utf8;
  try {
    return new TextDecoder('windows-1252').decode(body);
  } catch {
    return body.toString('latin1');
  }
}

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
    // A non-workbook renamed to .xlsx is read as text and yields no known headers.
    const recognisedHeader = (cells[0] ?? []).some((header) => canonicalHeader(header) !== null);
    if (!recognisedHeader && extension !== 'csv' && !isWorkbookBuffer(file.buffer)) {
      throw new AppError('No se pudo leer el archivo. Usa la plantilla en formato .xlsx.', 400);
    }
    return this.processCells(cells, userId);
  }

  /** First sheet named "Preguntas" (the template), else the first sheet; rows as arrays so row numbers stay true. */
  private readCells(buffer: Buffer, isCsv: boolean): unknown[][] {
    // Header + the row limit + one more, so an oversized file is still detected without expanding it all.
    const sheetRows = MAX_IMPORT_ROWS + 2;
    let workbook: XLSX.WorkBook;
    try {
      workbook = isCsv
        ? // raw: CSV values stay the text the teacher typed ("7:30", "1/2"), never dates or numbers.
          XLSX.read(decodeCsv(buffer), { type: 'string', raw: true, sheetRows })
        : XLSX.read(buffer, { type: 'buffer', sheetRows });
    } catch (error) {
      logger.error('Could not read spreadsheet:', error);
      throw new AppError('No se pudo leer el archivo. Verifica que sea un Excel o CSV válido.', 400);
    }
    const name = workbook.SheetNames.find((n) => n.trim().toLowerCase() === 'preguntas') ?? workbook.SheetNames[0];
    const sheet = name ? workbook.Sheets[name] : undefined;
    if (!sheet) throw new AppError('El archivo no tiene ninguna hoja con datos.', 400);
    // raw: false -> the formatted text shown in Excel, so a time or fraction is not turned into a serial number.
    return XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '', blankrows: true, raw: false });
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
      // Reading stops just past the limit, so the real count is unknown here.
      throw new AppError(`El archivo tiene más de ${MAX_IMPORT_ROWS} preguntas, el máximo por importación. Divídelo en varios archivos.`, 400);
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
