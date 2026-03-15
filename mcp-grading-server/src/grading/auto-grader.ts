import type { IQuestion, AutoGradeResult } from '../types/index.js';

/**
 * Unified deterministic grading for auto-gradable question types.
 * This is the single source of truth - replaces the 3 conflicting
 * implementations in exam-service (GradingService, QuestionEvaluationService, ExamEvaluationService).
 */
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
  const selected: string[] = (response?.selectedOptions || []).map(String);

  const correctCount = selected.filter(sel => idToCorrect.get(sel) === true).length;
  const wrongCount   = selected.filter(sel => idToCorrect.get(sel) === false).length;
  // Selections that don't match any known option ID are treated as wrong
  const unknownCount = selected.filter(sel => !idToCorrect.has(sel)).length;

  const isCorrect = correctCount === expectedCorrectCount && wrongCount === 0 && unknownCount === 0;

  if (isCorrect) {
    return { isCorrect: true, score: maxScore, maxScore, feedback: 'Correcto' };
  }

  // Partial credit: reward correct selections, penalise wrong ones
  const partialScore = Math.max(
    0,
    Math.floor(maxScore * (correctCount - wrongCount) / expectedCorrectCount)
  );

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
  const userRaw = response?.answer;
  let userAnswer: boolean;
  if (typeof userRaw === 'boolean') {
    userAnswer = userRaw;
  } else if (typeof userRaw === 'string') {
    userAnswer = userRaw.toLowerCase() === 'true' || userRaw.toLowerCase() === 'verdadero';
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
  const userBlanks: string[] = response?.blanks || [];

  // Format A: structured blanks with metadata
  if (question.content.blanks && question.content.blanks.length > 0) {
    const blanks = question.content.blanks;
    let correctCount = 0;

    for (let i = 0; i < blanks.length; i++) {
      const blank = blanks[i];
      const userAnswer = userBlanks[i] || '';
      const caseSensitive = blank.caseSensitive ?? false;

      const isMatch = blank.correctAnswers.some(correct =>
        caseSensitive
          ? userAnswer.trim() === correct.trim()
          : userAnswer.trim().toLowerCase() === correct.trim().toLowerCase()
      );
      if (isMatch) correctCount++;
    }

    const total = blanks.length;
    const percentage = total > 0 ? correctCount / total : 0;
    const score = Math.floor(maxScore * percentage);

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
    const correct = String(correctAnswers[i]).trim().toLowerCase();
    const user = (userBlanks[i] || '').trim().toLowerCase();
    if (user === correct) correctCount++;
  }

  const total = correctAnswers.length;
  const percentage = total > 0 ? correctCount / total : 0;
  const score = Math.floor(maxScore * percentage);

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
  const userPairs: Record<string, string> = response?.pairs || {};

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
  const percentage = total > 0 ? correctCount / total : 0;
  const score = Math.floor(maxScore * percentage);

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
  const userOrder: string[] = response?.order || [];

  if (items.length === 0) {
    return { isCorrect: false, score: 0, maxScore, feedback: 'Pregunta sin orden definido' };
  }

  // Build correct order: sort items by correctPosition, extract IDs
  const correctOrder = [...items]
    .filter(i => i.correctPosition !== undefined)
    .sort((a, b) => (a.correctPosition ?? 0) - (b.correctPosition ?? 0))
    .map(i => i.id);

  let correctCount = 0;
  for (let i = 0; i < correctOrder.length; i++) {
    if (userOrder[i] === correctOrder[i]) {
      correctCount++;
    }
  }

  const total = correctOrder.length;
  const isCorrect = correctCount === total;
  const percentage = total > 0 ? correctCount / total : 0;
  const score = Math.floor(maxScore * percentage);

  return {
    isCorrect,
    score,
    maxScore,
    feedback: isCorrect ? 'Orden correcto' : `${correctCount}/${total} posiciones correctas`,
  };
}

/**
 * Drag & Drop: compare user positions with correct positions.
 * Frontend sends { positions: { [itemId]: zoneIndex } }
 * Question stores items[].correctPosition
 */
function gradeDragDrop(question: IQuestion, response: any, maxScore: number): AutoGradeResult {
  const items = question.content.items || [];
  const userPositions: Record<string, number> = response?.positions || {};

  if (items.length === 0) {
    return { isCorrect: false, score: 0, maxScore, feedback: 'Pregunta sin posiciones definidas' };
  }

  let correctCount = 0;
  const itemsWithPosition = items.filter(i => i.correctPosition !== undefined);

  for (const item of itemsWithPosition) {
    const userPos = userPositions[item.id];
    if (userPos !== undefined && userPos === item.correctPosition) {
      correctCount++;
    }
  }

  const total = itemsWithPosition.length;
  const percentage = total > 0 ? correctCount / total : 0;
  const score = Math.floor(maxScore * percentage);

  return {
    isCorrect: correctCount === total,
    score,
    maxScore,
    feedback: `${correctCount}/${total} posiciones correctas`,
  };
}
