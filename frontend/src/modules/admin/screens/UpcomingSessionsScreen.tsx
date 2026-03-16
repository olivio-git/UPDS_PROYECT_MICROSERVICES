import { Button } from '@/components/atoms/button';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/atoms/hover-card';
import GradientWrapper from '@/components/background/GrandWrapperSection';
import { MainLayout } from '@/components/layout';
import ExportOptionsModal from '@/components/modals/ExportOptionsModal';
import {
  reportsService,
  type ExportOptions,
  type ReportFilters,
  type UpcomingSessionsData,
} from '@/services/reportsService';
import { notificationSocket } from '@/services/notifications/notificationSocket';
import { useAuthStore } from '@/modules/auth/services/authStore';
import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  ExternalLink,
  List,
  Loader2,
  Plus,
  RefreshCw,
  User2,
  UserCheck,
  Users,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

// ─── Constants ────────────────────────────────────────────
const DAYS  = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MONTHS = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
];
const LIST_PAGE_SIZE = 8;

type Session = UpcomingSessionsData['upcomingSessions'][number];
type ViewMode = 'calendar' | 'list';

// ─── Helpers ──────────────────────────────────────────────
const pad = (n: number) => String(n).padStart(2, '0');

const toLocalKey = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const dayKey = (y: number, m: number, d: number) =>
  `${y}-${pad(m + 1)}-${pad(d)}`;

const statusChip = (status: string) => {
  switch (status) {
    case 'scheduled':   return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800/30';
    case 'in_progress': return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800/30';
    case 'completed':   return 'bg-muted text-muted-foreground border-border';
    case 'cancelled':   return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/30';
    default:            return 'bg-muted text-muted-foreground border-border';
  }
};

const statusDot = (status: string) => {
  switch (status) {
    case 'scheduled':   return 'bg-blue-500';
    case 'in_progress': return 'bg-amber-500';
    case 'completed':   return 'bg-muted-foreground';
    case 'cancelled':   return 'bg-red-500';
    default:            return 'bg-muted-foreground';
  }
};

const statusLabel = (status: string) => {
  switch (status) {
    case 'scheduled':   return 'Programada';
    case 'in_progress': return 'En progreso';
    case 'completed':   return 'Completada';
    case 'cancelled':   return 'Cancelada';
    default:            return status;
  }
};

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' });

const fmtDayFull = (d: Date) =>
  d.toLocaleDateString('es-BO', { weekday: 'long', day: 'numeric', month: 'long' });

