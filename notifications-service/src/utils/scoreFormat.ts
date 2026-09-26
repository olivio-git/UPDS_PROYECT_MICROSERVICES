/**
 * Student-facing score display shared by the in-app and email copy:
 * "78% (42/60 puntos)". Mirrors the frontend's formatter by convention (no
 * cross-service import), so every channel shows a score the same way.
 */

/** Up to `digits` decimals, without trailing zeros: 78 → "78", 78.25 → "78.3". */
function trimDecimals(value: number, digits: number): string {
  return String(Number(value.toFixed(digits)));
}

export function formatScoreSummary(percentage: number, score: number, maxScore: number): string {
  return `${trimDecimals(percentage, 1)}% (${trimDecimals(score, 2)}/${trimDecimals(maxScore, 2)} puntos)`;
}
