import { PageHeader } from '@/components/layout';
import { Button } from '@/components/keel/button';
import { cn } from '@/lib/utils';
import type { UpcomingSessionsData } from '@/services/reportsService';
import { AlertTriangle, CalendarDays, Download, List, Plus, RefreshCw, Users } from 'lucide-react';

export type ViewMode = 'calendar' | 'list';

interface UpcomingHeaderProps {
  data: UpcomingSessionsData | undefined;
  viewMode: ViewMode;
  onToggleView: () => void;
  onExport: () => void;
  onRefresh: () => void;
  refreshing: boolean;
  /** Undefined hides the "Nueva Sesión" button. */
  onCreateSession?: () => void;
}

export function UpcomingHeader({ data, viewMode, onToggleView, onExport, onRefresh, refreshing, onCreateSession }: UpcomingHeaderProps) {
  const stats = data && [
    { label: 'Total próximas', value: data.totalUpcomingSessions, icon: CalendarDays, iconClass: 'text-blue-500', valueClass: 'text-blue-600 dark:text-blue-400' },
    { label: 'Esta semana', value: data.sessionsThisWeek, icon: CalendarDays, iconClass: 'text-emerald-500', valueClass: 'text-emerald-600 dark:text-emerald-400' },
    { label: 'Candidatos', value: data.summary.totalCandidatesRegistered, icon: Users, iconClass: 'text-violet-500', valueClass: 'text-violet-600 dark:text-violet-400' },
    { label: 'Sin proctor', value: data.summary.sessionsNeedingProctors, icon: AlertTriangle, iconClass: 'text-amber-500', valueClass: 'text-amber-600 dark:text-amber-400' },
  ];

  return (
    <div className="flex shrink-0 flex-col gap-3">
      <PageHeader
        title="Próximas Programaciones"
        description="Calendario de sesiones de examen"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={onToggleView}>
              {viewMode === 'calendar'
                ? <><List /> Lista</>
                : <><CalendarDays /> Calendario</>}
            </Button>
            <Button variant="outline" size="sm" onClick={onExport}>
              <Download /> Exportar
            </Button>
            <Button variant="outline" size="sm" onClick={onRefresh} disabled={refreshing}>
              <RefreshCw className={cn(refreshing && 'animate-spin')} /> Actualizar
            </Button>
            {onCreateSession && (
              <Button size="sm" onClick={onCreateSession}>
                <Plus /> Nueva Sesión
              </Button>
            )}
          </>
        }
      />

        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-px overflow-hidden border border-border bg-border">
            {stats.map(({ label, value, icon: Icon, iconClass, valueClass }) => (
              <div key={label} className="flex items-center gap-2.5 bg-card px-3 py-2.5">
                <Icon className={cn('h-3.5 w-3.5', iconClass)} />
                <div>
                  <p className="text-[10px] text-muted-foreground leading-none mb-0.5">{label}</p>
                  <p className={cn('text-base font-bold leading-none', valueClass)}>{value}</p>
                </div>
              </div>
            ))}
          </div>
        )}
    </div>
  );
}
