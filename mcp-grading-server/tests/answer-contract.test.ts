/**
 * Contract between what the exam runner shows/sends and what the grader expects.
 *
 * For every auto-graded type, thousands of random questions go through the same
 * path as production: stored question → student view (exam-service) → an answer
 * built only from that view, the way the frontend inputs build it → autoGrade.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { autoGrade } from '../src/grading/auto-grader.js';
import { toStudentQuestion } from '../../exam-service/src/utils/studentQuestionView.js';
import type { IQuestion } from '../src/types/index.js';

function seeded(seed: number) {
  let t = seed;
  return () => {
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = seeded(2026);
const int = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
const pick = <T>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)]!;
const shuffle = <T>(arr: readonly T[]) => [...arr].sort(() => rand() - 0.5);
const WORDS = ['went', 'goes', 'kitchen', 'happy', 'isn\'t', 'have lived', 'at night', 'Monday', 'cheap', 'early', 'doctor', 'train'];
const POINTS = 10;
const RUNS = 400;

const KEY_FIELDS = ['isCorrect', 'correctPosition', 'matchingPair', 'correctAnswers', 'correctAnswer', 'sampleAnswer', 'keywords'];
const leakedKeys = (view: unknown) => KEY_FIELDS.filter((k) => JSON.stringify(view).includes(`"${k}"`));

const q = (type: IQuestion['type'], content: IQuestion['content']) =>
  ({ _id: 'q', type, competency: 'grammar', level: 'A2', content, metadata: { points: POINTS } }) as unknown as IQuestion;

/** Fraction of credit expected for an answer, computed independently of the grader. */
const expectedScore = (fraction: number) => Math.round(POINTS * fraction * 100) / 100;

// ── Generators: one random stored question per type ───────────────────────────
function makeMC() {
  const n = int(3, 5);
  const correct = new Set(shuffle([...Array(n).keys()]).slice(0, rand() < 0.8 ? 1 : int(2, n - 1)));
  return q('multiple_choice', {
    question: 'Pick',
    options: [...Array(n).keys()].map((i) => ({ id: String.fromCharCode(65 + i), text: `opt ${i}`, isCorrect: correct.has(i) })),
  });
}
function makeTF() {
  const isTrue = rand() < 0.5;
  return q('true_false', { question: 'S.', options: [{ id: 'true', text: 'True', isCorrect: isTrue }, { id: 'false', text: 'False', isCorrect: !isTrue }] });
}
function makeFill() {
  const n = int(1, 3);
  const blanks = [...Array(n).keys()].map((i) => ({ position: i, correctAnswers: [pick(WORDS)], caseSensitive: false }));
  return q('fill_blanks', { question: 'Fill', template: blanks.map(() => 'a ___ b').join(' '), blanks });
}
function makeMatching() {
  const n = int(3, 6);
  return q('matching', { question: 'Match', items: [...Array(n).keys()].map((i) => ({ id: `m${i + 1}`, content: `L${i}`, matchingPair: `R${i}` })) });
}
function makeSequence(type: 'ordering' | 'drag_drop') {
  const n = int(3, 7);
  const prefix = type === 'ordering' ? 'o' : 'd';
  return q(type, { question: 'Order', items: [...Array(n).keys()].map((i) => ({ id: `${prefix}${i + 1}`, content: `w${i}`, correctPosition: i + 1 })) });
}

// ── What the frontend sends, built from the student view only ────────────────
const keyOf = (stored: IQuestion) => ({
  correctIds: new Set((stored.content.options ?? []).filter((o) => o.isCorrect).map((o) => o.id)),
  pairOf: new Map((stored.content.items ?? []).map((i) => [i.id, i.matchingPair])),
  posOf: new Map((stored.content.items ?? []).map((i) => [i.id, i.correctPosition])),
});

describe('student view hides the answer key and still lets every type be answered', () => {
  const makers = [makeMC, makeTF, makeFill, makeMatching, () => makeSequence('ordering'), () => makeSequence('drag_drop')];

  test(`no answer key in ${RUNS * makers.length} student views`, () => {
    for (let r = 0; r < RUNS; r++) {
      for (const make of makers) {
        const view = toStudentQuestion(make(), rand);
        assert.deepEqual(leakedKeys(view), [], view.type);
      }
    }
  });

  test('the view tells single from multiple selection', () => {
    for (let r = 0; r < RUNS; r++) {
      const stored = makeMC();
      const view = toStudentQuestion(stored, rand);
      const many = (stored.content.options ?? []).filter((o) => o.isCorrect).length > 1;
      assert.equal(view.content.multipleAnswers, many);
    }
  });

  test('a perfect student scores full marks on every type', () => {
    for (let r = 0; r < RUNS; r++) {
      for (const make of makers) {
        const stored = make();
        const view = toStudentQuestion(stored, rand);
        const key = keyOf(stored);
        let answer: unknown;
        switch (stored.type) {
          case 'multiple_choice':
            answer = { selectedOptions: view.content.options.filter((o: any) => key.correctIds.has(o.id)).map((o: any) => o.id) };
            break;
          case 'true_false':
            answer = { answer: key.correctIds.has('true') };
            break;
          case 'fill_blanks':
            answer = { blanks: stored.content.blanks!.map((b) => b.correctAnswers[0]) };
            break;
          case 'matching':
            // Every value the student needs must be offered in the right-hand column.
            for (const v of key.pairOf.values()) assert.ok(view.content.matchOptions.includes(v));
            answer = { pairs: Object.fromEntries(view.content.items.map((i: any) => [i.id, key.pairOf.get(i.id)])) };
            break;
          case 'ordering':
            answer = { order: [...view.content.items].sort((a: any, b: any) => key.posOf.get(a.id)! - key.posOf.get(b.id)!).map((i: any) => i.id) };
            break;
          case 'drag_drop':
            answer = { positions: Object.fromEntries(view.content.items.map((i: any) => [i.id, key.posOf.get(i.id)])) };
            break;
        }
        const result = autoGrade(stored, answer);
        assert.equal(result.score, POINTS, `${stored.type}: ${JSON.stringify(answer)}`);
        assert.equal(result.isCorrect, true);
      }
    }
  });
});

