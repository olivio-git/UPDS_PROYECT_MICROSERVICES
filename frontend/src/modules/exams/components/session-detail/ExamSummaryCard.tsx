import { cn } from '@/lib/utils';
import { BarChart3, BookOpen, Clock, TrendingUp } from 'lucide-react';
import type { ExamSession } from '../../types';
import { examTypeBadgeClass, levelBadgeClass } from './sessionDisplay';

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const ratio = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

function LinkedExam({ exam }: { exam: ExamSession['exam'] }) {
  return (
    <div className="space-y-2.5">
      <h2 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
        <BookOpen className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
        Examen vinculado
      </h2>
      {!exam ? (
        <p className="text-xs text-muted-foreground">Información no disponible</p>
      ) : (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-foreground leading-snug">{exam.name}</p>
          <div className="flex flex-wrap gap-1.5">
            {exam.type && (
              <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border', examTypeBadgeClass(exam.type))}>
                {capitalize(exam.type)}
              </span>
            )}
            {exam.targetLevel && (
              <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border', levelBadgeClass(exam.targetLevel))}>
                Nivel {exam.targetLevel}
              </span>
            )}
          </div>
          {exam.structure && (
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border">
              <div className="text-xs">
                <span className="text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" />Duración</span>
                <span className="text-foreground/80 font-medium">{exam.structure.totalDuration} min</span>
              </div>
              <div className="text-xs">
                <span className="text-muted-foreground flex items-center gap-1"><TrendingUp className="w-3 h-3" />Preguntas</span>
                <span className="text-foreground/80 font-medium">{exam.structure.totalQuestions}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface StatTileProps {
  value: string | number;
  label: string;
  /** Bar fill 0–100; omitted hides the bar. */
  fill?: number;
  tone: { box: string; value: string; label: string; track: string; bar: string };
}

function StatTile({ value, label, fill, tone }: StatTileProps) {
  return (
    <div className={cn('border rounded-lg p-2', tone.box)}>
      <p className={cn('text-base font-bold leading-none', tone.value)}>{value}</p>
      <p className={cn('text-xs mt-0.5', tone.label)}>{label}</p>
      {fill !== undefined && (
        <div className={cn('mt-1.5 h-px rounded-full overflow-hidden', tone.track)}>
          <div className={cn('h-full rounded-full', tone.bar)} style={{ width: `${Math.min(fill, 100)}%` }} />
        </div>
      )}
    </div>
  );
}

const TONES = {
  blue: { box: 'bg-blue-50 border-blue-200 dark:bg-blue-900/15 dark:border-blue-800/30', value: 'text-blue-700 dark:text-blue-300', label: 'text-blue-500 dark:text-blue-400', track: 'bg-blue-200 dark:bg-blue-900/40', bar: 'bg-blue-500' },
  emerald: { box: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/15 dark:border-emerald-800/30', value: 'text-emerald-700 dark:text-emerald-300', label: 'text-emerald-600 dark:text-emerald-400', track: 'bg-emerald-200 dark:bg-emerald-900/40', bar: 'bg-emerald-500' },
  red: { box: 'bg-red-50 border-red-200 dark:bg-red-900/15 dark:border-red-800/30', value: 'text-red-700 dark:text-red-300', label: 'text-red-500 dark:text-red-400', track: 'bg-red-200 dark:bg-red-900/40', bar: 'bg-red-500' },
  purple: { box: 'bg-purple-50 border-purple-200 dark:bg-purple-900/15 dark:border-purple-800/30', value: 'text-purple-700 dark:text-purple-300', label: 'text-purple-500 dark:text-purple-400', track: 'bg-purple-200 dark:bg-purple-900/40', bar: 'bg-purple-500' },
};

function SessionStats({ stats }: { stats: NonNullable<ExamSession['stats']> }) {
  const registered = stats.totalRegistered ?? 0;
  const completed = stats.totalCompleted ?? 0;
  const abandoned = stats.totalAbandoned ?? 0;
  const average = stats.averageScore;
  return (
    <div className="space-y-2 pt-3 border-t border-border">
      <h2 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
        <BarChart3 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
        Estadísticas
      </h2>
      <div className="grid grid-cols-2 gap-2">
        <StatTile value={registered} label="Registrados" fill={100} tone={TONES.blue} />
        <StatTile value={completed} label="Completados" fill={ratio(completed, registered)} tone={TONES.emerald} />
        <StatTile value={abandoned} label="Abandonados" fill={ratio(abandoned, registered)} tone={TONES.red} />
        <StatTile
          value={average != null ? `${average.toFixed(1)}%` : '—'}
          label="Promedio"
          fill={average != null ? average : undefined}
          tone={TONES.purple}
        />
      </div>
    </div>
  );
}

/** The exam a session delivers, plus attendance and score statistics. */
export function ExamSummaryCard({ session }: { session: ExamSession }) {
  return (
    <div className="lg:col-span-1 bg-card border border-border rounded-xl p-4 space-y-4">
      <LinkedExam exam={session.exam} />
      {session.stats && <SessionStats stats={session.stats} />}
    </div>
  );
}
