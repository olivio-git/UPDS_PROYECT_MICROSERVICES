import { AppError } from '../middleware/errorHandler.middleware';
import {
  getRubricWeightsTotal,
  INVALID_RUBRIC_WEIGHTS,
  isRubricWeightSumValid,
  rubricWeightsSumMessage,
  type WeightedCriterion,
} from './rubricWeights';

/**
 * Throws a 400 AppError (code INVALID_RUBRIC_WEIGHTS) when the rubric's
 * criteria weights don't sum to 100. `buildMessage` lets callers such as
 * clone explain what the teacher has to do.
 */
export function assertRubricWeightsSumTo100(
  criteria: ReadonlyArray<WeightedCriterion> | null | undefined,
  buildMessage: (total: number) => string = rubricWeightsSumMessage
): void {
  const total = getRubricWeightsTotal(criteria);
  if (total === null || isRubricWeightSumValid(total)) return;
  throw new AppError(buildMessage(total), 400, INVALID_RUBRIC_WEIGHTS);
}

export const RUBRIC_CRITERIA_REQUIRED = 'RUBRIC_CRITERIA_REQUIRED';

export const rubricCriteriaRequiredMessage = 'La rúbrica debe tener al menos un criterio.';

/**
 * Throws a 400 AppError (code RUBRIC_CRITERIA_REQUIRED) when the rubric has
 * no criteria. The weight-sum check skips empty lists on purpose, so write
 * paths that bypass the route schema (e.g. clone of a legacy rubric) need
 * this explicit guard.
 */
export function assertRubricHasCriteria(
  criteria: ReadonlyArray<WeightedCriterion> | null | undefined,
  message: string = rubricCriteriaRequiredMessage
): void {
  if (Array.isArray(criteria) && criteria.length > 0) return;
  throw new AppError(message, 400, RUBRIC_CRITERIA_REQUIRED);
}
