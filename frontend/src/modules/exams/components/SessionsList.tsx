import { Calendar } from '@/components/atoms/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/atoms/popover';
import CustomizableTable from '@/components/common/CustomizableTable';
import { MainLayout } from '@/components/layout';
import { cn } from '@/lib/utils';
import { notificationSocket } from '@/services/notifications/notificationSocket';
import { authSDK } from '@/services/sdk-simple-auth';
import {
  createColumnHelper,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Activity,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Edit,
  Eye,
  Loader2,
  MoreHorizontal,
  Play,
  Plus,
  RefreshCw,
  Search,
  Square,
  User2,
  UserPlus,
  Users,
  Wifi,
  WifiOff,
  XCircle,
} from 'lucide-react';
import type { DateRange } from 'react-day-picker';
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useSessions } from '../hooks/useSessions';
import type { ExamSession } from '../types';
import CandidateAssignmentView from './CandidateAssignmentView';
import ProctorAssignmentModal from './ProctorAssignmentView';
import SessionDetailView from './SessionDetailView';
import SessionForm from './SessionForm';

type ViewMode =
  | 'table'
  | 'create'
  | 'edit'
  | 'detail'
  | 'candidates'
  | 'proctors';

// Interface para eventos de WebSocket
// interface SessionStatusUpdate {
//   sessionId: string;
//   status: string;
//   timestamp: string;
// }


