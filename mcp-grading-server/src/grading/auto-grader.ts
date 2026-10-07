import type { IQuestion, AutoGradeResult } from '../types/index.js';

/**
 * Unified deterministic grading for auto-gradable question types.
 * This is the single source of truth - replaces the 3 conflicting
 * implementations in exam-service (GradingService, QuestionEvaluationService, ExamEvaluationService).
 */
// ── Shared helpers ────────────────────────────────────────────────────────────

/** Credit for a fraction of the question, to 2 decimals (never rounded down to 0). */
const credit = (maxScore: number, fraction: number) => Math.round(maxScore * Math.max(0, Math.min(1, fraction)) * 100) / 100;

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

/**
 * Typed answers as students really write them: phone keyboards insert curly
 * apostrophes, people add a full stop or a double space. None of that should
 * turn a right answer into a wrong one.
 */
export function normalizeTypedAnswer(value: unknown, caseSensitive = false): string {
  const text = String(value ?? '')
    .normalize('NFKC')
    .replace(/[\u2018\u2019\u02BC\u0060\u00B4]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.!?,;:]+$/, '')
    .trim();
  return caseSensitive ? text : text.toLowerCase();
}

/** Length of the longest subsequence of `user` that keeps the correct order. */
function longestOrderedSubset(user: string[], correct: string[]): number {
  const rank = new Map(correct.map((id, i) => [id, i]));
  const ranks = user.map((id) => rank.get(id)).filter((r): r is number => r !== undefined);
  // Longest increasing subsequence, O(n log n).
  const tails: number[] = [];
  for (const r of ranks) {
    let lo = 0;
    let hi = tails.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (tails[mid]! < r) lo = mid + 1;
      else hi = mid;
    }
    tails[lo] = r;
  }
  return tails.length;
}

/**
 * Sequence credit ("longest ordered subset", as in Moodle's ordering question):
 * the share of items already in the right relative order. Moving one word to the
 * wrong place costs one item, not the whole answer. A single item in order earns nothing.
 */
function sequenceGrade(userOrder: string[], correctOrder: string[], maxScore: number, label: string): AutoGradeResult {
  const total = correctOrder.length;
  const exact = total > 0 && userOrder.length === total && userOrder.every((id, i) => id === correctOrder[i]);
  if (exact) return { isCorrect: true, score: maxScore, maxScore, feedback: 'Orden correcto' };
  const inOrder = longestOrderedSubset([...new Set(userOrder)], correctOrder);
  const fraction = total > 0 && inOrder >= 2 ? inOrder / total : 0;
  return { isCorrect: false, score: credit(maxScore, fraction), maxScore, feedback: `${inOrder}/${total} ${label} en orden` };
}

export function autoGrade(question: IQuestion, response: any, maxScore?: number): AutoGradeResult {
  const points = maxScore ?? question.metadata?.points ?? 1;

  switch (question.type) {
    case 'multiple_choice':
      return gradeMultipleChoice(question, response, points);
    case 'true_false':
      return gradeTrueFalse(question, response, points);
    case 'fill_blanks':
      return gradeFillBlanks(question, response, points);
    case 'matching':
      return gradeMatching(question, response, points);
    case 'ordering':
      return gradeOrdering(question, response, points);
    case 'drag_drop':
      return gradeDragDrop(question, response, points);
    default:
      return { isCorrect: false, score: 0, maxScore: points, feedback: 'Tipo de pregunta no auto-calificable' };
  }
}

/**
 * Multiple Choice: compare response.selectedOptions vs options marked isCorrect.
 *
 * ID mismatch problem: QuestionRenderer sends `opt._id || opt.id` (prefers MongoDB ObjectId),
 * but the schema stores both `id` ("A","B"...) and potentially `_id` (ObjectId).
 * We build a lookup map that accepts either representation so the comparison is format-agnostic.
 */
