import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeBlankMarks, normalizeGeneratedContent, shuffled } from '../src/tools/question-validation.js';
import { autoGrade } from '../src/grading/auto-grader.js';
import type { IQuestion } from '../src/types/index.js';

/** Deterministic random source for shuffle tests. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2 ** 31;
    return s / 2 ** 31;
  };
}

const asQuestion = (type: IQuestion['type'], content: IQuestion['content']) =>
  ({ type, content, points: 1 }) as unknown as IQuestion;

describe('multiple_choice', () => {
  const content = {
    question: 'What time does Maria finish?',
    options: [
      { id: 'x', text: 'At two', isCorrect: true },
      { id: 'y', text: 'At six', isCorrect: false },
      { id: 'z', text: 'At noon', isCorrect: false },
      { id: 'w', text: 'At ten', isCorrect: false },
    ],
  };

  test('relabels A-D, keeps one correct and points correctAnswer at it', () => {
    const { content: out, problems } = normalizeGeneratedContent('multiple_choice', content, seeded(7));
    assert.deepEqual(problems, []);
    assert.deepEqual(out.options!.map((o) => o.id), ['A', 'B', 'C', 'D']);
    const correct = out.options!.filter((o) => o.isCorrect);
    assert.equal(correct.length, 1);
    assert.equal(correct[0].text, 'At two');
    assert.equal(out.correctAnswer, correct[0].id);
  });

  test('shuffling spreads the correct answer across positions', () => {
    const random = seeded(42);
    const seen = new Set<string>();
    for (let i = 0; i < 40; i++) {
      seen.add(normalizeGeneratedContent('multiple_choice', content, random).content.correctAnswer as string);
    }
    assert.ok(seen.size >= 3, `correct answer landed only on ${[...seen]}`);
  });

  test('flags zero or several correct options and duplicates', () => {
    const none = normalizeGeneratedContent('multiple_choice', {
      question: 'q',
      options: content.options.map((o) => ({ ...o, isCorrect: false })),
    });
    assert.match(none.problems.join(), /exactly one correct/);
    const dup = normalizeGeneratedContent('multiple_choice', {
      question: 'q',
      options: [...content.options.slice(0, 3), { id: 'v', text: 'at two', isCorrect: false }],
    });
    assert.match(dup.problems.join(), /distinct/);
  });
});

describe('true_false', () => {
  test('content-based options become True/False keyed on the first option', () => {
    const { content: out, problems } = normalizeGeneratedContent('true_false', {
      question: 'The sun rises in the west.',
      options: [
        { id: '1', text: 'The sun rises in the west.', isCorrect: false },
        { id: '2', text: 'The sun rises in the east.', isCorrect: true },
      ],
    });
    assert.deepEqual(problems, []);
    assert.deepEqual(out.options, [
      { id: 'true', text: 'True', isCorrect: false },
      { id: 'false', text: 'False', isCorrect: true },
    ]);
  });

  test('a question mark means it is not a statement', () => {
    const { problems } = normalizeGeneratedContent('true_false', {
      question: 'Does the sun rise in the west?',
      options: [{ id: 'true', text: 'True', isCorrect: false }, { id: 'false', text: 'False', isCorrect: true }],
    });
    assert.match(problems.join(), /statement/);
  });
});

describe('fill_blanks', () => {
  test('normalises blank marks', () => {
    assert.equal(normalizeBlankMarks('I ____ to [blank] school'), 'I ___ to ___ school');
  });

  test('builds 0-based blanks in order and a gradable answer key', () => {
    const { content: out, problems } = normalizeGeneratedContent('fill_blanks', {
      question: 'Complete.',
      template: 'Yesterday I _____ to the market and ___ apples.',
      blanks: [
        { position: 2, correctAnswers: ['bought'] },
        { position: 1, correctAnswers: ['went', ' '] },
      ],
    });
    assert.deepEqual(problems, []);
    assert.equal(out.template, 'Yesterday I ___ to the market and ___ apples.');
    assert.deepEqual(out.blanks, [
      { position: 0, correctAnswers: ['went'], caseSensitive: false },
      { position: 1, correctAnswers: ['bought'], caseSensitive: false },
    ]);
    const graded = autoGrade(asQuestion('fill_blanks', out), { blanks: ['Went', 'bought'] }, 2);
    assert.equal(graded?.score, 2);
  });

  test('flags a mismatch between template and answers', () => {
    const { problems } = normalizeGeneratedContent('fill_blanks', {
      question: 'Complete.',
      template: 'I ___ to ___ school.',
      correctAnswer: ['go'],
    });
    assert.match(problems.join(), /2 blanks .* 1 answers/);
  });
});

describe('matching', () => {
  test('requires unique, complete pairs', () => {
    const { problems } = normalizeGeneratedContent('matching', {
      question: 'Match.',
      items: [
        { id: 'a', content: 'hot', matchingPair: 'cold' },
        { id: 'b', content: 'warm', matchingPair: 'Cold' },
        { id: 'c', content: 'early', matchingPair: '' },
      ],
    });
    assert.match(problems.join(), /content and matchingPair/);
    assert.match(problems.join(), /pairs must be distinct/);
  });

  test('valid pairs grade correctly after normalisation', () => {
    const { content: out, problems } = normalizeGeneratedContent('matching', {
      question: 'Match.',
      items: [
        { id: 'a', content: 'hot', matchingPair: 'cold' },
        { id: 'b', content: 'early', matchingPair: 'late' },
        { id: 'c', content: 'cheap', matchingPair: 'expensive' },
      ],
    });
    assert.deepEqual(problems, []);
    const pairs = Object.fromEntries(out.items!.map((it) => [it.id, it.matchingPair!]));
    assert.equal(autoGrade(asQuestion('matching', out), { pairs }, 3)?.score, 3);
  });
});

describe('ordering / drag_drop', () => {
  test('stores items in answer order with positions 1..n', () => {
    const { content: out, problems } = normalizeGeneratedContent('drag_drop', {
      question: 'Build the sentence.',
      items: [
        { id: 'x', content: 'never', correctPosition: 3 },
        { id: 'y', content: 'She', correctPosition: 1 },
        { id: 'z', content: 'has', correctPosition: 2 },
      ],
    });
    assert.deepEqual(problems, []);
    assert.deepEqual(out.items!.map((i) => [i.content, i.correctPosition]), [['She', 1], ['has', 2], ['never', 3]]);
    const positions = Object.fromEntries(out.items!.map((it) => [it.id, it.correctPosition!]));
    assert.equal(autoGrade(asQuestion('drag_drop', out), { positions }, 1)?.score, 1);
  });

  test('flags gaps or repeats in correctPosition', () => {
    const { problems } = normalizeGeneratedContent('ordering', {
      question: 'Order.',
      items: [
        { id: 'a', content: 'one', correctPosition: 1 },
        { id: 'b', content: 'two', correctPosition: 1 },
        { id: 'c', content: 'three', correctPosition: 4 },
      ],
    });
    assert.match(problems.join(), /1\.\.3/);
  });
});

test('open_text without a sample answer is flagged', () => {
  const { problems } = normalizeGeneratedContent('open_text', { question: 'Why?' });
  assert.match(problems.join(), /sampleAnswer/);
});

test('shuffled keeps every element', () => {
  assert.deepEqual([...shuffled([1, 2, 3, 4, 5], seeded(3))].sort(), [1, 2, 3, 4, 5]);
});
