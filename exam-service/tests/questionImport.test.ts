import * as XLSX from 'xlsx';

// The service pulls in env/redis/kafka at import time; only its pure logic is under test here.
jest.mock('../src/services/question.service', () => ({ QuestionService: class {} }));
jest.mock('../src/utils/logger', () => ({ logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() } }));

import { ImportService } from '../src/services/import.service';
import { answerKeyProblems, formatMismatch, withDefaultPositions } from '../src/utils/questionFormats';
import {
  canonicalHeader,
  IMPORT_COLUMNS,
  ImportRow,
  mapImportRow,
  fold,
  rowsFromCells,
  TEMPLATE_EXAMPLES,
  TYPE_LOOKUP,
} from '../src/utils/questionImport';

/** What QuestionService.create would check, minus the database. */
function problemsOf(mapped: ReturnType<typeof mapImportRow>): string[] {
  if (mapped.error || !mapped.data) return [mapped.error ?? 'no data'];
  const { type, competency, content } = mapped.data;
  const fixed = withDefaultPositions(type, content);
  return [formatMismatch(type, competency), ...answerKeyProblems(type, fixed)].filter((p): p is string => Boolean(p));
}

const base: ImportRow = { competencia: 'grammar', nivel: 'a2', pregunta: 'Q ___' };

describe('mapImportRow per format', () => {
  it('multiple choice by text or by letter, with several correct options', () => {
    const byText = mapImportRow({ ...base, tipo: 'multiple_choice', opciones: 'went|go|gone', respuesta_correcta: 'Went' });
    expect(byText.data?.content.options).toEqual([
      { id: 'A', text: 'went', isCorrect: true }, { id: 'B', text: 'go', isCorrect: false }, { id: 'C', text: 'gone', isCorrect: false },
    ]);
    const byLetter = mapImportRow({ ...base, tipo: 'multiple_choice', opciones: 'x|y|z', respuesta_correcta: 'c' });
    expect(byLetter.data?.content.options?.map((o) => o.isCorrect)).toEqual([false, false, true]);
    const many = mapImportRow({ ...base, tipo: 'multiple_choice', opciones: 'x|y|z', respuesta_correcta: 'x|z' });
    expect(many.data?.content.options?.filter((o) => o.isCorrect)).toHaveLength(2);
    expect(problemsOf(byText)).toEqual([]);
  });

  it('multiple choice reports a missing or unknown answer', () => {
    expect(mapImportRow({ ...base, tipo: 'mc', opciones: 'a|b' }).error).toMatch(/respuesta_correcta/);
    expect(mapImportRow({ ...base, tipo: 'mc', opciones: 'a|b', respuesta_correcta: 'q' }).error).toMatch(/no coincide/);
    expect(mapImportRow({ ...base, tipo: 'mc', opciones: 'a', respuesta_correcta: 'a' }).error).toMatch(/al menos 2/);
  });

  it('true/false builds the two standard options', () => {
    const m = mapImportRow({ ...base, competencia: 'vocabulario', tipo: 'Verdadero/Falso', respuesta_correcta: 'Falso' });
    expect(m.data?.content.options).toEqual([
      { id: 'true', text: 'Verdadero', isCorrect: false }, { id: 'false', text: 'Falso', isCorrect: true },
    ]);
    expect(problemsOf(m)).toEqual([]);
    expect(mapImportRow({ ...base, tipo: 'tf', respuesta_correcta: 'TRUE' }).data?.content.options?.[0]?.isCorrect).toBe(true);
    expect(mapImportRow({ ...base, tipo: 'tf', respuesta_correcta: 'quizá' }).error).toMatch(/verdadero o falso/);
  });

  it('fill blanks: one answer per gap, alternatives with /', () => {
    const m = mapImportRow({ ...base, tipo: 'completar espacios', pregunta: 'I ___ a student; she ___ a teacher.', respuesta_correcta: 'am|is/was' });
    expect(m.data?.content.template).toBe('I ___ a student; she ___ a teacher.');
    expect(m.data?.content.blanks).toEqual([
      { position: 0, correctAnswers: ['am'], caseSensitive: false },
      { position: 1, correctAnswers: ['is', 'was'], caseSensitive: false },
    ]);
    expect(m.data?.content.correctAnswer).toEqual(['am', 'is']);
    expect(problemsOf(m)).toEqual([]);
    expect(problemsOf(mapImportRow({ ...base, tipo: 'fill_blanks', pregunta: 'A ___ B ___', respuesta_correcta: 'x' }))[0]).toMatch(/2 espacios y 1/);
    expect(mapImportRow({ ...base, tipo: 'fill_blanks', pregunta: 'no gaps', respuesta_correcta: 'x' }).error).toMatch(/___/);
  });

  it('matching reads left=right pairs', () => {
    const m = mapImportRow({ ...base, competencia: 'vocabulario', tipo: 'emparejar', pares: 'dog=perro | cat = gato' });
    expect(m.data?.content.items).toEqual([
      { id: 'p1', content: 'dog', matchingPair: 'perro' }, { id: 'p2', content: 'cat', matchingPair: 'gato' },
    ]);
    expect(problemsOf(m)).toEqual([]);
    expect(mapImportRow({ ...base, tipo: 'matching', pares: 'dog=perro|cat' }).error).toMatch(/izquierda=derecha/);
    expect(mapImportRow({ ...base, tipo: 'matching', pares: 'dog=perro' }).error).toMatch(/al menos 2/);
  });

  it('ordering and sentence builder take positions from the written order', () => {
    const ord = mapImportRow({ ...base, competencia: 'lectura', tipo: 'ordenar', elementos: 'a|b|c' });
    expect(ord.data?.content.items?.map((i) => i.correctPosition)).toEqual([1, 2, 3]);
    expect(problemsOf(ord)).toEqual([]);
    expect(mapImportRow({ ...base, tipo: 'ordenar', elementos: 'a|b' }).error).toMatch(/al menos 3/);
    const dd = mapImportRow({ ...base, tipo: 'drag_drop', elementos: 'She|is|reading' });
    expect(dd.data?.content.items).toHaveLength(3);
    const sentence = mapImportRow({ ...base, tipo: 'construir oracion', elementos: 'She is reading a book' });
    expect(sentence.data?.content.items?.map((i) => i.content)).toEqual(['She', 'is', 'reading', 'a', 'book']);
    expect(problemsOf(sentence)).toEqual([]);
  });

  it('open text, essay and audio response need no options', () => {
    const open = mapImportRow({ ...base, competencia: 'lectura', tipo: 'respuesta corta', respuesta_correcta: 'At home' });
    expect(open.data?.content.sampleAnswer).toBe('At home');
    expect(problemsOf(open)).toEqual([]);
    expect(problemsOf(mapImportRow({ ...base, competencia: 'escritura', tipo: 'ensayo' }))).toEqual([]);
    const oral = mapImportRow({ ...base, competencia: 'expresion oral', tipo: 'respuesta oral' });
    expect(oral.data?.content.expectedResponseType).toBe('sentence');
    expect(problemsOf(oral)).toEqual([]);
  });

  it('keeps reading text, instructions, points, time, topic and tags', () => {
    const m = mapImportRow({
      ...base, tipo: 'ensayo', competencia: 'escritura', texto_lectura: 'passage', instrucciones: 'do it',
      puntos: '2,5', tiempo_estimado: '90', tema: 'T', etiquetas: 'a, b', dificultad: '4',
    });
    expect(m.data?.content).toMatchObject({ context: 'passage', instructions: 'do it' });
    expect(m.data?.metadata).toEqual({ points: 2.5, estimatedTime: 90, topic: 'T', tags: ['a', 'b'] });
    expect(m.data?.difficulty).toBe(4);
    expect(m.data?.level).toBe('A2');
  });

  it('defaults difficulty, points and time', () => {
    const m = mapImportRow({ ...base, tipo: 'ensayo', competencia: 'writing' });
    expect(m.data).toMatchObject({ difficulty: 3, metadata: { points: 1, estimatedTime: 60 }, isActive: true });
  });
});