describe('fill in the blanks accepts what students really type', () => {
  const stored = q('fill_blanks', {
    question: 'Fill', template: 'She ___ here and he ___ there.',
    blanks: [{ position: 0, correctAnswers: ["isn't", 'is not'], caseSensitive: false }, { position: 1, correctAnswers: ['has lived'], caseSensitive: false }],
  });
  const cases: Array<[string, string[]]> = [
    ['exact', ["isn't", 'has lived']],
    ['capitals', ["ISN'T", 'Has Lived']],
    ['surrounding spaces', ["  isn't ", ' has lived  ']],
    ['double space inside', ["isn't", 'has  lived']],
    ['curly apostrophe (phone keyboards)', ['isn’t', 'has lived']],
    ['trailing full stop', ["isn't.", 'has lived.']],
  ];
  for (const [name, blanks] of cases) {
    test(name, () => assert.equal(autoGrade(stored, { blanks }).score, POINTS));
  }
  test('a different word is still wrong', () => {
    assert.equal(autoGrade(stored, { blanks: ['is', 'lived'] }).score, 0);
  });
});

describe('partial credit is proportional, whatever the points', () => {
  test('matching, fill blanks and drag & drop give credit per correct part', () => {
    for (let r = 0; r < RUNS; r++) {
      const stored = makeMatching();
      const items = stored.content.items!;
      const right = int(0, items.length);
      const pairs = Object.fromEntries(items.map((it, i) => [it.id, i < right ? it.matchingPair : 'nope']));
      assert.equal(autoGrade(stored, { pairs }).score, expectedScore(right / items.length), `${right}/${items.length}`);
    }
  });

  test('a 1-point question with 2 of 3 blanks right is not rounded down to 0', () => {
    const stored = q('fill_blanks', {
      question: 'Fill', template: '___ ___ ___',
      blanks: ['a', 'b', 'c'].map((w, i) => ({ position: i, correctAnswers: [w], caseSensitive: false })),
    });
    assert.equal(autoGrade(stored, { blanks: ['a', 'b', 'x'] }, 1).score, 0.67);
  });

  test('one word moved in a sentence builder costs one piece, not the whole answer', () => {
    // I(1) never(2) drink(3) coffee(4) at night.(5)
    const items = ['I', 'never', 'drink', 'coffee', 'at night.'].map((w, i) => ({ id: `d${i + 1}`, content: w, correctPosition: i + 1 }));
    const s = q('drag_drop', { question: 'Build', items });
    const build = (ids: string[]) => ({ positions: Object.fromEntries(ids.map((id, i) => [id, i + 1])) });
    assert.equal(autoGrade(s, build(['d2', 'd1', 'd3', 'd4', 'd5'])).score, expectedScore(4 / 5)); // swap
    assert.equal(autoGrade(s, build(['d5', 'd1', 'd2', 'd3', 'd4'])).score, expectedScore(4 / 5)); // last moved first
    assert.equal(autoGrade(s, build(['d5', 'd4', 'd3', 'd2', 'd1'])).score, 0); // reversed
    assert.equal(autoGrade(s, build(['d1', 'd2', 'd3'])).score, expectedScore(3 / 5)); // unfinished
  });

  test('ordering gets the same credit rule', () => {
    const items = [1, 2, 3, 4].map((n) => ({ id: `o${n}`, content: `step ${n}`, correctPosition: n }));
    const s = q('ordering', { question: 'Order', items });
    assert.equal(autoGrade(s, { order: ['o1', 'o2', 'o3', 'o4'] }).score, POINTS);
    assert.equal(autoGrade(s, { order: ['o4', 'o1', 'o2', 'o3'] }).score, expectedScore(3 / 4));
    assert.equal(autoGrade(s, { order: ['o1', 'o1', 'o1', 'o1'] }).score, 0, 'repeating one id earns nothing');
  });
});

describe('bad or missing answers never crash and never score', () => {
  const garbage: unknown[] = [undefined, null, {}, 'A', 42, [], { selectedOptions: 'A' }, { blanks: 'x' }, { pairs: null },
    { order: {} }, { positions: [] }, { answer: 'maybe' }, { selectedOptions: ['Z'] }];
  const makers = [makeMC, makeTF, makeFill, makeMatching, () => makeSequence('ordering'), () => makeSequence('drag_drop')];
  for (const make of makers) {
    const stored = make();
    test(stored.type, () => {
      for (const g of garbage) {
        const result = autoGrade(stored, g);
        assert.ok(result.score >= 0 && result.score <= POINTS, JSON.stringify(g));
        assert.equal(result.score, 0, `${stored.type} ${JSON.stringify(g)}`);
      }
    });
  }
});
