import { Button } from '@/components/atoms/button';
import GradientWrapper from '@/components/background/GrandWrapperSection';
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
    <GradientWrapper intensity="medium" size="md" position="center" animate={false} variant="cosmic">
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-foreground">Próximas Programaciones</h1>
            <p className="text-sm text-muted-foreground">Calendario de sesiones de examen</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={onToggleView} className="border-border bg-transparent text-foreground/80 gap-1.5">
              {viewMode === 'calendar'
                ? <><List className="h-3.5 w-3.5" /> Lista</>
                : <><CalendarDays className="h-3.5 w-3.5" /> Calendario</>}
            </Button>
            <Button size="sm" onClick={onExport} className="bg-green-600 hover:bg-green-700 text-white border-0 gap-1.5">
              <Download className="h-3.5 w-3.5" /> Exportar
            </Button>
            <Button size="sm" onClick={onRefresh} disabled={refreshing} className="bg-transparent hover:bg-muted/60 text-foreground/70 border border-border gap-1.5">
              <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} /> Actualizar
            </Button>
            {onCreateSession && (
              <Button size="sm" onClick={onCreateSession} className="bg-blue-600 hover:bg-blue-700 text-white border-0 gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Nueva Sesión
              </Button>
            )}
          </div>
        </div>

        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-border/40 rounded-lg overflow-hidden border border-border/40">
            {stats.map(({ label, value, icon: Icon, iconClass, valueClass }) => (
              <div key={label} className="bg-card/60 px-3 py-2.5 flex items-center gap-2.5">
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
    </GradientWrapper>
  );
}
