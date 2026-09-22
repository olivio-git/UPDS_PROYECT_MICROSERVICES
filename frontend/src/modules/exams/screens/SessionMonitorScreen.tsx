import { MainLayout } from "@/components/layout";
import { UserAvatar } from "@/components/atoms/UserAvatar";
import { examService } from "@/services/examService";
import { notificationSocket } from "@/services/notifications/notificationSocket";
import type { AuditLogEntry } from "@/services/auditLogService";
import { auditLogService } from "@/services/auditLogService";
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Circle,
  Clock,
  ClipboardList,
  Loader2,
  Plus,
  RefreshCw,
  RotateCcw,
  Square,
  UserX,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

// ─── Types ───────────────────────────────────────────────────────────────────

type CandidateStatus =
  | "not_started"
  | "in_progress"
  | "completed"
  | "expired"
  | "cancelled";

interface CandidateProgress {
  candidateId: string;
  name: string;
  status: CandidateStatus;
  answeredCount: number;
  totalQuestions: number;
  startedAt: string | null;
  finishedAt: string | null;
  lastActivity: string | null;
  activeSeconds: number;
}

interface SessionProgress {
  sessionId: string;
  sessionName: string;
  sessionStatus: string;
  totalEnrolled: number;
  inProgress: number;
  completed: number;
  notStarted: number;
  candidates: CandidateProgress[];
}

// ─── Helper functions ─────────────────────────────────────────────────────────

/**
 * Formats a duration given in seconds to a human-readable string.
 * Examples: 3723 -> "1h 2m", 270 -> "4m", 45 -> "45s"
 */
function formatDuration(seconds: number): string {
  if (seconds <= 0) return "0s";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}

/**
 * Returns a relative time string in Spanish.
 * Examples: "hace 2 min", "hace 1 hora", "-" if null
 */
function formatRelativeTime(date: string | null): string {
  if (!date) return "-";
  const diffMs = Date.now() - new Date(date).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return `hace ${diffSec}s`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffHr = Math.floor(diffMin / 60);
  return `hace ${diffHr} hora${diffHr !== 1 ? "s" : ""}`;
}

/**
 * Returns a label and Tailwind className for a candidate status badge.
 */
function getStatusConfig(status: string): { label: string; className: string } {
  switch (status) {
    case "in_progress":
      return {
        label: "En progreso",
        className:
          "bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700/40",
      };
    case "completed":
      return {
        label: "Completado",
        className: "bg-green-100 text-green-700 border border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700/40",
      };
    case "expired":
      return {
        label: "Expirado",
        className: "bg-red-100 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700/40",
      };
    case "cancelled":
      return {
        label: "Cancelado",
        className: "bg-red-100 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800/40",
      };
    case "not_started":
    default:
      return {
        label: "Sin empezar",
        className: "bg-muted text-muted-foreground border border-border",
      };
  }
}

/**
 * Returns label and className for the overall session status badge shown in header.
 */
function getSessionStatusConfig(status: string): {
  label: string;
  className: string;
  dot: string;
} {
  switch (status) {
    case "in_progress":
      return {
        label: "En curso",
        className: "bg-green-100 text-green-700 border border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800/30",
        dot: "bg-green-500",
      };
    case "completed":
      return {
        label: "Finalizada",
        className: "bg-muted/60 text-muted-foreground border border-border",
        dot: "bg-muted-foreground",
      };
    case "cancelled":
      return {
        label: "Cancelada",
        className: "bg-red-100 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800/30",
        dot: "bg-red-500",
      };
    case "scheduled":
      return {
        label: "Programada",
        className: "bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800/30",
        dot: "bg-blue-500",
      };
    default:
      return {
        label: status,
        className: "bg-muted text-muted-foreground border border-border",
        dot: "bg-muted-foreground",
      };
  }
}

/**
 * Sorts candidates: in_progress first, then not_started, then completed/expired/cancelled.
 */
function sortCandidates(candidates: CandidateProgress[]): CandidateProgress[] {
  const order: Record<string, number> = {
    in_progress: 0,
    not_started: 1,
    completed: 2,
    expired: 3,
    cancelled: 4,
  };
  return [...candidates].sort(
    (a, b) => (order[a.status] ?? 99) - (order[b.status] ?? 99)
  );
}

// ─── Constants ───────────────────────────────────────────────────────────────

