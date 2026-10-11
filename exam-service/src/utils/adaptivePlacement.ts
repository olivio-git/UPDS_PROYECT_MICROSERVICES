/**
 * How the adaptive placement exam moves between levels.
 *
 * Transformed up-down staircase (Levitt, 1971): two correct answers in a row at
 * the current level move one level up; a wrong answer moves one level down. It
 * settles where the student answers about 70% correctly, and one lucky guess
 * (25% on multiple choice, 50% on true/false) is no longer enough to climb.
 *
 * The previous rule (one correct → up, never down, stop after 3 wrong) placed
 * half of the simulated students at the wrong level and pushed a fifth of A1
 * students to B2 or above; see grading-service tests/placement.test.ts.
 */
export const PLACEMENT_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;

export interface PlacementStep {
  currentLevel: string;
  /** Correct answers in a row at the current level. */
  streak: number;
  consecutiveWrong: number;
}

export function nextPlacementStep(state: PlacementStep, isCorrect: boolean): PlacementStep {
  const idx = Math.max(0, PLACEMENT_LEVELS.indexOf(state.currentLevel as (typeof PLACEMENT_LEVELS)[number]));
  if (isCorrect) {
    const streak = (state.streak ?? 0) + 1;
    if (streak >= 2 && idx < PLACEMENT_LEVELS.length - 1) {
      return { currentLevel: PLACEMENT_LEVELS[idx + 1]!, streak: 0, consecutiveWrong: 0 };
    }
    return { currentLevel: state.currentLevel, streak: streak >= 2 ? 0 : streak, consecutiveWrong: 0 };
  }
  return {
    currentLevel: PLACEMENT_LEVELS[Math.max(0, idx - 1)]!,
    streak: 0,
    consecutiveWrong: (state.consecutiveWrong ?? 0) + 1,
  };
}

/**
 * Stop early only when the student keeps failing at the bottom level (nothing
 * lower to try); otherwise the test runs to maxQuestions, which is what makes
 * the estimate reliable.
 */
export function shouldStopPlacement(state: PlacementStep, answered: number, maxQuestions: number, wrongThreshold: number) {
  if (answered >= maxQuestions) return 'max_questions' as const;
  if (state.currentLevel === PLACEMENT_LEVELS[0] && state.consecutiveWrong >= wrongThreshold) return 'consecutive_wrong' as const;
  return undefined;
}

/** Levels to try when the bank has nothing left at `level`: nearest first, lower before higher. */
export function fallbackLevels(level: string): string[] {
  const idx = PLACEMENT_LEVELS.indexOf(level as (typeof PLACEMENT_LEVELS)[number]);
  const out: string[] = [];
  for (let d = 1; d < PLACEMENT_LEVELS.length; d++) {
    if (idx - d >= 0) out.push(PLACEMENT_LEVELS[idx - d]!);
    if (idx + d < PLACEMENT_LEVELS.length) out.push(PLACEMENT_LEVELS[idx + d]!);
  }
  return out;
}
