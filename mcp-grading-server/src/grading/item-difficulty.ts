/**
 * Item statistics from real use: how often each question was answered and what
 * share of its points students earned (classical p-value). Once a question has
 * enough answers, its observed difficulty replaces the one the author guessed,
 * so the bank learns which "easy" questions students actually find hard.
 *
 * Observed difficulty (1–5) from the share of points earned:
 *   ≥85% → 1, ≥70% → 2, ≥50% → 3, ≥30% → 4, below → 5.
 */
export const MIN_ANSWERS_FOR_OBSERVED_DIFFICULTY = 20;

export function observedDifficulty(averageShare: number): number {
  if (averageShare >= 0.85) return 1;
  if (averageShare >= 0.7) return 2;
  if (averageShare >= 0.5) return 3;
  if (averageShare >= 0.3) return 4;
  return 5;
}
