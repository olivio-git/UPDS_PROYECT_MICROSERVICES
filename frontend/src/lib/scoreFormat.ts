/**
 * Student-facing score display: "78% (42/60 puntos)", built from
 * `formatPercent` + `formatPoints` so every student screen shows a score the
 * same way (notifications-service renders the same format in its in-app and
 * email copy with its own formatter — no cross-service import).
 */

/** Up to `digits` decimals, without trailing zeros: 78 → "78", 78.25 → "78.3". */
const trimDecimals = (value: number, digits: number): string => String(Number(value.toFixed(digits)));

/** "78%" */
export const formatPercent = (percentage: number): string => `${trimDecimals(percentage, 1)}%`;

/** "42/60 puntos" */
export const formatPoints = (score: number, maxScore: number): string =>
  `${trimDecimals(score, 2)}/${trimDecimals(maxScore, 2)} puntos`;
