import TrendChart from '@/components/charts/TrendChart';
import type { TrendsData } from '@/services/reportsService';
import { TrendingUp } from 'lucide-react';
import { useState } from 'react';
import { TREND_PERIODS, type TrendPeriod } from './constants';
import { ReportCard } from './ReportCard';
import { scoreTextClass } from './scoring';
import { SegmentedControl } from './SegmentedControl';
import { ViewToggle, type ViewMode } from './ViewToggle';

interface TrendsCardProps {
  trends: TrendsData | undefined;
  period: TrendPeriod;
  onPeriodChange: (period: TrendPeriod) => void;
}

export function TrendsCard({ trends, period, onPeriodChange }: TrendsCardProps) {
  const [view, setView] = useState<ViewMode>('table');
  const rows = trends?.trends.filter((r) => r.studentsEvaluated > 0) ?? [];

  return (
    <ReportCard
      icon={TrendingUp}
      title="Tendencias"
      actions={
        <div className="flex items-center gap-1.5">
          <SegmentedControl value={period} onChange={onPeriodChange} options={TREND_PERIODS} size="xs" />
          <ViewToggle view={view} onChange={setView} />
        </div>
      }
    >
      {view === 'chart' ? (
        <TrendChart data={trends?.trends ?? []} height={220} />
      ) : (
        <div className="h-[180px] overflow-auto">
          {rows.length > 0 ? (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-1.5 text-muted-foreground font-medium">Período</th>
                  <th className="text-right py-1.5 text-muted-foreground font-medium">Promedio</th>
                  <th className="text-right py-1.5 text-muted-foreground font-medium">Evaluados</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.period} className="border-b border-border/50">
                    <td className="py-1.5 text-foreground">{row.period}</td>
                    <td className="py-1.5 text-right">
                      <span className={`font-medium ${scoreTextClass(row.averageScore)}`}>{row.averageScore.toFixed(1)}</span>
                    </td>
                    <td className="py-1.5 text-right text-muted-foreground">{row.studentsEvaluated}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground text-xs">
              Sin datos de tendencias en el período seleccionado
            </div>
          )}
        </div>
      )}
    </ReportCard>
  );
}