const REFRESH_INTERVAL_SECONDS = 10;

// ─── Component ───────────────────────────────────────────────────────────────

const SessionMonitorScreen = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const [data, setData] = useState<SessionProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [regrading, setRegrading] = useState(false);
  const [endingSession, setEndingSession] = useState(false);
  const [extendingSession, setExtendingSession] = useState(false);
  const [showExtendMenu, setShowExtendMenu] = useState(false);
  const extendMenuRef = useRef<HTMLDivElement>(null);
  const [kickingCandidate, setKickingCandidate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  // Countdown state: seconds remaining until next auto-refresh
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL_SECONDS);

  const autoRefreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(
    null
  );
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchAuditLogs = useCallback(async () => {
    if (!sessionId) return;
    setAuditLoading(true);
    try {
      const result = await auditLogService.getAuditLogs({ targetId: sessionId, limit: 40 });
      if (result.success && result.data) {
        setAuditLogs(result.data.logs);
      }
    } catch {
      // silent — not critical
    } finally {
      setAuditLoading(false);
    }
  }, [sessionId]);

  const fetchProgress = useCallback(
    async (isManual = false) => {
      if (!sessionId) return;

      if (isManual) {
        setRefreshing(true);
      }

      try {
        const response = await examService.getSessionProgress(sessionId);
        // The service returns response.data directly from axios; unwrap if needed
        const payload: SessionProgress =
          response?.data ?? response;
        setData(payload);
        setError(null);
        setLastUpdated(new Date());
        // Reset countdown after each fetch
        setCountdown(REFRESH_INTERVAL_SECONDS);
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : "Error al cargar el progreso de la sesión";
        setError(msg);
        if (isManual) {
          toast.error("No se pudo actualizar el progreso");
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }

      // Always refresh audit logs alongside session progress
      fetchAuditLogs();
    },
    [sessionId, fetchAuditLogs]
  );

  // ── Auto-refresh setup ─────────────────────────────────────────────────────

  const startAutoRefresh = useCallback(() => {
    // Clear any existing timers
    if (autoRefreshTimerRef.current) clearInterval(autoRefreshTimerRef.current);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);

    // Auto-fetch every 10 seconds
    autoRefreshTimerRef.current = setInterval(() => {
      fetchProgress(false);
    }, REFRESH_INTERVAL_SECONDS * 1000);

    // Decrement countdown every second
    setCountdown(REFRESH_INTERVAL_SECONDS);
    countdownTimerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) return REFRESH_INTERVAL_SECONDS;
        return prev - 1;
      });
    }, 1000);
  }, [fetchProgress]);

  useEffect(() => {
    fetchProgress(false);
    startAutoRefresh();

    return () => {
      if (autoRefreshTimerRef.current) clearInterval(autoRefreshTimerRef.current);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, [fetchProgress, startAutoRefresh]);

  // ── WebSocket: detect session end in real-time ─────────────────────────────
  useEffect(() => {
    if (!sessionId) return;

    const handleSessionStatusChanged = (event: any) => {
      if (String(event.sessionId) !== String(sessionId)) return;
      const newStatus: string = event.status;

      setData((prev) => {
        if (!prev) return prev;

        // Update all in_progress candidates to completed when session ends
        const updatedCandidates =
          newStatus === "completed" || newStatus === "cancelled"
            ? prev.candidates.map((c) =>
                c.status === "in_progress"
                  ? { ...c, status: newStatus as CandidateStatus, finishedAt: new Date().toISOString() }
                  : c
              )
            : prev.candidates;

        return {
          ...prev,
          sessionStatus: newStatus,
          inProgress: updatedCandidates.filter((c) => c.status === "in_progress").length,
          completed: updatedCandidates.filter((c) => c.status === "completed").length,
          candidates: updatedCandidates,
        };
      });

      if (newStatus === "completed") {
        toast.info("La sesión ha sido finalizada");
        // Refresh once to get accurate data from backend
        setTimeout(() => fetchProgress(false), 3000);
      } else if (newStatus === "cancelled") {
        toast.warning("La sesión ha sido cancelada");
        setTimeout(() => fetchProgress(false), 3000);
      }
    };

    notificationSocket.on("session.status.changed", handleSessionStatusChanged);
    return () => {
      notificationSocket.off("session.status.changed", handleSessionStatusChanged);
    };
  }, [sessionId, fetchProgress]);

  // ── Manual refresh ─────────────────────────────────────────────────────────

  const handleManualRefresh = useCallback(async () => {
    if (refreshing) return;
    // Restart timers so the 10s countdown resets from now
    startAutoRefresh();
    await fetchProgress(true);
  }, [refreshing, fetchProgress, startAutoRefresh]);

  // ── Regrade handler ────────────────────────────────────────────────────────

  const handleRegrade = useCallback(async () => {
    if (!sessionId || regrading) return;
    setRegrading(true);
    try {
      const result = await examService.regradeSession(sessionId);
      const { queued, total } = result?.data ?? {};
      toast.success(
        `Recalificación completada: ${queued ?? 0}/${total ?? 0} intentos procesados`
      );
    } catch {
      toast.error("Error al iniciar la recalificación");
    } finally {
      setRegrading(false);
    }
  }, [sessionId, regrading]);

  // ── End session handler ────────────────────────────────────────────────────

  const handleEndSession = useCallback(async () => {
    if (!sessionId || endingSession) return;
    setEndingSession(true);
    try {
      await examService.endSession(sessionId);
      toast.success('Sesión finalizada correctamente');
      await fetchProgress(true);
    } catch {
      toast.error('Error al finalizar la sesión');
    } finally {
      setEndingSession(false);
    }
  }, [sessionId, endingSession, fetchProgress]);

  // ── Kick candidate handler ─────────────────────────────────────────────────

  const handleKick = useCallback(async (candidateId: string) => {
    if (!sessionId || kickingCandidate) return;
    setKickingCandidate(candidateId);
    try {
      await examService.kickCandidate(sessionId, candidateId);
      toast.success('Candidato expulsado de la sesión');
      await fetchProgress(true);
    } catch {
      toast.error('Error al expulsar al candidato');
    } finally {
      setKickingCandidate(null);
    }
  }, [sessionId, kickingCandidate, fetchProgress]);

  // ── Extend session handler ─────────────────────────────────────────────────

  const handleExtendSession = useCallback(async (minutes: number) => {
    if (!sessionId || extendingSession) return;
    setShowExtendMenu(false);
    setExtendingSession(true);
    try {
      await examService.extendSession(sessionId, minutes);
      toast.success(`Tiempo extendido por ${minutes} minutos`);
    } catch {
      toast.error('Error al extender el tiempo de la sesión');
    } finally {
      setExtendingSession(false);
    }
  }, [sessionId, extendingSession]);

  // Close extend menu on outside click
  useEffect(() => {
    if (!showExtendMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (extendMenuRef.current && !extendMenuRef.current.contains(e.target as Node)) {
        setShowExtendMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showExtendMenu]);

  // ── Derived data ───────────────────────────────────────────────────────────

  const sortedCandidates = data ? sortCandidates(data.candidates) : [];

  // ── Render helpers ─────────────────────────────────────────────────────────

  const renderStatusBadge = (status: string) => {
    const { label, className } = getStatusConfig(status);
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${className}`}
      >
        {status === "in_progress" && (
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" />
        )}
        {status === "completed" && (
          <CheckCircle2 className="w-3 h-3 text-green-400" />
        )}
        {status === "not_started" && (
          <Circle className="w-3 h-3 text-muted-foreground/50" />
        )}
        {(status === "expired" || status === "cancelled") && (
          <AlertCircle className="w-3 h-3 text-red-400" />
        )}
        {label}
      </span>
    );
  };

  // ── Audit log helpers ──────────────────────────────────────────────────────

  const AUDIT_ACTION_LABELS: Record<string, { label: string; className: string }> = {
    'exam.started':           { label: 'Inicio examen',    className: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700/60' },
    'exam.resumed':           { label: 'Reanudó examen',   className: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700/60' },
    'exam.answer_submitted':  { label: 'Respondió',        className: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-700/60' },
    'exam.finished':          { label: 'Finalizó examen',  className: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/40 dark:text-green-300 dark:border-green-700/60' },
    'session.started':        { label: 'Sesión iniciada',  className: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700/60' },
    'session.ended':          { label: 'Sesión finalizada',className: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/40 dark:text-green-300 dark:border-green-700/60' },
    'session.cancelled':      { label: 'Sesión cancelada', className: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-700/60' },
  };

  const renderAuditActionBadge = (action: string) => {
    const cfg = AUDIT_ACTION_LABELS[action] ?? { label: action, className: 'bg-muted text-muted-foreground border-border' };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border whitespace-nowrap ${cfg.className}`}>
        {cfg.label}
      </span>
    );
  };

  const formatAuditDetails = (details: Record<string, any>): string => {
    const parts: string[] = [];
    if (details.answeredCount != null && details.totalQuestions != null) {
      parts.push(`${details.answeredCount}/${details.totalQuestions} respondidas`);
    }
    if (details.questionId) parts.push(`P: ${String(details.questionId).slice(-6)}`);
    if (details.mode === 'adaptive') parts.push('adaptativo');
    if (details.finished === true) parts.push('finalizado');
    return parts.join(' · ');
  };

  // ── Loading state ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center py-32">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Cargando sesión...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────

  if (error && !data) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center py-32 px-6">
          <div className="bg-card border border-border rounded-2xl p-8 max-w-md w-full text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <h2 className="text-base font-semibold text-foreground mb-1">
              Error al cargar la sesión
            </h2>
            <p className="text-sm text-muted-foreground mb-6">{error}</p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => navigate(-1)}
                className="px-4 py-2 rounded-lg border border-border text-muted-foreground hover:bg-muted text-sm transition-colors"
              >
                Volver
              </button>
              <button
                onClick={() => fetchProgress(true)}
                className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-sm transition-colors flex items-center gap-2"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Reintentar
              </button>
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  // ── Main render ────────────────────────────────────────────────────────────

  const sessionStatusConfig = data
    ? getSessionStatusConfig(data.sessionStatus)
    : null;

  return (
    <MainLayout>
      <div className="pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-5">

          {/* ── Header ── */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 pt-1">
            {/* Left: back + title */}
            <div className="flex items-start gap-3 min-w-0">
              <button
                onClick={() => navigate(-1)}
                aria-label="Volver atrás"
                className="mt-0.5 flex-shrink-0 p-2 rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-bold text-foreground leading-tight truncate">
                    {data?.sessionName ?? "Monitor de Sesión"}
                  </h1>
                  {sessionStatusConfig && (
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${sessionStatusConfig.className}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${sessionStatusConfig.dot}`} />
                      {sessionStatusConfig.label}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                  <Activity className="w-3 h-3" />
                  Monitoreo en tiempo real
                  <span className="text-muted-foreground/50">·</span>
                  <span>Actualiza en {countdown}s</span>
                  {lastUpdated && (
                    <>
                      <span className="text-muted-foreground/50">·</span>
                      <span>{lastUpdated.toLocaleTimeString("es-BO")}</span>
                    </>
                  )}
                </p>
              </div>
            </div>

            {/* Right: actions */}
            <div className="flex items-center gap-2 flex-shrink-0 pl-11 sm:pl-0 flex-wrap">
              {/* Extend time */}
              {(data?.sessionStatus === 'in_progress' || data?.sessionStatus === 'scheduled') && (
                <div className="relative" ref={extendMenuRef}>
                  <button
                    onClick={() => setShowExtendMenu(v => !v)}
                    disabled={extendingSession}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700/50 dark:text-emerald-300 dark:hover:bg-emerald-900/20 transition-colors text-sm font-medium disabled:opacity-50"
                  >
                    {extendingSession ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    <span className="hidden sm:inline">{extendingSession ? 'Extendiendo...' : 'Extender'}</span>
                  </button>
                  {showExtendMenu && (
                    <div className="absolute right-0 top-full mt-1 z-50 bg-card border border-border rounded-xl shadow-lg py-1 min-w-[148px]">
                      {[15, 30, 45, 60].map((min) => (
                        <button
                          key={min}
                          onClick={() => handleExtendSession(min)}
                          className="w-full text-left px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors"
                        >
                          +{min} minutos
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* End session */}
              {data?.sessionStatus === 'in_progress' && (
                <button
                  onClick={handleEndSession}
                  disabled={endingSession}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 dark:border-red-700/50 dark:text-red-300 dark:hover:bg-red-900/20 transition-colors text-sm font-medium disabled:opacity-50"
                >
                  <Square className={`w-3.5 h-3.5 ${endingSession ? 'animate-pulse' : ''}`} />
                  <span className="hidden sm:inline">{endingSession ? 'Finalizando...' : 'Finalizar'}</span>
                </button>
              )}

              {/* Regrade */}
              {(data?.completed ?? 0) > 0 && (
                <button
                  onClick={handleRegrade}
                  disabled={regrading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-700/50 dark:text-amber-300 dark:hover:bg-amber-900/20 transition-colors text-sm font-medium disabled:opacity-50"
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${regrading ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">{regrading ? 'Recalculando...' : 'Recalcular'}</span>
                </button>
              )}

              {/* Refresh */}
              <button
                onClick={handleManualRefresh}
                disabled={refreshing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors text-sm font-medium disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">{refreshing ? 'Actualizando...' : 'Actualizar'}</span>
              </button>
            </div>
          </div>

          {/* ── Stat cards ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Total inscritos */}
            <div className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Inscritos</p>
                  <p className="text-3xl font-bold text-foreground mt-1">{data?.totalEnrolled ?? 0}</p>
                </div>
                <div className="p-2.5 rounded-xl bg-muted/60 shrink-0">
                  <Users className="w-4 h-4 text-muted-foreground" />
                </div>
              </div>
            </div>

            {/* En progreso */}
            <div className="bg-card border border-blue-200 dark:border-blue-800/40 rounded-2xl p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wide">En progreso</p>
                  <p className="text-3xl font-bold text-blue-700 dark:text-blue-300 mt-1">{data?.inProgress ?? 0}</p>
                </div>
                <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-900/30 relative shrink-0">
                  <Activity className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  {(data?.inProgress ?? 0) > 0 && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-blue-500 animate-ping" />
                  )}
                </div>
              </div>
            </div>

            {/* Completados */}
            <div className="bg-card border border-green-200 dark:border-green-800/40 rounded-2xl p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-medium text-green-600 dark:text-green-400 uppercase tracking-wide">Completados</p>
                  <p className="text-3xl font-bold text-green-700 dark:text-green-300 mt-1">{data?.completed ?? 0}</p>
                </div>
                <div className="p-2.5 rounded-xl bg-green-100 dark:bg-green-900/30 shrink-0">
                  <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </div>

            {/* Sin empezar */}
            <div className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Sin empezar</p>
                  <p className="text-3xl font-bold text-foreground mt-1">{data?.notStarted ?? 0}</p>
                </div>
                <div className="p-2.5 rounded-xl bg-muted/60 shrink-0">
                  <Circle className="w-4 h-4 text-muted-foreground/60" />
                </div>
              </div>
            </div>
          </div>

          {/* ── Candidates section ── */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold text-foreground">Candidatos</h2>
                {data && (
                  <span className="text-xs text-muted-foreground">({sortedCandidates.length})</span>
                )}
              </div>
              {error && (
                <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Datos pueden estar desactualizados
                </span>
              )}
            </div>

            {sortedCandidates.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
                <div className="w-12 h-12 rounded-full bg-muted/60 flex items-center justify-center mb-3">
                  <Users className="w-6 h-6 text-muted-foreground/50" />
                </div>
                <h3 className="text-sm font-medium text-foreground mb-1">Sin candidatos inscritos</h3>
                <p className="text-xs text-muted-foreground max-w-xs">
                  Todavía no hay candidatos registrados en esta sesión o aún no han iniciado el examen.
                </p>
              </div>
            ) : (
              <>
                {/* Table header */}
                <div className="hidden md:grid md:grid-cols-[2fr_1fr_1.5fr_1fr_1fr_40px] gap-4 px-5 py-2.5 bg-muted/40 border-b border-border/60 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  <span>Nombre</span>
                  <span>Estado</span>
                  <span>Progreso</span>
                  <span>Tiempo activo</span>
                  <span>Última actividad</span>
                  <span />
                </div>

                <div className="divide-y divide-border/50">
                  {sortedCandidates.map((candidate) => {
                    const progressPct = candidate.totalQuestions > 0
                      ? Math.round((candidate.answeredCount / candidate.totalQuestions) * 100)
                      : 0;

                    return (
                      <div key={candidate.candidateId} className="px-5 py-3.5 hover:bg-muted/20 transition-colors">
                        {/* Mobile */}
                        <div className="md:hidden space-y-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <UserAvatar
                                firstName={candidate.name.split(' ')[0]}
                                lastName={candidate.name.split(' ').slice(1).join(' ')}
                                size="sm"
                                className="shrink-0"
                              />
                              <span className="text-sm font-medium text-foreground truncate">{candidate.name}</span>
                            </div>
                            {renderStatusBadge(candidate.status)}
                          </div>
                          <div>
                            <div className="flex justify-between text-xs text-muted-foreground mb-1">
                              <span>{candidate.answeredCount}/{candidate.totalQuestions} respondidas</span>
                              <span>{progressPct}%</span>
                            </div>
                            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${progressPct === 100 ? 'bg-green-500' : candidate.status === 'in_progress' ? 'bg-blue-500' : 'bg-muted-foreground/30'}`}
                                style={{ width: `${progressPct}%` }}
                              />
                            </div>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {candidate.startedAt ? formatDuration(candidate.activeSeconds) : '-'}
                            </span>
                            <span>{formatRelativeTime(candidate.lastActivity)}</span>
                          </div>
                          {candidate.status === 'in_progress' && (
                            <div className="flex justify-end">
                              <button
                                onClick={() => handleKick(candidate.candidateId)}
                                disabled={kickingCandidate === candidate.candidateId}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs text-red-600 border border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-800/40 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                              >
                                <UserX className="w-3 h-3" />
                                {kickingCandidate === candidate.candidateId ? 'Expulsando...' : 'Expulsar'}
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Desktop */}
                        <div className="hidden md:grid md:grid-cols-[2fr_1fr_1.5fr_1fr_1fr_40px] gap-4 items-center">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <UserAvatar
                              firstName={candidate.name.split(' ')[0]}
                              lastName={candidate.name.split(' ').slice(1).join(' ')}
                              size="sm"
                              className="shrink-0"
                            />
                            <span className="text-sm font-medium text-foreground truncate">{candidate.name}</span>
                          </div>
                          <div>{renderStatusBadge(candidate.status)}</div>
                          <div>
                            <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                              <span>{candidate.answeredCount}/{candidate.totalQuestions}</span>
                              <span>{progressPct}%</span>
                            </div>
                            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${progressPct === 100 ? 'bg-green-500' : candidate.status === 'in_progress' ? 'bg-blue-500' : 'bg-muted-foreground/30'}`}
                                style={{ width: `${progressPct}%` }}
                              />
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 text-sm text-foreground">
                            <Clock className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
                            {candidate.startedAt ? formatDuration(candidate.activeSeconds) : '-'}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {formatRelativeTime(candidate.lastActivity)}
                          </div>
                          <div className="flex justify-end">
                            {candidate.status === 'in_progress' && (
                              <button
                                onClick={() => handleKick(candidate.candidateId)}
                                disabled={kickingCandidate === candidate.candidateId}
                                title="Expulsar candidato"
                                className="p-1.5 rounded-lg text-muted-foreground/50 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                              >
                                <UserX className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* ── Actividad Reciente ── */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold text-foreground">Actividad reciente</h2>
                {auditLogs.length > 0 && (
                  <span className="text-xs text-muted-foreground">({auditLogs.length})</span>
                )}
              </div>
              {auditLoading && <Loader2 className="w-3.5 h-3.5 text-muted-foreground animate-spin" />}
            </div>

            {auditLogs.length === 0 ? (
              <div className="py-12 flex flex-col items-center text-center px-6">
                <ClipboardList className="w-8 h-8 text-muted-foreground/25 mb-3" />
                <p className="text-sm text-muted-foreground">Sin actividad registrada aún</p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  Las acciones de los candidatos aparecerán aquí en tiempo real
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border/50 max-h-96 overflow-y-auto">
                {auditLogs.map((log) => (
                  <div key={log._id} className="px-5 py-3 flex items-start gap-3 hover:bg-muted/20 transition-colors">
                    <div className="shrink-0 pt-0.5">
                      {renderAuditActionBadge(log.action)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-foreground">
                        {log.actor.userId
                          ? `Candidato ···${log.actor.userId.slice(-6)}`
                          : log.actor.role === 'admin' || log.actor.role === 'teacher'
                          ? (log.actor.email ?? 'Sistema')
                          : 'Sistema'}
                      </p>
                      {log.details && Object.keys(log.details).length > 0 && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {formatAuditDetails(log.details)}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground/60 shrink-0 whitespace-nowrap pt-0.5">
                      {formatRelativeTime(log.timestamp)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </MainLayout>
  );
};

export default SessionMonitorScreen;
