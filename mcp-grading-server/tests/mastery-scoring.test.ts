import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { computeMastery } from '../src/grading/scoring.js';
import type { ILevel } from '../src/types/index.js';

function level(overrides: Partial<ILevel> = {}): ILevel {
  return {
    _id: 'level-1' as any,
    code: 'B1',
    isActive: true,
    overallMinScore: 60,
    competencyRequirements: {
      grammar: { minScore: 70 },
      vocabulary: { minScore: 60 },
    },
    ...overrides,
  };
}

describe('computeMastery — level-mastery-indicator spec', () => {
  test('per-competency achieved/not-achieved vs Level.competencyRequirements[].minScore', () => {
    const mastery = computeMastery(
      [
        { competency: 'grammar', percentage: 80 },
        { competency: 'vocabulary', percentage: 50 },
      ],
      65,
      'final',
      level()
    );
    assert.ok(mastery);
    assert.equal(mastery!.levelCode, 'B1');
    assert.deepEqual(
      mastery!.competencies.map(c => [c.competency, c.achieved]),
      [['grammar', true], ['vocabulary', false]]
    );
  });

  test('overall achieved/not-achieved vs Level.overallMinScore, using the exam final percentage (weighted when applicable)', () => {
    const passing = computeMastery([{ competency: 'grammar', percentage: 90 }], 60, 'final', level());
    assert.equal(passing!.overall.achieved, true);
    assert.equal(passing!.overall.percentage, 60);

    const failing = computeMastery([{ competency: 'grammar', percentage: 90 }], 59.9, 'final', level());
    assert.equal(failing!.overall.achieved, false);
  });

  test('mastery is independent of passed: a bad competency does not change the overall achieved decision by itself', () => {
    // Overall is computed only from overallPercentage vs overallMinScore —
    // a failed competency does not drag the overall verdict down.
    const mastery = computeMastery(
      [{ competency: 'grammar', percentage: 10 }],
      75,
      'final',
      level()
    );
    assert.equal(mastery!.overall.achieved, true);
    assert.equal(mastery!.competencies[0]!.achieved, false);
  });

  test('omitted for placement exams', () => {
    assert.equal(computeMastery([{ competency: 'grammar', percentage: 90 }], 90, 'placement', level()), undefined);
  });

  test('omitted when the level did not resolve (missing/deleted targetLevel)', () => {
    assert.equal(computeMastery([{ competency: 'grammar', percentage: 90 }], 90, 'final', null), undefined);
    assert.equal(computeMastery([{ competency: 'grammar', percentage: 90 }], 90, 'final', undefined), undefined);
  });

  test('omitted when the level resolved but is inactive', () => {
    assert.equal(
      computeMastery([{ competency: 'grammar', percentage: 90 }], 90, 'final', level({ isActive: false })),
      undefined
    );
  });

  test('omitted when the level has no competencyRequirements object', () => {
    assert.equal(
      computeMastery(
        [{ competency: 'grammar', percentage: 90 }],
        90,
        'final',
        level({ competencyRequirements: undefined as any })
      ),
      undefined
    );
  });

  test('omitted when the level has no numeric overallMinScore', () => {
    assert.equal(
      computeMastery([{ competency: 'grammar', percentage: 90 }], 90, 'final', level({ overallMinScore: undefined as any })),
      undefined
    );
  });

  test('a competency the exam evaluated but the level does not require is skipped (not reported achieved or not-achieved)', () => {
    const mastery = computeMastery(
      [{ competency: 'listening', percentage: 90 }],
      90,
      'final',
      level() // only defines grammar/vocabulary
    );
    assert.ok(mastery);
    assert.equal(mastery!.competencies.length, 0);
  });

  test('flat-question-pool exam: mastery is computed from competencyScores regardless of exam sections', () => {
    // computeMastery never reads `sections` — it only takes the already
    // per-competency-aggregated scores, which grade-exam.ts derives from
    // questionResults for both sectioned and flat-pool exams alike.
    const mastery = computeMastery(
      [
        { competency: 'grammar', percentage: 100 },
        { competency: 'vocabulary', percentage: 100 },
      ],
      100,
      'progress',
      level()
    );
    assert.equal(mastery!.competencies.length, 2);
  });
});
