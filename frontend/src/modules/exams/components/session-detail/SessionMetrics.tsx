import type { LucideIcon } from 'lucide-react';
import { BarChart3, Clock, UserPlus, Users } from 'lucide-react';
import type { ExamSession } from '../../types';
import { formatSessionDuration } from './sessionDisplay';

interface Metric {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tint: string;
  /** Long text (the duration) uses a smaller size to fit. */
  compact?: boolean;
}

export function SessionMetrics({ session }: { session: ExamSession }) {
  const average = session.stats?.averageScore;
  const metrics: Metric[] = [
    { label: 'Capacidad', value: session.participants.maxCandidates, icon: Users, tint: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' },
    { label: 'Registrados', value: session.participants.registeredCandidates?.length ?? 0, icon: UserPlus, tint: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' },
    { label: 'Duración sesión', value: formatSessionDuration(session.scheduling.startDate, session.scheduling.endDate), icon: Clock, tint: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400', compact: true },
    { label: 'Promedio', value: average != null ? `${average.toFixed(1)}%` : '—', icon: BarChart3, tint: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400' },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {metrics.map(({ label, value, icon: Icon, tint, compact }) => (
        <div key={label} className="bg-card border border-border rounded-xl p-3 flex items-center gap-2.5">
          <div className={`flex items-center justify-center w-8 h-8 rounded-lg shrink-0 ${tint}`}>
            <Icon className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className={`${compact ? 'text-base' : 'text-xl'} font-bold text-foreground leading-none`}>{value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
