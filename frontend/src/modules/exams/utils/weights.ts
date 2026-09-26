/**
 * Shared helpers for percentage weights that must sum to 100 (exam sections,
 * rubric criteria).
 *
 * The tolerance mirrors exam-service (`src/utils/sectionWeights.ts`): a sum is
 * valid when |sum - 100| < 0.01, so decimal splits like 33.33 / 33.33 / 33.34
 * are accepted while 33.33 x 3 (99.99) is rejected.
 */
export const WEIGHT_SUM_TOLERANCE = 0.01;

/** Sums weights, treating missing / non-numeric values as 0. */
export const sumWeights = (weights: ReadonlyArray<number | null | undefined>): number =>
  weights.reduce<number>((sum, weight) => sum + (Number(weight) || 0), 0);

/** Rounds to 2 decimals for display, dropping float noise (e.g. 99.99000000000001). */
export const formatWeight = (value: number): number => Number(value.toFixed(2));

export const isWeightSumValid = (total: number): boolean =>
  // Compare at a 1e-6 scale: raw float sums like 10+20+30+39.99
  // (99.99000000000001) must be judged the same as 33.33*3 (99.99).
  Math.round(Math.abs(total - 100) * 1e6) < Math.round(WEIGHT_SUM_TOLERANCE * 1e6);

/**
 * Splits 100 into `count` integer weights, giving the remainder to the first
 * entries so the result always sums to exactly 100.
 */
export const distributeEvenly = (count: number): number[] => {
  if (count <= 0) return [];
  const evenWeight = Math.floor(100 / count);
  const remainder = 100 % count;
  return Array.from({ length: count }, (_, i) => evenWeight + (i < remainder ? 1 : 0));
};

/** Weight for a newly added entry: whatever is left to reach 100 (never negative). */
export const remainingWeight = (currentTotal: number): number =>
  Math.max(0, formatWeight(100 - currentTotal));
