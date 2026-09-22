import type { DashboardSummary } from '@/services/reportsService';
import { BarChart3 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CHART_AXIS_TICK, CHART_CURSOR, CHART_TOOLTIP_STYLE, LEVEL_COLORS } from './constants';
import { ReportCard } from './ReportCard';
import { buildLevelRows } from './scoring';
import { ViewToggle, type ViewMode } from './ViewToggle';

const colorAt = (i: number) => LEVEL_COLORS[i % LEVEL_COLORS.length];

/** Compact MCER distribution for the students tab; renders nothing without data. */
export function LevelDistributionCard({ distribution }: { distribution: DashboardSummary['levelDistribution'] }) {
  const [view, setView] = useState<ViewMode>('table');
  const rows = useMemo(() => buildLevelRows(distribution), [distribution]);
  const total = rows.reduce((sum, r) => sum + r.count, 0);

  if (rows.length === 0) return null;

  return (
    <ReportCard icon={BarChart3} title="Distribución por Nivel MCER" actions={<ViewToggle view={view} onChange={setView} />}>
      {view === 'chart' ? (
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={rows} layout="vertical" margin={{ top: 2, right: 16, bottom: 2, left: 8 }}>
            <XAxis type="number" tick={CHART_AXIS_TICK} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="level" tick={CHART_AXIS_TICK} axisLine={false} tickLine={false} width={24} />
            <Tooltip contentStyle={CHART_TOOLTIP_STYLE} cursor={CHART_CURSOR} formatter={(v: number) => [`${v}`, 'Estudiantes']} />
            <Bar dataKey="count" radius={[0, 4, 4, 0]}>
              {rows.map((row, i) => <Cell key={row.level} fill={colorAt(i)} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex gap-2 flex-wrap py-1">
          {rows.map(({ level, count }, i) => (
            <div key={level} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-muted/30">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: colorAt(i) }} />
              <span className="text-xs font-medium text-foreground">{level}</span>
              <span className="text-xs font-bold text-foreground">{count}</span>
              <span className="text-[10px] text-muted-foreground">({total > 0 ? ((count / total) * 100).toFixed(0) : '0'}%)</span>
            </div>
          ))}
        </div>
      )}
    </ReportCard>
  );
}