function gradeMultipleChoice(question: IQuestion, response: any, maxScore: number): AutoGradeResult {
  const options = question.content.options || [];
  const expectedCorrectCount = options.filter(o => o.isCorrect).length;

  if (expectedCorrectCount === 0) {
    return { isCorrect: false, score: 0, maxScore, feedback: 'Pregunta sin respuesta correcta definida' };
  }

  // Map every known ID string (both id and _id) → whether that option is correct
  const idToCorrect = new Map<string, boolean>();
  for (const opt of options) {
    const correct = !!opt.isCorrect;
    if (opt.id != null)           idToCorrect.set(String(opt.id), correct);
    if ((opt as any)._id != null) idToCorrect.set(String((opt as any)._id), correct);
  }

  // Frontend sends { selectedOptions: string[] }
  const selected: string[] = [...new Set(asArray(asRecord(response).selectedOptions).map(String))];

  const correctCount = selected.filter(sel => idToCorrect.get(sel) === true).length;
  const wrongCount   = selected.filter(sel => idToCorrect.get(sel) === false).length;
  // Selections that don't match any known option ID are treated as wrong
  const unknownCount = selected.filter(sel => !idToCorrect.has(sel)).length;

  const isCorrect = correctCount === expectedCorrectCount && wrongCount === 0 && unknownCount === 0;

  if (isCorrect) {
    return { isCorrect: true, score: maxScore, maxScore, feedback: 'Correcto' };
  }

  // Partial credit: reward correct selections, penalise wrong ones
  const partialScore = credit(maxScore, (correctCount - wrongCount - unknownCount) / expectedCorrectCount);

  return {
    isCorrect: false,
    score: partialScore,
    maxScore,
    feedback: `${correctCount}/${expectedCorrectCount} opciones correctas`,
  };
}

/**
 * True/False: normalize both to boolean, then compare.
 * Frontend sends { answer: boolean } but could also be string "true"/"false".
 * Question stores correctness in options[].isCorrect.
 */
function gradeTrueFalse(question: IQuestion, response: any, maxScore: number): AutoGradeResult {
  const options = question.content.options || [];

  // Find which option is correct
  const correctOption = options.find(o => o.isCorrect);
  if (!correctOption) {
    return { isCorrect: false, score: 0, maxScore, feedback: 'Pregunta sin respuesta correcta definida' };
  }

  // The correct answer is: is the "true" option the correct one?
  // Check both id ("true"/"false") and text ("True"/"False"/"Verdadero"/"Falso")
  const correctAnswer =
    correctOption.id?.toLowerCase() === 'true' ||
    correctOption.text?.toLowerCase() === 'true' ||
    correctOption.text?.toLowerCase() === 'verdadero';

  // Normalize user answer to boolean
  const userRaw = asRecord(response).answer;
  const word = typeof userRaw === 'string' ? userRaw.trim().toLowerCase() : '';
  let userAnswer: boolean;
  if (typeof userRaw === 'boolean') {
    userAnswer = userRaw;
  } else if (word === 'true' || word === 'verdadero') {
    userAnswer = true;
  } else if (word === 'false' || word === 'falso') {
    userAnswer = false;
  } else {
    return { isCorrect: false, score: 0, maxScore, feedback: 'No se proporcionó respuesta' };
  }

  const isCorrect = userAnswer === correctAnswer;
  return {
    isCorrect,
    score: isCorrect ? maxScore : 0,
    maxScore,
    feedback: isCorrect ? 'Correcto' : 'Incorrecto',
  };
}

/**
 * Fill Blanks: supports two storage formats from the question model.
 * Format A: question.content.blanks[] with { correctAnswers, caseSensitive }
 * Format B: question.content.correctAnswer as string[]
 * Frontend sends { blanks: string[] }
 */
