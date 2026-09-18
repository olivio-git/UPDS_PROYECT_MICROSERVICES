import type { DashboardSummary, LevelDistributionEntry } from '@/services/reportsService';
import { MCER_LEVELS } from './constants';

/**
 * Every score threshold used by the reports screen lives here.
 *
 * Performance bands match the backend report bands (reports.service.ts) and the
 * ranges shown to the user in the distribution table. Competency mastery and
 * improvement areas are separate scales with their own documented cutoffs.
 */
export const PERFORMANCE_BANDS = {
  excellent: 85,
  good: 70,
  acceptable: 60,
} as const;

/** Competency "dominio" column: Alto ≥75, Medio 50–74, Bajo <50. */
export const MASTERY_BANDS = { high: 75, medium: 50 } as const;

/** Competency summary chips: green ≥70, amber ≥50, red below. */
export const COMPETENCY_CHIP_BANDS = { good: 70, fair: 50 } as const;

type Tone = 'positive' | 'info' | 'warning' | 'negative' | 'neutral';

const TONE_TEXT: Record<Tone, string> = {
  positive: 'text-emerald-400',
  info: 'text-blue-400',
  warning: 'text-amber-400',
  negative: 'text-red-400',
  neutral: 'text-muted-foreground',
};

const TONE_BADGE: Record<Tone, string> = {
  positive: 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20',
  info: 'text-blue-400 bg-blue-500/10 border border-blue-500/20',
  warning: 'text-amber-400 bg-amber-500/10 border border-amber-500/20',
  negative: 'text-red-400 bg-red-500/10 border border-red-500/20',
  neutral: 'text-muted-foreground bg-muted/10 border border-border/20',
};

const performanceTone = (score: number): Tone =>
  score >= PERFORMANCE_BANDS.excellent ? 'positive'
  : score >= PERFORMANCE_BANDS.good ? 'info'
  : score >= PERFORMANCE_BANDS.acceptable ? 'warning'
  : 'negative';

/** Text color for a 0–100 score, following the performance bands. */
export const scoreTextClass = (score: number) => TONE_TEXT[performanceTone(score)];

const DIFFICULTY: Record<string, { label: string; tone: Tone }> = {
  easy: { label: 'Fácil', tone: 'positive' },
  medium: { label: 'Medio', tone: 'warning' },
  hard: { label: 'Difícil', tone: 'negative' },
};

export const difficultyBadge = (difficulty: string) => {
  const entry = DIFFICULTY[difficulty];
  return {
    label: entry?.label ?? difficulty,
    className: TONE_BADGE[entry?.tone ?? 'neutral'],
  };
};

export const masteryBadge = (score: number) =>
  score >= MASTERY_BANDS.high ? { label: 'Alto', className: TONE_BADGE.positive }
  : score >= MASTERY_BANDS.medium ? { label: 'Medio', className: TONE_BADGE.warning }
  : { label: 'Bajo', className: TONE_BADGE.negative };

export const competencyChipClass = (score: number) =>
  score >= COMPETENCY_CHIP_BANDS.good ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
  : score >= COMPETENCY_CHIP_BANDS.fair ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
  : 'bg-red-500/10 border-red-500/20 text-red-400';

export interface PerformanceBandRow {
  name: string;
  count: number;
  /** Percentage of all graded exams, rounded. */
  value: number;
  fill: string;
  range: string;
}

export function buildPerformanceRows(
  dist: DashboardSummary['performanceDistribution'],
): PerformanceBandRow[] {
  const counts = {
    excellent: dist.excellent ?? 0,
    good: dist.good ?? 0,
    acceptable: dist.acceptable ?? 0,
    needsImprovement: dist.needsImprovement ?? 0,
  };
  const total = counts.excellent + counts.good + counts.acceptable + counts.needsImprovement;
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
  const { excellent, good, acceptable } = PERFORMANCE_BANDS;

  return [
    { name: 'Excelente', count: counts.excellent, value: pct(counts.excellent), fill: '#10b981', range: `≥${excellent}%` },
    { name: 'Bueno', count: counts.good, value: pct(counts.good), fill: '#3b82f6', range: `${good}–${excellent - 1}%` },
    { name: 'Satisfact.', count: counts.acceptable, value: pct(counts.acceptable), fill: '#f59e0b', range: `${acceptable}–${good - 1}%` },
    { name: 'Mejorar', count: counts.needsImprovement, value: pct(counts.needsImprovement), fill: '#ef4444', range: `<${acceptable}%` },
  ];
}

export const levelCount = (entry: LevelDistributionEntry | undefined): number =>
  entry == null ? 0 : typeof entry === 'number' ? entry : entry.count ?? 0;

export interface LevelRow {
  level: string;
  count: number;
}

/** Levels present in the distribution, in MCER order. */
export function buildLevelRows(distribution: DashboardSummary['levelDistribution']): LevelRow[] {
  const order = (level: string) => {
    const index = (MCER_LEVELS as readonly string[]).indexOf(level);
    return index === -1 ? MCER_LEVELS.length : index;
  };
  return Object.entries(distribution)
    .sort(([a], [b]) => order(a) - order(b))
    .map(([level, entry]) => ({ level, count: levelCount(entry) }));
}
