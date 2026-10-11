import { CEFRJ_VOCABULARY } from './cefrj-vocabulary.js';

/**
 * Estimates the CEFR level a piece of English asks of a reader, from two signals:
 *
 * - Lexis: each running word is looked up (after lemmatising) in the CEFR-J
 *   Vocabulary Profile. A text is at level L when the words known at L cover
 *   enough of it — the lexical-coverage approach of Laufer & Ravenhorst-Kalovski
 *   (2010): ~95% coverage for minimal comprehension, 98% for comfortable reading.
 * - Grammar: hallmark structures, each placed at the lowest level the
 *   British Council/EAQUALS Core Inventory (and the English Grammar Profile where
 *   the inventory is silent) introduces it.
 *
 * This is a screening tool, not a validated test: it tells a teacher that an
 * "A1" passage uses B2 words or a third conditional, which is what matters
 * when building items.
 */

export const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'] as const;
export type CefrLevel = (typeof LEVELS)[number];
/** Index into LEVELS; 4 (C1) also stands for "not in the A1–B2 list". */
export type LevelIndex = 0 | 1 | 2 | 3 | 4;

const OFF_LIST: LevelIndex = 4;

let lexicon: Map<string, LevelIndex> | undefined;
function getLexicon(): Map<string, LevelIndex> {
  if (lexicon) return lexicon;
  lexicon = new Map();
  (['A1', 'A2', 'B1', 'B2'] as const).forEach((level, index) => {
    for (const w of CEFRJ_VOCABULARY[level].split(' ')) {
      if (w && !lexicon!.has(w)) lexicon!.set(w.replace(/_/g, ' '), index as LevelIndex);
    }
  });
  return lexicon;
}

/** Irregular forms → base form (verbs, plurals, comparatives) for lookup. */
const IRREGULAR: Record<string, string> = Object.fromEntries(
  (
    'am:be is:be are:be was:be were:be been:be being:be has:have had:have does:do did:do done:do ' +
    'went:go gone:go made:make said:say saw:see seen:see took:take taken:take came:come got:get gotten:get gave:give given:give ' +
    'knew:know known:know thought:think told:tell found:find felt:feel left:leave brought:bring bought:buy began:begin begun:begin ' +
    'kept:keep held:hold stood:stand heard:hear let:let meant:mean met:meet ran:run paid:pay sat:sit spoke:speak spoken:speak ' +
    'lay:lie led:lead grew:grow grown:grow lost:lose fell:fall fallen:fall sent:send built:build understood:understand ' +
    'drew:draw drawn:draw broke:break broken:break spent:spend rose:rise risen:rise drove:drive driven:drive wrote:write written:write ' +
    'ate:eat eaten:eat drank:drink drunk:drink sang:sing sung:sing swam:swim swum:swim slept:sleep taught:teach caught:catch ' +
    'fought:fight flew:fly flown:fly forgot:forget forgotten:forget chose:choose chosen:choose wore:wear worn:wear won:win ' +
    'sold:sell stole:steal stolen:steal threw:throw thrown:throw woke:wake woken:wake hid:hide hidden:hide rode:ride ridden:ride ' +
    'shook:shake shaken:shake hung:hang fed:feed shot:shoot dug:dig lit:light bit:bite bitten:bite blew:blow blown:blow ' +
    'children:child men:man women:woman people:person feet:foot teeth:tooth mice:mouse geese:goose lives:life wives:wife knives:knife ' +
    'leaves:leaf halves:half shelves:shelf wolves:wolf better:good best:good worse:bad worst:bad further:far farther:far ' +
    "me:i my:i mine:i him:he his:he her:she hers:she us:we our:we them:they their:they ' ' " +
    "can't:can won't:will don't:do doesn't:do didn't:do isn't:be aren't:be wasn't:be weren't:be haven't:have hasn't:have " +
    "couldn't:could shouldn't:should wouldn't:would i'm:i you're:you we're:we they're:they it's:it that's:that there's:there " +
    "cannot:can i've:i you've:you we've:we they've:they i'll:i you'll:you i'd:i you'd:you let's:let"
  )
    .split(/\s+/)
    .filter((p) => p.includes(':'))
    .map((p) => p.split(':') as [string, string]),
);

