import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCriteriaScoreMap,
  computeRubricQuestionScore,
  computeWeightedPercentage,
  effectiveWeight,
  hasScorableCriteria,
  normalizeCriterionName,
  parseCriterionScore,
  scoreRubricCriteria,
  type SectionScoreInput,
} from '../src/grading/scoring.js';
import type { IRubricCriterionDefinition, RawRubricCriterionScore } from '../src/types/index.js';

function def(name: string, weight: number): IRubricCriterionDefinition {
  return { name, description: `${name} description`, weight, levels: [] };
}

function ai(name: string, score: unknown, feedback?: string): RawRubricCriterionScore {
  return feedback === undefined ? { name, score } : { name, score, feedback };
}

const CGV = [def('Content', 40), def('Grammar', 30), def('Vocabulary', 30)];

describe('scoreRubricCriteria — matching', () => {
  test('exact name match applies the weighted formula', () => {
    const out = scoreRubricCriteria(
      [def('content', 40), def('grammar', 60)],
      [ai('content', 80), ai('grammar', 60)],
      10
    );
    // (80*40 + 60*60) / 100 = 68 -> 6.8 of 10
    assert.equal(out.questionScore, 6.8);
    assert.equal(out.partial, false);
    assert.deepEqual(out.criteria.map(c => [c.name, c.score]), [['content', 80], ['grammar', 60]]);
  });

  test('omitted criterion is NOT filled positionally; renormalizes and marks partial', () => {
    // Regression for the positional fallback bug: Grammar used to receive
    // Vocabulary's score (index 1) and the result was 6.8 instead of 7.14.
    const out = scoreRubricCriteria(CGV, [ai('Content', 80), ai('Vocabulary', 60)], 10);
    // (80*40 + 60*30) / 70 = 71.43% -> 7.14 of 10
    assert.equal(out.questionScore, 7.14);
    assert.equal(out.partial, true);
    assert.deepEqual(out.criteria.map(c => c.name), ['Content', 'Vocabulary']);
  });

  test('reordered response matches by name, not by position', () => {
    const out = scoreRubricCriteria(
      CGV,
      [ai('Vocabulary', 50), ai('Content', 100), ai('Grammar', 0)],
      10
    );
    assert.deepEqual(
      out.criteria.map(c => [c.name, c.score]),
      [['Content', 100], ['Grammar', 0], ['Vocabulary', 50]]
    );
    // (100*40 + 0*30 + 50*30) / 100 = 55 -> 5.5
    assert.equal(out.questionScore, 5.5);
    assert.equal(out.partial, false);
  });

  test('case, whitespace and accents are normalized', () => {
    const out = scoreRubricCriteria(
      [def('Gramática', 50), def('Coherencia y cohesión', 50)],
      [ai('  gramatica ', 80), ai('COHERENCIA   Y COHESION', 60)],
      10
    );
    assert.equal(out.partial, false);
    assert.deepEqual(out.criteria.map(c => c.score), [80, 60]);
    assert.equal(out.questionScore, 7);
  });

  test('misspelled name in a full-length response falls back positionally (unused index, unknown name)', () => {
    const out = scoreRubricCriteria(
      CGV,
      [ai('Vocabulary', 50), ai('Grammer', 70), ai('Content', 90)],
      10
    );
    // "Grammer" at index 1 matches no definition and index 1 is unconsumed.
    assert.deepEqual(out.criteria.map(c => [c.name, c.score]), [['Content', 90], ['Grammar', 70], ['Vocabulary', 50]]);
    assert.equal(out.partial, false);
  });

  test('positional fallback is refused when the entry at that index was consumed by another name', () => {
    // Index 1 holds "Content" (consumed by name), so Grammar can't borrow it.
    const out = scoreRubricCriteria(
      CGV,
      [ai('Gramatik', 70), ai('Content', 90), ai('Vocabulary', 50)],
      10
    );
    assert.deepEqual(out.criteria.map(c => c.name), ['Content', 'Vocabulary']);
    assert.equal(out.partial, true);
  });

  test('translated names with a full-length response match positionally', () => {
    const out = scoreRubricCriteria(
      CGV,
      [ai('Contenido', 80), ai('Gramática', 60), ai('Vocabulario', 40)],
      10
    );
    assert.equal(out.partial, false);
    assert.deepEqual(out.criteria.map(c => c.score), [80, 60, 40]);
  });

  test('translated names with a shorter response match nothing -> fallback signal', () => {
    const out = scoreRubricCriteria(CGV, [ai('Contenido', 80), ai('Gramática', 60)], 10);
    assert.deepEqual(out.criteria, []);
    assert.equal(out.questionScore, 0);
  });

  test('translated + one exact name in a shorter response -> partial over the exact one only', () => {
    const out = scoreRubricCriteria(CGV, [ai('Contenido', 80), ai('Grammar', 60)], 10);
    assert.deepEqual(out.criteria.map(c => c.name), ['Grammar']);
    assert.equal(out.partial, true);
    assert.equal(out.questionScore, 6);
  });

  test('extra unknown AI entries do not enable positional fallback', () => {
    const out = scoreRubricCriteria(
      [def('Content', 50), def('Grammar', 50)],
      [ai('Content', 80), ai('Style', 10), ai('Other', 20)],
      10
    );
    assert.deepEqual(out.criteria.map(c => c.name), ['Content']);
    assert.equal(out.partial, true);
  });
});

