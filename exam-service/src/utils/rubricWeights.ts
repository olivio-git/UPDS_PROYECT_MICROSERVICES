/**
 * rubric-ai-grading: Rubric Weight Sum Validation and Normalization — write
 * side. A rubric's criteria weights must sum to 100, exactly like exam
 * sections (`sectionWeights.ts`) — same tolerance, same shared math
 * (`weightSum.ts`). The grading-time safety net (normalizing by the actual
 * matched-weight sum for legacy rubrics) already lives in
 * `mcp-grading-server/src/grading/scoring.ts` (`computeRubricQuestionScore`);
 * this file only covers the write-time rejection.
 *
 * Shared by the Zod request schema and RubricService (via
 * assertRubricWeights.ts) so every write path (create, update, clone)
 * enforces the same rule.
 */
import { formatWeight, getWeightsTotal, isWeightSumValid, WEIGHT_SUM_TOLERANCE, type Weighted } from './weightSum';

export { WEIGHT_SUM_TOLERANCE, formatWeight };

export const INVALID_RUBRIC_WEIGHTS = 'INVALID_RUBRIC_WEIGHTS';

export type WeightedCriterion = Weighted;

/** Sum of criteria weights, or null when there are no criteria to check. */
export function getRubricWeightsTotal(
  criteria: ReadonlyArray<WeightedCriterion> | null | undefined
): number | null {
  return getWeightsTotal(criteria);
}

export const isRubricWeightSumValid = isWeightSumValid;

export const rubricWeightsSumMessage = (total: number): string =>
  `Los criterios de la rúbrica deben sumar 100% de peso (suma actual: ${formatWeight(total)}%)`;

/** Returns the Spanish error message when weights are invalid, null otherwise. */
export function getRubricWeightsSumError(
  criteria: ReadonlyArray<WeightedCriterion> | null | undefined
): string | null {
  const total = getRubricWeightsTotal(criteria);
  if (total === null || isRubricWeightSumValid(total)) return null;
  return rubricWeightsSumMessage(total);
}