// ─── HoverCard day popover ────────────────────────────────
const DayHoverContent: React.FC<{ date: Date; sessions: Session[]; currentUserEmail?: string }> = ({ date, sessions, currentUserEmail }) => (
  <div className="w-72 p-0 overflow-hidden">
    {/* Header */}
    <div className="px-3 py-2.5 border-b border-border bg-muted/40">
      <p className="text-xs font-semibold text-foreground capitalize">
        {fmtDayFull(date)}
      </p>
      <p className="text-[10px] text-muted-foreground mt-0.5">
        {sessions.length} sesión{sessions.length !== 1 ? 'es' : ''}
      </p>
    </div>

    {/* Session list */}
    <div className="divide-y divide-border">
      {sessions.map(s => {
        const capacityPct = s.maxCandidates > 0
          ? Math.min(100, Math.round((s.registeredCandidates / s.maxCandidates) * 100))
          : 0;
        const isOwn = !!(s.createdBy && currentUserEmail && s.createdBy.email === currentUserEmail);
        return (
          <div key={s.sessionId} className="px-3 py-2.5">
            <div className="flex items-start gap-2 mb-1.5">
              <span className={`w-2 h-2 rounded-full mt-1 shrink-0 ${statusDot(s.status)}`} />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-foreground truncate">{s.sessionName}</p>
                <p className="text-[10px] text-muted-foreground truncate">{s.examTitle}</p>
              </div>
            </div>
            <div className="pl-4 space-y-1">
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Clock className="h-3 w-3 shrink-0" />
                <span>{fmtTime(s.startDate)} — {fmtTime(s.endDate)}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
                  <Users className="h-3 w-3" />
                  <span>{s.registeredCandidates}/{s.maxCandidates}</span>
                </div>
                <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-1 bg-primary rounded-full transition-all"
                    style={{ width: `${capacityPct}%` }}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0">{capacityPct}%</span>
              </div>
              {s.createdBy && (
                <div className="flex items-center gap-1.5 pt-0.5">
                  {s.createdBy.avatarUrl ? (
                    <img
                      src={s.createdBy.avatarUrl}
                      alt=""
                      className="w-4 h-4 rounded-full object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-4 h-4 rounded-full bg-muted border border-border flex items-center justify-center shrink-0">
                      <User2 className="h-2.5 w-2.5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-foreground/80 font-medium">
                        {s.createdBy.firstName} {s.createdBy.lastName}
                      </span>
                      {isOwn && (
                        <span className="text-[9px] px-1 py-px rounded bg-primary/15 text-primary font-medium leading-none shrink-0">
                          Tú
                        </span>
                      )}
                    </div>
                    <p className="text-[9px] text-muted-foreground truncate leading-tight">
                      {s.createdBy.email}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

// ─── Navigation helper ────────────────────────────────────
const sessionNavPath = (session: Session): string =>
  session.status === 'in_progress'
    ? `/sessions/${session.sessionId}/monitor`
    : `/sessions?sessionId=${session.sessionId}`;

// ─── Session detail card (right panel) ───────────────────
const SessionCard: React.FC<{ session: Session; onNavigate: () => void }> = ({ session, onNavigate }) => (
  <div className="px-4 py-3 hover:bg-muted/30 transition-colors">
    <div className="flex items-start gap-2 mb-1.5">
      <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${statusDot(session.status)}`} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground truncate">{session.sessionName}</p>
        <p className="text-xs text-muted-foreground truncate">{session.examTitle}</p>
      </div>
      <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium shrink-0 ${statusChip(session.status)}`}>
        {statusLabel(session.status)}
      </span>
      <button
        onClick={onNavigate}
        aria-label={session.status === 'in_progress' ? 'Ir al monitor' : 'Ver detalle'}
        title={session.status === 'in_progress' ? 'Ir al monitor en vivo' : 'Ver detalle de sesión'}
        className={`shrink-0 transition-colors p-0.5 rounded ${
          session.status === 'in_progress'
            ? 'text-amber-500 hover:text-amber-400'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        <ExternalLink className="h-3.5 w-3.5" />
      </button>
    </div>
    <div className="flex items-center gap-3 text-xs text-muted-foreground pl-4">
      <span className="flex items-center gap-1">
        <Clock className="h-3 w-3" />
        {fmtTime(session.startDate)} — {fmtTime(session.endDate)}
      </span>
      <span className="flex items-center gap-1">
        <Users className="h-3 w-3" />
        {session.registeredCandidates}/{session.maxCandidates}
      </span>
      <span className="flex items-center gap-1">
        <UserCheck className="h-3 w-3" />
        {session.proctorsAssigned}
      </span>
    </div>
  </div>
);

// ─── Main component ───────────────────────────────────────
const UpcomingSessionsScreen: React.FC = () => {
  const navigate = useNavigate();
  const currentUser = useAuthStore(s => s.user);
  const currentUserEmail = currentUser?.email as string | undefined;
  const canCreateSession = currentUser?.role === 'teacher' || currentUser?.role === 'admin';

  const [sessionsData, setSessionsData] = useState<UpcomingSessionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters] = useState<ReportFilters>({});
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  const [viewDate, setViewDate] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null); // "YYYY-MM-DD"
  const [listPage, setListPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // ── Data loading ──────────────────────────────────────
  const loadData = async (f?: ReportFilters) => {
    try {
      setLoading(true);
      const data = await reportsService.getUpcomingSessions(f ?? filters);
      setSessionsData(data);
      setListPage(0);
    } catch {
      toast.error('Error cargando las próximas sesiones');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const onUpdate = () => loadData();
    notificationSocket.on('session.status.changed', onUpdate);
    notificationSocket.connect().catch(() => {});
    return () => { notificationSocket.off('session.status.changed', onUpdate); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Filtered sessions (status filter) ─────────────────
  const filteredSessions = useMemo(() => {
    if (!sessionsData) return [];
    if (statusFilter === 'all') return sessionsData.upcomingSessions;
    return sessionsData.upcomingSessions.filter(s => s.status === statusFilter);
  }, [sessionsData, statusFilter]);

  // ── Filter chip counts ─────────────────────────────────
  const chipCounts = useMemo(() => {
    if (!sessionsData) return { all: 0, scheduled: 0, in_progress: 0 };
    const all = sessionsData.upcomingSessions.length;
    const scheduled = sessionsData.upcomingSessions.filter(s => s.status === 'scheduled').length;
    const in_progress = sessionsData.upcomingSessions.filter(s => s.status === 'in_progress').length;
    return { all, scheduled, in_progress };
  }, [sessionsData]);

  // ── Session → day map ─────────────────────────────────
  const sessionsByDay = useMemo(() => {
    const map: Record<string, Session[]> = {};
    filteredSessions.forEach(s => {
      const k = toLocalKey(s.startDate);
      if (!map[k]) map[k] = [];
      map[k].push(s);
    });
    return map;
  }, [filteredSessions]);

  // ── Calendar math ─────────────────────────────────────
  const year  = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = (new Date(year, month, 1).getDay() + 6) % 7; // Mon-first
  const todayKey = toLocalKey(new Date().toISOString());

  // ── Right panel sessions ──────────────────────────────
  const panelSessions = useMemo(() => {
    if (selectedDay) return sessionsByDay[selectedDay] ?? [];
    // Next 7 days
    const today = new Date();
    const keys: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      keys.push(toLocalKey(d.toISOString()));
    }
    return keys.flatMap(k => sessionsByDay[k] ?? [])
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  }, [selectedDay, sessionsByDay]);

  const panelTitle = selectedDay
    ? fmtDayFull(new Date(selectedDay + 'T12:00'))
    : 'Próximos 7 días';

  // ── Export ────────────────────────────────────────────
  const handleExport = async (format: 'csv' | 'pdf', opts?: ExportOptions) => {
    try {
      setExportLoading(true);
      await reportsService.exportReport('upcoming-sessions', filters, format, undefined, opts);
      toast.success(`Reporte exportado como ${format.toUpperCase()}`);
      setExportModalOpen(false);
    } catch {
      toast.error('Error exportando el reporte');
    } finally {
      setExportLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────
  return (
    <MainLayout>
      <div className="max-w-5xl mx-auto w-full px-4 py-6 space-y-5">

        {/* ── Header ── */}
        <GradientWrapper intensity="medium" size="md" position="center" animate={false} variant="cosmic">
          <div className="p-4 space-y-3">
            {/* Title row */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold text-foreground">Próximas Programaciones</h1>
                <p className="text-sm text-muted-foreground">Calendario de sesiones de examen</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setViewMode(v => v === 'calendar' ? 'list' : 'calendar')}
                  className="border-border bg-transparent text-foreground/80 gap-1.5"
                >
                  {viewMode === 'calendar'
                    ? <><List className="h-3.5 w-3.5" /> Lista</>
                    : <><CalendarDays className="h-3.5 w-3.5" /> Calendario</>}
                </Button>
                <Button size="sm" onClick={() => setExportModalOpen(true)}
                  className="bg-green-600 hover:bg-green-700 text-white border-0 gap-1.5">
                  <Download className="h-3.5 w-3.5" /> Exportar
                </Button>
                <Button size="sm" onClick={() => loadData()}
                  className="bg-transparent hover:bg-muted/60 text-foreground/70 border border-border gap-1.5">
                  <RefreshCw className="h-3.5 w-3.5" /> Actualizar
                </Button>
                {canCreateSession && (
                  <Button size="sm" onClick={() => navigate('/sessions?action=create')}
                    className="bg-blue-600 hover:bg-blue-700 text-white border-0 gap-1.5">
                    <Plus className="h-3.5 w-3.5" /> Nueva Sesión
                  </Button>
                )}
              </div>
            </div>

            {/* Stats row */}
            {sessionsData && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-border/40 rounded-lg overflow-hidden border border-border/40">
                {[
                  { label: 'Total próximas',  value: sessionsData.totalUpcomingSessions,               icon: <CalendarDays className="h-3.5 w-3.5 text-blue-500" />,   color: 'text-blue-600 dark:text-blue-400' },
                  { label: 'Esta semana',     value: sessionsData.sessionsThisWeek,                    icon: <CalendarDays className="h-3.5 w-3.5 text-emerald-500" />, color: 'text-emerald-600 dark:text-emerald-400' },
                  { label: 'Candidatos',      value: sessionsData.summary.totalCandidatesRegistered,   icon: <Users className="h-3.5 w-3.5 text-violet-500" />,        color: 'text-violet-600 dark:text-violet-400' },
                  { label: 'Sin proctor',     value: sessionsData.summary.sessionsNeedingProctors,     icon: <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />,  color: 'text-amber-600 dark:text-amber-400' },
                ].map(stat => (
                  <div key={stat.label} className="bg-card/60 px-3 py-2.5 flex items-center gap-2.5">
                    {stat.icon}
                    <div>
                      <p className="text-[10px] text-muted-foreground leading-none mb-0.5">{stat.label}</p>
                      <p className={`text-base font-bold leading-none ${stat.color}`}>{stat.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </GradientWrapper>

        {/* ── Status filter chips ── */}
        {sessionsData && (
          <div className="flex items-center gap-2 flex-wrap">
            {[
              { key: 'all',         label: 'Todas',       count: chipCounts.all },
              { key: 'scheduled',   label: 'Programadas', count: chipCounts.scheduled },
              { key: 'in_progress', label: 'En progreso', count: chipCounts.in_progress },
            ].map(chip => (
              <button
                key={chip.key}
                onClick={() => { setStatusFilter(chip.key); setListPage(0); }}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                  statusFilter === chip.key
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted',
                )}
              >
                {chip.label}
                <span className={cn(
                  'text-[10px] font-semibold px-1.5 py-0.5 rounded-full',
                  statusFilter === chip.key
                    ? 'bg-primary-foreground/20 text-primary-foreground'
                    : 'bg-muted text-muted-foreground',
                )}>
                  {chip.count}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* ── Loading ── */}
        {loading && (
          <div className="flex items-center justify-center py-20 bg-card border border-border rounded-xl">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2.5 text-sm text-muted-foreground">Cargando sesiones...</span>
          </div>
        )}

        {/* ── Calendar view ── */}
        {!loading && sessionsData && viewMode === 'calendar' && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4 items-start">

            {/* Calendar card */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">

              {/* Month nav */}
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setViewDate(new Date(year, month - 1, 1))}
                    className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="text-sm font-semibold text-foreground px-2 min-w-[140px] text-center">
                    {MONTHS[month]} {year}
                  </span>
                  <button
                    onClick={() => setViewDate(new Date(year, month + 1, 1))}
                    className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
                <button
                  onClick={() => { setViewDate(new Date()); setSelectedDay(null); }}
                  className="text-xs text-primary hover:text-primary/80 font-medium transition-colors"
                >
                  Hoy
                </button>
              </div>

              <div className="p-3">
                {/* Day headers */}
                <div className="grid grid-cols-7 mb-1">
                  {DAYS.map(d => (
                    <div key={d} className="text-center text-[10px] font-semibold text-muted-foreground py-1.5">
                      {d}
                    </div>
                  ))}
                </div>

                {/* Day grid */}
                <div className="grid grid-cols-7 gap-1">
                  {/* Offset */}
                  {Array.from({ length: startOffset }).map((_, i) => (
                    <div key={`off-${i}`} className="min-h-[90px]" />
                  ))}

                  {/* Days */}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const key = dayKey(year, month, day);
                    const daySessions = sessionsByDay[key] ?? [];
                    const isToday = key === todayKey;
                    const isSelected = key === selectedDay;
                    const isPast = key < todayKey;
                    const hasSessions = daySessions.length > 0;
                    const cellDate = new Date(year, month, day);

                    const cellContent = (
                      <div
                        key={day}
                        onClick={() => hasSessions && setSelectedDay(isSelected ? null : key)}
                        className={cn(
                          'min-h-[90px] p-1.5 rounded-lg border transition-all',
                          isSelected
                            ? 'border-primary bg-primary/8 dark:bg-primary/10'
                            : isToday
                            ? 'border-primary/40 bg-primary/5'
                            : hasSessions
                            ? 'border-transparent hover:border-border hover:bg-muted/40 cursor-pointer'
                            : 'border-transparent',
                          isPast && !isToday ? 'opacity-40' : '',
                        )}
                      >
                        {/* Day number */}
                        <div className={cn(
                          'w-6 h-6 flex items-center justify-center rounded-full text-xs font-medium mb-1 select-none',
                          isToday
                            ? 'bg-primary text-primary-foreground'
                            : isSelected
                            ? 'text-primary font-bold'
                            : 'text-foreground',
                        )}>
                          {day}
                        </div>

                        {/* Session chips */}
                        <div className="space-y-0.5">
                          {daySessions.slice(0, 2).map(s => (
                            <div
                              key={s.sessionId}
                              className={cn(
                                'text-[10px] truncate px-1.5 py-0.5 rounded border leading-tight',
                                statusChip(s.status),
                              )}
                            >
                              {s.sessionName}
                            </div>
                          ))}
                          {daySessions.length > 2 && (
                            <div className="text-[10px] text-muted-foreground px-1 leading-tight">
                              +{daySessions.length - 2} más
                            </div>
                          )}
                        </div>
                      </div>
                    );

                    if (!hasSessions) return cellContent;

                    return (
                      <HoverCard key={day} openDelay={300} closeDelay={100}>
                        <HoverCardTrigger asChild>
                          {cellContent}
                        </HoverCardTrigger>
                        <HoverCardContent
                          side="right"
                          align="start"
                          className="w-72 p-0 overflow-hidden border border-line bg-card shadow-xl"
                        >
                          <DayHoverContent date={cellDate} sessions={daySessions} currentUserEmail={currentUserEmail} />
                        </HoverCardContent>
                      </HoverCard>
                    );
                  })}
                </div>

                {/* Legend */}
                <div className="flex items-center gap-4 pt-3 mt-2 border-t border-border">
                  {[
                    { label: 'Programada',  cls: 'bg-blue-500' },
                    { label: 'En progreso', cls: 'bg-amber-500' },
                    { label: 'Completada',  cls: 'bg-muted-foreground' },
                    { label: 'Cancelada',   cls: 'bg-red-500' },
                  ].map(l => (
                    <div key={l.label} className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${l.cls}`} />
                      <span className="text-[10px] text-muted-foreground">{l.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right panel */}
            <div className="bg-card border border-border rounded-xl overflow-hidden sticky top-4">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground capitalize truncate">
                  {panelTitle}
                </h3>
                {selectedDay && (
                  <button
                    onClick={() => setSelectedDay(null)}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
                  >
                    Ver todo
                  </button>
                )}
              </div>

              {panelSessions.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10 px-4 text-center">
                  <CalendarDays className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    {selectedDay ? 'Sin sesiones este día' : 'Sin sesiones en los próximos 7 días'}
                  </p>
                </div>
              ) : (() => {
                const PANEL_SIZE = 6;
                const hasMore = panelSessions.length > PANEL_SIZE;
                return (
                  <>
                    <div className="divide-y divide-border">
                      {panelSessions.slice(0, PANEL_SIZE).map(s => (
                        <SessionCard
                          key={s.sessionId}
                          session={s}
                          onNavigate={() => navigate(sessionNavPath(s))}
                        />
                      ))}
                    </div>
                    {hasMore && (
                      <div className="px-4 py-2.5 border-t border-border">
                        <button
                          onClick={() => setViewMode('list')}
                          className="w-full text-xs text-primary hover:text-primary/80 text-center transition-colors"
                        >
                          +{panelSessions.length - PANEL_SIZE} sesiones más — ver lista completa
                        </button>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        )}

        {/* ── List view ── */}
        {!loading && sessionsData && viewMode === 'list' && (() => {
          const sorted = filteredSessions
            .slice()
            .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
          const totalPages = Math.ceil(sorted.length / LIST_PAGE_SIZE);
          const paginated = sorted.slice(listPage * LIST_PAGE_SIZE, (listPage + 1) * LIST_PAGE_SIZE);

          return (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">
                  Todas las sesiones ({sorted.length})
                </h3>
                {totalPages > 1 && (
                  <span className="text-xs text-muted-foreground">
                    Página {listPage + 1} de {totalPages}
                  </span>
                )}
              </div>

              {sorted.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-12 text-center">
                  <CalendarDays className="h-10 w-10 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">No hay sesiones programadas próximamente</p>
                </div>
              ) : (
                <>
                  <div className="divide-y divide-border">
                    {paginated.map(s => {
                      const d = new Date(s.startDate);
                      return (
                        <div key={s.sessionId} className="flex items-start gap-4 px-4 py-3 hover:bg-muted/30 transition-colors">
                          {/* Date badge */}
                          <div className="flex flex-col items-center w-10 shrink-0 mt-0.5">
                            <span className="text-[10px] text-muted-foreground uppercase leading-none">
                              {MONTHS[d.getMonth()].slice(0, 3)}
                            </span>
                            <span className="text-xl font-bold text-foreground leading-tight">{d.getDate()}</span>
                            <span className="text-[10px] text-muted-foreground">{d.getFullYear()}</span>
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                              <p className="text-sm font-medium text-foreground">{s.sessionName}</p>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${statusChip(s.status)}`}>
                                {statusLabel(s.status)}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground mb-1">{s.examTitle}</p>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {fmtTime(s.startDate)} — {fmtTime(s.endDate)}
                              </span>
                              <span className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                {s.registeredCandidates}/{s.maxCandidates}
                              </span>
                              <span className="flex items-center gap-1">
                                <UserCheck className="h-3 w-3" />
                                {s.proctorsAssigned} proctors
                              </span>
                            </div>
                          </div>

                          {/* Navigate arrow */}
                          <button
                            onClick={() => navigate(sessionNavPath(s))}
                            aria-label={s.status === 'in_progress' ? 'Ir al monitor' : 'Ver detalle'}
                            title={s.status === 'in_progress' ? 'Ir al monitor en vivo' : 'Ver detalle de sesión'}
                            className={`shrink-0 self-center p-1 rounded transition-colors ${
                              s.status === 'in_progress'
                                ? 'text-amber-500 hover:text-amber-400'
                                : 'text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Pagination footer */}
                  {totalPages > 1 && (
                    <div className="px-4 py-3 border-t border-border flex items-center justify-between gap-4">
                      <span className="text-xs text-muted-foreground">
                        Mostrando {listPage * LIST_PAGE_SIZE + 1}–{Math.min((listPage + 1) * LIST_PAGE_SIZE, sorted.length)} de {sorted.length}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setListPage(p => p - 1)}
                          disabled={listPage === 0}
                          className="p-1.5 rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                        {Array.from({ length: totalPages }).map((_, i) => (
                          <button
                            key={i}
                            onClick={() => setListPage(i)}
                            className={cn(
                              'w-7 h-7 rounded-lg text-xs font-medium border transition-colors',
                              i === listPage
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'border-border hover:bg-muted text-foreground',
                            )}
                          >
                            {i + 1}
                          </button>
                        ))}
                        <button
                          onClick={() => setListPage(p => p + 1)}
                          disabled={listPage === totalPages - 1}
                          className="p-1.5 rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })()}

        {/* ── Proctor workload ── */}
        {!loading && sessionsData && sessionsData.proctorWorkload.length > 0 && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-muted-foreground" />
                Carga de Proctors
              </h3>
            </div>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {sessionsData.proctorWorkload.map(p => (
                <div key={p.proctorId} className="bg-muted/30 border border-border rounded-lg px-3 py-2.5">
                  <p className="text-sm font-medium text-foreground mb-1.5 truncate">{p.proctorName}</p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{p.assignedSessions} sesión{p.assignedSessions !== 1 ? 'es' : ''}</span>
                    <span className="font-medium text-foreground">{p.upcomingHours.toFixed(1)}h</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      <ExportOptionsModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        onExport={handleExport}
        reportType="upcoming-sessions"
        isLoading={exportLoading}
      />
    </MainLayout>
  );
};

export default UpcomingSessionsScreen;
