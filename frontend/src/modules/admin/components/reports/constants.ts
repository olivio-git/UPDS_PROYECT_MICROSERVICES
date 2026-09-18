import type { CSSProperties } from 'react';

export const MCER_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;

export const COMPETENCY_LABELS: Record<string, string> = {
  listening: 'Listening',
  reading: 'Reading',
  writing: 'Writing',
  speaking: 'Speaking',
};

/** Accent color per MCER level, index-aligned with MCER_LEVELS. */
export const LEVEL_COLORS = ['#6366f1', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

export const CHART_TOOLTIP_STYLE: CSSProperties = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '6px',
  fontSize: 12,
  color: 'hsl(var(--foreground))',
};

export const CHART_AXIS_TICK = { fill: 'hsl(var(--muted-foreground))', fontSize: 10 };

export const CHART_CURSOR = { fill: 'rgba(128,128,128,0.08)' };

export type TrendPeriod = 'week' | 'month' | 'quarter';

export const TREND_PERIODS: ReadonlyArray<{ value: TrendPeriod; label: string; hint: string }> = [
  { value: 'week', label: 'Sem', hint: 'Agrupa los resultados por semana (ej. 2026-W07)' },
  { value: 'month', label: 'Mes', hint: 'Agrupa los resultados por mes (ej. 2026-02)' },
  { value: 'quarter', label: 'Trim', hint: 'Agrupa los resultados por trimestre (ej. 2026-Q1 = enero–marzo)' },
];
