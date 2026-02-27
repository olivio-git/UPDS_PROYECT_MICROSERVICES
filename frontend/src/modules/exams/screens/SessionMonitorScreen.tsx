import { MainLayout } from "@/components/layout";
import { examService } from "@/services/examService";
import { notificationSocket } from "@/services/notifications/notificationSocket";
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Circle,
  Clock,
  Loader2,
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
          "bg-blue-900/40 text-blue-300 border border-blue-700/60 animate-pulse",
      };
    case "completed":
      return {
        label: "Completado",
        className: "bg-green-900/40 text-green-300 border border-green-700/60",
      };
    case "expired":
      return {
        label: "Expirado",
        className: "bg-red-900/40 text-red-300 border border-red-700/60",
      };
    case "cancelled":
      return {
        label: "Cancelado",
        className: "bg-red-900/30 text-red-400 border border-red-800/40",
      };
    case "not_started":
    default:
      return {
        label: "Sin empezar",
        className: "bg-gray-800 text-gray-400 border border-gray-700",
      };
  }
}

/**
 * Returns label and className for the overall session status badge shown in header.
 */
function getSessionStatusConfig(status: string): {
  label: string;
  className: string;
} {
  switch (status) {
    case "in_progress":
      return {
        label: "En curso",
        className: "bg-blue-900/40 text-blue-300 border border-blue-700/60",
      };
    case "completed":
      return {
        label: "Finalizada",
        className: "bg-green-900/40 text-green-300 border border-green-700/60",
      };
    case "cancelled":
      return {
        label: "Cancelada",
        className: "bg-red-900/40 text-red-300 border border-red-700/60",
      };
    case "scheduled":
      return {
        label: "Programada",
        className:
          "bg-amber-900/40 text-amber-300 border border-amber-700/60",
      };
    default:
      return {
        label: status,
        className: "bg-gray-800 text-gray-400 border border-gray-700",
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
  const [kickingCandidate, setKickingCandidate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Countdown state: seconds remaining until next auto-refresh
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL_SECONDS);

  const autoRefreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(
    null
  );
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Data fetching ──────────────────────────────────────────────────────────

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
    },
    [sessionId]
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

  // ── Derived data ───────────────────────────────────────────────────────────

  const sortedCandidates = data ? sortCandidates(data.candidates) : [];
  const countdownPercent =
    ((REFRESH_INTERVAL_SECONDS - countdown) / REFRESH_INTERVAL_SECONDS) * 100;

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
          <Circle className="w-3 h-3 text-gray-500" />
        )}
        {(status === "expired" || status === "cancelled") && (
          <AlertCircle className="w-3 h-3 text-red-400" />
        )}
        {label}
      </span>
    );
  };

  // ── Loading state ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <MainLayout>
        <div className="min-h-screen bg-gray-900 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-10 h-10 text-blue-400 animate-spin" />
            <p className="text-gray-400 text-sm">Cargando progreso de sesión...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────

  if (error && !data) {
    return (
      <MainLayout>
        <div className="min-h-screen bg-gray-900 flex items-center justify-center p-6">
          <div className="bg-gray-800 border border-red-800/40 rounded-xl p-8 max-w-md w-full text-center">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-gray-100 mb-2">
              Error al cargar la sesión
            </h2>
            <p className="text-sm text-gray-400 mb-6">{error}</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => navigate(-1)}
                className="px-4 py-2 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-700 text-sm transition-colors"
              >
                Volver
              </button>
              <button
                onClick={() => fetchProgress(true)}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm transition-colors flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
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
      <div className="min-h-screen bg-gray-900 pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">

          {/* ── Header ── */}
          <div className="pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              {/* Left: Back + title */}
              <div className="flex items-center gap-3 min-w-0">
                <button
                  onClick={() => navigate(-1)}
                  aria-label="Volver atrás"
                  className="flex-shrink-0 p-2 rounded-lg border border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-gray-100 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>

                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-lg font-semibold text-gray-100 truncate">
                      {data?.sessionName ?? "Monitor de Sesión"}
                    </h1>
                    {sessionStatusConfig && (
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${sessionStatusConfig.className}`}
                      >
                        {sessionStatusConfig.label}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                    <Activity className="w-3 h-3" />
                    Monitoreo en tiempo real
                  </p>
                </div>
              </div>

              {/* Right: timestamp + actions */}
              <div className="flex items-center gap-3 flex-shrink-0">
                {lastUpdated && (
                  <span className="text-xs text-gray-500 hidden sm:block">
                    Actualizado: {lastUpdated.toLocaleTimeString("es-BO")}
                  </span>
                )}
                {/* End session button — shown only for in_progress sessions */}
                {data?.sessionStatus === 'in_progress' && (
                  <button
                    onClick={handleEndSession}
                    disabled={endingSession}
                    title="Finalizar sesión para todos los candidatos"
                    aria-label="Finalizar sesión"
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-red-700/60 text-red-300 hover:bg-red-900/20 transition-colors text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <Square className={`w-4 h-4 ${endingSession ? 'animate-pulse' : ''}`} />
                    <span className="hidden sm:inline">
                      {endingSession ? 'Finalizando...' : 'Finalizar'}
                    </span>
                  </button>
                )}
                {/* Regrade button — shown only when there are completed attempts */}
                {(data?.completed ?? 0) > 0 && (
                  <button
                    onClick={handleRegrade}
                    disabled={regrading}
                    title="Recalcular calificaciones de todos los intentos completados"
                    aria-label="Recalcular calificaciones"
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-amber-700/60 text-amber-300 hover:bg-amber-900/20 transition-colors text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <RotateCcw
                      className={`w-4 h-4 ${regrading ? "animate-spin" : ""}`}
                    />
                    <span className="hidden sm:inline">
                      {regrading ? "Recalculando..." : "Recalcular"}
                    </span>
                  </button>
                )}
                <button
                  onClick={handleManualRefresh}
                  disabled={refreshing}
                  aria-label="Actualizar manualmente"
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-gray-100 transition-colors text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <RefreshCw
                    className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
                  />
                  <span className="hidden sm:inline">
                    {refreshing ? "Actualizando..." : "Actualizar"}
                  </span>
                </button>
              </div>
            </div>

            {/* Countdown progress bar */}
            <div
              className="mt-3 h-0.5 w-full bg-gray-800 rounded-full overflow-hidden"
              aria-label={`Próxima actualización en ${countdown} segundos`}
              title={`Próxima actualización en ${countdown}s`}
            >
              <div
                className="h-full bg-blue-600/60 transition-all duration-1000 ease-linear rounded-full"
                style={{ width: `${countdownPercent}%` }}
              />
            </div>
            <p className="text-xs text-gray-600 mt-1 text-right">
              Próxima actualización en {countdown}s
            </p>
          </div>

          {/* ── Stat cards ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total inscritos */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                    Total inscritos
                  </p>
                  <p className="text-3xl font-bold text-gray-100 mt-1">
                    {data?.totalEnrolled ?? 0}
                  </p>
                </div>
                <div className="p-2 rounded-lg bg-gray-700/50">
                  <Users className="w-5 h-5 text-gray-400" />
                </div>
              </div>
            </div>

            {/* En progreso */}
            <div className="bg-gray-800 border border-blue-800/40 rounded-xl p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-blue-400 uppercase tracking-wide">
                    En progreso
                  </p>
                  <p className="text-3xl font-bold text-blue-300 mt-1">
                    {data?.inProgress ?? 0}
                  </p>
                </div>
                <div className="p-2 rounded-lg bg-blue-900/30 relative">
                  <Activity className="w-5 h-5 text-blue-400" />
                  {(data?.inProgress ?? 0) > 0 && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-blue-500 animate-ping" />
                  )}
                </div>
              </div>
            </div>

            {/* Completados */}
            <div className="bg-gray-800 border border-green-800/40 rounded-xl p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-green-400 uppercase tracking-wide">
                    Completados
                  </p>
                  <p className="text-3xl font-bold text-green-300 mt-1">
                    {data?.completed ?? 0}
                  </p>
                </div>
                <div className="p-2 rounded-lg bg-green-900/30">
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                </div>
              </div>
            </div>

            {/* Sin empezar */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                    Sin empezar
                  </p>
                  <p className="text-3xl font-bold text-gray-300 mt-1">
                    {data?.notStarted ?? 0}
                  </p>
                </div>
                <div className="p-2 rounded-lg bg-gray-700/50">
                  <Circle className="w-5 h-5 text-gray-500" />
                </div>
              </div>
            </div>
          </div>

          {/* ── Candidates section ── */}
          <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
            {/* Section header */}
            <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-gray-400" />
                <h2 className="text-sm font-semibold text-gray-200">
                  Candidatos
                </h2>
                {data && (
                  <span className="text-xs text-gray-500 ml-1">
                    ({sortedCandidates.length})
                  </span>
                )}
              </div>
              {error && (
                <span className="text-xs text-amber-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Datos pueden estar desactualizados
                </span>
              )}
            </div>

            {/* Empty state */}
            {sortedCandidates.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                <div className="w-14 h-14 rounded-full bg-gray-700/60 flex items-center justify-center mb-4">
                  <Users className="w-7 h-7 text-gray-500" />
                </div>
                <h3 className="text-sm font-medium text-gray-300 mb-1">
                  Sin candidatos inscritos
                </h3>
                <p className="text-xs text-gray-500 max-w-xs">
                  Todavía no hay candidatos registrados en esta sesión o aún no
                  han iniciado el examen.
                </p>
              </div>
            ) : (
              <>
                {/* Table header — hidden on mobile, shown on md+ */}
                <div className="hidden md:grid md:grid-cols-[2fr_1fr_1.5fr_1fr_1fr] gap-4 px-6 py-3 bg-gray-900/40 border-b border-gray-700/60 text-xs font-medium text-gray-400 uppercase tracking-wide">
                  <span>Nombre</span>
                  <span>Estado</span>
                  <span>Progreso</span>
                  <span>Tiempo activo</span>
                  <span>Ultima actividad</span>
                </div>

                {/* Candidate rows */}
                <div className="divide-y divide-gray-700/50">
                  {sortedCandidates.map((candidate) => {
                    const progressPct =
                      candidate.totalQuestions > 0
                        ? Math.round(
                            (candidate.answeredCount /
                              candidate.totalQuestions) *
                              100
                          )
                        : 0;

                    return (
                      <div
                        key={candidate.candidateId}
                        className="px-6 py-4 hover:bg-gray-700/20 transition-colors"
                      >
                        {/* Mobile layout */}
                        <div className="md:hidden space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              {/* Avatar initials */}
                              <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs font-semibold text-gray-300 flex-shrink-0">
                                {candidate.name
                                  .split(" ")
                                  .slice(0, 2)
                                  .map((n) => n[0])
                                  .join("")
                                  .toUpperCase()}
                              </div>
                              <span className="text-sm font-medium text-gray-200 truncate">
                                {candidate.name}
                              </span>
                            </div>
                            {renderStatusBadge(candidate.status)}
                          </div>

                          {/* Progress bar */}
                          <div>
                            <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                              <span>
                                {candidate.answeredCount} /{" "}
                                {candidate.totalQuestions} preguntas
                              </span>
                              <span>{progressPct}%</span>
                            </div>
                            <div className="h-1.5 w-full bg-gray-700 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                  progressPct === 100
                                    ? "bg-green-500"
                                    : candidate.status === "in_progress"
                                    ? "bg-blue-500"
                                    : "bg-gray-500"
                                }`}
                                style={{ width: `${progressPct}%` }}
                              />
                            </div>
                          </div>

                          <div className="flex items-center gap-4 text-xs text-gray-400">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {candidate.startedAt
                                ? formatDuration(candidate.activeSeconds)
                                : "-"}
                            </span>
                            <span>
                              {formatRelativeTime(candidate.lastActivity)}
                            </span>
                          </div>
                        </div>

                        {/* Desktop layout — grid */}
                        <div className="hidden md:grid md:grid-cols-[2fr_1fr_1.5fr_1fr_1fr_auto] gap-4 items-center">
                          {/* Name */}
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs font-semibold text-gray-300 flex-shrink-0">
                              {candidate.name
                                .split(" ")
                                .slice(0, 2)
                                .map((n) => n[0])
                                .join("")
                                .toUpperCase()}
                            </div>
                            <span className="text-sm font-medium text-gray-200 truncate">
                              {candidate.name}
                            </span>
                          </div>

                          {/* Status badge */}
                          <div>{renderStatusBadge(candidate.status)}</div>

                          {/* Progress */}
                          <div>
                            <div className="flex items-center justify-between text-xs text-gray-400 mb-1.5">
                              <span>
                                {candidate.answeredCount} /{" "}
                                {candidate.totalQuestions} preguntas
                              </span>
                              <span className="text-gray-500">
                                {progressPct}%
                              </span>
                            </div>
                            <div className="h-1.5 w-full bg-gray-700 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                  progressPct === 100
                                    ? "bg-green-500"
                                    : candidate.status === "in_progress"
                                    ? "bg-blue-500"
                                    : "bg-gray-500"
                                }`}
                                style={{ width: `${progressPct}%` }}
                              />
                            </div>
                          </div>

                          {/* Active time */}
                          <div className="flex items-center gap-1.5 text-sm text-gray-300">
                            <Clock className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                            <span>
                              {candidate.startedAt
                                ? formatDuration(candidate.activeSeconds)
                                : "-"}
                            </span>
                          </div>

                          {/* Last activity */}
                          <div className="text-sm text-gray-400">
                            {formatRelativeTime(candidate.lastActivity)}
                          </div>

                          {/* Kick action */}
                          <div className="flex justify-end">
                            {candidate.status === 'in_progress' && (
                              <button
                                onClick={() => handleKick(candidate.candidateId)}
                                disabled={kickingCandidate === candidate.candidateId}
                                title="Expulsar candidato"
                                aria-label="Expulsar candidato"
                                className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-900/20 transition-colors disabled:opacity-50"
                              >
                                <UserX className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Mobile: kick button */}
                        {candidate.status === 'in_progress' && (
                          <div className="md:hidden flex justify-end mt-2">
                            <button
                              onClick={() => handleKick(candidate.candidateId)}
                              disabled={kickingCandidate === candidate.candidateId}
                              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-red-400 border border-red-800/40 hover:bg-red-900/20 transition-colors disabled:opacity-50"
                            >
                              <UserX className="w-3 h-3" />
                              {kickingCandidate === candidate.candidateId ? 'Expulsando...' : 'Expulsar'}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default SessionMonitorScreen;
