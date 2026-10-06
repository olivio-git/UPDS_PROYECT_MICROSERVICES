/** Minimal rubric shape the score needs (kept free of app imports so it is testable alone). */
export interface ScoringCriterion {
  name: string;
  weight?: number;
  levels: Array<{ score: number }>;
}

const effectiveWeight = (w: unknown) => (typeof w === 'number' && Number.isFinite(w) && w > 0 ? w : 0);

/** A rubric level as a 0–100 criterion score (the scale the AI grader uses). */
export function levelPercent(criterion: ScoringCriterion, pick: number): number {
  const top = Math.max(...criterion.levels.map((l) => l.score), 0);
  return top > 0 ? (pick / top) * 100 : 0;
}

/**
 * Question score from rubric picks. Mirrors the grading service's
 * computeRubricQuestionScore (mcp-grading-server/src/grading/scoring.ts) so a
 * teacher's grade and an AI grade of the same work land on the same number:
 * criteria as 0–100, weighted by their positive weights and normalised by the
 * actual weight sum, rounded to 2 decimals. A rubric with no usable weights
 * counts every criterion equally.
 */
export function scoreFromRubric(
  criteria: ScoringCriterion[],
  picks: Record<string, number>,
  maxScore: number,
): number | null {
  if (!criteria.length || criteria.some((c) => picks[c.name] === undefined)) return null;
  const anyWeight = criteria.some((c) => effectiveWeight(c.weight) > 0);
  let weightSum = 0;
  let weighted = 0;
  for (const c of criteria) {
    const w = anyWeight ? effectiveWeight(c.weight) : 1;
    if (w <= 0) continue;
    weightSum += w;
    weighted += levelPercent(c, picks[c.name]) * w;
  }
  if (weightSum <= 0) return 0;
  return Math.round((weighted / weightSum / 100) * maxScore * 100) / 100;
}