describe('scoreRubricCriteria — score validity', () => {
  for (const [label, bad] of [
    ['null', null],
    ['true', true],
    ['false', false],
    ['empty string', ''],
    ['blank string', '   '],
    ['empty array', []],
    ['object', {}],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['non-numeric string', 'excellent'],
    ['undefined', undefined],
  ] as const) {
    test(`${label} score is dropped -> partial`, () => {
      const out = scoreRubricCriteria(CGV, [ai('Content', 80), ai('Grammar', bad), ai('Vocabulary', 60)], 10);
      assert.deepEqual(out.criteria.map(c => c.name), ['Content', 'Vocabulary']);
      assert.equal(out.partial, true);
      assert.equal(out.questionScore, 7.14);
    });
  }

  test('numeric string score is accepted', () => {
    const out = scoreRubricCriteria([def('Content', 100)], [ai('Content', ' 75 ')], 10);
    assert.equal(out.questionScore, 7.5);
  });

  test('all scores invalid -> empty criteria (fallback signal)', () => {
    const out = scoreRubricCriteria(CGV, [ai('Content', null), ai('Grammar', ''), ai('Vocabulary', false)], 10);
    assert.deepEqual(out, { criteria: [], partial: false, questionScore: 0 });
  });

  test('empty AI response -> fallback signal', () => {
    assert.deepEqual(scoreRubricCriteria(CGV, [], 10), { criteria: [], partial: false, questionScore: 0 });
  });

  test('scores are clamped to [0,100] before weighting', () => {
    const out = scoreRubricCriteria(
      [def('Content', 50), def('Grammar', 50)],
      [ai('Content', 150), ai('Grammar', -10)],
      10
    );
    assert.deepEqual(out.criteria.map(c => c.score), [100, 0]);
    assert.equal(out.questionScore, 5);
  });

  test('feedback is only kept when it is a non-empty string (no undefined key)', () => {
    const out = scoreRubricCriteria(
      [def('Content', 50), def('Grammar', 50)],
      [ai('Content', 80, 'Good ideas'), ai('Grammar', 60)],
      10
    );
    assert.equal(out.criteria[0]!.feedback, 'Good ideas');
    assert.equal('feedback' in out.criteria[1]!, false);
  });
});

describe('scoreRubricCriteria — weights', () => {
  test('NaN / negative / undefined / Infinity weights are excluded from score and breakdown', () => {
    const defs = [
      def('Content', 50),
      def('Grammar', Number.NaN),
      def('Vocabulary', -10),
      { name: 'Coherence', description: '', levels: [] } as unknown as IRubricCriterionDefinition,
      def('Style', Number.POSITIVE_INFINITY),
    ];
    const out = scoreRubricCriteria(
      defs,
      [ai('Content', 80), ai('Grammar', 0), ai('Vocabulary', 0), ai('Coherence', 0), ai('Style', 0)],
      10
    );
    assert.deepEqual(out.criteria.map(c => c.name), ['Content']);
    assert.equal(out.partial, false, 'zero-weight criteria do not count toward partial');
    assert.equal(out.questionScore, 8);
    assert.ok(Number.isFinite(out.questionScore));
  });

  test('all weights non-positive -> fallback signal, never NaN', () => {
    const out = scoreRubricCriteria([def('Content', 0), def('Grammar', Number.NaN)], [ai('Content', 90), ai('Grammar', 90)], 10);
    assert.deepEqual(out, { criteria: [], partial: false, questionScore: 0 });
  });

  test('legacy rubric weights not summing to 100 are normalized by their actual sum', () => {
    const out = scoreRubricCriteria(
      [def('Content', 50), def('Grammar', 40)],
      [ai('Content', 90), ai('Grammar', 45)],
      10
    );
    // (90*50 + 45*40) / 90 = 70 -> 7
    assert.equal(out.questionScore, 7);
  });
});

