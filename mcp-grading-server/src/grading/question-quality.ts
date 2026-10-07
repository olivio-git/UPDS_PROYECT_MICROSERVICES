import type { Competency, IQuestion, Level, QuestionType } from '../types/index.js';
import { COVERAGE_TARGET, LEVELS, estimateLevel, type CefrLevel } from './cefr/cefr-level.js';

/**
 * Quality checks for AI-generated questions, beyond the structural ones in
 * question-validation.ts. Pure and deterministic so it can run on every
 * generation, in tests and in the offline evaluation script.
 *
 * - `block` issues make the question unfit (wrong language, answer given away,
 *   missing passage, duplicate of the bank): the generator asks the model to fix them.
 * - `warn` issues are test-design smells (level fit, longest-option bias…):
 *   the generator tries once to fix them and otherwise shows them to the teacher.
 */

type Content = IQuestion['content'];

export type QualitySeverity = 'block' | 'warn';

export interface QualityIssue {
  code: string;
  severity: QualitySeverity;
  /** English, sent back to the model when asking for a fix. */
  message: string;
  /** Spanish, shown to the teacher. */
  label: string;
}

export interface QualityReport {
  /** 0–100: 100 minus 25 per blocking issue and 8 per warning. */
  score: number;
  issues: QualityIssue[];
  /** CEFR level the text of the question asks for (CEFR-J vocabulary + grammar), for the teacher. */
  estimatedLevel?: CefrLevel;
}

export interface QualityInput {
  type: QuestionType;
  competency: Competency;
  level: Level;
}

export interface QualityOptions {
  /** Signatures (see questionSignature) of questions already in the bank or batch. */
  existing?: string[];
  /** Leave the passage out of the comparison (several questions about one shared audio transcript). */
  ignoreContext?: boolean;
}

/** Text profile per CEFR level: sentence length, share of long words, passage and model-answer size. */
export const LEVEL_PROFILE: Record<Level, { maxAvgSentence: number; passage: [number, number]; writing: [number, number] }> = {
  A1: { maxAvgSentence: 10, passage: [20, 80], writing: [25, 70] },
  A2: { maxAvgSentence: 13, passage: [35, 120], writing: [35, 100] },
  B1: { maxAvgSentence: 17, passage: [70, 200], writing: [70, 160] },
  B2: { maxAvgSentence: 22, passage: [110, 280], writing: [120, 220] },
  C1: { maxAvgSentence: 28, passage: [150, 380], writing: [160, 300] },
  C2: { maxAvgSentence: 35, passage: [150, 450], writing: [180, 400] },
};

/** Index of a level in the A1..C1 scale used by the estimator (C2 counts as C1). */
const levelIndex = (level: Level) => (level === 'C2' ? 4 : LEVELS.indexOf(level));
/** The estimator's scale stops at C1; C2 targets are compared as C1. */
const asCefr = (level: Level): CefrLevel => (level === 'C2' ? 'C1' : level);
const listWords = (ws: Array<{ word: string; level: string }>, max = 8) =>
  ws.slice(0, max).map((w) => `${w.word} (${w.level})`).join(', ');

const STOPWORDS = new Set(
  ('a an the and or but if of to in on at by for with from as is are was were be been being am do does did have has had ' +
    'i you he she it we they me him her us them my your his its our their this that these those there here what which who ' +
    'whom whose when where why how not no yes so than then too very can could will would shall should may might must ' +
    'about into over after before up down out off again all any each few more most other some such only own same just')
    .split(' '),
);

const SPANISH = new Set(
  ('el la los las del que y en un una unos unas es por para con se su sus lo como más pero ya este esta estos estas ' +
    'porque cuando muy sobre también hasta hay donde quien desde todo nos durante entre cual cuál qué cómo dónde ' +
    'pregunta respuesta texto oración elige escribe completa verdadero falso correcta')
    .split(' '),
);