const SessionsList: React.FC = () => {
  const {
    sessions,
    loading,
    error,
    totalPages,
    totalItems,
    currentPage,
    applyFilters,
    clearFilters,
    changePage,
    loadSessions,
    updateSessionStatus,
    startSession,
    endSession,
  } = useSessions();

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Navegación / vistas
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [selectedSession, setSelectedSession] = useState<ExamSession | null>(null);

  // UI state
  const [searchTerm, setSearchTerm] = useState('');

  // Estados para WebSocket
  const [socketConnected, setSocketConnected] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  // Estado para forzar re-render cada minuto (actualizar condiciones de tiempo)
  const [currentTime, setCurrentTime] = useState(new Date());

  // Estado para tabla
  const [sorting, setSorting] = useState<SortingState>([]);

  // Estado para recalificación
  const [regradingId, setRegradingId] = useState<string | null>(null);

  // Estado para rango de fechas del date picker
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  // Filtros locales
  const [localFilters, setLocalFilters] = useState({
    status: 'all',
    examId: '',
    startDate: '',
    endDate: '',
    sortBy: 'startDate',
    sortOrder: 'desc' as 'asc' | 'desc',
  });

  // Real-time session status updates via notification socket
  useEffect(() => {
    console.log('[SessionsList] mount — socket already connected?', notificationSocket.isConnected());

    const onSessionStatusChanged = (payload: any) => {
      console.log('🔄 [SessionsList] session.status.changed:', payload);
      const statusMap: Record<string, 'scheduled' | 'in_progress' | 'completed' | 'cancelled'> = {
        in_progress: 'in_progress',
        completed: 'completed',
        cancelled: 'cancelled',
        scheduled: 'scheduled',
      };
      const mappedStatus = statusMap[payload.status] || payload.status;
      updateSessionStatus(String(payload.sessionId), mappedStatus);
    };
    const onConnect = () => {
      console.log('[SessionsList] notificationSocket connected → setSocketConnected(true)');
      setSocketConnected(true);
    };
    const onDisconnect = () => {
      console.log('[SessionsList] notificationSocket disconnected → setSocketConnected(false)');
      setSocketConnected(false);
    };

    notificationSocket.on('session.status.changed', onSessionStatusChanged);
    notificationSocket.on('connect', onConnect);
    notificationSocket.on('disconnect', onDisconnect);

    // Si ya está conectado al montarse, reflejar estado inmediatamente
    if (notificationSocket.isConnected()) {
      console.log('[SessionsList] Already connected — setting true immediately');
      setSocketConnected(true);
    } else {
      console.log('[SessionsList] Not connected — calling connect()');
      notificationSocket.connect().catch((e) => console.error('[SessionsList] connect() failed:', e));
    }

    return () => {
      notificationSocket.off('session.status.changed', onSessionStatusChanged);
      notificationSocket.off('connect', onConnect);
      notificationSocket.off('disconnect', onDisconnect);
    };
  }, []);

  // Effect para timer simple y escalable
  useEffect(() => {
    // Timer fijo cada 30 segundos - simple y predecible
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 30000);

    return () => clearInterval(interval);
  }, []); // Sin dependencias = se ejecuta solo una vez

  // Función para reintentar la conexión
  const handleRetryConnection = async () => {
    if (isRetrying) return;

    setIsRetrying(true);
    try {
      await notificationSocket.connect();
      const connected = notificationSocket.isConnected();
      setSocketConnected(connected);
      
      if (connected) {
        toast.success('Reconectado al servidor de sesiones');
      } else {
        toast.error('No se pudo conectar al servidor');
      }
    } catch (error) {
      console.error('Error al reintentar conexión:', error);
      toast.error('Error al intentar reconectar');
    } finally {
      setIsRetrying(false);
    }
  };

  // Auto-abrir sesión si viene ?sessionId= en la URL
  useEffect(() => {
    const targetId = searchParams.get('sessionId');
    if (!targetId || !sessions.length || viewMode !== 'table') return;
    const match = sessions.find(s => s._id === targetId);
    if (match) {
      setSelectedSession(match);
      setViewMode('detail');
    }
  }, [sessions, searchParams]);

  // Auto-abrir formulario de creación si viene ?action=create en la URL
  useEffect(() => {
    if (searchParams.get('action') === 'create' && viewMode === 'table') {
      setViewMode('create');
    }
  }, [searchParams]);

  // Handlers de navegación
  const goTable = () => {
    setSelectedSession(null);
    setViewMode('table');
  };
  const goCreate = () => {
    setSelectedSession(null);
    setViewMode('create');
  };
  const goEdit = (s: ExamSession) => {
    setSelectedSession(s);
    setViewMode('edit');
  };
  const goDetail = (s: ExamSession) => {
    setSelectedSession(s);
    setViewMode('detail');
  };
  const goCandidates = (s: ExamSession) => {
    setSelectedSession(s);
    setViewMode('candidates');
  };
  const goProctors = (s: ExamSession) => {
    setSelectedSession(s);
    setViewMode('proctors');
  };

  // Validaciones de tiempo/fecha para sesiones
  const isSessionInPast = (session: ExamSession): boolean => {
    const sessionEndTime = new Date(session.scheduling.endDate).getTime();
    return sessionEndTime < currentTime.getTime();
  };

  const isSessionStartTimeInPast = (session: ExamSession): boolean => {
    const sessionStartTime = new Date(session.scheduling.startDate).getTime();
    return sessionStartTime < currentTime.getTime();
  };

  const canManageSession = (session: ExamSession): boolean => {
    // Solo permitir gestión si la sesión no ha terminado
    return !isSessionInPast(session) && session.status !== 'completed';
  };

  // Acciones de sesiones
  const canStartSession = (session: ExamSession) =>
    session.status === 'scheduled'; // Siempre mostrar para sesiones programadas

  // const isSessionReadyToStart = (session: ExamSession) =>
  //   new Date(session.scheduling.startDate) <= currentTime;

  const canEndSession = (session: ExamSession) =>
    session.status === 'in_progress';

  const handleStartSession = async (sessionId: string) => {
    const session = sessions.find(s => s._id === sessionId);
    if (!session) return;

    const startTime = new Date(session.scheduling.startDate).toLocaleTimeString(
      'es-BO',
      {
        timeZone: 'America/La_Paz',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }
    );

    // const isOnTime = new Date(session.scheduling.startDate) <= currentTime;
    const isEarly = new Date(session.scheduling.startDate) > currentTime;

    let confirmMessage = '';
    if (isEarly) {
      confirmMessage = `⏰ Esta sesión está programada para las ${startTime}.\n\n¿Está seguro de que desea iniciarla ANTES de la hora programada?`;
    } else {
      confirmMessage = `✅ La sesión estaba programada para las ${startTime}.\n\n¿Está seguro de que desea iniciarla ahora?`;
    }

    if (confirm(confirmMessage)) {
      await startSession(sessionId);
      loadSessions();
    }
  };

  const handleEndSession = async (sessionId: string) => {
    if (confirm('¿Está seguro de que desea finalizar esta sesión?')) {
      await endSession(sessionId);
      loadSessions();
    }
  };

  const handleRegrade = (session: ExamSession) => {
    setRegradingId(session._id!);
    const gradingUrl = import.meta.env.VITE_API_GATEWAY_URL || 'http://localhost:80';
    const token = authSDK.getAccessToken();

    const fetchPromise = fetch(`${gradingUrl}/api/v1/grading/regrade-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: JSON.stringify({ sessionId: session._id }),
    }).then(async (res) => {
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error desconocido');
      return data;
    }).finally(() => setRegradingId(null));

    toast.promise(fetchPromise, {
      loading: `Recalificando "${session.sessionName}"...`,
      success: (data: any) =>
        `Recalificación completa: ${data.data.regraded} resultado(s) actualizado(s)`,
      error: (err: any) => `Error al recalificar: ${err.message}`,
    });
  };

  // Búsqueda / filtros
  const handleSearch = () => {
    const filters = {
      ...localFilters,
      status: localFilters.status === 'all' ? undefined : localFilters.status,
      q: searchTerm || undefined,
      sortBy: localFilters.sortBy,
      sortOrder: localFilters.sortOrder,
    };
    applyFilters(filters);
  };

  const handleClearFilters = () => {
    setDateRange(undefined);
    setLocalFilters({
      status: 'all',
      examId: '',
      startDate: '',
      endDate: '',
      sortBy: 'startDate',
      sortOrder: 'desc' as 'asc' | 'desc',
    });
    setSearchTerm('');
    clearFilters();
  };

  const handleDateRangeChange = (range: DateRange | undefined) => {
    setDateRange(range);
    setLocalFilters(prev => ({
      ...prev,
      startDate: range?.from ? format(range.from, 'yyyy-MM-dd') : '',
      endDate: range?.to ? format(range.to, 'yyyy-MM-dd') : '',
    }));
  };

  const formatDate = (date: string) => {
    // Simplemente usar toLocaleString con zona horaria específica
    const utcDate = new Date(date);

    return utcDate.toLocaleString('es-BO', {
      timeZone: 'America/La_Paz',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      scheduled: {
        color: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/30',
        icon: Clock,
        text: 'Programada',
      },
      in_progress: {
        color: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-500/20 dark:text-green-300 dark:border-green-500/30',
        icon: Play,
        text: 'En Progreso',
      },
      completed: {
        color: 'bg-muted/50 text-foreground/80 border-border',
        icon: CheckCircle,
        text: 'Completada',
      },
      cancelled: {
        color: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-500/20 dark:text-red-300 dark:border-red-500/30',
        icon: XCircle,
        text: 'Cancelada',
      },
      expired: {
        color: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-500/20 dark:text-orange-300 dark:border-orange-500/30',
        icon: XCircle,
        text: 'Expirada',
      },
    } as const;

    const cfg = (statusConfig as any)[status] || statusConfig.scheduled;
    const Icon = cfg.icon;
    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}
      >
        <Icon className="w-3.5 h-3.5 mr-1" />
        {cfg.text}
      </span>
    );
  };

  // Column helper para TanStack Table
  const columnHelper = createColumnHelper<ExamSession>();

  // Definición de columnas (sin lobby)
  const columns = [
    columnHelper.accessor('sessionName', {
      header: 'Sesión',
      size: 200,
      cell: info => (
        <span className="text-sm font-medium text-foreground">{info.getValue()}</span>
      ),
    }),
    columnHelper.accessor(row => (row as any).examId?.name || row.exam?.name, {
      id: 'exam',
      header: 'Examen',
      size: 200,
      cell: info => {
        const session = info.row.original;
        const name = (session as any).examId?.name || session.exam?.name || 'Sin examen';
        const level = (session as any).examId?.targetLevel || session.exam?.targetLevel;
        return (
          <span className="inline-flex items-center gap-1.5 text-sm text-foreground truncate max-w-full">
            <span className="truncate">{name}</span>
            {level && (
              <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border leading-none">
                {level}
              </span>
            )}
          </span>
        );
      },
    }),
    columnHelper.accessor('scheduling.startDate', {
      header: 'Fecha y Hora',
      size: 170,
      cell: info => {
        const session = info.row.original;
        const start = new Date(session.scheduling.startDate);
        const end = new Date(session.scheduling.endDate);
        const durationMs = end.getTime() - start.getTime();
        const durationMin = Math.round(durationMs / 60000);
        const durationLabel = durationMin >= 60
          ? `${Math.floor(durationMin / 60)}h${durationMin % 60 > 0 ? ` ${durationMin % 60}min` : ''}`
          : `${durationMin}min`;
        const dateStr = start.toLocaleString('es-BO', {
          timeZone: 'America/La_Paz',
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        });
        return (
          <span className="text-sm text-foreground whitespace-nowrap">
            {dateStr}
            <span className="text-muted-foreground ml-1.5">· {durationLabel}</span>
          </span>
        );
      },
    }),
    columnHelper.accessor('participants', {
      header: 'Candidatos',
      size: 100,
      cell: info => {
        const participants = info.getValue();
        const registered = participants.registeredCandidates?.length || 0;
        const max = participants.maxCandidates || 1;
        const fillPercentage = registered / max;

        let color = 'text-muted-foreground';
        if (fillPercentage > 0.7) color = 'text-red-500 dark:text-red-400';
        else if (fillPercentage > 0.4) color = 'text-orange-500 dark:text-orange-400';
        else if (fillPercentage > 0) color = 'text-cyan-600 dark:text-cyan-400';

        return (
          <span className={`inline-flex items-center gap-1 text-sm font-medium whitespace-nowrap ${color}`}>
            <Users className="w-3.5 h-3.5 shrink-0" />
            {registered} / {max}
          </span>
        );
      },
    }),
    columnHelper.accessor('status', {
      header: 'Estado',
      size: 120,
      cell: info => getStatusBadge(info.getValue()),
    }),
    columnHelper.display({
      id: 'actions',
      header: '',
      size: 48,
      cell: info => {
        const session = info.row.original;
        const isInProgress = session.status === 'in_progress';

        const menuItems: { icon: React.ReactNode; label: string; onClick: () => void; className?: string }[] = [];

        menuItems.push({
          icon: <Eye className="h-3.5 w-3.5" />,
          label: 'Ver detalles',
          onClick: () => goDetail(session),
        });

        if (isInProgress) {
          menuItems.push({
            icon: <Activity className="h-3.5 w-3.5" />,
            label: 'Monitorear',
            onClick: () => navigate(`/sessions/${session._id}/monitor`),
            className: 'text-cyan-600 dark:text-cyan-400',
          });
        }

        if (session.status === 'scheduled' && canManageSession(session) && !isSessionStartTimeInPast(session)) {
          menuItems.push({
            icon: <Edit className="h-3.5 w-3.5" />,
            label: 'Editar',
            onClick: () => goEdit(session),
          });
        }

        if (canManageSession(session)) {
          menuItems.push({
            icon: <UserPlus className="h-3.5 w-3.5" />,
            label: 'Gestionar candidatos',
            onClick: () => goCandidates(session),
          });
          menuItems.push({
            icon: <User2 className="h-3.5 w-3.5" />,
            label: 'Gestionar proctores',
            onClick: () => goProctors(session),
          });
        }

        if (canStartSession(session) && canManageSession(session)) {
          menuItems.push({
            icon: <Play className="h-3.5 w-3.5" />,
            label: 'Iniciar sesión',
            onClick: () => handleStartSession(session._id!),
            className: 'text-green-600 dark:text-green-400',
          });
        }

        if (canEndSession(session) && canManageSession(session)) {
          menuItems.push({
            icon: <Square className="h-3.5 w-3.5" />,
            label: 'Finalizar sesión',
            onClick: () => handleEndSession(session._id!),
            className: 'text-red-600 dark:text-red-400',
          });
        }

        if (session.status === 'completed') {
          menuItems.push({
            icon: regradingId === session._id
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <RefreshCw className="h-3.5 w-3.5" />,
            label: 'Recalificar',
            onClick: () => handleRegrade(session),
            className: 'text-purple-600 dark:text-purple-400',
          });
        }

        return (
          <Popover>
            <PopoverTrigger asChild>
              <button
                className={`p-1.5 rounded-md transition-colors hover:bg-muted/60 ${
                  isInProgress
                    ? 'text-cyan-500 dark:text-cyan-400 hover:bg-cyan-500/10'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title="Acciones"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-44 p-1">
              {menuItems.map((item, i) => (
                <button
                  key={i}
                  onClick={item.onClick}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-xs rounded hover:bg-muted transition-colors text-left ${item.className || 'text-foreground'}`}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </PopoverContent>
          </Popover>
        );
      },
    }),
  ];

  // Configurar TanStack Table
  const table = useReactTable({
    data: sessions,
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    columnResizeMode: 'onChange',
  });

  // Render por vista
  const renderView = () => {
    if (viewMode === 'detail' && selectedSession) {
      return (
        <SessionDetailView
          session={selectedSession}
          onBack={goTable}
          onEdit={() => goEdit(selectedSession)}
          onManageCandidates={() => goCandidates(selectedSession)}
        />
      );
    }

    if (viewMode === 'create' || viewMode === 'edit') {
      return (
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">
              {viewMode === 'edit' ? 'Editar Sesión' : 'Nueva Sesión'}
            </h2>
            <button
              onClick={goTable}
              className="px-3 py-2 bg-muted/50 border border-border rounded-lg text-foreground/80 hover:bg-muted flex items-center gap-2"
            >
              <XCircle className="w-4 h-4" /> Volver
            </button>
          </div>

          <SessionForm
            session={viewMode === 'edit' ? selectedSession : null}
            onCancel={goTable}
            onSaved={() => {
              goTable();
              loadSessions();
            }}
          />
        </div>
      );
    }

    if (viewMode === 'candidates' && selectedSession) {
      return (
        <div className="bg-card border border-border rounded-xl p-6">
          <CandidateAssignmentView
            session={selectedSession}
            onClose={goTable}
            loadSessions={loadSessions}
            onSuccess={() => {
              goTable();
              loadSessions();
            }}
          />
        </div>
      );
    }
    if (viewMode === 'proctors' && selectedSession) {
      return (
        <div className="bg-card border border-border rounded-xl p-6">
          <ProctorAssignmentModal
            session={selectedSession}
            onClose={goTable}
            loadSessions={loadSessions}
            onSuccess={() => {
              goTable();
              loadSessions();
            }}
          />
        </div>
      );
    }
    // Tabla (vista por defecto "table")
    if (loading) {
      return (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
          <p className="mt-4 text-muted-foreground">Cargando sesiones...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={() => loadSessions()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all"
          >
            Reintentar
          </button> 
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-3">

        {/* Header row */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Sesiones</h1>
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
              Gestión y programación de evaluaciones
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium border ${
                socketConnected
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-red-500/10 text-red-400 border-red-500/20'
              }`}>
                {socketConnected ? <Wifi className="w-2.5 h-2.5" /> : <WifiOff className="w-2.5 h-2.5" />}
                {socketConnected ? 'Conectado' : 'Desconectado'}
              </span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!socketConnected && (
              <button
                onClick={handleRetryConnection}
                disabled={isRetrying}
                className="h-7 flex items-center gap-1.5 px-2 text-xs rounded border border-border bg-muted/60 text-foreground hover:bg-muted transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${isRetrying ? 'animate-spin' : ''}`} />
                {isRetrying ? 'Conectando...' : 'Reintentar'}
              </button>
            )}
            <button
              onClick={goCreate}
              className="h-8 flex items-center gap-1.5 px-3 text-xs rounded-md bg-blue-600 hover:bg-blue-700 text-white transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Nueva Sesión
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="bg-card border border-border rounded-lg px-3 py-2 flex flex-wrap items-center gap-2">

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar sesión..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              className="h-7 pl-6 pr-2 text-xs bg-muted/60 border border-border rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring w-44"
            />
          </div>

          <div className="w-px h-5 bg-border shrink-0" />

          {/* Estado */}
          <select
            value={localFilters.status}
            onChange={e => setLocalFilters(prev => ({ ...prev, status: e.target.value }))}
            className="h-7 text-xs bg-muted/60 border border-border rounded px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="all">Todos los estados</option>
            <option value="scheduled">Programada</option>
            <option value="in_progress">En Progreso</option>
            <option value="completed">Completada</option>
            <option value="cancelled">Cancelada</option>
            <option value="expired">Expirada</option>
          </select>

          <div className="w-px h-5 bg-border shrink-0" />

          {/* Date range */}
          <Popover>
            <PopoverTrigger asChild>
              <button className={cn(
                'h-7 flex items-center gap-1.5 px-2 text-xs rounded border border-border bg-muted/60 text-foreground hover:bg-muted transition-colors whitespace-nowrap',
                !dateRange?.from && 'text-muted-foreground'
              )}>
                <Clock className="h-3 w-3 shrink-0 text-muted-foreground" />
                {dateRange?.from ? (
                  dateRange.to
                    ? <>{format(dateRange.from, 'd MMM', { locale: es })} — {format(dateRange.to, 'd MMM yy', { locale: es })}</>
                    : format(dateRange.from, 'd MMM yyyy', { locale: es })
                ) : 'Rango de fechas'}
                {dateRange?.from && (
                  <span
                    role="button"
                    onClick={e => { e.stopPropagation(); handleDateRangeChange(undefined); }}
                    className="ml-1 text-muted-foreground hover:text-foreground"
                  >
                    <XCircle className="h-3 w-3" />
                  </span>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                selected={dateRange}
                onSelect={handleDateRangeChange}
                numberOfMonths={2}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          <div className="w-px h-5 bg-border shrink-0" />

          {/* Ordenar por */}
          <select
            value={localFilters.sortBy}
            onChange={e => setLocalFilters(prev => ({ ...prev, sortBy: e.target.value }))}
            className="h-7 text-xs bg-muted/60 border border-border rounded px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="startDate">Fecha inicio</option>
            <option value="endDate">Fecha fin</option>
            <option value="sessionName">Nombre</option>
            <option value="status">Estado</option>
            <option value="createdAt">Creación</option>
            <option value="candidatesCount">Candidatos</option>
          </select>

          {/* Orden */}
          <select
            value={localFilters.sortOrder}
            onChange={e => setLocalFilters(prev => ({ ...prev, sortOrder: e.target.value as 'asc' | 'desc' }))}
            className="h-7 text-xs bg-muted/60 border border-border rounded px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="desc">Descendente</option>
            <option value="asc">Ascendente</option>
          </select>

          <button
            onClick={handleSearch}
            className="h-7 px-2.5 text-xs rounded bg-blue-600 hover:bg-blue-700 text-white transition-colors"
          >
            Aplicar
          </button>

          <button
            onClick={handleClearFilters}
            className="h-7 px-2 text-xs rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            Limpiar
          </button>
        </div>

        {/* Tabla */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <CustomizableTable
            table={table}
            isLoading={loading}
            isFetching={false}
            isError={!!error}
            errorMessage={error || undefined}
            noDataMessage="No hay sesiones disponibles"
            rows={10}
          />

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="px-4 py-3 border-t border-border flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {(currentPage - 1) * 10 + 1}–{Math.min(currentPage * 10, totalItems)} de {totalItems} sesiones
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => changePage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="p-1.5 bg-muted/50 border border-border rounded hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronLeft className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => changePage(page)}
                    className={`px-2.5 py-1 text-xs rounded transition-all ${
                      page === currentPage
                        ? 'bg-blue-600 text-white'
                        : 'bg-muted/50 border border-border text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {page}
                  </button>
                ))}
                <button
                  onClick={() => changePage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="p-1.5 bg-muted/50 border border-border rounded hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <MainLayout>
      <div className="flex flex-col gap-3 p-4 max-w-5xl mx-auto w-full">
        {renderView()}
      </div>
    </MainLayout>
  );
};

export default SessionsList;
