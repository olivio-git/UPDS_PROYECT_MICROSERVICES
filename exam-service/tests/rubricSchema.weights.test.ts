/**
 * rubric-ai-grading: Rubric Weight Sum Validation and Normalization — save
 * scenario. Saving a rubric whose `criteria[].weight` values don't sum to
 * 100 must be rejected. Decimals are tolerated within 0.01 (same tolerance
 * documented in design.md D12, shared with exam sections).
 */

import { rubricSchema } from '../src/schemas/rubric.schema';

const levels = [
  { score: 4, description: 'Excelente' },
  { score: 1, description: 'Necesita mejora' },
];

const baseCriterion = {
  name: 'Criterio',
  description: 'Descripción',
  levels,
};

const baseRubric = {
  name: 'Rúbrica de prueba',
  competency: 'writing',
  level: 'B1',
  criteria: [
    { ...baseCriterion, name: 'Criterio 1', weight: 70 },
    { ...baseCriterion, name: 'Criterio 2', weight: 30 },
  ],
  scoringType: 'analytic',
  maxScore: 100,
};

const withWeights = (...weights: number[]) => ({
  ...baseRubric,
  criteria: weights.map((weight, i) => ({ ...baseCriterion, name: `Criterio ${i + 1}`, weight })),
});

describe('rubricSchema.create — criteria weight sum validation', () => {
  it('accepts criteria whose weights sum to exactly 100', () => {
    expect(rubricSchema.create.safeParse(withWeights(50, 30, 20)).success).toBe(true);
  });

  it('accepts a sum just inside the 0.01 tolerance (99.995)', () => {
    expect(rubricSchema.create.safeParse(withWeights(66.665, 33.33)).success).toBe(true);
  });

  it('rejects 33.33 x 3 (99.99) — the gap equals the tolerance', () => {
    const result = rubricSchema.create.safeParse(withWeights(33.33, 33.33, 33.33));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        'Los criterios de la rúbrica deben sumar 100% de peso (suma actual: 99.99%)'
      );
    }
  });

  it('rejects criteria whose weights sum to 90 (not 100)', () => {
    expect(rubricSchema.create.safeParse(withWeights(60, 30)).success).toBe(false);
  });
});

describe('rubricSchema.update — criteria weight sum validation', () => {
  it('applies the same weight-sum validation as create when criteria is present', () => {
    expect(rubricSchema.update.safeParse({ criteria: baseRubric.criteria }).success).toBe(true);
    expect(
      rubricSchema.update.safeParse({
        criteria: [
          { ...baseCriterion, name: 'Criterio 1', weight: 60 },
          { ...baseCriterion, name: 'Criterio 2', weight: 30 },
        ],
      }).success
    ).toBe(false);
  });

  it('accepts an update without criteria (e.g. only isActive)', () => {
    expect(rubricSchema.update.safeParse({ isActive: false }).success).toBe(true);
  });
});