describe('Spanish aliases and error messages', () => {
  it.each([
    ['opcion multiple', 'multiple_choice'], ['Opción Múltiple', 'multiple_choice'], ['verdadero falso', 'true_false'],
    ['completar espacios', 'fill_blanks'], ['emparejar', 'matching'], ['ordenar', 'ordering'],
    ['construir oración', 'drag_drop'], ['respuesta corta', 'open_text'], ['ensayo', 'essay'], ['respuesta oral', 'audio_response'],
  ])('type "%s" -> %s', (alias, code) => {
    expect(TYPE_LOOKUP.get(fold(alias))).toBe(code);
  });

  it.each([
    ['gramática', 'grammar'], ['Vocabulario', 'vocabulary'], ['lectura', 'reading'], ['escritura', 'writing'],
    ['expresión oral', 'speaking'], ['comprensión auditiva', 'listening'], ['Comprension Lectora', 'reading'],
  ])('competency "%s" -> %s', (alias, code) => {
    expect(mapImportRow({ tipo: 'respuesta corta', competencia: alias, nivel: 'B1', pregunta: 'q' }).data?.competency).toBe(code);
  });

  it('explains what is wrong in Spanish', () => {
    expect(mapImportRow({ ...base, tipo: '' }).error).toMatch(/Falta el tipo/);
    expect(mapImportRow({ ...base, tipo: 'quiz' }).error).toMatch(/no reconocido/);
    expect(mapImportRow({ ...base, tipo: 'ensayo', competencia: 'baile' }).error).toMatch(/Competencia/);
    expect(mapImportRow({ ...base, tipo: 'ensayo', nivel: 'D9' }).error).toMatch(/Nivel/);
    expect(mapImportRow({ ...base, tipo: 'ensayo', dificultad: '9' }).error).toMatch(/Dificultad/);
    expect(mapImportRow({ ...base, tipo: 'ensayo', pregunta: '' }).error).toMatch(/Falta la pregunta/);
  });

  it('format vs competency mismatches surface the existing Spanish message', () => {
    const m = mapImportRow({ ...base, competencia: 'lectura', tipo: 'ensayo' });
    expect(problemsOf(m)[0]).toMatch(/no evalúa .*Formatos válidos/);
  });

  it('accepts Spanish and English headers', () => {
    expect(canonicalHeader('Respuesta correcta')).toBe('respuesta_correcta');
    expect(canonicalHeader('correctAnswer')).toBe('respuesta_correcta');
    expect(canonicalHeader('Enunciado')).toBe('pregunta');
    expect(canonicalHeader('Tiempo estimado')).toBe('tiempo_estimado');
    expect(canonicalHeader('difficulty')).toBe('dificultad');
    expect(canonicalHeader('columna rara')).toBeNull();
  });
});

