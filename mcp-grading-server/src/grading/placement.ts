/**
 * Placement level from an adaptive exam's answer history.
 *
 * Each answer is scored against every candidate level with a 3-parameter
 * logistic item-response model: a student at level t answers an item of level
 * l correctly with probability c + (1 − c)·σ(1.8·(t + 0.6 − l)), where c is the
 * chance of guessing (½ for true/false, 1/k for k options, ~0 when the answer
 * is typed or built). The level with the highest likelihood wins; ties go to
 * the lower level. Unlike "highest level with ≥60%", one lucky answer at a high
 * level cannot decide the result, and every answer counts, including the ones
 * at lower levels.
 *
 * Simulated cohorts (tests/placement.test.ts): with 20 questions this places
 * ~80% of students at their exact level and virtually all within one level;
 * the previous rule managed ~50% and ~83%.
 */
export const PLACEMENT_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;

export interface PlacementAnswer {
  level: string;
  score: number;
  maxScore: number;
  type?: string;
  optionCount?: number;
}

export function guessRate(type?: string, optionCount?: number): number {
  if (type === 'true_false') return 0.5;
  if (type === 'multiple_choice' || type === undefined) return 1 / Math.max(2, optionCount ?? 4);
  return 0.02; // typed, ordered or matched answers are rarely right by chance
}

export function probabilityCorrect(studentLevel: number, itemLevel: number, guess: number): number {
  return guess + (1 - guess) / (1 + Math.exp(-1.8 * (studentLevel + 0.6 - itemLevel)));
}

export function estimatePlacementLevel(history: readonly PlacementAnswer[]): { level: string; confidence: number } {
  const answers = history
    .map((h) => ({
      l: PLACEMENT_LEVELS.indexOf(h.level as (typeof PLACEMENT_LEVELS)[number]),
      f: h.maxScore > 0 ? Math.max(0, Math.min(1, h.score / h.maxScore)) : 0,
      c: guessRate(h.type, h.optionCount),
    }))
    .filter((a) => a.l >= 0);
  if (!answers.length) return { level: 'A1', confidence: 0 };

  const logLik = PLACEMENT_LEVELS.map((_, t) =>
    answers.reduce((sum, a) => {
      const p = Math.min(1 - 1e-6, Math.max(1e-6, probabilityCorrect(t, a.l, a.c)));
      return sum + a.f * Math.log(p) + (1 - a.f) * Math.log(1 - p);
    }, 0),
  );
  let best = 0;
  logLik.forEach((ll, t) => {
    if (ll > logLik[best]! + 1e-9) best = t;
  });
  const max = logLik[best]!;
  const total = logLik.reduce((s, ll) => s + Math.exp(ll - max), 0);
  return { level: PLACEMENT_LEVELS[best]!, confidence: Math.round((1 / total) * 100) / 100 };
}