const words = (text: string): string[] => text.toLowerCase().match(/[a-záéíóúüñ']+/g) ?? [];
const clean = (s: unknown): string => (typeof s === 'string' ? s.trim() : '');
const contentWords = (text: string) => words(text).filter((w) => w.length >= 3 && !STOPWORDS.has(w));
const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const containsPhrase = (haystack: string, phrase: string) =>
  new RegExp(`(^|[^a-z'])${escapeRegExp(phrase.toLowerCase())}($|[^a-z'])`).test(haystack.toLowerCase());

export function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 0;
  if (w.length <= 3) return 1;
  const trimmed = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '');
  return Math.max(1, (trimmed.match(/[aeiouy]{1,2}/g) ?? []).length);
}

export function textProfile(text: string) {
  const sentences = text.split(/[.!?]+(?:\s|$)/).map((s) => s.trim()).filter((s) => words(s).length > 0);
  const all = words(text);
  const long = all.filter((w) => countSyllables(w) >= 3).length;
  return {
    words: all.length,
    sentences: sentences.length,
    avgSentence: sentences.length ? all.length / sentences.length : 0,
    longWordRatio: all.length ? long / all.length : 0,
  };
}

/** The text that identifies a question: what the student reads plus the answer key. */
export function questionSignature(content: Partial<Content> | undefined, { ignoreContext = false } = {}): string {
  if (!content) return '';
  return [
    content.question,
    ignoreContext ? '' : content.context,
    content.template,
    ...(content.options ?? []).map((o) => o.text),
    ...(content.items ?? []).map((i) => `${i.content} ${i.matchingPair ?? ''}`),
  ]
    .map(clean)
    .filter(Boolean)
    .join(' ');
}

/** Jaccard similarity of the content words of two texts (0–1). */
export function similarity(a: string, b: string): number {
  const A = new Set(contentWords(a));
  const B = new Set(contentWords(b));
  if (A.size < 4 || B.size < 4) return 0;
  let shared = 0;
  for (const w of A) if (B.has(w)) shared++;
  return shared / (A.size + B.size - shared);
}

export const DUPLICATE_THRESHOLD = 0.7;
export const SIMILAR_THRESHOLD = 0.5;

/** Exam rubric language every level uses; not counted against the level of the item. */
const RUBRIC_PHRASES =
  /\b(according to the (text|passage|dialogue|conversation|recording|audio|email|message|notice)|choose the (correct|best|right) (answer|option|word|form)|complete the (sentence|text|dialogue)|the following|in the (text|passage|recording))\b/gi;

const NEEDS_PASSAGE: QuestionType[] = ['multiple_choice', 'true_false', 'fill_blanks', 'open_text', 'matching', 'ordering'];
const BANNED_OPTION = /\b(all|none) of the above\b|\bboth (a|b) and (a|b)\b|^(a|b) and (b|c)$/i;