/** Possible dictionary forms of an inflected word, most likely first. */
export function lemmaCandidates(word: string): string[] {
  const w = word.toLowerCase().replace(/^'+|'+$/g, '').replace(/'s$/, '');
  const out = [w];
  if (IRREGULAR[w]) out.push(IRREGULAR[w]!);
  const add = (s: string) => s.length >= 2 && out.push(s);
  const undouble = (s: string) => (/([bcdfgklmnprstvz])\1$/.test(s) ? s.slice(0, -1) : s);
  if (w.endsWith('ies')) add(w.slice(0, -3) + 'y');
  if (w.endsWith('es')) add(w.slice(0, -2));
  if (w.endsWith('s') && !w.endsWith('ss')) add(w.slice(0, -1));
  if (w.endsWith('ied')) add(w.slice(0, -3) + 'y');
  if (w.endsWith('ed')) {
    add(w.slice(0, -2));
    add(w.slice(0, -1));
    add(undouble(w.slice(0, -2)));
  }
  if (w.endsWith('ing')) {
    add(w.slice(0, -3));
    add(w.slice(0, -3) + 'e');
    add(undouble(w.slice(0, -3)));
    if (w.endsWith('ying')) add(w.slice(0, -4) + 'ie');
  }
  for (const suffix of ['er', 'est']) {
    if (w.endsWith(suffix)) {
      const stem = w.slice(0, -suffix.length);
      add(stem);
      add(stem + 'e');
      add(undouble(stem));
      if (stem.endsWith('i')) add(stem.slice(0, -1) + 'y');
    }
  }
  if (w.endsWith('ly')) {
    add(w.slice(0, -2));
    if (w.endsWith('ily')) add(w.slice(0, -3) + 'y');
  }
  return out;
}

export function wordLevel(word: string): LevelIndex {
  const lex = getLexicon();
  let best: LevelIndex = OFF_LIST;
  for (const candidate of lemmaCandidates(word)) {
    const level = lex.get(candidate);
    if (level !== undefined && level < best) best = level;
  }
  return best;
}

interface Token { word: string; level: LevelIndex }

/**
 * Running words, without numbers and likely proper nouns: an unknown capitalised
 * word mid-sentence, or a short one at the start of a sentence that never
 * appears in lower case (Sara, Ben, Madrid…). Two-word entries of the list
 * ("according to", "look after") are matched as one.
 */
function tokens(text: string): Token[] {
  const out: Token[] = [];
  const lex = getLexicon();
  const lowerSeen = new Set((text.match(/\b[a-z][a-z']*/g) ?? []).map((w) => w));
  for (const sentence of text.split(/(?<=[.!?:;"“”])\s+|\n+/)) {
    const raw = (sentence.match(/[A-Za-z][A-Za-z'’-]*/g) ?? []).map((t) => t.replace(/’/g, "'").replace(/-+$/, ''));
    for (let i = 0; i < raw.length; i++) {
      const word = raw[i]!;
      const next = raw[i + 1];
      if (next && lex.has(`${word} ${next}`.toLowerCase())) {
        out.push({ word: `${word} ${next}`, level: lex.get(`${word} ${next}`.toLowerCase())! });
        i++;
        continue;
      }
      const capitalised = /^[A-Z][a-z]/.test(word);
      if (capitalised && wordLevel(word) === OFF_LIST && (i > 0 || (word.length <= 7 && !lowerSeen.has(word.toLowerCase())))) continue;
      if (word.includes('-')) {
        for (const part of word.split('-').filter(Boolean)) out.push({ word: part, level: wordLevel(part) });
        continue;
      }
      out.push({ word, level: wordLevel(word) });
    }
  }
  return out;
}

export interface GrammarHit { structure: string; level: LevelIndex; example: string }

const PARTICIPLE =
  "(?:\\w+ed|been|gone|done|seen|taken|made|written|eaten|known|given|left|told|come|become|begun|broken|chosen|driven|fallen|" +
  'forgotten|found|got|gotten|heard|kept|lost|met|paid|read|run|said|sent|sold|spoken|spent|stolen|swum|thought|understood|won|worn|' +
  'built|bought|brought|caught|taught|felt|held|hidden|grown|drawn|thrown|flown|shown|sung|drunk|ridden|risen|woken|meant|slept|left|had)';

/** Hallmark structures and the lowest level the Core Inventory / EGP place them at. */
const GRAMMAR: Array<{ structure: string; level: LevelIndex; pattern: RegExp }> = [
  { structure: 'past continuous', level: 1, pattern: /\b(was|were)\s+(not\s+)?\w+ing\b/i },
  { structure: 'present perfect', level: 1, pattern: new RegExp(`\\b(have|has|'ve|haven't|hasn't)\\s+(never\\s+|already\\s+|just\\s+|ever\\s+|not\\s+|been\\s+)?${PARTICIPLE}\\b`, 'i') },
  { structure: 'used to', level: 1, pattern: /\bused\s+to\s+(?!\w+ing\b)\w+/i },
  { structure: 'present perfect continuous', level: 2, pattern: /\b(have|has|'ve)\s+been\s+\w+ing\b/i },
  { structure: 'past perfect', level: 2, pattern: new RegExp(`\\b(had|'d)\\s+(never\\s+|already\\s+|just\\s+|not\\s+)?(?!to\\b)${PARTICIPLE}\\b`, 'i') },
  { structure: 'second conditional', level: 2, pattern: /\bif\b[^.?!]{1,80}\b(were|was|had|did|could|knew|\w+ed)\b[^.?!]{0,80}\b(would|could|might)\s+(?!have\b)\w+/i },
  { structure: 'future continuous', level: 2, pattern: /\bwill\s+be\s+\w+ing\b/i },
  { structure: 'reported speech', level: 2, pattern: /\b(said|told\s+\w+|asked(\s+\w+)?)\s+(that\s+)?(he|she|they|we|i|it)\s+(would|had|was|were|could)\b/i },
  { structure: 'non-defining relative clause', level: 2, pattern: /,\s*(which|who|whose)\b/i },
  { structure: 'modal perfect', level: 2, pattern: new RegExp(`\\b(should|could|would)(n't)?\\s+have\\s+${PARTICIPLE}\\b`, 'i') },
  { structure: 'passive with perfect or modal', level: 2, pattern: new RegExp(`\\b((have|has|had)\\s+been|(will|can|must|should|might|could)\\s+be)\\s+${PARTICIPLE}\\b(?!\\s+\\w+ing)`, 'i') },
  { structure: 'third conditional', level: 3, pattern: /\bif\b[^.?!]{1,80}\bhad\s+\w+[^.?!]{0,80}\b(would|could|might)(n't)?\s+have\s+\w+/i },
  { structure: 'might/must have (speculation)', level: 3, pattern: new RegExp(`\\b(might|must|may)(n't)?\\s+have\\s+${PARTICIPLE}\\b`, 'i') },
  { structure: 'wish + past', level: 3, pattern: /\bwish(es|ed)?\s+(i|you|he|she|we|they|it)\s+(were|had|could|would|was|knew|\w+ed)\b/i },
  { structure: 'future perfect', level: 3, pattern: new RegExp(`\\bwill\\s+have\\s+${PARTICIPLE}\\b`, 'i') },
  { structure: 'the more ..., the more', level: 3, pattern: /\bthe\s+(more|less|\w+er)\b[^.?!]{1,40},\s*the\s+(more|less|\w+er)\b/i },
  { structure: 'not only ... but also', level: 3, pattern: /\bnot\s+only\b[^.?!]{1,60}\bbut\s+also\b/i },
  { structure: 'inversion', level: 4, pattern: /(^|[.!?]\s+)(had|were|should)\s+(i|you|he|she|we|they)\s+\w+|\b(no sooner|hardly had|little did|never before have)\b/i },
];

export function detectGrammar(text: string): GrammarHit[] {
  const hits: GrammarHit[] = [];
  for (const g of GRAMMAR) {
    const m = text.match(g.pattern);
    if (m) hits.push({ structure: g.structure, level: g.level, example: m[0].trim().slice(0, 60) });
  }
  return hits;
}

export interface LevelEstimate {
  words: number;
  /** Share of running words known at or below each level A1..B2. */
  coverage: [number, number, number, number];
  /** Lowest level whose vocabulary covers the text (95%), C1 when even B2 does not. */
  lexicalLevel: CefrLevel;
  grammar: GrammarHit[];
  /** Highest level among the detected structures (A1 when none). */
  grammarLevel: CefrLevel;
  /** The higher of the two. */
  level: CefrLevel;
  /** Distinct words above the given level, hardest first. */
  wordsAbove: (target: CefrLevel) => Array<{ word: string; level: CefrLevel }>;
}

export const COVERAGE_TARGET = 0.9;

export function estimateLevel(text: string): LevelEstimate {
  const toks = tokens(text);
  const n = toks.length || 1;
  const coverage = [0, 1, 2, 3].map((l) => toks.filter((t) => t.level <= l).length / n) as LevelEstimate['coverage'];
  const lexIdx = (coverage.findIndex((c) => c >= COVERAGE_TARGET) + 5) % 5; // -1 → 4
  const grammar = detectGrammar(text);
  const gramIdx = grammar.reduce((m, g) => Math.max(m, g.level), 0);
  return {
    words: toks.length,
    coverage,
    lexicalLevel: LEVELS[lexIdx]!,
    grammar,
    grammarLevel: LEVELS[gramIdx]!,
    level: LEVELS[Math.max(lexIdx, gramIdx)]!,
    wordsAbove: (target) => {
      const t = LEVELS.indexOf(target);
      const seen = new Map<string, LevelIndex>();
      for (const tok of toks) if (tok.level > t) seen.set(tok.word.toLowerCase(), tok.level);
      return [...seen].sort((a, b) => b[1] - a[1]).map(([word, l]) => ({ word, level: LEVELS[l]! }));
    },
  };
}
