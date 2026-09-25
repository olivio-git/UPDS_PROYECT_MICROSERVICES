/**
 * Generic "percentage weights must sum to 100" math, shared by every entity
 * that carries a `weight` per item (exam sections, rubric criteria). Kept
 * dependency-free (pure functions, no AppError/Zod imports) so both the
 * request schemas and the service layer can use it without coupling.
 *
 * Tolerance: a sum is valid when |sum - 100| < 0.01, compared at a 1e-6 scale
 * so raw float sums like 10+20+30+39.99 (99.99000000000001) are judged the
 * same as 33.33*3 (99.99) — see design.md D12.
 */
export const WEIGHT_SUM_TOLERANCE = 0.01;

export interface Weighted {
  weight?: number | null;
}

/** Rounds to 2 decimals for messages, dropping float noise. */
export const formatWeight = (value: number): number => Number(value.toFixed(2));

/** Sum of item weights, or null when there are no items to check. */
export function getWeightsTotal(
  items: ReadonlyArray<Weighted> | null | undefined
): number | null {
  if (!items || items.length === 0) return null;
  return items.reduce((sum, item) => sum + (Number(item?.weight) || 0), 0);
}

export const isWeightSumValid = (total: number): boolean =>
  Math.round(Math.abs(total - 100) * 1e6) < Math.round(WEIGHT_SUM_TOLERANCE * 1e6);