describe('scoreRubricCriteria — duplicate criterion names', () => {
  test('duplicates pair positionally among themselves when counts line up', () => {
    const out = scoreRubricCriteria(
      [def('Content', 40), def('Content', 20), def('Grammar', 40)],
      [ai('content', 90), ai('Grammar', 50), ai('CONTENT', 30)],
      10
    );
    assert.deepEqual(out.criteria.map(c => [c.name, c.weight, c.score]), [
      ['Content', 40, 90],
      ['Content', 20, 30],
      ['Grammar', 40, 50],
    ]);
    assert.equal(out.partial, false);
  });

  test('duplicate group with mismatched counts is ambiguous -> both missing, entry not reused positionally', () => {
    const out = scoreRubricCriteria(
      [def('Content', 40), def('Content', 20), def('Grammar', 40)],
      [ai('Content', 90), ai('Grammar', 50), ai('Other', 10)],
      10
    );
    assert.deepEqual(out.criteria.map(c => c.name), ['Grammar']);
    assert.equal(out.partial, true);
  });

  test('AI repeating a name defined once is ambiguous -> that criterion is missing', () => {
    const out = scoreRubricCriteria(
      [def('Content', 50), def('Grammar', 50)],
      [ai('Content', 90), ai('Content', 10)],
      10
    );
    assert.deepEqual(out.criteria, []);
  });

  test('buildCriteriaScoreMap keeps every duplicate under a unique key', () => {
    const map = buildCriteriaScoreMap([
      { name: 'Content', weight: 40, score: 90 },
      { name: 'Content', weight: 20, score: 30 },
      { name: 'Grammar', weight: 40, score: 50 },
      { name: 'Content', weight: 10, score: 5 },
    ]);
    assert.deepEqual(map, { Content: 90, 'Content (2)': 30, Grammar: 50, 'Content (3)': 5 });
  });
});

describe('computeRubricQuestionScore', () => {
  test('rounds to 2 decimals in points', () => {
    // (100*1 + 0*2) / 3 = 33.333% of 10 -> 3.33
    assert.equal(
      computeRubricQuestionScore([{ name: 'A', weight: 1, score: 100 }, { name: 'B', weight: 2, score: 0 }], 10),
      3.33
    );
  });

  test('uses the same effective weight in numerator and denominator (bad weight never yields NaN)', () => {
    const score = computeRubricQuestionScore(
      [{ name: 'A', weight: 50, score: 80 }, { name: 'B', weight: Number.NaN, score: 10 }, { name: 'C', weight: -5, score: 10 }],
      10
    );
    assert.equal(score, 8);
  });

  test('empty or all-zero weights -> 0', () => {
    assert.equal(computeRubricQuestionScore([], 10), 0);
    assert.equal(computeRubricQuestionScore([{ name: 'A', weight: 0, score: 100 }], 10), 0);
  });
});

describe('helpers', () => {
  test('effectiveWeight', () => {
    assert.equal(effectiveWeight(30), 30);
    for (const w of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, undefined, null, '30']) {
      assert.equal(effectiveWeight(w), 0, `weight ${String(w)}`);
    }
  });

  test('hasScorableCriteria', () => {
    assert.equal(hasScorableCriteria([]), false);
    assert.equal(hasScorableCriteria(undefined), false);
    assert.equal(hasScorableCriteria([def('A', 0)]), false);
    assert.equal(hasScorableCriteria([def('A', 0), def('B', 10)]), true);
  });

  test('normalizeCriterionName', () => {
    assert.equal(normalizeCriterionName('  Coherencia   y  Cohesión '), 'coherencia y cohesion');
    assert.equal(normalizeCriterionName(undefined), '');
    assert.equal(normalizeCriterionName(42), '');
  });

  test('parseCriterionScore', () => {
    assert.equal(parseCriterionScore(70), 70);
    assert.equal(parseCriterionScore('70.5'), 70.5);
    assert.equal(parseCriterionScore(0), 0);
    for (const bad of [null, true, '', ' ', [], [70], {}, 'abc', Number.NaN, undefined]) {
      assert.equal(parseCriterionScore(bad), undefined, `score ${JSON.stringify(bad)}`);
    }
  });
});

describe('computeWeightedPercentage (PR 1a)', () => {
  function section(percentage: number, weight: number): SectionScoreInput {
    return { name: 's', competency: 'c', score: percentage, maxScore: 100, percentage, weight };
  }

  test('3 equal sections at 70% -> 70 (no rounding drift)', () => {
    const out = computeWeightedPercentage([section(70, 33.3), section(70, 33.3), section(70, 33.4)], 0);
    assert.equal(out.percentage, 70);
  });

  test('3 sections at 100% -> 100', () => {
    assert.equal(computeWeightedPercentage([section(100, 30), section(100, 30), section(100, 40)], 0).percentage, 100);
  });

  test('2 sections at 69.9% -> 69.9', () => {
    assert.equal(computeWeightedPercentage([section(69.9, 50), section(69.9, 50)], 0).percentage, 69.9);
  });

  test('Infinity weight section is ineligible; the rest are weighted normally', () => {
    const out = computeWeightedPercentage([section(40, Number.POSITIVE_INFINITY), section(80, 50)], 0);
    assert.equal(out.percentage, 80);
    assert.equal(out.sections[0]!.weightedPercentage, 0);
  });

  test('all weights ineligible -> fallback percentage', () => {
    const out = computeWeightedPercentage([section(40, 0), section(80, Number.NaN)], 55.5);
    assert.equal(out.percentage, 55.5);
  });

  test('empty section (maxScore 0) is excluded from both sums', () => {
    const out = computeWeightedPercentage(
      [section(90, 50), { name: 'e', competency: 'c', score: 0, maxScore: 0, percentage: 0, weight: 50 }],
      0
    );
    assert.equal(out.percentage, 90);
  });
});
