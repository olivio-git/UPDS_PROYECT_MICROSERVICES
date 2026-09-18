import type { DashboardSummary } from '@/services/reportsService';
import { BarChart3 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CHART_AXIS_TICK, CHART_CURSOR, CHART_TOOLTIP_STYLE } from './constants';
import { ReportCard } from './ReportCard';
import { buildPerformanceRows } from './scoring';
import { ViewToggle, type ViewMode } from './ViewToggle';

export function PerformanceDistributionCard({ distribution }: { distribution: DashboardSummary['performanceDistribution'] }) {
  const [view, setView] = useState<ViewMode>('table');
  const rows = useMemo(() => buildPerformanceRows(distribution), [distribution]);

  return (
    <ReportCard icon={BarChart3} title="Distribución de Rendimiento" actions={<ViewToggle view={view} onChange={setView} />}>
      {view === 'chart' ? (
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={rows} margin={{ top: 4, right: 4, bottom: 4, left: -24 }}>
            <XAxis dataKey="name" tick={CHART_AXIS_TICK} axisLine={false} tickLine={false} />
            <YAxis tick={CHART_AXIS_TICK} axisLine={false} tickLine={false} />
            <Tooltip cursor={CHART_CURSOR} contentStyle={CHART_TOOLTIP_STYLE}
              formatter={(v: number) => [`${v}%`, 'Porcentaje']} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {rows.map((row) => <Cell key={row.name} fill={row.fill} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-[180px] overflow-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-1.5 text-muted-foreground font-medium">Categoría</th>
                <th className="text-right py-1.5 text-muted-foreground font-medium">Rango</th>
                <th className="text-right py-1.5 text-muted-foreground font-medium">%</th>
                <th className="text-right py-1.5 text-muted-foreground font-medium">Alumnos</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.name} className="border-b border-border/50">
                  <td className="py-1.5 text-foreground">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: row.fill }} />
                      {row.name}
                    </span>
                  </td>
                  <td className="py-1.5 text-right text-muted-foreground">{row.range}</td>
                  <td className="py-1.5 text-right font-medium text-foreground">{row.value}%</td>
                  <td className="py-1.5 text-right text-muted-foreground">{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ReportCard>
  );
}
