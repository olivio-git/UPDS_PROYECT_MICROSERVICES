import type { IQuestion, QuestionType } from '../types/index.js';

type Content = IQuestion['content'];

export interface NormalizeResult {
  content: Content;
  /** Problems that make the question unusable or ungradable. Empty = valid. */
  problems: string[];
}

const clean = (s: unknown): string => (typeof s === 'string' ? s.trim() : '');
const lower = (s: unknown): string => clean(s).toLowerCase();

/** Fisher–Yates shuffle with an injectable random source (tests pass a seeded one). */
export function shuffled<T>(arr: readonly T[], random: () => number = Math.random): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const hasDuplicates = (values: string[]) => new Set(values.map((v) => v.toLowerCase())).size !== values.length;

/** LLMs write blanks as "____", "[blank]", "(1) ___" … — bring them all to `___`. */
export function normalizeBlankMarks(template: string): string {
  return template.replace(/\[\s*blank\s*\]|_{2,}/gi, '___');
}

function normalizeMultipleChoice(content: Content, random: () => number, problems: string[]): Content {
  const options = (content.options ?? [])
    .map((o) => ({ text: clean(o.text), isCorrect: o.isCorrect === true }))
    .filter((o) => o.text);
  if (options.length < 3) problems.push(`multiple_choice needs 4 options, got ${options.length}`);
  const correct = options.filter((o) => o.isCorrect).length;
  if (correct !== 1) problems.push(`multiple_choice needs exactly one correct option, got ${correct}`);
  if (hasDuplicates(options.map((o) => o.text))) problems.push('multiple_choice options must be distinct');

  // LLMs put the right answer first or second far more often than chance:
  // shuffle server-side, then relabel A, B, C, D in the new order.
  const relabeled = shuffled(options, random).map((o, i) => ({ id: String.fromCharCode(65 + i), ...o }));
  return {
    ...content,
    options: relabeled,
    correctAnswer: relabeled.find((o) => o.isCorrect)?.id,
  };
}

function normalizeTrueFalse(content: Content, problems: string[]): Content {
  const opts = content.options ?? [];
  const trueOpt = opts.find((o) => lower(o.id) === 'true' || ['true', 'verdadero'].includes(lower(o.text)));
  const falseOpt = opts.find((o) => lower(o.id) === 'false' || ['false', 'falso'].includes(lower(o.text)));
  let statementIsTrue: boolean | undefined;
  if (trueOpt && typeof trueOpt.isCorrect === 'boolean') statementIsTrue = trueOpt.isCorrect;
  else if (falseOpt && typeof falseOpt.isCorrect === 'boolean') statementIsTrue = !falseOpt.isCorrect;
  else if (typeof content.correctAnswer === 'string') statementIsTrue = ['true', 'verdadero'].includes(lower(content.correctAnswer));
  else if (opts[0] && typeof opts[0].isCorrect === 'boolean') statementIsTrue = opts[0].isCorrect;

  if (statementIsTrue === undefined) {
    problems.push('true_false must say whether the statement is true or false');
    statementIsTrue = true;
  }
  if (clean(content.question).endsWith('?')) problems.push('true_false "question" must be a statement, not a question');
  return {
    ...content,
    options: [
      { id: 'true', text: 'True', isCorrect: statementIsTrue },
      { id: 'false', text: 'False', isCorrect: !statementIsTrue },
    ],
    correctAnswer: statementIsTrue ? 'true' : 'false',
  };
}

function normalizeFillBlanks(content: Content, problems: string[]): Content {
  const template = normalizeBlankMarks(clean(content.template));
  const count = template.split('___').length - 1;
  if (count === 0) problems.push('fill_blanks template must contain at least one ___');

  // Prefer structured blanks, ordered by their position; fall back to correctAnswer[].
  let answers: string[][] = [...(content.blanks ?? [])]
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((b) => (b.correctAnswers ?? []).map(clean).filter(Boolean));
  if (!answers.length) {
    const raw = content.correctAnswer;
    const list = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(',') : [];
    answers = list.map((a) => [clean(a)].filter(Boolean));
  }
  if (answers.length !== count) problems.push(`fill_blanks has ${count} blanks in the template but ${answers.length} answers`);
  const missing = answers.slice(0, count).findIndex((a) => a.length === 0);
  if (missing !== -1) problems.push(`fill_blanks blank ${missing + 1} has no answer`);

  const blanks = Array.from({ length: count }, (_, i) => ({
    position: i,
    correctAnswers: answers[i] ?? [],
    caseSensitive: false,
  }));
  return { ...content, template, blanks, correctAnswer: blanks.map((b) => b.correctAnswers[0] ?? '') };
}

