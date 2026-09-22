import { cn } from '@/lib/utils';
import type { DashboardSummary } from '@/services/reportsService';
import { Users } from 'lucide-react';
import { LEVEL_COLORS, MCER_LEVELS } from './constants';
import { ReportCard } from './ReportCard';
import { levelCount } from './scoring';

/** One tile per MCER level, including levels with no candidates yet. */
export function LevelOverviewCard({ distribution }: { distribution: DashboardSummary['levelDistribution'] }) {
  return (
    <ReportCard
      icon={Users}
      title={
        <span title="Cuántos alumnos distintos han rendido exámenes en cada nivel MCER (A1=básico → C2=maestría). Un alumno cuenta una vez por nivel aunque haya dado múltiples exámenes en ese nivel.">
          Distribución por Nivel MCER
        </span>
      }
    >
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {MCER_LEVELS.map((level, i) => {
          const count = levelCount(distribution[level]);
          const color = LEVEL_COLORS[i];
          const hasData = count > 0;
          return (
            <div
              key={level}
              className={cn(
                'flex flex-col items-center justify-center gap-1 p-3 rounded-lg border text-center',
                hasData ? 'border-blue-500/20 bg-blue-500/5' : 'border-border bg-muted/30',
              )}
            >
              <span
                className="text-sm font-bold px-2 py-0.5 rounded"
                style={hasData && color ? { backgroundColor: `${color}22`, color } : undefined}
              >
                {level}
              </span>
              {hasData ? (
                <>
                  <span className="text-xl font-bold text-foreground leading-none">{count}</span>
                  <span className="text-[10px] text-muted-foreground">evaluados</span>
                </>
              ) : (
                <>
                  <span className="text-lg font-bold text-muted-foreground/40">—</span>
                  <span className="text-[10px] text-muted-foreground/60">Sin datos</span>
                </>
              )}
            </div>
          );
        })}
      </div>
    </ReportCard>
  );
}