describe('listening becomes an inactive draft', () => {
  it('flags listening rows (non audio_response) as draft and inactive', () => {
    const m = mapImportRow({ tipo: 'opcion multiple', competencia: 'comprension auditiva', nivel: 'A2', pregunta: 'What did he buy?', opciones: 'milk|bread', respuesta_correcta: 'milk' });
    expect(m.draft).toBe(true);
    expect(m.data?.isActive).toBe(false);
    expect(problemsOf(m)).toEqual([]);
  });

  it('other competencies stay active', () => {
    expect(mapImportRow({ ...base, tipo: 'ensayo', competencia: 'escritura' }).draft).toBe(false);
  });
});

describe('rowsFromCells', () => {
  it('keeps real row numbers and skips empty rows', () => {
    const { rows, missing } = rowsFromCells([
      ['Tipo', 'Competencia', 'Nivel', 'Pregunta'],
      ['ensayo', 'escritura', 'B1', 'a'],
      ['', '', '', ''],
      [' ', '', '', ''],
      ['ensayo', 'escritura', 'B1', 'b'],
    ]);
    expect(missing).toEqual([]);
    expect(rows.map((r) => r.row)).toEqual([2, 5]);
  });

  it('reports missing required columns', () => {
    expect(rowsFromCells([['tipo', 'nivel'], ['x', 'y']]).missing).toEqual(['competencia', 'pregunta']);
  });
});

describe('generated template', () => {
  const buffer = new ImportService().generateExcelTemplate();
  const workbook = XLSX.read(buffer, { type: 'buffer' });

  it('has the Preguntas and Instrucciones sheets', () => {
    expect(workbook.SheetNames).toEqual(['Preguntas', 'Instrucciones']);
    const instructions = XLSX.utils.sheet_to_json<string[]>(workbook.Sheets['Instrucciones']!, { header: 1 }).flat().join('\n');
    for (const column of IMPORT_COLUMNS) expect(instructions).toContain(column);
    expect(instructions).toMatch(/BORRADOR/);
    expect(instructions).toMatch(/FORMATOS VÁLIDOS POR COMPETENCIA/);
  });

  it('round-trips: every example row maps to a valid question', () => {
    const cells = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets['Preguntas']!, { header: 1, defval: '', blankrows: true, raw: true });
    const { rows, missing } = rowsFromCells(cells);
    expect(missing).toEqual([]);
    expect(rows).toHaveLength(TEMPLATE_EXAMPLES.length);
    for (const { row, values } of rows) {
      const mapped = mapImportRow(values);
      expect({ row, problems: problemsOf(mapped) }).toEqual({ row, problems: [] });
      expect(mapped.draft).toBe(false);
    }
  });

  it('covers every format', () => {
    const types = new Set(TEMPLATE_EXAMPLES.map((r) => mapImportRow(r).data?.type));
    expect([...types].sort()).toEqual(
      ['audio_response', 'drag_drop', 'essay', 'fill_blanks', 'matching', 'multiple_choice', 'open_text', 'ordering', 'true_false']
    );
  });
});

describe('ImportService.processCells', () => {
  it('counts imported, drafts and failures with spreadsheet row numbers', async () => {
    const service = new ImportService();
    const created: unknown[] = [];
    (service as unknown as { questionService: { create: (d: unknown) => Promise<void> } }).questionService = {
      create: async (data: any) => {
        if (data.content.question === 'boom') throw new Error('La pregunta ya existe');
        created.push(data);
      },
    };
    const result = await service.processCells(
      [
        ['tipo', 'competencia', 'nivel', 'pregunta', 'opciones', 'respuesta_correcta'],
        ['ensayo', 'escritura', 'B1', 'ok'],
        ['', '', '', ''],
        ['opcion multiple', 'comprension auditiva', 'A2', 'listen', 'a|b', 'a'],
        ['ensayo', 'escritura', 'B1', 'boom'],
        ['ensayo', 'escritura', 'Z9', 'bad level'],
      ],
      '507f1f77bcf86cd799439011'
    );
    expect(result).toEqual({
      total: 4, imported: 1, drafts: 1, draftRows: [4], failed: 2,
      errors: [{ row: 5, message: 'La pregunta ya existe' }, { row: 6, message: expect.stringMatching(/Nivel/) }],
    });
    expect(created).toHaveLength(2);
  });

  it('rejects files without the required columns', async () => {
    await expect(new ImportService().processCells([['a', 'b'], ['1', '2']], 'u')).rejects.toThrow(/Faltan columnas/);
  });
});
