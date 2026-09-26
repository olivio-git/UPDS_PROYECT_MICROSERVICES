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
 */
export const WEIGHT_SUM_TOLERANCE = 0.01;

export const INVALID_SECTION_WEIGHTS = 'INVALID_SECTION_WEIGHTS';

export interface WeightedSection {
  weight?: number | null;
}

/** Rounds to 2 decimals for messages, dropping float noise. */
export const formatWeight = (value: number): number => Number(value.toFixed(2));

/** Sum of section weights, or null when there are no sections to check. */
export function getSectionWeightsTotal(
  sections: ReadonlyArray<WeightedSection> | null | undefined
): number | null {
  if (!sections || sections.length === 0) return null;
  return sections.reduce((sum, section) => sum + (Number(section?.weight) || 0), 0);
}

export const isSectionWeightSumValid = (total: number): boolean =>
  // Compare at a 1e-6 scale: raw float sums like 10+20+30+39.99
  // (99.99000000000001) must be judged the same as 33.33*3 (99.99).
  Math.round(Math.abs(total - 100) * 1e6) < Math.round(WEIGHT_SUM_TOLERANCE * 1e6);

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
