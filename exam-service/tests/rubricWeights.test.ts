/**
 * rubric-ai-grading: Rubric Weight Sum Validation and Normalization — write
 * side enforced in the service layer so no write path (create, update,
 * clone) can persist a rubric whose criteria weights don't sum to 100.
 *
 * Mirrors `tests/sectionWeights.test.ts`: the Rubric model is replaced by a
 * constructor mock that records every document saved, so "nothing
 * persisted" can be asserted directly.
 */

const saved: Array<Record<string, unknown>> = [];
const findById = jest.fn();
const findByIdAndUpdate = jest.fn();

jest.mock('../src/models/rubric.model', () => {
  const Rubric = jest.fn().mockImplementation((data: Record<string, unknown>) => ({
    ...data,
    _id: 'new-rubric-id',
    save: jest.fn(async () => {
      saved.push(data);
    }),
  }));
  Object.assign(Rubric, {
    findById: (...args: unknown[]) => findById(...args),
    findByIdAndUpdate: (...args: unknown[]) => findByIdAndUpdate(...args),
  });
  return { Rubric };
});
jest.mock('../src/config/redis', () => ({
  cache: {
    get: jest.fn(async () => null),
    set: jest.fn(async () => undefined),
    del: jest.fn(async () => undefined),
  },
}));
jest.mock('../src/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('../src/services/kafka.service', () => ({
  KafkaService: jest.fn().mockImplementation(() => ({ publishEvent: jest.fn(async () => undefined) })),
}));

import { AppError } from '../src/middleware/errorHandler.middleware';
import { RubricService } from '../src/services/rubric.service';
import { assertRubricWeightsSumTo100, RUBRIC_CRITERIA_REQUIRED } from '../src/utils/assertRubricWeights';
import { getRubricWeightsSumError, INVALID_RUBRIC_WEIGHTS } from '../src/utils/rubricWeights';

const levels = [
  { score: 4, description: 'Excelente' },
  { score: 1, description: 'Necesita mejora' },
];

const criteria = (...weights: number[]) =>
  weights.map((weight, i) => ({
    name: `Criterio ${i + 1}`,
    description: 'Descripción',
    weight,
    levels,
  }));

const rubricData = (...weights: number[]) => ({
  name: 'Rúbrica de prueba',
  competency: 'writing',
  level: 'B1',
  criteria: criteria(...weights),
  scoringType: 'analytic',
  maxScore: 100,
});

beforeEach(() => {
  saved.length = 0;
  findById.mockReset();
  findByIdAndUpdate.mockReset();
});