export function assessQuestionQuality(input: QualityInput, content: Content, opts: QualityOptions = {}): QualityReport {
  const issues: QualityIssue[] = [];
  const add = (code: string, severity: QualitySeverity, message: string, label: string) =>
    issues.push({ code, severity, message, label });

  const profile = LEVEL_PROFILE[input.level];
  const question = clean(content.question);
  const context = clean(content.context);
  const options = (content.options ?? []).map((o) => ({ text: clean(o.text), isCorrect: o.isCorrect === true }));
  const correct = options.find((o) => o.isCorrect);
  const distractors = options.filter((o) => !o.isCorrect);

  // ── Language ────────────────────────────────────────────────────────────────
  const studentText = [question, context, clean(content.template), clean(content.instructions), clean(content.sampleAnswer),
    ...options.map((o) => o.text), ...(content.items ?? []).map((i) => `${clean(i.content)} ${clean(i.matchingPair)}`)].join(' ');
  const tokens = words(studentText);
  const spanish = tokens.filter((w) => SPANISH.has(w)).length;
  if (/[¿¡]/.test(studentText) || (tokens.length >= 4 && spanish / tokens.length >= 0.15)) {
    add('language', 'block', 'All student-facing text must be in English; part of it is in Spanish.', 'Parte del texto está en español');
  }

  // ── Passage for reading/listening comprehension ──────────────────────────────
  const comprehension = (input.competency === 'reading' || input.competency === 'listening') && NEEDS_PASSAGE.includes(input.type);
  if (comprehension && words(context).length < 15) {
    add('missing_context', 'block',
      `A ${input.competency} question needs a passage in "context" (at least 2 sentences) and must be answerable from it.`,
      input.competency === 'reading' ? 'Falta el texto de lectura' : 'Falta el diálogo o la transcripción');
  }
  if ((input.competency === 'grammar' || input.competency === 'vocabulary') && words(context).length > 60) {
    add('unneeded_context', 'warn', `A ${input.competency} item should not include a reading passage; test the point in one sentence.`,
      'Tiene un texto largo que no hace falta para gramática o vocabulario');
  }

  // ── Level fit of the passage ────────────────────────────────────────────────
  if (context && comprehension && words(context).length >= 15) {
    const p = textProfile(context);
    const [min, max] = profile.passage;
    if (p.words > max * 1.3) {
      add('passage_too_long', 'warn', `The passage has ${p.words} words; for ${input.level} keep it between ${min} and ${max}.`,
        `El texto es largo para ${input.level} (${p.words} palabras)`);
    }
    if (p.sentences >= 2 && p.avgSentence > profile.maxAvgSentence * 1.25) {
      add('sentences_too_long', 'warn',
        `Sentences average ${Math.round(p.avgSentence)} words; ${input.level} learners need about ${profile.maxAvgSentence} or fewer.`,
        `Oraciones largas para ${input.level}`);
    }
  }

  // ── CEFR level of the language used (CEFR-J vocabulary profile + grammar) ───
  const target = levelIndex(input.level);
  // A quoted sentence in another language (a translation prompt) is not English to level.
  const englishQuestion = question.replace(RUBRIC_PHRASES, ' ').replace(/["“][^"”]+["”]/g, (quoted) => {
    const ws = words(quoted);
    return ws.length && ws.filter((w) => SPANISH.has(w)).length / ws.length >= 0.2 ? ' ' : quoted;
  });
  const itemText = [englishQuestion, clean(content.template).replace(/___/g, ' '), ...options.map((o) => o.text),
    ...(content.items ?? []).map((i) => `${clean(i.content)}. ${clean(i.matchingPair)}`)].join('. ');
  const readerText = [context, itemText].filter(Boolean).join('\n');
  const estimate = estimateLevel(readerText);
  const wrongLanguage = issues.some((i) => i.code === 'language');
  if (target < 4 && !wrongLanguage) {
    if (context && words(context).length >= 25) {
      const passage = estimateLevel(context);
      if (passage.coverage[target]! < COVERAGE_TARGET) {
        const hard = passage.wordsAbove(asCefr(input.level));
        add('passage_above_level', 'warn',
          `The passage uses vocabulary above ${input.level} (only ${Math.round(passage.coverage[target]! * 100)}% of its words are ${input.level} words). Replace: ${listWords(hard)}.`,
          `El texto usa vocabulario de nivel superior a ${input.level}: ${listWords(hard, 5)}`);
      }
    }
    // Short item text: flag words two or more levels above the target (one level up is normal stretch).
    const tooHard = estimateLevel(itemText).wordsAbove(asCefr(input.level)).filter((w) => LEVELS.indexOf(w.level as CefrLevel) >= target + 2);
    if (tooHard.length) {
      add('words_above_level', 'warn', `These words are well above ${input.level}: ${listWords(tooHard)}. Use words a ${input.level} learner knows.`,
        `Palabras muy por encima de ${input.level}: ${listWords(tooHard, 5)}`);
    }
    const grammarAbove = estimate.grammar.filter((g) => g.level > target);
    if (grammarAbove.length) {
      add('grammar_above_level', 'warn',
        `It uses grammar above ${input.level}: ${grammarAbove.map((g) => `${g.structure} ("${g.example}", ${LEVELS[g.level]})`).join('; ')}. Rewrite with ${input.level} structures.`,
        `Usa gramática de nivel superior a ${input.level}: ${grammarAbove.map((g) => `${g.structure} (${LEVELS[g.level]})`).join(', ')}`);
    }
  }
  if (target >= 3 && context && words(context).length >= 60 && estimateLevel(context).coverage[1]! >= 0.97 && !estimate.grammar.some((g) => g.level >= 2)) {
    add('passage_below_level', 'warn', `The passage is too easy for ${input.level}; use richer vocabulary and structures.`,
      `El texto es demasiado fácil para ${input.level}`);
  }

  // ── Multiple choice ─────────────────────────────────────────────────────────
  if (input.type === 'multiple_choice' && correct) {
    if (options.some((o) => BANNED_OPTION.test(o.text))) {
      add('banned_option', 'block', 'Do not use "all of the above", "none of the above" or combined options.',
        'Usa opciones tipo "todas las anteriores"');
    }
    const listsOptions = distractors.some((d) => d.text.length >= 2 && containsPhrase(question, d.text));
    if (correct.text.length >= 3 && containsPhrase(question, correct.text) && !listsOptions) {
      add('answer_in_question', 'block', `The question text already contains the correct answer ("${correct.text}").`,
        'El enunciado revela la respuesta correcta');
    }
    const longestDistractor = Math.max(0, ...distractors.map((d) => d.text.length));
    if (correct.text.length >= 20 && correct.text.length > longestDistractor * 1.5) {
      add('longest_option', 'warn', 'The correct option is much longer than the distractors; make all options similar in length.',
        'La opción correcta se delata por ser la más larga');
    }
    if ((input.competency === 'grammar' || input.competency === 'vocabulary') && options.some((o) => words(o.text).length > 6)) {
      add('long_options', 'warn', `${input.competency} options should be a word or short phrase.`, 'Las opciones son demasiado largas');
    }
  }

  // ── Grounding in the passage ────────────────────────────────────────────────
  if (comprehension && context && (input.type === 'multiple_choice' || input.type === 'true_false')) {
    const claim = input.type === 'true_false' ? question : correct?.text ?? '';
    const claimWords = contentWords(claim);
    const passage = contentWords(context);
    const stem = (w: string) => w.slice(0, 4);
    const grounded = claimWords.some((w) => passage.some((p) => stem(p) === stem(w)));
    if (claimWords.length > 0 && !/\d/.test(claim) && !grounded) {
      add('not_grounded', 'warn',
        input.type === 'true_false'
          ? 'The statement shares no words with the passage; it must be checkable against the text.'
          : 'The correct answer is not supported by the passage; it must be checkable against the text.',
        'La respuesta no se apoya en el texto');
    }
  }

  // ── Fill in the blanks ──────────────────────────────────────────────────────
  if (input.type === 'fill_blanks') {
    const template = clean(content.template);
    const outside = `${template.replace(/___/g, ' ')} ${question}`;
    for (const blank of content.blanks ?? []) {
      const answer = clean(blank.correctAnswers?.[0]);
      if (!answer) continue;
      if (new RegExp(`\\(\\s*${escapeRegExp(answer)}\\s*\\)`, 'i').test(template)) {
        add('answer_in_hint', 'block', `The hint in brackets is the answer itself ("${answer}"); give the base form instead.`,
          'La pista entre paréntesis es la misma respuesta');
      } else if (answer.length >= 3 && containsPhrase(outside, answer)) {
        add('answer_visible', 'warn', `The answer "${answer}" appears elsewhere in the sentence; the student can copy it.`,
          'La respuesta aparece escrita en la oración');
      }
      if (words(answer).length > 3) {
        add('long_blank', 'warn', 'Each blank should test one word or a very short phrase.', 'Un espacio pide demasiadas palabras');
      }
    }
  }

  // ── Matching ────────────────────────────────────────────────────────────────
  if (input.type === 'matching') {
    const trivial = (content.items ?? []).filter((i) => {
      const left = clean(i.content);
      return left.length >= 4 && containsPhrase(clean(i.matchingPair), left);
    });
    if (trivial.length) {
      add('trivial_pair', 'warn', 'Some pairs repeat the word on the left, which gives the match away.',
        'Algún par repite la palabra de la izquierda');
    }
  }

  // ── Sentence builder ────────────────────────────────────────────────────────
  if (input.type === 'drag_drop') {
    const items = content.items ?? [];
    if (items.length && (items.length < 4 || items.length > 8)) {
      add('chunk_count', 'warn', `Split the sentence into 4 to 8 chunks (got ${items.length}).`, 'La oración tiene pocas o demasiadas piezas');
    }
    const last = [...items].sort((a, b) => (a.correctPosition ?? 0) - (b.correctPosition ?? 0)).at(-1);
    if (last && !/[.!?]$/.test(clean(last.content))) {
      add('final_punctuation', 'warn', 'Attach the final punctuation to the last chunk so the order is unambiguous.',
        'Falta el punto final en la última pieza');
    }
  }

  // ── Production tasks ────────────────────────────────────────────────────────
  const production = input.type === 'essay' || (input.competency === 'writing' && input.type === 'open_text');
  if (production) {
    const n = words(clean(content.sampleAnswer)).length;
    const [min, max] = profile.writing;
    if (input.type === 'essay' && n > 0 && (n < min * 0.6 || n > max * 1.6)) {
      add('sample_length', 'warn', `The model answer has ${n} words; a ${input.level} text should have about ${min}-${max}.`,
        `La respuesta modelo no tiene el largo esperado para ${input.level}`);
    }
  }
  if (input.type === 'essay' || input.type === 'audio_response') {
    if (!clean(content.instructions)) {
      add('no_instructions', 'warn', 'Add "instructions" with length and what to include.', 'Faltan instrucciones para el estudiante');
    }
    const keywords = (content.keywords ?? []).map(clean).filter(Boolean);
    const sample = clean(content.sampleAnswer);
    if (keywords.length && sample) {
      const used = keywords.filter((k) => containsPhrase(sample, k) || sample.toLowerCase().includes(k.toLowerCase().slice(0, 5))).length;
      if (used < Math.ceil(keywords.length / 2)) {
        add('keywords_unused', 'warn', 'The model answer should use most of the keywords.', 'La respuesta modelo no usa las palabras clave');
      }
    }
  }
  if (input.type === 'open_text' && words(clean(content.sampleAnswer)).length > 60) {
    add('open_text_long', 'warn', 'A short-answer model should be 1-2 sentences.', 'La respuesta modelo es larga para respuesta corta');
  }

  // ── Duplicates ──────────────────────────────────────────────────────────────
  const signature = questionSignature(content, { ignoreContext: opts.ignoreContext });
  const best = Math.max(0, ...(opts.existing ?? []).map((e) => similarity(signature, e)));
  if (best >= DUPLICATE_THRESHOLD) {
    add('duplicate', 'block', 'This question is almost identical to one already in the bank; write a different one.',
      'Es casi igual a una pregunta del banco');
  } else if (best >= SIMILAR_THRESHOLD) {
    add('similar', 'warn', 'This question is very similar to one already in the bank; change the scenario and vocabulary.',
      'Se parece mucho a una pregunta del banco');
  }

  const blocks = issues.filter((i) => i.severity === 'block').length;
  const warns = issues.length - blocks;
  return { score: Math.max(0, 100 - blocks * 25 - warns * 8), issues, estimatedLevel: estimate.level };
}
