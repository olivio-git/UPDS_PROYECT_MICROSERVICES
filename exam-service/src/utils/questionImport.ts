import type { IQuestion } from '../models/question.model';
import { QUESTION_FORMATS_BY_COMPETENCY } from './questionFormats';

/**
 * Spreadsheet row -> question payload, kept free of I/O so it can be tested on its own.
 * The payload is then validated by QuestionService.create, the same code path as the form,
 * so format / answer-key rules live in one place only.
 */

export const IMPORT_COLUMNS = [
  'tipo', 'competencia', 'nivel', 'dificultad', 'pregunta', 'instrucciones', 'texto_lectura',
  'opciones', 'respuesta_correcta', 'pares', 'elementos', 'puntos', 'tiempo_estimado', 'tema', 'etiquetas',
] as const;
export type ImportColumn = (typeof IMPORT_COLUMNS)[number];
export const REQUIRED_COLUMNS: readonly ImportColumn[] = ['tipo', 'competencia', 'nivel', 'pregunta'];

export const MAX_IMPORT_ROWS = 500;

/** Lowercase, no accents, every run of non-alphanumerics becomes one space. */
export function fold(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const HEADER_ALIASES: Record<ImportColumn, string[]> = {
  tipo: ['tipo', 'type', 'formato', 'tipo de pregunta'],
  competencia: ['competencia', 'competency', 'habilidad'],
  nivel: ['nivel', 'level'],
  dificultad: ['dificultad', 'difficulty'],
  pregunta: ['pregunta', 'enunciado', 'question'],
  instrucciones: ['instrucciones', 'instructions', 'consigna'],
  texto_lectura: ['texto lectura', 'texto', 'lectura', 'passage', 'context', 'contexto', 'transcripcion'],
  opciones: ['opciones', 'options'],
  respuesta_correcta: ['respuesta correcta', 'respuesta', 'correct answer', 'answer', 'correctanswer'],
  pares: ['pares', 'parejas', 'pairs'],
  elementos: ['elementos', 'items', 'piezas'],
  puntos: ['puntos', 'points', 'puntaje'],
  tiempo_estimado: ['tiempo estimado', 'tiempo', 'estimated time', 'estimatedtime', 'segundos'],
  tema: ['tema', 'topic'],
  etiquetas: ['etiquetas', 'tags'],
};

const HEADER_LOOKUP = new Map<string, ImportColumn>();
for (const [column, aliases] of Object.entries(HEADER_ALIASES) as Array<[ImportColumn, string[]]>) {
  for (const alias of aliases) HEADER_LOOKUP.set(fold(alias), column);
  HEADER_LOOKUP.set(fold(column), column);
}
// "correctAnswer" folds to "correctanswer" (camelCase has no separator).
HEADER_LOOKUP.set('correctanswer', 'respuesta_correcta');
HEADER_LOOKUP.set('estimatedtime', 'tiempo_estimado');

export function canonicalHeader(header: unknown): ImportColumn | null {
  return HEADER_LOOKUP.get(fold(header)) ?? null;
}

const TYPE_ALIASES: Record<string, string[]> = {
  multiple_choice: ['multiple choice', 'opcion multiple', 'seleccion multiple', 'mc', 'alternativas'],
  true_false: ['true false', 'verdadero falso', 'tf', 'v f', 'vf'],
  fill_blanks: ['fill blanks', 'fill in the blanks', 'completar espacios', 'completar', 'rellenar espacios', 'espacios en blanco'],
  matching: ['matching', 'emparejar', 'relacionar', 'unir'],
  ordering: ['ordering', 'ordenar', 'ordenar elementos'],
  drag_drop: ['drag drop', 'drag and drop', 'construir oracion', 'arrastrar y soltar', 'arrastrar soltar', 'ordenar palabras'],
  open_text: ['open text', 'respuesta corta', 'texto abierto', 'respuesta abierta'],
  essay: ['essay', 'ensayo', 'redaccion', 'composicion'],
  audio_response: ['audio response', 'respuesta oral', 'respuesta de audio', 'audio'],
};

const COMPETENCY_ALIASES: Record<string, string[]> = {
  reading: ['reading', 'lectura', 'comprension lectora', 'comprension de lectura'],
  listening: ['listening', 'comprension auditiva', 'escucha', 'auditiva', 'comprension oral'],
  writing: ['writing', 'escritura', 'expresion escrita', 'redaccion'],
  speaking: ['speaking', 'expresion oral', 'oral', 'habla'],
  grammar: ['grammar', 'gramatica'],
  vocabulary: ['vocabulary', 'vocabulario'],
};

function buildLookup(table: Record<string, string[]>): Map<string, string> {
  const lookup = new Map<string, string>();
  for (const [code, aliases] of Object.entries(table)) {
    lookup.set(fold(code), code);
    for (const alias of aliases) lookup.set(fold(alias), code);
  }
  return lookup;
}
export const TYPE_LOOKUP = buildLookup(TYPE_ALIASES);
const COMPETENCY_LOOKUP = buildLookup(COMPETENCY_ALIASES);

export const TYPE_NAMES_ES: Record<string, string> = {
  multiple_choice: 'opcion multiple', true_false: 'verdadero falso', fill_blanks: 'completar espacios',
  matching: 'emparejar', ordering: 'ordenar', drag_drop: 'construir oracion', open_text: 'respuesta corta',
  essay: 'ensayo', audio_response: 'respuesta oral',
};
export const COMPETENCY_NAMES_ES: Record<string, string> = {
  reading: 'lectura', listening: 'comprension auditiva', writing: 'escritura',
  speaking: 'expresion oral', grammar: 'gramatica', vocabulary: 'vocabulario',
};

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export type ImportRow = Partial<Record<ImportColumn, string>>;

export type ImportedQuestion = Partial<IQuestion> & { content: IQuestion['content'] };

export interface MappedRow {
  /** Payload for QuestionService.create (createdBy is added by the caller). */
  data?: ImportedQuestion;
  /** Listening without audio: saved inactive so it cannot reach an exam until audio is attached. */
  draft?: boolean;
  error?: string;
}

const text = (value: string | undefined): string => (value ?? '').trim();
const splitList = (value: string | undefined, separator = '|'): string[] =>
  text(value).split(separator).map((part) => part.trim()).filter(Boolean);

function parseNumber(value: string | undefined): number | undefined {
  const raw = text(value).replace(',', '.');
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : NaN;
}

/** verdadero / falso (or true / false, v / f) -> boolean, null when unrecognised. */
function parseTruth(value: string | undefined): boolean | null {
  const v = fold(value);
  if (['verdadero', 'true', 'v', 'cierto', 'si', 'yes', '1'].includes(v)) return true;
  if (['falso', 'false', 'f', 'no', '0'].includes(v)) return false;
  return null;
}

const letterId = (index: number) => String.fromCharCode(65 + index);

function multipleChoice(row: ImportRow): { options: NonNullable<IQuestion['content']['options']> } | string {
  const texts = splitList(row.opciones);
  if (texts.length < 2) return 'Escribe al menos 2 opciones separadas por | en la columna "opciones"';
  const answers = splitList(row.respuesta_correcta);
  if (!answers.length) return 'Falta la columna "respuesta_correcta" (texto de la opción correcta o su letra: A, B, C…)';

  const correct = new Set<number>();
  for (const answer of answers) {
    let index = texts.findIndex((t) => fold(t) === fold(answer));
    if (index < 0 && /^[a-z]$/i.test(answer)) index = answer.toUpperCase().charCodeAt(0) - 65;
    if (index < 0 || index >= texts.length) return `La respuesta correcta "${answer}" no coincide con ninguna opción`;
    correct.add(index);
  }
  return { options: texts.map((t, i) => ({ id: letterId(i), text: t, isCorrect: correct.has(i) })) };
}

function trueFalse(row: ImportRow): { options: NonNullable<IQuestion['content']['options']> } | string {
  const truth = parseTruth(row.respuesta_correcta);
  if (truth === null) return 'En "respuesta_correcta" escribe verdadero o falso';
  return { options: [{ id: 'true', text: 'Verdadero', isCorrect: truth }, { id: 'false', text: 'Falso', isCorrect: !truth }] };
}

/** Maps one spreadsheet row. Pure: no database, no I/O. */
export function mapImportRow(row: ImportRow): MappedRow {
  const type = TYPE_LOOKUP.get(fold(row.tipo));
  if (!text(row.tipo)) return { error: 'Falta el tipo de pregunta (columna "tipo")' };
  if (!type) {
    return { error: `Tipo "${text(row.tipo)}" no reconocido. Usa: ${Object.values(TYPE_NAMES_ES).join(', ')}` };
  }

  if (!text(row.competencia)) return { error: 'Falta la competencia (columna "competencia")' };
  const competency = COMPETENCY_LOOKUP.get(fold(row.competencia));
  if (!competency) {
    return { error: `Competencia "${text(row.competencia)}" no reconocida. Usa: ${Object.values(COMPETENCY_NAMES_ES).join(', ')}` };
  }

  const level = text(row.nivel).toUpperCase();
  if (!level) return { error: 'Falta el nivel (columna "nivel")' };
  if (!LEVELS.includes(level)) return { error: `Nivel "${text(row.nivel)}" no válido. Usa A1, A2, B1, B2, C1 o C2` };

  const difficulty = parseNumber(row.dificultad) ?? 3;
  if (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 5) {
    return { error: `Dificultad "${text(row.dificultad)}" no válida. Usa un número entero del 1 al 5` };
  }

  const prompt = text(row.pregunta);
  if (!prompt) return { error: 'Falta la pregunta (columna "pregunta")' };

  const points = parseNumber(row.puntos);
  if (points !== undefined && (Number.isNaN(points) || points < 0)) return { error: `Puntos "${text(row.puntos)}" no válidos` };
  const estimatedTime = parseNumber(row.tiempo_estimado);
  if (estimatedTime !== undefined && (Number.isNaN(estimatedTime) || estimatedTime < 0)) {
    return { error: `Tiempo estimado "${text(row.tiempo_estimado)}" no válido (segundos)` };
  }

  const content: IQuestion['content'] = { question: prompt };
  if (text(row.instrucciones)) content.instructions = text(row.instrucciones);
  if (text(row.texto_lectura)) content.context = text(row.texto_lectura);

  switch (type) {
    case 'multiple_choice': {
      const result = multipleChoice(row);
      if (typeof result === 'string') return { error: result };
      content.options = result.options;
      break;
    }
    case 'true_false': {
      const result = trueFalse(row);
      if (typeof result === 'string') return { error: result };
      content.options = result.options;
      break;
    }
    case 'fill_blanks': {
      // The editor keeps the instruction in "question" and the sentence with the gaps in "template".
      if (!prompt.includes('___')) return { error: 'En "pregunta" escribe la oración con ___ (tres guiones bajos) en cada espacio' };
      const perBlank = splitList(row.respuesta_correcta).map((cell) => splitList(cell, '/'));
      if (!perBlank.length) return { error: 'Falta "respuesta_correcta": una respuesta por espacio, separadas por |' };
      content.template = prompt;
      content.question = text(row.instrucciones) || 'Completa los espacios.';
      content.blanks = perBlank.map((answers, position) => ({ position, correctAnswers: answers, caseSensitive: false }));
      content.correctAnswer = perBlank.map((answers) => answers[0] ?? '');
      break;
    }
    case 'matching': {
      const pairs = splitList(row.pares);
      if (pairs.length < 2) return { error: 'Escribe al menos 2 parejas en "pares", con el formato izquierda=derecha separadas por |' };
      const items: NonNullable<IQuestion['content']['items']> = [];
      for (const [i, pair] of pairs.entries()) {
        const cut = pair.indexOf('=');
        const left = cut > 0 ? pair.slice(0, cut).trim() : '';
        const right = cut > 0 ? pair.slice(cut + 1).trim() : '';
        if (!left || !right) return { error: `Pareja "${pair}" no válida: usa izquierda=derecha` };
        items.push({ id: `p${i + 1}`, content: left, matchingPair: right });
      }
      content.items = items;
      break;
    }
    case 'ordering':
    case 'drag_drop': {
      let pieces = splitList(row.elementos);
      // Sentence builder: a whole sentence in one cell is split into its words.
      if (type === 'drag_drop' && pieces.length === 1) pieces = (pieces[0] ?? '').split(/\s+/).filter(Boolean);
      const min = type === 'ordering' ? 3 : 2;
      if (pieces.length < min) return { error: `Escribe al menos ${min} elementos en "elementos", en el orden correcto y separados por |` };
      content.items = pieces.map((piece, i) => ({ id: `e${i + 1}`, content: piece, correctPosition: i + 1 }));
      break;
    }
    case 'open_text':
    case 'essay':
      if (text(row.respuesta_correcta)) content.sampleAnswer = text(row.respuesta_correcta);
      break;
    case 'audio_response':
      content.expectedResponseType = 'sentence';
      break;
  }

  const tags = splitList(row.etiquetas, ',');
  const data: ImportedQuestion = {
    type: type as IQuestion['type'],
    competency: competency as IQuestion['competency'],
    level: level as IQuestion['level'],
    difficulty,
    content,
    metadata: {
      points: points ?? 1,
      estimatedTime: estimatedTime ?? 60,
      ...(text(row.tema) ? { topic: text(row.tema) } : {}),
      ...(tags.length ? { tags } : {}),
    },
    isActive: true,
  };

  // Listening needs a recording a spreadsheet cannot carry: keep the row as an inactive draft.
  const draft = competency === 'listening' && type !== 'audio_response';
  if (draft) data.isActive = false;
  return { data, draft };
}

/** Turns a header row + data rows (arrays of cells) into keyed rows, skipping fully empty ones. */
export function rowsFromCells(cells: unknown[][]): { rows: Array<{ row: number; values: ImportRow }>; missing: ImportColumn[] } {
  const header = (cells[0] ?? []).map(canonicalHeader);
  const missing = REQUIRED_COLUMNS.filter((column) => !header.includes(column));
  const rows: Array<{ row: number; values: ImportRow }> = [];
  for (let i = 1; i < cells.length; i++) {
    const line = cells[i] ?? [];
    const values: ImportRow = {};
    let any = false;
    header.forEach((column, c) => {
      const raw = line[c];
      const cell = raw === undefined || raw === null ? '' : String(raw).trim();
      if (cell) any = true;
      if (column && cell) values[column] = cell;
    });
    if (any) rows.push({ row: i + 1, values });
  }
  return { rows, missing };
}

// ───────────────────────────── Template ─────────────────────────────

export const TEMPLATE_EXAMPLES: ImportRow[] = [
  { tipo: 'opcion multiple', competencia: 'gramatica', nivel: 'A2', dificultad: '2', pregunta: 'Choose the correct form: She ___ to school yesterday.', opciones: 'went|go|gone', respuesta_correcta: 'went', puntos: '1', tiempo_estimado: '45', tema: 'Past simple', etiquetas: 'past,irregular verbs' },
  { tipo: 'opcion multiple', competencia: 'lectura', nivel: 'B1', dificultad: '3', pregunta: 'Why did Tom miss the bus?', texto_lectura: 'Tom woke up late because his alarm did not ring. He ran to the stop, but the bus had already left.', opciones: 'He woke up late|He was ill|The bus was cancelled', respuesta_correcta: 'B', tema: 'Daily routines' },
  { tipo: 'verdadero falso', competencia: 'vocabulario', nivel: 'A1', dificultad: '1', pregunta: '"Dog" means "perro" in Spanish.', respuesta_correcta: 'verdadero' },
  { tipo: 'completar espacios', competencia: 'gramatica', nivel: 'A1', dificultad: '1', pregunta: 'I ___ a student and my parents ___ teachers.', instrucciones: 'Completa con am, is o are.', respuesta_correcta: 'am|are', tema: 'Verb to be' },
  { tipo: 'emparejar', competencia: 'vocabulario', nivel: 'A1', dificultad: '1', pregunta: 'Relaciona cada palabra con su significado.', pares: 'dog=perro|cat=gato|house=casa' },
  { tipo: 'ordenar', competencia: 'lectura', nivel: 'A2', dificultad: '2', pregunta: 'Ordena las acciones de la rutina de Ana.', elementos: 'Wake up|Have breakfast|Go to work|Come back home' },
  { tipo: 'construir oracion', competencia: 'gramatica', nivel: 'A2', dificultad: '2', pregunta: 'Ordena las palabras para formar una oración.', elementos: 'She|is|reading|a|book' },
  { tipo: 'respuesta corta', competencia: 'lectura', nivel: 'B1', dificultad: '3', pregunta: 'Where did Tom run to?', texto_lectura: 'Tom woke up late because his alarm did not ring. He ran to the stop, but the bus had already left.', respuesta_correcta: 'To the bus stop' },
  { tipo: 'ensayo', competencia: 'escritura', nivel: 'B2', dificultad: '4', pregunta: 'Write an essay (150 words) about the advantages and disadvantages of social media.', puntos: '10', tiempo_estimado: '1800' },
  { tipo: 'respuesta oral', competencia: 'expresion oral', nivel: 'A2', dificultad: '2', pregunta: 'Introduce yourself: say your name, where you live and what you like to do.', puntos: '5', tiempo_estimado: '120' },
];

const COLUMN_HELP: Array<[ImportColumn, string, string, string]> = [
  ['tipo', 'Sí', 'Formato de la pregunta. Valores: opcion multiple, verdadero falso, completar espacios, emparejar, ordenar, construir oracion, respuesta corta, ensayo, respuesta oral.', 'opcion multiple'],
  ['competencia', 'Sí', 'Competencia que evalúa. Valores: lectura, comprension auditiva, escritura, expresion oral, gramatica, vocabulario. Ver la tabla de formatos válidos más abajo.', 'gramatica'],
  ['nivel', 'Sí', 'Nivel MCER: A1, A2, B1, B2, C1 o C2.', 'A2'],
  ['dificultad', 'No', 'Número entero del 1 (muy fácil) al 5 (muy difícil). Si se deja vacío: 3.', '2'],
  ['pregunta', 'Sí', 'Enunciado de la pregunta. En "completar espacios" es la oración con ___ (tres guiones bajos) en cada espacio.', 'She ___ to school yesterday.'],
  ['instrucciones', 'No', 'Consigna adicional para el estudiante.', 'Elige la opción correcta.'],
  ['texto_lectura', 'No', 'Texto de lectura o transcripción que acompaña a la pregunta.', 'Tom woke up late…'],
  ['opciones', 'Solo opción múltiple', 'Opciones separadas por |. Mínimo 2, sin repetir.', 'went|go|gone'],
  ['respuesta_correcta', 'Según el tipo', 'Opción múltiple: el texto de la opción correcta o su letra (A, B, C…); si hay varias correctas sepáralas con |. Verdadero falso: verdadero o falso. Completar espacios: una respuesta por espacio separadas por |, y alternativas válidas de un mismo espacio con /. Respuesta corta y ensayo: respuesta modelo (opcional).', 'went  |  am|are  |  goes/go'],
  ['pares', 'Solo emparejar', 'Parejas con el formato izquierda=derecha separadas por |. Mínimo 2, sin repetir la derecha.', 'dog=perro|cat=gato'],
  ['elementos', 'Solo ordenar y construir oración', 'Elementos en el orden CORRECTO separados por |; el estudiante los verá mezclados. Ordenar: mínimo 3. Construir oración: mínimo 2; también puedes escribir la oración completa y se separa por palabras.', 'Wake up|Have breakfast|Go to work'],
  ['puntos', 'No', 'Puntaje de la pregunta. Si se deja vacío: 1.', '1'],
  ['tiempo_estimado', 'No', 'Segundos estimados para responder. Si se deja vacío: 60.', '45'],
  ['tema', 'No', 'Tema gramatical o temático.', 'Past simple'],
  ['etiquetas', 'No', 'Etiquetas separadas por coma.', 'past,irregular verbs'],
];

/** Rows of the "Instrucciones" sheet (array of arrays). */
export function buildInstructionRows(): string[][] {
  const typeNames = (types: readonly string[]) => types.map((t) => TYPE_NAMES_ES[t] ?? t).join(', ');
  const rows: string[][] = [
    ['PLANTILLA DE IMPORTACIÓN DE PREGUNTAS'],
    ['Llena la hoja "Preguntas" (una pregunta por fila), borra las filas de ejemplo y sube el archivo con el botón "Importar". No cambies los nombres de la primera fila.'],
    ['Las preguntas sin audio ni imágenes son válidas. El sistema revisa cada fila con las mismas reglas del formulario y te dice qué fila falló y por qué.'],
    [],
    ['COLUMNAS'],
    ['Columna', '¿Obligatoria?', 'Qué escribir', 'Ejemplo'],
    ...COLUMN_HELP.map(([column, required, help, example]) => [column, required, help, example]),
    [],
    ['FORMATOS VÁLIDOS POR COMPETENCIA'],
    ['Competencia', 'Formatos permitidos'],
    ...Object.entries(QUESTION_FORMATS_BY_COMPETENCY).map(([competency, types]) => [COMPETENCY_NAMES_ES[competency] ?? competency, typeNames(types)]),
    [],
    ['NOTAS'],
    ['Mayúsculas y tildes no importan ("Gramática" = "gramatica"). También se aceptan los códigos en inglés (multiple_choice, grammar…).'],
    ['Comprensión auditiva: el audio no se puede subir desde Excel. Esas filas se importan como BORRADOR (inactivas, con el aviso "falta audio"). Edita la pregunta, sube el audio y actívala; sin audio no se puede activar ni entra en ningún examen.'],
    ['Las filas completamente vacías se ignoran. Máximo ' + MAX_IMPORT_ROWS + ' filas por archivo.'],
    ['También puedes importar un archivo .csv con las mismas columnas.'],
  ];
  return rows;
}
