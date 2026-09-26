/**
 * grading-section-weights: Weight Sum Validation on Write.
 *
 * Sections shape the final weighted score at grading time, so their weights
 * must sum to 100 — otherwise the score wouldn't mean what the teacher
 * configured. Decimals are allowed; a sum is rejected when |sum - 100| >= 0.01
 * (design.md D12). Exams without sections (adaptive/placement/flat-pool) are
 * not checked and keep the raw-sum behavior.
 *
 * Shared by the Zod request schema and ExamService (via
 * assertSectionWeights.ts) so every write path (create, update, clone)
 * enforces the same rule. Kept dependency-free so the schema can import it.
 *
 * The underlying sum/tolerance math lives in `weightSum.ts` — shared with
 * `rubricWeights.ts` (rubric criteria have the exact same "must sum to 100"
 * rule) so both entities compare at the same 1e-6 scale without duplicating
 * the formula.
 */
import { formatWeight, getWeightsTotal, isWeightSumValid, WEIGHT_SUM_TOLERANCE, type Weighted } from './weightSum';

export { WEIGHT_SUM_TOLERANCE, formatWeight };

export const INVALID_SECTION_WEIGHTS = 'INVALID_SECTION_WEIGHTS';

export type WeightedSection = Weighted;

/** Sum of section weights, or null when there are no sections to check. */
export function getSectionWeightsTotal(
  sections: ReadonlyArray<WeightedSection> | null | undefined
): number | null {
  return getWeightsTotal(sections);
}

export const isSectionWeightSumValid = isWeightSumValid;

export const sectionWeightsSumMessage = (total: number): string =>
  `Las secciones deben sumar 100% de peso (suma actual: ${formatWeight(total)}%)`;

/** Returns the Spanish error message when weights are invalid, null otherwise. */
export function getSectionWeightsSumError(
  sections: ReadonlyArray<WeightedSection> | null | undefined
): string | null {
  const total = getSectionWeightsTotal(sections);
  if (total === null || isSectionWeightSumValid(total)) return null;
  return sectionWeightsSumMessage(total);
}
