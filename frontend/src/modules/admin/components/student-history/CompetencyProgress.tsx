import { scoreBarClass, scoreTextClass } from '@/lib/scoreBands';
import type { StudentHistoryData } from '@/services/reportsService';
import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { Panel } from './Panel';

type Trend = 'improving' | 'stable' | 'declining';

const TREND: Record<Trend, { className: string; icon: typeof TrendingUp; label: string }> = {
  improving: { className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300', icon: TrendingUp, label: 'Mejorando' },
  declining: { className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300', icon: TrendingDown, label: 'Bajando' },
  stable: { className: 'bg-muted text-muted-foreground', icon: Minus, label: 'Estable' },
};

export function CompetencyProgress({ progress }: { progress: StudentHistoryData['competencyProgress'] }) {
  const entries = Object.entries(progress);
  if (entries.length === 0) return null;

  return (
    <Panel icon={TrendingUp} title="Progreso por Competencia">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-px bg-border">
        {entries.map(([competency, data]) => {
          const trend = TREND[data.trend] ?? TREND.stable;
          const TrendIcon = trend.icon;
          return (
            <div key={competency} className="bg-card px-3 py-2.5 space-y-1.5">
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-medium text-foreground capitalize truncate">{competency.replace('_', ' ')}</span>
                <span title={trend.label} className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-medium ${trend.className}`}>
                  <TrendIcon className="h-3 w-3" />
                </span>
              </div>
              <div className="h-1 rounded-full bg-muted overflow-hidden">
                <div className={`h-full rounded-full ${scoreBarClass(data.averageScore)}`} style={{ width: `${Math.min(data.averageScore, 100)}%` }} />
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{data.currentLevel} · {data.examsCount} ex.</span>
                <span className={`font-semibold ${scoreTextClass(data.averageScore)}`}>{data.averageScore.toFixed(0)}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
