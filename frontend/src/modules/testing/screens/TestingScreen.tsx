import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/atoms/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/atoms/dialog";
import { Input } from "@/components/atoms/input";
import { MainLayout } from "@/components/layout";
import { api } from "@/services/api.service";
import {
  notificationService,
  type EmailHistoryItem,
  type EmailHistoryResponse,
  type NotificationStats,
} from "@/services/notifications/notificationService";
import { auditLogService, type AuditLogEntry, type AuditFilters } from "@/services/auditLogService";
import {
  Activity,
  AlertCircle,
  BarChart3,
  BookOpen,
  Brain,
  CheckCircle,
  ChevronRight,
  Clock,
  Copy,
  Database,
  Eye,
  FileText,
  History,
  Loader2,
  Mail,
  MessageSquare,
  RefreshCw,
  Search,
  Server,
  Shield,
  Users,
  XCircle,
  ClipboardList,
  ChevronLeft,
  Filter,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

// ─── Service config ──────────────────────────────────────────────────────────

// Paths via nginx (port 80) — no direct port access needed
const SERVICE_PATHS: Record<string, { path: string; anyResponse: boolean }> = {
  auth:          { path: "/api/v1/auth/validate",        anyResponse: true  },
  users:         { path: "/api/v1/users/health",         anyResponse: false },
  exam:          { path: "/api/v1/system/health",        anyResponse: false },
  session:       { path: "/api/v1/technical",            anyResponse: true  },
  notifications: { path: "/api/v1/notifications/health", anyResponse: false },
  grading:       { path: "/api/v1/grading/pending",      anyResponse: true  },
};

const SERVICES = [
  { key: "auth",          name: "Auth Service",       icon: Shield,   color: "blue"   },
  { key: "users",         name: "User Management",    icon: Users,    color: "green"  },
  { key: "exam",          name: "Exam Service",       icon: BookOpen, color: "purple" },
  { key: "session",       name: "Session Manager",    icon: Activity, color: "orange" },
  { key: "notifications", name: "Notifications",      icon: Mail,     color: "yellow" },
  { key: "grading",       name: "Grading Service",    icon: Brain,    color: "pink"   },
] as const;

type ServiceKey = typeof SERVICES[number]["key"];
type ServiceStatus = "online" | "offline" | "loading";

interface ServiceHealth {
  status: ServiceStatus;
  latency: number | null;
  detail?: string;
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface UserStats {
  total?: number;
  byRole?: Record<string, number>;
  active?: number;
  inactive?: number;
}

interface CandidateStats {
  total?: number;
  byLevel?: Record<string, number>;
  verified?: number;
}

interface SystemMetrics {
  memoryUsageMB?: number;
  uptime?: number;
  activeSessions?: number;
  databaseConnected?: boolean;
}

interface PendingGrading {
  count?: number;
  items?: any[];
}

interface DashboardStats {
  totalExams?: number;
  totalSessions?: number;
  completedSessions?: number;
  averageScore?: number;
  passRate?: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const colorMap: Record<string, string> = {
  blue:   "text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-500/20",
  green:  "text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-500/20",
  purple: "text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-500/20",
  orange: "text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-500/20",
  yellow: "text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-500/20",
  pink:   "text-pink-600 dark:text-pink-400 bg-pink-100 dark:bg-pink-500/20",
};

const formatUptime = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

const formatBytes = (mb: number | undefined) => mb != null ? `${mb.toFixed(0)} MB` : "—";

// ─── Component ───────────────────────────────────────────────────────────────

const DiagnosticoScreen = () => {
  // Service health
  const [serviceHealth, setServiceHealth] = useState<Record<ServiceKey, ServiceHealth>>(
    Object.fromEntries(SERVICES.map(s => [s.key, { status: "loading", latency: null }])) as any
  );

  // Stats
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [candidateStats, setCandidateStats] = useState<CandidateStats | null>(null);
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null);
  const [pendingGrading, setPendingGrading] = useState<PendingGrading | null>(null);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);

  // Email
  const [emailStats, setEmailStats] = useState<NotificationStats | null>(null);
  const [emailHistory, setEmailHistory] = useState<EmailHistoryResponse | null>(null);
  const [historyEmail, setHistoryEmail] = useState("");
  const [selectedEmail, setSelectedEmail] = useState<EmailHistoryItem | null>(null);
  const [emailDetailOpen, setEmailDetailOpen] = useState(false);

  // Audit logs
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotalPages, setAuditTotalPages] = useState(1);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditFilters, setAuditFilters] = useState<AuditFilters>({ limit: 15 });
  const [auditActionFilter, setAuditActionFilter] = useState("");
  const [auditEmailFilter, setAuditEmailFilter] = useState("");
  const [auditServiceFilter, setAuditServiceFilter] = useState("");

  const [refreshing, setRefreshing] = useState(false);

  // ── Health checks ──────────────────────────────────────────────────────────

  const checkServiceHealth = useCallback(async (key: ServiceKey) => {
    const { path, anyResponse } = SERVICE_PATHS[key];
    const start = Date.now();
    try {
      const res = await fetch(`http://localhost:80${path}`, { signal: AbortSignal.timeout(4000) });
      const latency = Date.now() - start;
      const online = anyResponse ? true : res.ok;
      setServiceHealth(prev => ({
        ...prev,
        [key]: { status: online ? "online" : "offline", latency },
      }));
    } catch {
      setServiceHealth(prev => ({
        ...prev,
        [key]: { status: "offline", latency: null },
      }));
    }
  }, []);

  const checkAllServices = useCallback(async () => {
    setServiceHealth(prev =>
      Object.fromEntries(Object.keys(prev).map(k => [k, { status: "loading", latency: null }])) as any
    );
    await Promise.allSettled(SERVICES.map(s => checkServiceHealth(s.key)));
  }, [checkServiceHealth]);

  // ── Stats fetchers ─────────────────────────────────────────────────────────

  const fetchStats = useCallback(async () => {
    await Promise.allSettled([
      (async () => {
        try {
          const r = await api.get("/api/v1/users/stats") as any;
          const d = r?.data ?? r ?? {};
          setUserStats({
            total:    d.total,
            byRole:   d.byRole,
            active:   d.byStatus?.active,
            inactive: d.byStatus?.inactive,
          });
        } catch {}
      })(),
      (async () => {
        try {
          const r = await api.get("/api/v1/candidates/stats") as any;
          const d = r?.data ?? r ?? {};
          setCandidateStats({
            total:    d.total,
            byLevel:  d.byLevel,
            verified: d.byStatus?.verified,
          });
        } catch {}
      })(),
      (async () => {
        try {
          const r = await api.get("/api/v1/system/health") as any;
          const data = r?.data ?? r ?? {};
          setSystemMetrics({
            memoryUsageMB:    data.memoryUsageMB,
            uptime:           data.uptime,
            activeSessions:   data.activeSessions,
            databaseConnected: data.databaseConnected,
          });
        } catch {}
      })(),
      (async () => {
        try {
          const r = await api.get("/api/v1/grading/pending") as any;
          const items = r?.data ?? r ?? [];
          setPendingGrading({ count: Array.isArray(items) ? items.length : items?.count ?? 0, items });
        } catch {}
      })(),
      (async () => {
        try {
          const r = await api.get("/api/v1/reports/dashboard") as any;
          const d = r?.data ?? r ?? {};
          const overview = d.overview ?? d;
          setDashboardStats({
            totalExams:  overview.totalExams,
            averageScore: overview.averageScore,
            passRate:    overview.completionRate,
          });
        } catch {}
      })(),
      (async () => {
        try {
          const r = await notificationService.getEmailStats();
          if (r?.success) setEmailStats(r.data);
        } catch {}
      })(),
    ]);
  }, []);

  const fetchEmailHistory = async () => {
    try {
      const r = await notificationService.getEmailHistory({ email: historyEmail || undefined });
      if (r?.success) setEmailHistory(r.data);
    } catch {
      toast.error("Error al cargar historial");
    }
  };

  const fetchAuditLogs = useCallback(async (page = 1, filters: AuditFilters = {}) => {
    setAuditLoading(true);
    try {
      const r = await auditLogService.getAuditLogs({ ...filters, page, limit: 15 });
      if (r.success && r.data) {
        setAuditLogs(r.data.logs);
        setAuditTotal(r.data.total);
        setAuditPage(r.data.page);
        setAuditTotalPages(r.data.totalPages);
      }
    } catch {
      // silenciar
    } finally {
      setAuditLoading(false);
    }
  }, []);

  const applyAuditFilters = () => {
    const filters: AuditFilters = {
      action: auditActionFilter || undefined,
      actorEmail: auditEmailFilter || undefined,
      service: auditServiceFilter || undefined,
    };
    setAuditFilters(filters);
    fetchAuditLogs(1, filters);
  };

  // ── Full refresh ───────────────────────────────────────────────────────────

  const handleRefreshAll = async () => {
    setRefreshing(true);
    await Promise.allSettled([checkAllServices(), fetchStats()]);
    setRefreshing(false);
    toast.success("Diagnóstico actualizado");
  };

  useEffect(() => {
    checkAllServices();
    fetchStats();
    fetchAuditLogs(1, {});
  }, []);

  // ── Render helpers ─────────────────────────────────────────────────────────

  const ServiceCard = ({ service }: { service: typeof SERVICES[number] }) => {
    const health = serviceHealth[service.key];
    const Icon = service.icon;
    const colors = colorMap[service.color];

    return (
      <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${colors}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{service.name}</p>
          {health.latency !== null && (
            <p className="text-xs text-muted-foreground">{health.latency}ms</p>
          )}
        </div>
        {health.status === "loading" ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground flex-shrink-0" />
        ) : health.status === "online" ? (
          <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" />
        ) : (
          <XCircle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0" />
        )}
      </div>
    );
  };

  const StatCard = ({
    label, value, sub, icon: Icon, color,
  }: {
    label: string; value: string | number; sub?: string;
    icon: React.ElementType; color: string;
  }) => {
    const colors = colorMap[color];
    return (
      <Card className="bg-card border border-line">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs text-muted-foreground mb-1">{label}</p>
              <p className="text-2xl font-bold text-foreground">{value}</p>
              {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
            </div>
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${colors}`}>
              <Icon className="h-4 w-4" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const ACTION_LABELS: Record<string, { label: string; color: string }> = {
    "user.created":      { label: "Usuario creado",       color: "green"  },
    "user.updated":      { label: "Usuario actualizado",  color: "blue"   },
    "user.deleted":      { label: "Usuario eliminado",    color: "red"    },
    "user.activated":    { label: "Usuario activado",     color: "green"  },
    "user.deactivated":  { label: "Usuario desactivado",  color: "orange" },
    "user.password_reset": { label: "Contraseña reseteada", color: "yellow" },
    "user.bulk_import":  { label: "Importación masiva",   color: "purple" },
    "session.created":          { label: "Sesión creada",       color: "blue"   },
    "session.started":          { label: "Sesión iniciada",     color: "green"  },
    "session.ended":            { label: "Sesión finalizada",   color: "orange" },
    "session.cancelled":        { label: "Sesión cancelada",    color: "red"    },
    "exam.started":             { label: "Inicio examen",       color: "blue"   },
    "exam.resumed":             { label: "Reanudó examen",      color: "yellow" },
    "exam.answer_submitted":    { label: "Respondió pregunta",  color: "purple" },
    "exam.finished":            { label: "Finalizó examen",     color: "green"  },
  };

  const actionBadge = (action: string) => {
    const cfg = ACTION_LABELS[action];
    const c = cfg?.color ?? "blue";
    const label = cfg?.label ?? action;
    const colorMap2: Record<string, string> = {
      green:  "bg-green-100 text-green-700 border-green-200 dark:bg-green-500/20 dark:text-green-300 dark:border-green-500/30",
      blue:   "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/30",
      red:    "bg-red-100 text-red-700 border-red-200 dark:bg-red-500/20 dark:text-red-300 dark:border-red-500/30",
      orange: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-500/20 dark:text-orange-300 dark:border-orange-500/30",
      yellow: "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-500/20 dark:text-yellow-300 dark:border-yellow-500/30",
      purple: "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-500/20 dark:text-purple-300 dark:border-purple-500/30",
    };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium border rounded-md ${colorMap2[c] ?? colorMap2.blue}`}>
        {label}
      </span>
    );
  };

  const formatAuditDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString("es-BO", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
  };

  const emailStatusBadge = (status: string) => {
    switch (status) {
      case "sent":
        return <Badge className="bg-green-100 text-green-700 border-green-200 dark:bg-green-500/20 dark:text-green-300 dark:border-green-500/30">Enviado</Badge>;
      case "failed":
        return <Badge className="bg-red-100 text-red-700 border-red-200 dark:bg-red-500/20 dark:text-red-300 dark:border-red-500/30">Fallido</Badge>;
      case "pending":
        return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-500/20 dark:text-yellow-300 dark:border-yellow-500/30">Pendiente</Badge>;
      default:
        return <Badge className="bg-muted text-muted-foreground border-border">{status}</Badge>;
    }
  };

  const onlineCount = Object.values(serviceHealth).filter(h => h.status === "online").length;
  const offlineCount = Object.values(serviceHealth).filter(h => h.status === "offline").length;

  return (
    <MainLayout gradientVariant="primary">
      <div className="max-w-6xl mx-auto px-4 pt-6 pb-12 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Diagnóstico del Sistema</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Monitoreo de servicios, métricas e infraestructura
            </p>
          </div>
          <Button
            onClick={handleRefreshAll}
            disabled={refreshing}
            variant="outline"
            size="sm"
            className="gap-2 border-border"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
        </div>

        {/* ── Sección 1: Estado de Servicios ─────────────────────────────── */}
        <Card className="bg-card border border-line">
          <CardHeader className="border-b border-line pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-foreground flex items-center gap-2 text-base">
                <Server className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                Estado de Servicios
              </CardTitle>
              <div className="flex items-center gap-2">
                {offlineCount > 0 && (
                  <Badge className="bg-red-100 text-red-700 border-red-200 dark:bg-red-500/20 dark:text-red-300 dark:border-red-500/30">
                    {offlineCount} caído{offlineCount > 1 ? "s" : ""}
                  </Badge>
                )}
                <Badge className="bg-green-100 text-green-700 border-green-200 dark:bg-green-500/20 dark:text-green-300 dark:border-green-500/30">
                  {onlineCount}/{SERVICES.length} online
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {SERVICES.map(s => <ServiceCard key={s.key} service={s} />)}
            </div>
          </CardContent>
        </Card>

        {/* ── Sección 2: Estadísticas Operativas ─────────────────────────── */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
            <BarChart3 className="h-3.5 w-3.5" />
            Estadísticas Operativas
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Usuarios"
              value={userStats?.total ?? "—"}
              sub={userStats?.active != null ? `${userStats.active} activos` : undefined}
              icon={Users}
              color="blue"
            />
            <StatCard
              label="Candidatos"
              value={candidateStats?.total ?? "—"}
              sub={candidateStats?.verified != null ? `${candidateStats.verified} verificados` : undefined}
              icon={Shield}
              color="green"
            />
            <StatCard
              label="Pendientes IA"
              value={pendingGrading?.count ?? "—"}
              sub="evaluaciones en cola"
              icon={Brain}
              color="purple"
            />
            <StatCard
              label="Exámenes"
              value={dashboardStats?.totalExams ?? "—"}
              sub={dashboardStats?.passRate != null ? `${dashboardStats.passRate}% aprobación` : undefined}
              icon={BookOpen}
              color="orange"
            />
          </div>

          {/* Breakdown por rol */}
          {userStats?.byRole && Object.keys(userStats.byRole).length > 0 && (
            <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
              {Object.entries(userStats.byRole).map(([role, count]) => (
                <div key={role} className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/40 border border-border">
                  <span className="text-xs text-muted-foreground capitalize">{role}</span>
                  <span className="text-sm font-semibold text-foreground">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Sección 3: Métricas del Sistema ────────────────────────────── */}
        {systemMetrics && (
          <Card className="bg-card border border-line">
            <CardHeader className="border-b border-line pb-4">
              <CardTitle className="text-foreground flex items-center gap-2 text-base">
                <Database className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                Métricas del Sistema
                <Badge className="ml-1 bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-500/20 dark:text-purple-300 dark:border-purple-500/30 text-xs">
                  exam-service
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Memoria</p>
                  <p className="text-lg font-semibold text-foreground">{formatBytes(systemMetrics.memoryUsageMB)}</p>
                  <p className="text-xs text-muted-foreground">uso del proceso</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Uptime</p>
                  <p className="text-lg font-semibold text-foreground">
                    {systemMetrics.uptime != null ? formatUptime(systemMetrics.uptime) : "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">desde último reinicio</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Sesiones activas</p>
                  <p className="text-lg font-semibold text-foreground">
                    {systemMetrics.activeSessions ?? "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">en este momento</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Base de datos</p>
                  <p className={`text-lg font-semibold ${
                    systemMetrics.databaseConnected
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  }`}>
                    {systemMetrics.databaseConnected == null ? "—" : systemMetrics.databaseConnected ? "Conectada" : "Desconectada"}
                  </p>
                  <p className="text-xs text-muted-foreground">MongoDB</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Sección 4: Auditoría de Emails ─────────────────────────────── */}
        <Card className="bg-card border border-line">
          <CardHeader className="border-b border-line pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-foreground flex items-center gap-2 text-base">
                <Mail className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                Auditoría de Emails
              </CardTitle>
              {emailStats && (
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="text-green-600 dark:text-green-400 font-medium">{emailStats.sent} enviados</span>
                  <span className="text-red-600 dark:text-red-400 font-medium">{emailStats.failed} fallidos</span>
                  <span className="text-foreground font-semibold">{emailStats.successRate}% éxito</span>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">

            {/* Stats row */}
            {emailStats ? (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { label: "Total", value: emailStats.total, color: "blue" },
                  { label: "Enviados", value: emailStats.sent, color: "green" },
                  { label: "Pendientes", value: emailStats.pending, color: "yellow" },
                  { label: "Fallidos", value: emailStats.failed, color: "pink" },
                ].map(item => (
                  <div key={item.label} className="px-3 py-2.5 rounded-lg bg-muted/40 border border-border text-center">
                    <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
                    <p className={`text-xl font-bold ${
                      item.color === "green" ? "text-green-600 dark:text-green-400" :
                      item.color === "yellow" ? "text-yellow-600 dark:text-yellow-400" :
                      item.color === "pink" ? "text-red-600 dark:text-red-400" :
                      "text-foreground"
                    }`}>{item.value}</p>
                  </div>
                ))}
              </div>
            ) : (
              <Button variant="secondary" size="sm" onClick={async () => {
                try {
                  const r = await notificationService.getEmailStats();
                  if (r?.success) setEmailStats(r.data);
                } catch {}
              }}>
                Cargar estadísticas
              </Button>
            )}

            {/* History search */}
            <div className="flex gap-2">
              <Input
                placeholder="Buscar por email..."
                value={historyEmail}
                onChange={e => setHistoryEmail(e.target.value)}
                onKeyDown={e => e.key === "Enter" && fetchEmailHistory()}
                className="h-8 text-sm border-border bg-muted/50"
              />
              <Button variant="outline" size="sm" className="h-8 border-border gap-1.5" onClick={fetchEmailHistory}>
                <Search className="h-3.5 w-3.5" />
                Buscar
              </Button>
            </div>

            {/* History list */}
            {emailHistory?.history && emailHistory.history.length > 0 && (
              <div className="rounded-lg border border-border overflow-hidden">
                {emailHistory.history.map((email: EmailHistoryItem, i: number) => (
                  <div
                    key={email._id}
                    className={`flex items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors ${
                      i > 0 ? "border-t border-border" : ""
                    }`}
                    onClick={() => { setSelectedEmail(email); setEmailDetailOpen(true); }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <MessageSquare className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm text-foreground truncate">{email.to}</p>
                        <p className="text-xs text-muted-foreground">{email.template}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {emailStatusBadge(email.status)}
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Sección 5: Auditoría de Acciones ───────────────────────────── */}
        <Card className="bg-card border border-line">
          <CardHeader className="border-b border-line pb-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-foreground flex items-center gap-2 text-base">
                <ClipboardList className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                Auditoría de Acciones
                {auditTotal > 0 && (
                  <Badge className="ml-1 bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/30 text-xs">
                    {auditTotal} registros
                  </Badge>
                )}
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                className="h-7 border-border gap-1.5 text-xs"
                onClick={() => fetchAuditLogs(auditPage, auditFilters)}
                disabled={auditLoading}
              >
                <RefreshCw className={`h-3 w-3 ${auditLoading ? "animate-spin" : ""}`} />
                Actualizar
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">

            {/* Filtros */}
            <div className="flex flex-wrap gap-2">
              <Input
                placeholder="Filtrar por acción..."
                value={auditActionFilter}
                onChange={e => setAuditActionFilter(e.target.value)}
                onKeyDown={e => e.key === "Enter" && applyAuditFilters()}
                className="h-8 text-sm border-border bg-muted/50 w-44"
              />
              <Input
                placeholder="Filtrar por email..."
                value={auditEmailFilter}
                onChange={e => setAuditEmailFilter(e.target.value)}
                onKeyDown={e => e.key === "Enter" && applyAuditFilters()}
                className="h-8 text-sm border-border bg-muted/50 w-44"
              />
              <select
                value={auditServiceFilter}
                onChange={e => setAuditServiceFilter(e.target.value)}
                className="h-8 px-2 text-sm border border-border rounded-md bg-muted/50 text-foreground"
              >
                <option value="">Todos los servicios</option>
                <option value="user-management">User Management</option>
                <option value="exam-service">Exam Service</option>
              </select>
              <Button
                variant="outline"
                size="sm"
                className="h-8 border-border gap-1.5"
                onClick={applyAuditFilters}
              >
                <Filter className="h-3.5 w-3.5" />
                Filtrar
              </Button>
            </div>

            {/* Tabla de logs */}
            {auditLoading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Cargando registros...
              </div>
            ) : auditLogs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No hay registros de auditoría aún. Las acciones sobre usuarios y sesiones aparecerán aquí.
              </div>
            ) : (
              <div className="rounded-lg border border-border overflow-hidden">
                {/* Header */}
                <div className="grid grid-cols-[1fr_1fr_1fr_1fr] gap-3 px-4 py-2 bg-muted/40 border-b border-border text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  <span>Fecha</span>
                  <span>Acción</span>
                  <span>Actor</span>
                  <span>Objetivo</span>
                </div>
                {auditLogs.map((log, i) => (
                  <div
                    key={String(log._id)}
                    className={`grid grid-cols-[1fr_1fr_1fr_1fr] gap-3 px-4 py-2.5 items-center ${
                      i > 0 ? "border-t border-border" : ""
                    } ${i % 2 === 0 ? "" : "bg-muted/20"}`}
                  >
                    <div className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatAuditDate(log.timestamp)}
                    </div>
                    <div>
                      {actionBadge(log.action)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-foreground truncate font-medium">
                        {log.actor.email ?? log.actor.userId ?? "—"}
                      </p>
                      {log.actor.role && (
                        <p className="text-xs text-muted-foreground capitalize">{log.actor.role}</p>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-foreground truncate">
                        {log.target.name ?? log.target.id ?? "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">{log.target.type}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Paginación */}
            {auditTotalPages > 1 && (
              <div className="flex items-center justify-between pt-1">
                <p className="text-xs text-muted-foreground">
                  Página {auditPage} de {auditTotalPages} — {auditTotal} registros
                </p>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => { const p = auditPage - 1; setAuditPage(p); fetchAuditLogs(p, auditFilters); }}
                    disabled={auditPage === 1}
                    className="p-1.5 rounded-md border border-border bg-muted/50 hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                  <button
                    onClick={() => { const p = auditPage + 1; setAuditPage(p); fetchAuditLogs(p, auditFilters); }}
                    disabled={auditPage === auditTotalPages}
                    className="p-1.5 rounded-md border border-border bg-muted/50 hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

      </div>

      {/* Email detail dialog */}
      <Dialog open={emailDetailOpen} onOpenChange={setEmailDetailOpen}>
        <DialogContent className="max-w-lg bg-card border border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <Mail className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
              Detalle del Email
            </DialogTitle>
          </DialogHeader>
          {selectedEmail && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground">Destinatario</p>
                  <p className="text-foreground font-medium">{selectedEmail.to}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground">Plantilla</p>
                  <p className="text-foreground font-medium">{selectedEmail.template}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground">Estado</p>
                  {emailStatusBadge(selectedEmail.status)}
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground">Intentos</p>
                  <p className="text-foreground">{(selectedEmail as any).attempts ?? 1}</p>
                </div>
              </div>
              {selectedEmail.messageId && (
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground">Message ID</p>
                  <div className="flex items-center gap-2">
                    <code className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded truncate flex-1">
                      {selectedEmail.messageId}
                    </code>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 flex-shrink-0"
                      onClick={() => { navigator.clipboard.writeText(selectedEmail.messageId!); toast.success("Copiado"); }}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}
              {(selectedEmail as any).error && (
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30">
                  <p className="text-xs font-medium text-red-700 dark:text-red-300 mb-1">Error</p>
                  <p className="text-xs text-red-600 dark:text-red-400">{(selectedEmail as any).error}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};

export default DiagnosticoScreen;