describe('rubricWeights helper', () => {
  it('skips rubrics without criteria', () => {
    expect(getRubricWeightsSumError(undefined)).toBeNull();
    expect(getRubricWeightsSumError([])).toBeNull();
    expect(() => assertRubricWeightsSumTo100([])).not.toThrow();
  });

  it('accepts exact and within-tolerance sums', () => {
    expect(getRubricWeightsSumError(criteria(50, 30, 20))).toBeNull();
    expect(getRubricWeightsSumError(criteria(33.33, 33.33, 33.34))).toBeNull();
    expect(getRubricWeightsSumError(criteria(66.665, 33.33))).toBeNull(); // 99.995
  });

  it('rejects sums at or beyond the tolerance, formatting the total to 2 decimals', () => {
    expect(getRubricWeightsSumError(criteria(33.33, 33.33, 33.33))).toBe(
      'Los criterios de la rúbrica deben sumar 100% de peso (suma actual: 99.99%)'
    );
    expect(getRubricWeightsSumError(criteria(60, 30))).toBe(
      'Los criterios de la rúbrica deben sumar 100% de peso (suma actual: 90%)'
    );
  });

  it('throws a 400 AppError with code INVALID_RUBRIC_WEIGHTS', () => {
    let caught: unknown;
    try {
      assertRubricWeightsSumTo100(criteria(10, 10));
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(AppError);
    expect((caught as AppError).statusCode).toBe(400);
    expect((caught as AppError).code).toBe(INVALID_RUBRIC_WEIGHTS);
  });
});

describe('RubricService — weight sum enforced on every write', () => {
  it('create persists a rubric whose criteria weights sum to 100', async () => {
    await new RubricService().create(rubricData(50, 30, 20) as never);
    expect(saved).toHaveLength(1);
  });

  it('create rejects criteria weights that do not sum to 100 and persists nothing', async () => {
    await expect(new RubricService().create(rubricData(50, 30) as never)).rejects.toMatchObject({
      statusCode: 400,
      code: INVALID_RUBRIC_WEIGHTS,
    });
    expect(saved).toHaveLength(0);
  });

  it('update rejects invalid criteria weights without touching the database', async () => {
    await expect(
      new RubricService().update('507f1f77bcf86cd799439011', { criteria: criteria(50, 30) } as never)
    ).rejects.toMatchObject({ statusCode: 400, code: INVALID_RUBRIC_WEIGHTS });
    expect(findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('create rejects missing or empty criteria with a 400 and persists nothing', async () => {
    const { criteria: _omit, ...withoutCriteria } = rubricData(100);
    await expect(new RubricService().create(withoutCriteria as never)).rejects.toMatchObject({
      statusCode: 400,
      code: RUBRIC_CRITERIA_REQUIRED,
      message: 'La rúbrica debe tener al menos un criterio.',
    });
    await expect(
      new RubricService().create({ ...rubricData(100), criteria: [] } as never)
    ).rejects.toMatchObject({ statusCode: 400, code: RUBRIC_CRITERIA_REQUIRED });
    expect(saved).toHaveLength(0);
  });

  it('update with valid criteria weights reaches findByIdAndUpdate', async () => {
    const validCriteria = criteria(60, 40);
    findByIdAndUpdate.mockResolvedValue({ _id: 'rubric-1', criteria: validCriteria });

    await expect(
      new RubricService().update('507f1f77bcf86cd799439011', { criteria: validCriteria } as never)
    ).resolves.toMatchObject({ _id: 'rubric-1' });
    expect(findByIdAndUpdate).toHaveBeenCalledTimes(1);
    expect(findByIdAndUpdate).toHaveBeenCalledWith(
      '507f1f77bcf86cd799439011',
      { $set: { criteria: validCriteria } },
      { new: true, runValidators: true }
    );
  });

  it('update with an empty criteria list is rejected without touching the database', async () => {
    await expect(
      new RubricService().update('507f1f77bcf86cd799439011', { criteria: [] } as never)
    ).rejects.toMatchObject({ statusCode: 400, code: RUBRIC_CRITERIA_REQUIRED });
    expect(findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('update without criteria (e.g. only isActive) is not blocked by legacy weights', async () => {
    findByIdAndUpdate.mockResolvedValue({ _id: 'legacy', isActive: false });
    await expect(
      new RubricService().update('507f1f77bcf86cd799439011', { isActive: false } as never)
    ).resolves.toMatchObject({ isActive: false });
  });

  it('clone of a legacy rubric with invalid weights is rejected with a clear message, nothing persisted', async () => {
    const legacy = rubricData(10, 10);
    findById.mockResolvedValue({ ...legacy, _id: 'legacy' });

    await expect(
      new RubricService().clone('507f1f77bcf86cd799439011', 'Copia', 'user-1')
    ).rejects.toMatchObject({
      statusCode: 400,
      code: INVALID_RUBRIC_WEIGHTS,
      message:
        'No se puede clonar: los criterios de la rúbrica original suman 20% de peso (deben sumar 100%). ' +
        'Corrige los pesos de la rúbrica antes de clonarla.',
    });
    expect(saved).toHaveLength(0);
  });

  it('clone of a legacy rubric with empty criteria is rejected with a 400, nothing persisted', async () => {
    findById.mockResolvedValue({ ...rubricData(), criteria: [], _id: 'legacy-empty' });

    await expect(
      new RubricService().clone('507f1f77bcf86cd799439011', 'Copia', 'user-1')
    ).rejects.toMatchObject({
      statusCode: 400,
      code: RUBRIC_CRITERIA_REQUIRED,
      message:
        'No se puede clonar: la rúbrica original no tiene criterios. ' +
        'Agrega al menos un criterio a la rúbrica antes de clonarla.',
    });
    expect(saved).toHaveLength(0);
  });

  it('clone of a valid rubric still works', async () => {
    const original = rubricData(70, 30);
    findById.mockResolvedValue({ ...original, _id: 'orig' });

    await new RubricService().clone('507f1f77bcf86cd799439011', 'Copia', 'user-1');
    expect(saved).toHaveLength(1);
    expect(saved[0]?.name).toBe('Copia');
  });
});
