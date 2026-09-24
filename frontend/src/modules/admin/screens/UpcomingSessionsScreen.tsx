import { Button } from '@/components/atoms/button';
import { MainLayout } from '@/components/layout';
import ExportOptionsModal from '@/components/modals/ExportOptionsModal';
import { useAuthStore } from '@/modules/auth/services/authStore';
import type { ExportOptions } from '@/services/reportsService';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { AgendaPanel } from '../components/upcoming-sessions/AgendaPanel';
import { byStartDate, groupByDay, nextDayKeys } from '../components/upcoming-sessions/calendar';
import { MonthCalendar } from '../components/upcoming-sessions/MonthCalendar';
import { ProctorWorkload } from '../components/upcoming-sessions/ProctorWorkload';
import { SessionListView } from '../components/upcoming-sessions/SessionListView';
import { StatusFilterChips, type StatusFilter } from '../components/upcoming-sessions/StatusFilterChips';
import { UpcomingHeader, type ViewMode } from '../components/upcoming-sessions/UpcomingHeader';
import { useExportUpcomingSessions, useUpcomingSessions } from '../hooks/useUpcomingSessions';

const AGENDA_DAYS = 7;

const UpcomingSessionsScreen: React.FC = () => {
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.user);
  const canCreateSession = currentUser?.role === 'teacher' || currentUser?.role === 'admin';

  const upcoming = useUpcomingSessions();
  const exportSessions = useExportUpcomingSessions();
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  const [viewDate, setViewDate] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [exportOpen, setExportOpen] = useState(false);

  const all = useMemo(() => upcoming.data?.upcomingSessions ?? [], [upcoming.data]);
  const filtered = useMemo(
    () => (statusFilter === 'all' ? all : all.filter((s) => s.status === statusFilter)),
    [all, statusFilter],
  );
  const counts = useMemo(() => ({
    all: all.length,
    scheduled: all.filter((s) => s.status === 'scheduled').length,
    in_progress: all.filter((s) => s.status === 'in_progress').length,
  }), [all]);
  const sessionsByDay = useMemo(() => groupByDay(filtered), [filtered]);
  const agenda = useMemo(
    () => (selectedDay
      ? sessionsByDay[selectedDay] ?? []
      : nextDayKeys(AGENDA_DAYS).flatMap((k) => sessionsByDay[k] ?? []).sort(byStartDate)),
    [selectedDay, sessionsByDay],
  );
  const listSessions = useMemo(() => [...filtered].sort(byStartDate), [filtered]);

  const handleExport = (format: 'csv' | 'pdf', options?: ExportOptions) => {
    exportSessions.mutate({ format, options }, {
      onSuccess: () => {
        toast.success(`Reporte exportado como ${format.toUpperCase()}`);
        setExportOpen(false);
      },
      onError: () => toast.error('Error exportando el reporte'),
    });
  };

  const data = upcoming.data;

  // A failed refresh (manual or from a live update) keeps the last data on
  // screen; say so instead of failing silently. errorUpdatedAt changes on each failure.
  const refreshFailed = upcoming.isError && data !== undefined;
  useEffect(() => {
    if (refreshFailed) toast.error('Error actualizando las próximas sesiones');
  }, [refreshFailed, upcoming.errorUpdatedAt]);

  return (
    <MainLayout>
      <div className="flex h-full min-h-0 w-full flex-col gap-3 overflow-auto p-3">
        <UpcomingHeader
          data={data}
          viewMode={viewMode}
          onToggleView={() => setViewMode((v) => (v === 'calendar' ? 'list' : 'calendar'))}
          onExport={() => setExportOpen(true)}
          onRefresh={() => upcoming.refetch()}
          refreshing={upcoming.isFetching}
          onCreateSession={canCreateSession ? () => navigate('/sessions?action=create') : undefined}
        />

        {data && <StatusFilterChips value={statusFilter} onChange={setStatusFilter} counts={counts} />}

        {upcoming.isPending && (
          <div className="flex items-center justify-center py-20 bg-card border border-border">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2.5 text-sm text-muted-foreground">Cargando sesiones...</span>
          </div>
        )}

        {upcoming.isError && !data && (
          <div className="flex flex-col items-center gap-3 py-16 bg-card border border-border">
            <AlertTriangle className="h-6 w-6 text-amber-500" />
            <p className="text-sm text-muted-foreground">Error cargando las próximas sesiones</p>
            <Button size="sm" variant="outline" onClick={() => upcoming.refetch()}>Reintentar</Button>
          </div>
        )}

        {data && viewMode === 'calendar' && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4 items-start">
            <MonthCalendar
              viewDate={viewDate}
              onViewDateChange={setViewDate}
              sessionsByDay={sessionsByDay}
              selectedDay={selectedDay}
              onSelectDay={setSelectedDay}
              currentUserEmail={currentUser?.email}
            />
            <AgendaPanel sessions={agenda} selectedDay={selectedDay} onClearDay={() => setSelectedDay(null)} onShowAll={() => setViewMode('list')} />
          </div>
        )}

        {/* Keyed by filter so changing it starts again from the first page. */}
        {data && viewMode === 'list' && <SessionListView key={statusFilter} sessions={listSessions} />}

        {data && <ProctorWorkload workload={data.proctorWorkload} />}
      </div>

      <ExportOptionsModal
        isOpen={exportOpen}
        onClose={() => setExportOpen(false)}
        onExport={handleExport}
        reportType="upcoming-sessions"
        isLoading={exportSessions.isPending}
      />
    </MainLayout>
  );
};

export default UpcomingSessionsScreen;
