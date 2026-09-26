/**
 * grading-section-weights: Weight Sum Validation on Write — enforced in the
 * service layer so no write path (create, update, clone) can persist an exam
 * whose section weights don't sum to 100.
 *
 * The Exam model is replaced by a constructor mock that records every
 * document saved, so "nothing persisted" can be asserted directly.
 */

const saved: Array<Record<string, unknown>> = [];
const findById = jest.fn();
const findByIdAndUpdate = jest.fn();

jest.mock('../src/models/exam.model', () => {
  const Exam = jest.fn().mockImplementation((data: Record<string, unknown>) => ({
    ...data,
    _id: 'new-exam-id',
    save: jest.fn(async () => {
      saved.push(data);
    }),
  }));
  Object.assign(Exam, {
    findById: (...args: unknown[]) => findById(...args),
    findByIdAndUpdate: (...args: unknown[]) => findByIdAndUpdate(...args),
  });
  return { Exam };
});
jest.mock('../src/models/question.model', () => ({ Question: {} }));
jest.mock('../src/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('../src/services/kafka.service', () => ({
  KafkaService: jest.fn().mockImplementation(() => ({ publishEvent: jest.fn(async () => undefined) })),
}));

import { AppError } from '../src/middleware/errorHandler.middleware';
import { ExamService } from '../src/services/exam.service';
import { assertSectionWeightsSumTo100 } from '../src/utils/assertSectionWeights';
import { getSectionWeightsSumError, INVALID_SECTION_WEIGHTS } from '../src/utils/sectionWeights';

const sections = (...weights: number[]) =>
  weights.map((weight, i) => ({
    name: `Sección ${i + 1}`,
    competency: 'reading',
    duration: 30,
    questionCount: 10,
    weight,
  }));

const examData = (...weights: number[]) => ({
  name: 'Examen de prueba',
  type: 'final',
  targetLevel: 'B1',
  structure: { sections: sections(...weights), totalDuration: 60, passingScore: 70 },
});

beforeEach(() => {
  saved.length = 0;
  findById.mockReset();
  findByIdAndUpdate.mockReset();
});

describe('sectionWeights helper', () => {
  it('skips exams without sections', () => {
    expect(getSectionWeightsSumError(undefined)).toBeNull();
    expect(getSectionWeightsSumError([])).toBeNull();
    expect(() => assertSectionWeightsSumTo100([])).not.toThrow();
  });

  it('accepts exact and within-tolerance sums', () => {
    expect(getSectionWeightsSumError(sections(60, 40))).toBeNull();
    expect(getSectionWeightsSumError(sections(33.33, 33.33, 33.34))).toBeNull();
    expect(getSectionWeightsSumError(sections(66.665, 33.33))).toBeNull(); // 99.995
  });

  it('rejects sums at or beyond the tolerance, formatting the total to 2 decimals', () => {
    expect(getSectionWeightsSumError(sections(33.33, 33.33, 33.33))).toBe(
      'Las secciones deben sumar 100% de peso (suma actual: 99.99%)'
    );
    expect(getSectionWeightsSumError(sections(60, 30))).toBe(
      'Las secciones deben sumar 100% de peso (suma actual: 90%)'
    );
    // Same 99.99 total, but the float sum is 99.99000000000001: must also be rejected.
    expect(getSectionWeightsSumError(sections(10, 20, 30, 39.99))).toBe(
      'Las secciones deben sumar 100% de peso (suma actual: 99.99%)'
    );
  });

  it('treats missing weights (legacy documents) as 0', () => {
    expect(getSectionWeightsSumError([{ weight: 50 }, {}])).toBe(
      'Las secciones deben sumar 100% de peso (suma actual: 50%)'
    );
  });

  it('throws a 400 AppError with code INVALID_SECTION_WEIGHTS', () => {
    let caught: unknown;
    try {
      assertSectionWeightsSumTo100(sections(10, 10));
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(AppError);
    expect((caught as AppError).statusCode).toBe(400);
    expect((caught as AppError).code).toBe(INVALID_SECTION_WEIGHTS);
  });
});

describe('ExamService — weight sum enforced on every write', () => {
  it('create persists an exam whose weights sum to 100', async () => {
    await new ExamService().create(examData(60, 40) as never);
    expect(saved).toHaveLength(1);
  });

  it('create rejects weights that do not sum to 100 and persists nothing', async () => {
    await expect(new ExamService().create(examData(60, 30) as never)).rejects.toMatchObject({
      statusCode: 400,
      code: INVALID_SECTION_WEIGHTS,
    });
    expect(saved).toHaveLength(0);
  });

  it('update rejects invalid section weights without touching the database', async () => {
    await expect(
      new ExamService().update('507f1f77bcf86cd799439011', { structure: examData(60, 30).structure } as never)
    ).rejects.toMatchObject({ statusCode: 400, code: INVALID_SECTION_WEIGHTS });
    expect(findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('update without sections (e.g. only the name) is not blocked by legacy weights', async () => {
    findByIdAndUpdate.mockResolvedValue({ _id: 'legacy', name: 'Nuevo nombre' });
    await expect(
      new ExamService().update('507f1f77bcf86cd799439011', { name: 'Nuevo nombre' } as never)
    ).resolves.toMatchObject({ name: 'Nuevo nombre' });
  });

  it('clone of a legacy exam with invalid weights is rejected with a clear message, nothing persisted', async () => {
    const legacy = examData(10, 10);
    findById.mockReturnValue({
      populate: async () => ({ ...legacy, _id: 'legacy', toObject: () => ({ ...legacy }) }),
    });

    await expect(
      new ExamService().cloneExam('507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012')
    ).rejects.toMatchObject({
      statusCode: 400,
      code: INVALID_SECTION_WEIGHTS,
      message:
        'No se puede clonar: las secciones del examen original suman 20% de peso (deben sumar 100%). ' +
        'Corrige los pesos del examen antes de clonarlo.',
    });
    expect(saved).toHaveLength(0);
  });

  it('clone of a valid exam still works', async () => {
    const original = examData(70, 30);
    findById.mockReturnValue({
      populate: async () => ({ ...original, _id: 'orig', toObject: () => ({ ...original, _id: 'orig' }) }),
    });

    await new ExamService().cloneExam('507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012');
    expect(saved).toHaveLength(1);
    expect(saved[0]?.name).toBe('Examen de prueba (Copy)');
  });
});
