/**
 * Score bands for 0–100 exam percentages, shared by every screen that colors a
 * score. Before this module each screen had its own cutoffs (90/75/60 in one
 * place, 80/60/40 in another, 85/70/60 in a third), so the same score could be
 * blue on one screen and amber on the next.
 *
 * The bands match the backend report bands and the ranges shown to users:
 * Excelente ≥85, Bueno 70–84, Satisfactorio 60–69, Necesita mejorar <60.
 */
export const PERFORMANCE_BANDS = {
  excellent: 85,
  good: 70,
  acceptable: 60,
} as const;

/** Minimum percentage that counts as passing. */
export const PASS_THRESHOLD = PERFORMANCE_BANDS.acceptable;

export type ScoreTone = 'excellent' | 'good' | 'acceptable' | 'failing';

export const scoreTone = (percentage: number): ScoreTone =>
  percentage >= PERFORMANCE_BANDS.excellent ? 'excellent'
  : percentage >= PERFORMANCE_BANDS.good ? 'good'
  : percentage >= PERFORMANCE_BANDS.acceptable ? 'acceptable'
  : 'failing';

const TEXT: Record<ScoreTone, string> = {
  excellent: 'text-emerald-600 dark:text-emerald-400',
  good: 'text-blue-600 dark:text-blue-400',
  acceptable: 'text-amber-600 dark:text-amber-400',
  failing: 'text-red-600 dark:text-red-400',
};

const BADGE: Record<ScoreTone, string> = {
  excellent: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700/40',
  good: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700/40',
  acceptable: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700/40',
  failing: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700/40',
};

const BAR: Record<ScoreTone, string> = {
  excellent: 'bg-emerald-500',
  good: 'bg-blue-500',
  acceptable: 'bg-amber-500',
  failing: 'bg-red-500',
};

/** Text color for a score. */
export const scoreTextClass = (percentage: number) => TEXT[scoreTone(percentage)];

/** Background + border + text for a score pill. Pair with `border` and padding. */
export const scoreBadgeClass = (percentage: number) => BADGE[scoreTone(percentage)];

/** Fill color for a progress bar showing a score. */
export const scoreBarClass = (percentage: number) => BAR[scoreTone(percentage)];