function normalizeMatching(content: Content, problems: string[]): Content {
  const items = (content.items ?? []).map((it, i) => ({
    id: `m${i + 1}`,
    content: clean(it.content),
    matchingPair: clean(it.matchingPair),
  }));
  if (items.length < 3) problems.push(`matching needs at least 3 pairs, got ${items.length}`);
  if (items.some((it) => !it.content || !it.matchingPair)) problems.push('every matching item needs content and matchingPair');
  if (hasDuplicates(items.map((it) => it.content))) problems.push('matching left-hand items must be distinct');
  if (hasDuplicates(items.map((it) => it.matchingPair))) problems.push('matching pairs must be distinct (one right answer per row)');
  return { ...content, items };
}

function normalizeSequence(type: QuestionType, content: Content, problems: string[]): Content {
  const raw = (content.items ?? []).filter((it) => clean(it.content));
  const n = raw.length;
  if (n < 3) problems.push(`${type} needs at least 3 items, got ${n}`);

  const positions = raw.map((it) => Number(it.correctPosition));
  const isPermutation =
    positions.every((p) => Number.isInteger(p)) &&
    [...positions].sort((a, b) => a - b).every((p, i) => p === i + 1);
  const allMissing = positions.every((p) => !Number.isFinite(p));
  if (!isPermutation && !allMissing) {
    problems.push(`${type} correctPosition values must be exactly 1..${n} with no gaps or repeats`);
  }
  if (hasDuplicates(raw.map((it) => clean(it.content)))) {
    problems.push(`${type} items must be distinct, otherwise more than one order is correct`);
  }

  // Store in answer order; the student client shuffles for display.
  const ordered = isPermutation ? [...raw].sort((a, b) => Number(a.correctPosition) - Number(b.correctPosition)) : raw;
  const prefix = type === 'drag_drop' ? 'd' : 'o';
  return {
    ...content,
    items: ordered.map((it, i) => ({ id: `${prefix}${i + 1}`, content: clean(it.content), correctPosition: i + 1 })),
  };
}

/**
 * Validate and normalise a generated question so it is gradable by
 * auto-grader.ts: ids, answer key shape, option shuffling, blank counts.
 */
export function normalizeGeneratedContent(
  type: QuestionType,
  content: Content,
  random: () => number = Math.random,
): NormalizeResult {
  const problems: string[] = [];
  if (!clean(content?.question)) problems.push('"question" is empty');
  const base: Content = { ...content, question: clean(content?.question) };

  let out: Content;
  switch (type) {
    case 'multiple_choice':
      out = normalizeMultipleChoice(base, random, problems);
      break;
    case 'true_false':
      out = normalizeTrueFalse(base, problems);
      break;
    case 'fill_blanks':
      out = normalizeFillBlanks(base, problems);
      break;
    case 'matching':
      out = normalizeMatching(base, problems);
      break;
    case 'ordering':
    case 'drag_drop':
      out = normalizeSequence(type, base, problems);
      break;
    case 'essay':
    case 'open_text':
      if (!clean(base.sampleAnswer)) problems.push(`${type} needs a sampleAnswer`);
      out = { ...base, options: undefined, items: undefined, template: undefined, blanks: undefined };
      break;
    case 'audio_response':
      out = { ...base, options: undefined, items: undefined, template: undefined, blanks: undefined };
      break;
    default:
      out = base;
  }

  // Drop undefined keys so the stored document stays tidy.
  for (const key of Object.keys(out) as Array<keyof Content>) if (out[key] === undefined) delete out[key];
  return { content: out, problems };
}