function gradeFillBlanks(question: IQuestion, response: any, maxScore: number): AutoGradeResult {
  const userBlanks = asArray(asRecord(response).blanks).map((b) => (typeof b === 'string' ? b : ''));

  // Format A: structured blanks with metadata
  if (question.content.blanks && question.content.blanks.length > 0) {
    const blanks = question.content.blanks;
    let correctCount = 0;

    for (let i = 0; i < blanks.length; i++) {
      const blank = blanks[i];
      const userAnswer = userBlanks[i] || '';
      const caseSensitive = blank.caseSensitive ?? false;

      const typed = normalizeTypedAnswer(userAnswer, caseSensitive);
      const isMatch = typed !== '' && (blank.correctAnswers ?? []).some((correct) => normalizeTypedAnswer(correct, caseSensitive) === typed);
      if (isMatch) correctCount++;
    }

    const total = blanks.length;
    const score = credit(maxScore, total > 0 ? correctCount / total : 0);

    return {
      isCorrect: correctCount === total,
      score,
      maxScore,
      feedback: `${correctCount}/${total} espacios correctos`,
    };
  }

  // Format B: simple correctAnswer array
  const correctAnswers = Array.isArray(question.content.correctAnswer)
    ? question.content.correctAnswer
    : [];

  let correctCount = 0;
  for (let i = 0; i < correctAnswers.length; i++) {
    const correct = normalizeTypedAnswer(correctAnswers[i]);
    const user = normalizeTypedAnswer(userBlanks[i]);
    if (user !== '' && user === correct) correctCount++;
  }

  const total = correctAnswers.length;
  const score = credit(maxScore, total > 0 ? correctCount / total : 0);

  return {
    isCorrect: correctCount === total,
    score,
    maxScore,
    feedback: `${correctCount}/${total} espacios correctos`,
  };
}

/**
 * Matching: compare user pairs with correct pairs from items[].matchingPair.
 * Frontend sends { pairs: { [itemId]: matchedValue } }
 * Question stores items[].matchingPair
 */
function gradeMatching(question: IQuestion, response: any, maxScore: number): AutoGradeResult {
  const items = question.content.items || [];
  const userPairs = asRecord(asRecord(response).pairs);

  if (items.length === 0) {
    return { isCorrect: false, score: 0, maxScore, feedback: 'Pregunta sin pares definidos' };
  }

  let correctCount = 0;
  for (const item of items) {
    if (!item.matchingPair) continue;
    const userMatch = userPairs[item.id];
    if (userMatch === item.matchingPair) {
      correctCount++;
    }
  }

  const total = items.filter(i => i.matchingPair).length;
  const score = credit(maxScore, total > 0 ? correctCount / total : 0);

  return {
    isCorrect: correctCount === total,
    score,
    maxScore,
    feedback: `${correctCount}/${total} parejas correctas`,
  };
}

/**
 * Ordering: compare user order with correct order from items[].correctPosition.
 * Frontend sends { order: string[] } (array of item IDs in user's order)
 * Question stores items[].correctPosition (number)
 */
function gradeOrdering(question: IQuestion, response: any, maxScore: number): AutoGradeResult {
  const items = question.content.items || [];
  const userOrder = asArray(asRecord(response).order).map(String);

  if (items.length === 0) {
    return { isCorrect: false, score: 0, maxScore, feedback: 'Pregunta sin orden definido' };
  }

  // Build correct order: sort items by correctPosition, extract IDs
  const correctOrder = [...items]
    .filter(i => i.correctPosition !== undefined)
    .sort((a, b) => (a.correctPosition ?? 0) - (b.correctPosition ?? 0))
    .map(i => i.id);

  return sequenceGrade(userOrder, correctOrder, maxScore, 'elementos');
}

/**
 * Drag & Drop: compare user positions with correct positions.
 * Frontend sends { positions: { [itemId]: zoneIndex } }
 * Question stores items[].correctPosition
 */
function gradeDragDrop(question: IQuestion, response: any, maxScore: number): AutoGradeResult {
  const items = question.content.items || [];
  const userPositions = asRecord(asRecord(response).positions);

  if (items.length === 0) {
    return { isCorrect: false, score: 0, maxScore, feedback: 'Pregunta sin posiciones definidas' };
  }

  // The sentence the student built: placed pieces sorted by their slot.
  const userOrder = Object.entries(userPositions)
    .filter(([, pos]) => typeof pos === 'number' && Number.isFinite(pos) && pos >= 1)
    .sort((a, b) => (a[1] as number) - (b[1] as number))
    .map(([id]) => id);
  const correctOrder = [...items]
    .filter(i => i.correctPosition !== undefined)
    .sort((a, b) => (a.correctPosition ?? 0) - (b.correctPosition ?? 0))
    .map(i => i.id);

  return sequenceGrade(userOrder, correctOrder, maxScore, 'piezas');
}
