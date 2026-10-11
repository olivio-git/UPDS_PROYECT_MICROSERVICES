import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { levelPercent, manualRubricScore, percentToLevel, readResponse, ReviewError, validatePlainScore } from '../src/grading/manual-review-scoring.js';
import { computeRubricQuestionScore } from '../src/grading/scoring.js';
import { isPendingManual } from '../src/types/index.js';
import type { IRubricCriterionDefinition } from '../src/types/index.js';

const crit = (name: string, weight: number, top = 3, base = 0): IRubricCriterionDefinition => ({
  name,
  description: '',
  weight,
  levels: Array.from({ length: top - base + 1 }, (_, i) => ({ score: base + i, description: `${name} ${base + i}` })),
});

const A2 = [crit('Tarea', 30), crit('Gramática', 25), crit('Vocabulario', 25), crit('Coherencia', 20)];

describe('isPendingManual', () => {
  test('a reviewed 0 is a real grade, not pending', () => {
    assert.equal(isPendingManual({ evaluationMethod: 'manual' }), true);
    assert.equal(
      isPendingManual({ evaluationMethod: 'manual', review: { score: 0, feedback: '', reviewedBy: 't', reviewedAt: new Date() } }),
      false,
    );
    assert.equal(isPendingManual({ evaluationMethod: 'ai_grading' }), false);
  });
});

describe('manualRubricScore', () => {
  test('matches the AI rubric formula for the same picks', () => {
    const picks = { Tarea: 3, Gramática: 2, Vocabulario: 2, Coherencia: 2 };
    const expected = computeRubricQuestionScore(
      A2.map((c) => ({ name: c.name, weight: c.weight, score: (picks[c.name as keyof typeof picks] / 3) * 100 })),
      10,
    );
    assert.equal(manualRubricScore(A2, picks, 10), expected);
    assert.equal(manualRubricScore(A2, picks, 10), 7.67);
  });

  test('all top levels give full marks, all zeros give 0', () => {
    assert.equal(manualRubricScore(A2, { Tarea: 3, Gramática: 3, Vocabulario: 3, Coherencia: 3 }, 10), 10);
    assert.equal(manualRubricScore(A2, { Tarea: 0, Gramática: 0, Vocabulario: 0, Coherencia: 0 }, 10), 0);
  });

  test('levels that start at 1 are scaled against the top level', () => {
    const c = [crit('Único', 100, 4, 1)];
    assert.equal(manualRubricScore(c, { Único: 4 }, 5), 5);
    assert.equal(manualRubricScore(c, { Único: 2 }, 5), 2.5);
  });

  test('a rubric without usable weights counts criteria equally', () => {
    const c = [crit('A', 0), crit('B', 0)];
    assert.equal(manualRubricScore(c, { A: 3, B: 0 }, 10), 5);
  });

  test('a missing or invented level is rejected', () => {
    assert.throws(() => manualRubricScore(A2, { Tarea: 3 }, 10), ReviewError);
    assert.throws(() => manualRubricScore(A2, { Tarea: 7, Gramática: 1, Vocabulario: 1, Coherencia: 1 }, 10), ReviewError);
  });
});

describe('percentToLevel / levelPercent', () => {
  test('round-trip through the 0–100 scale', () => {
    const c = crit('X', 1, 3);
    for (const level of [0, 1, 2, 3]) assert.equal(percentToLevel(c, levelPercent(c, level)), level);
    assert.equal(percentToLevel(c, 70), 2);
    assert.equal(percentToLevel(c, 90), 3);
  });
});

describe('validatePlainScore', () => {
  test('accepts 0..max with two decimals, rejects the rest', () => {
    assert.equal(validatePlainScore(3.456, 5), 3.46);
    assert.equal(validatePlainScore(0, 5), 0);
    assert.throws(() => validatePlainScore(6, 5), ReviewError);
    assert.throws(() => validatePlainScore(-1, 5), ReviewError);
    assert.throws(() => validatePlainScore('4', 5), ReviewError);
  });
});

describe('readResponse', () => {
  test('text, essay and audio shapes', () => {
    assert.deepEqual(readResponse({ text: 'hi' }), { text: 'hi' });
    assert.deepEqual(readResponse({ essay: 'long' }), { text: 'long' });
    assert.deepEqual(readResponse({ audioUrl: 'u', audioDuration: 12 }), { audioUrl: 'u', audioDuration: 12 });
    assert.deepEqual(readResponse(null), { text: '' });
    assert.deepEqual(readResponse('plain'), { text: 'plain' });
  });
});
