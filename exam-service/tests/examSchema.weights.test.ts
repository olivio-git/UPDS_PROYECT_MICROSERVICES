/**
 * grading-section-weights: Weight Sum Validation on Write.
 *
 * Saving an exam whose `structure.sections[].weight` values don't sum to
 * 100 must be rejected. Decimals are tolerated within 0.01 (same tolerance
 * documented in design.md D12).
 */

import { examSchema } from '../src/schemas/exam.schema';

const baseSection = {
  name: 'Sección',
  competency: 'reading',
  duration: 30,
  questionCount: 10,
};

const baseExam = {
  name: 'Examen de prueba',
  type: 'final',
  targetLevel: 'B1',
  structure: {
    sections: [
      { ...baseSection, name: 'Sección 1', weight: 70 },
      { ...baseSection, name: 'Sección 2', weight: 30 },
    ],
    totalDuration: 60,
    passingScore: 70,
  },
};

describe('examSchema.create — section weight sum validation', () => {
  it('accepts sections whose weights sum to exactly 100', () => {
    const result = examSchema.create.safeParse(baseExam);
    expect(result.success).toBe(true);
  });

  const withWeights = (...weights: number[]) => ({
    ...baseExam,
    structure: {
      ...baseExam.structure,
      sections: weights.map((weight, i) => ({ ...baseSection, name: `Sección ${i + 1}`, weight })),
    },
  });

  it('accepts decimal weights that sum to exactly 100 (33.33 / 33.33 / 33.34)', () => {
    expect(examSchema.create.safeParse(withWeights(33.33, 33.33, 33.34)).success).toBe(true);
  });

  it('accepts a sum just inside the 0.01 tolerance (99.995)', () => {
    expect(examSchema.create.safeParse(withWeights(66.665, 33.33)).success).toBe(true);
  });

  it('rejects 33.33 x 3 (99.99) — the gap equals the tolerance', () => {
    const result = examSchema.create.safeParse(withWeights(33.33, 33.33, 33.33));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        'Las secciones deben sumar 100% de peso (suma actual: 99.99%)'
      );
    }
  });

  it('rejects sections whose weights sum to 90 (not 100)', () => {
    const result = examSchema.create.safeParse({
      ...baseExam,
      structure: {
        ...baseExam.structure,
        sections: [
          { ...baseSection, name: 'Sección 1', weight: 60 },
          { ...baseSection, name: 'Sección 2', weight: 30 },
        ],
      },
    });
    expect(result.success).toBe(false);
  });

  it('allows an exam with no sections (adaptive/placement/flat-pool)', () => {
    const result = examSchema.create.safeParse({
      ...baseExam,
      structure: { sections: [], totalDuration: 60, passingScore: 70 },
    });
    expect(result.success).toBe(true);
  });
});

describe('examSchema.update — section weight sum validation', () => {
  it('applies the same weight-sum validation as create, and skips it when structure is absent', () => {
    expect(examSchema.update.safeParse({ structure: baseExam.structure }).success).toBe(true);
    expect(examSchema.update.safeParse({
      structure: {
        sections: [
          { ...baseSection, name: 'Sección 1', weight: 60 },
          { ...baseSection, name: 'Sección 2', weight: 30 },
        ],
        totalDuration: 60,
        passingScore: 70,
      },
    }).success).toBe(false);
    expect(examSchema.update.safeParse({ name: 'Nuevo nombre' }).success).toBe(true);
  });

  it('accepts an update that clears the sections (structure.sections: [])', () => {
    expect(examSchema.update.safeParse({
      structure: { sections: [], totalDuration: 60, passingScore: 70 },
    }).success).toBe(true);
  });
});
