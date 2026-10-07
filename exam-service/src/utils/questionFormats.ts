/**
 * Which question formats actually measure each MCER competency (construct validity).
 *
 * - Reading / listening are comprehension: the student shows understanding of a
 *   text or recording by choosing, matching, ordering, completing notes or
 *   answering briefly (the task families of Cambridge A2 Key / B1 Preliminary).
 *   Writing an essay or building a sentence does not measure comprehension.
 * - Writing / speaking are production: the student must produce language.
 *   Choosing or ordering given words is recognition, not written production.
 * - Grammar: form in context — choose or supply the form, build the word order,
 *   judge a sentence, or match sentence halves.
 * - Vocabulary: meaning, collocation and word choice — choose, match, supply or
 *   judge a word. Word order (sentence builder) tests grammar, not vocabulary.
 *
 * The frontend mirrors this table in academic.constants.ts (QUESTION_FORMATS_BY_COMPETENCY)
 * and the generator in grading-service; keep the three in step.
 */
export const QUESTION_FORMATS_BY_COMPETENCY: Record<string, readonly string[]> = {
  reading: ['multiple_choice', 'true_false', 'matching', 'ordering', 'fill_blanks', 'open_text'],
  listening: ['multiple_choice', 'true_false', 'matching', 'ordering', 'fill_blanks', 'open_text'],
  writing: ['essay', 'open_text'],
  speaking: ['audio_response'],
  grammar: ['multiple_choice', 'fill_blanks', 'drag_drop', 'true_false', 'matching'],
  vocabulary: ['multiple_choice', 'matching', 'fill_blanks', 'true_false'],
};

const TYPE_LABEL: Record<string, string> = {
  multiple_choice: 'Opción múltiple', true_false: 'Verdadero/Falso', fill_blanks: 'Completar espacios',
  matching: 'Emparejar', ordering: 'Ordenar', drag_drop: 'Construir oración', open_text: 'Respuesta corta',
  essay: 'Ensayo', audio_response: 'Respuesta oral', file_upload: 'Subir archivo',
};
const COMPETENCY_LABEL: Record<string, string> = {
  reading: 'Comprensión lectora', listening: 'Comprensión auditiva', writing: 'Expresión escrita',
  speaking: 'Expresión oral', grammar: 'Gramática', vocabulary: 'Vocabulario',
};

/** Spanish explanation when a format does not measure the competency, else null. */
export function formatMismatch(type?: string, competency?: string): string | null {
  if (!type || !competency) return null;
  const allowed = QUESTION_FORMATS_BY_COMPETENCY[competency];
  if (!allowed || allowed.includes(type)) return null;
  return (
    `"${TYPE_LABEL[type] ?? type}" no evalúa ${COMPETENCY_LABEL[competency] ?? competency}. ` +
    `Formatos válidos: ${allowed.map((t) => TYPE_LABEL[t] ?? t).join(', ')}.`
  );
}

/** Ordering / sentence-builder items saved without positions are in answer order. */
export function withDefaultPositions(type?: string, content?: any): any {
  if ((type !== 'ordering' && type !== 'drag_drop') || !Array.isArray(content?.items)) return content;
  if (content.items.some((i: any) => i?.correctPosition !== undefined && i?.correctPosition !== null)) return content;
  return { ...content, items: content.items.map((i: any, idx: number) => ({ ...i, correctPosition: idx + 1 })) };
}

/**
 * Answer-key problems that would make a question impossible to grade fairly
 * (every student would get 0, or several answers would be right). Spanish, for the teacher.
 */
export function answerKeyProblems(type?: string, content?: any): string[] {
  const problems: string[] = [];
  const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const distinct = (vs: string[]) => new Set(vs.map((v) => v.toLowerCase())).size === vs.length;
  const options: any[] = Array.isArray(content?.options) ? content.options : [];
  const items: any[] = Array.isArray(content?.items) ? content.items : [];

  switch (type) {
    case 'multiple_choice': {
      if (options.some((o) => !text(o?.text) && !o?.mediaUrl)) problems.push('Hay opciones vacías');
      if (!options.some((o) => o?.isCorrect)) problems.push('Marca al menos una opción correcta');
      if (!distinct(options.map((o) => text(o?.text)).filter(Boolean))) problems.push('Hay opciones repetidas');
      break;
    }
    case 'true_false':
      if (options.filter((o) => o?.isCorrect).length !== 1) problems.push('Indica si la afirmación es verdadera o falsa');
      break;
    case 'fill_blanks': {
      const gaps = (text(content?.template).match(/___/g) ?? []).length;
      const blanks: any[] = Array.isArray(content?.blanks) ? content.blanks : [];
      const fromKey = Array.isArray(content?.correctAnswer) ? content.correctAnswer.length : 0;
      const answers = blanks.length || fromKey;
      if (gaps && answers !== gaps) problems.push(`La plantilla tiene ${gaps} espacios y ${answers} respuestas`);
      if (blanks.some((b) => !(b?.correctAnswers ?? []).some((a: unknown) => text(a)))) problems.push('Algún espacio no tiene respuesta');
      break;
    }
    case 'matching': {
      if (items.some((i) => !text(i?.matchingPair))) problems.push('Cada elemento necesita su pareja');
      const pairs = items.map((i) => text(i?.matchingPair)).filter(Boolean);
      if (!distinct(pairs)) problems.push('Las parejas deben ser distintas (una sola respuesta por fila)');
      break;
    }
    case 'ordering':
    case 'drag_drop': {
      const positions = items.map((i) => Number(i?.correctPosition));
      const ok = positions.every(Number.isInteger) && [...positions].sort((a, b) => a - b).every((p, i) => p === i + 1);
      if (!ok) problems.push('Las posiciones correctas deben ir de 1 a ' + items.length + ' sin repetirse');
      if (!distinct(items.map((i) => text(i?.content)).filter(Boolean))) problems.push('Hay piezas repetidas: más de un orden sería correcto');
      break;
    }
  }
  return problems;
}
