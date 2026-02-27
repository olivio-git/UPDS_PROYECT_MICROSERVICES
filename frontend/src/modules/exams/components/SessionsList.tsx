import { Button } from '@/components/atoms/button';
import { Input } from '@/components/atoms/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/atoms/select';
import GradientWrapper from '@/components/background/GrandWrapperSection';
import CustomizableTable from '@/components/common/CustomizableTable';
import { MainLayout } from '@/components/layout';
import { notificationSocket } from '@/services/notifications/notificationSocket';
import { authSDK } from '@/services/sdk-simple-auth';
import {
  createColumnHelper,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table';
import {
  Activity,
  BookOpen,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Edit,
  Eye,
  Filter,
  Loader2,
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
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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

  // Navegación / vistas
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [selectedSession, setSelectedSession] = useState<ExamSession | null>(
    null
  );

  // UI state
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Estados para WebSocket
  const [socketConnected, setSocketConnected] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  // Estado para forzar re-render cada minuto (actualizar condiciones de tiempo)
  const [currentTime, setCurrentTime] = useState(new Date());

  // Estado para tabla
  const [sorting, setSorting] = useState<SortingState>([]);

  // Estado para recalificación
  const [regradingId, setRegradingId] = useState<string | null>(null);

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
        color: 'bg-blue-900/20 text-blue-400 border-blue-800/30',
        icon: Clock,
        text: 'Programada',
      },
      in_progress: {
        color: 'bg-green-900/20 text-green-400 border-green-800/30',
        icon: Play,
        text: 'En Progreso',
      },
      completed: {
        color: 'bg-gray-900/20 text-gray-300 border-gray-700',
        icon: CheckCircle,
        text: 'Completada',
      },
      cancelled: {
        color: 'bg-red-900/20 text-red-400 border-red-800/30',
        icon: XCircle,
        text: 'Cancelada',
      },
      expired: {
        color: 'bg-orange-900/20 text-orange-400 border-orange-800/30',
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
      header: () => (
        <div className="flex items-center">
          {/* <Square className="h-4 w-4 mr-2 text-gray-400" /> */}
          Sesión
        </div>
      ),
      size: 200,
      cell: info => (
        <div>
          <div className="text-sm font-medium text-gray-200">
            {info.getValue()}
          </div>
          <div className="text-xs text-gray-500">
            ID: {info.row.original._id}
          </div>
        </div>
      ),
    }),
    columnHelper.accessor(row => (row as any).examId?.name || row.exam?.name, {
      id: 'exam',
      header: () => (
        <div className="flex items-center">
          <BookOpen className="h-4 w-4 mr-2 text-gray-400" />
          Examen
        </div>
      ),
      size: 180,
      cell: info => {
        const session = info.row.original;
        return (
          <div>
            <div className="text-sm text-gray-200">
              {(session as any).examId?.name ||
                session.exam?.name ||
                'Examen no disponible'}
            </div>
            <div className="text-xs text-gray-500">
              {(session as any).examId?.type || session.exam?.type || 'N/A'} -
              {(session as any).examId?.targetLevel ||
                session.exam?.targetLevel ||
                'N/A'}
            </div>
          </div>
        );
      },
    }),
    columnHelper.accessor('scheduling.startDate', {
      header: () => (
        <div className="flex items-center">
          <Clock className="h-4 w-4 mr-2 text-gray-400" />
          Fecha y Hora
        </div>
      ),
      size: 160,
      cell: info => {
        const session = info.row.original;
        return (
          <div>
            <div className="text-sm text-gray-200">
              {formatDate(session.scheduling.startDate)}
            </div>
            <div className="text-xs text-gray-500">
              hasta{' '}
              {new Date(session.scheduling.endDate).toLocaleTimeString(
                'es-BO',
                {
                  timeZone: 'America/La_Paz',
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: false,
                }
              )}
            </div>
          </div>
        );
      },
    }),
    columnHelper.accessor('participants', {
      header: () => (
        <div className="flex items-center">
          <Users className="h-4 w-4 mr-2 text-gray-400" />
          Participantes
        </div>
      ),
      size: 120,
      cell: info => {
        const participants = info.getValue();
        const registered = participants.registeredCandidates?.length || 0;
        const max = participants.maxCandidates || 1;
        const fillPercentage = registered / max;
        
        // Dynamic color based on fill percentage
        let iconColor = 'text-gray-400'; // Empty state
        if (fillPercentage > 0.7) {
          iconColor = 'text-red-400'; // High occupancy
        } else if (fillPercentage > 0.4) {
          iconColor = 'text-orange-400'; // Medium occupancy
        } else if (fillPercentage > 0) {
          iconColor = 'text-cyan-400'; // Low occupancy
        }
        
        return (
          <div>
            <div className="flex items-center text-sm text-gray-200">
              <Users className={`h-4 w-4 mr-1 ${iconColor}`} />
              {registered} / {max}
            </div>
            <div className="text-xs text-gray-500">
              {participants.proctors?.length || 0} proctores
            </div>
          </div>
        );
      },
    }),
    columnHelper.accessor('status', {
      header: () => (
        <div className="flex items-center">
          <Wifi className="h-4 w-4 mr-2 text-gray-400" />
          Estado
        </div>
      ),
      size: 120,
      cell: info => getStatusBadge(info.getValue()),
    }),
    columnHelper.display({
      id: 'actions',
      header: () => (
        <div className="flex items-center">
          <Edit className="h-4 w-4 mr-2 text-gray-400" />
          Acciones
        </div>
      ),
      size: 100,
      cell: info => {
        const session = info.row.original;
        return (
          <div className="grid grid-cols-3 gap-2 max-w-[120px]">
            {/* Botón Ver detalles */}
            <button
              onClick={() => goDetail(session)}
              className="p-2 text-blue-400 hover:text-blue-300 hover:bg-blue-400/10 rounded-md transition-all duration-200 flex items-center justify-center"
              title="Ver detalles"
            >
              <Eye className="h-4 w-4" />
            </button>

            {/* Botón Monitorear (solo sesiones activas) */}
            {session.status === 'in_progress' && (
              <button
                onClick={() => navigate(`/sessions/${session._id}/monitor`)}
                className="p-2 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-400/10 rounded-md transition-all duration-200 flex items-center justify-center"
                title="Monitorear en tiempo real"
              >
                <Activity className="h-4 w-4" />
              </button>
            )}

            {/* Botón Editar */}
            {session.status === 'scheduled' &&
              canManageSession(session) &&
              !isSessionStartTimeInPast(session) && (
                <button
                  onClick={() => goEdit(session)}
                  className="p-2 text-gray-300 hover:text-gray-100 hover:bg-gray-400/10 rounded-md transition-all duration-200 flex items-center justify-center"
                  title="Editar"
                >
                  <Edit className="h-4 w-4" />
                </button>
              )}

            {/* Botón Gestionar proctores */}
            {canManageSession(session) && (
              <button
                onClick={() => goProctors(session)}
                className="p-2 text-orange-400 hover:text-orange-300 hover:bg-orange-400/10 rounded-md transition-all duration-200 flex items-center justify-center"
                title="Gestionar proctores"
              >
                <User2 className="h-4 w-4" />
              </button>
            )}

            {/* Botón Gestionar candidatos */}
            {canManageSession(session) && (
              <button
                onClick={() => goCandidates(session)}
                className="p-2 text-green-400 hover:text-green-300 hover:bg-green-400/10 rounded-md transition-all duration-200 flex items-center justify-center"
                title="Gestionar candidatos"
              >
                <UserPlus className="h-4 w-4" />
              </button>
            )}

            {/* Acciones de sesión */}
            {canStartSession(session) && canManageSession(session) && (
              <button
                onClick={() => handleStartSession(session._id!)}
                className="p-2 text-green-400 hover:text-green-300 hover:bg-green-400/10 rounded-md transition-all duration-200 flex items-center justify-center"
                title="Iniciar sesión"
              >
                <Play className="h-4 w-4" />
              </button>
            )}

            {canEndSession(session) && canManageSession(session) && (
              <button
                onClick={() => handleEndSession(session._id!)}
                className="p-2 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-md transition-all duration-200 flex items-center justify-center"
                title="Finalizar sesión"
              >
                <Square className="h-4 w-4" />
              </button>
            )}

            {/* Botón Recalificar (solo sesiones completadas) */}
            {session.status === 'completed' && (
              <button
                onClick={() => handleRegrade(session)}
                disabled={regradingId === session._id}
                className="p-2 text-purple-400 hover:text-purple-300 hover:bg-purple-400/10 rounded-md transition-all duration-200 flex items-center justify-center disabled:opacity-50"
                title="Recalificar examen"
              >
                {regradingId === session._id
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <RefreshCw className="h-4 w-4" />}
              </button>
            )}
          </div>
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
        <div className="bg-box border border-line rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">
              {viewMode === 'edit' ? 'Editar Sesión' : 'Nueva Sesión'}
            </h2>
            <button
              onClick={goTable}
              className="px-3 py-2 bg-dark-light border border-line rounded-lg text-gray-300 hover:bg-dark-light/80 flex items-center gap-2"
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
        <div className="bg-box border border-line rounded-xl p-6">
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
        <div className="bg-box border border-line rounded-xl p-6">
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
    const baseInputClass =
      'bg-box border-line text-white placeholder-gray-400 border-[0.5px] focus:border-blue-500 focus:ring-0 rounded-lg';

    if (loading) {
      return (
        <div className="bg-box border border-line rounded-xl p-12 text-center">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
          <p className="mt-4 text-gray-400">Cargando sesiones...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="bg-box border border-line rounded-xl p-12 text-center">
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
      <div className="space-y-6">
        {/* Header con búsqueda y acciones */}
        <div className="bg-box border border-line rounded-xl p-6">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-gray-200">
                Sesiones de Examen
              </h2>

              {/* Indicador de conexión WebSocket */}
              <div className="flex items-center gap-2">
                <div
                  className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                    socketConnected
                      ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                      : 'bg-red-500/20 text-red-300 border border-red-500/30'
                  }`}
                >
                  {socketConnected ? (
                    <>
                      <Wifi className="w-3 h-3" /> Servidor Conectado
                    </>
                  ) : (
                    <>
                      <WifiOff className="w-3 h-3" /> Servidor Desconectado
                    </>
                  )}
                </div>
                
                {/* Botón de reintento cuando está desconectado */}
                {!socketConnected && (
                  <button
                    onClick={handleRetryConnection}
                    disabled={isRetrying}
                    className="flex items-center gap-1 px-2 py-1 rounded-md bg-blue-600/20 text-blue-400 border border-blue-600/30 hover:bg-blue-600/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium"
                    title="Reintentar conexión"
                  >
                    <RefreshCw className={`w-3 h-3 ${isRetrying ? 'animate-spin' : ''}`} />
                    {isRetrying ? 'Conectando...' : 'Reintentar'}
                  </button>
                )}
              </div>
            </div>
            <p className="text-gray-400 mt-1">
              Gestiona y programa sesiones de evaluación
            </p>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mt-4">
            {/* Búsqueda */}
            <div className="flex-1 max-w-xl">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  placeholder="Buscar por nombre de sesión..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  className="pl-10 pr-3 w-full bg-gray-800/50 border-gray-600 text-white placeholder-gray-400"
                />
              </div>
            </div>

            {/* Acciones */}
            <div className="flex items-center gap-3"> 
              <Button
                size={"sm"}
                className='px-4 py-2.5 bg-dark-light border border-line rounded-lg hover:bg-dark-light/80 text-gray-300 flex items-center gap-2 transition-all'
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="w-4 h-4" />
                Filtros 
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={goCreate}
                className="gap-1 bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Plus className="w-4 h-4" />
                Nueva Sesión
              </Button>
            </div>
          </div>

          {/* Filtros expandidos */}
          {showFilters && (
            <div className="mt-6 pt-6 border-t border-line">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Estado
                  </label>
                  <Select
                    value={localFilters.status}
                    onValueChange={(value) => 
                      setLocalFilters(prev => ({
                        ...prev,
                        status: value,
                      }))
                    }
                  >
                    <SelectTrigger className={`w-full px-3 py-2 text-sm ${baseInputClass}`}>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-900 border border-line">
                      <SelectItem className="hover:bg-gray-800" value="all">Todos</SelectItem>
                      <SelectItem className="hover:bg-gray-800" value="scheduled">Programada</SelectItem>
                      <SelectItem className="hover:bg-gray-800" value="in_progress">En Progreso</SelectItem>
                      <SelectItem className="hover:bg-gray-800" value="completed">Completada</SelectItem>
                      <SelectItem className="hover:bg-gray-800" value="cancelled">Cancelada</SelectItem>
                      <SelectItem className="hover:bg-gray-800" value="expired">Expirada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Fecha Inicio
                  </label>
                  <input
                    type="date"
                    value={localFilters.startDate}
                    onChange={e =>
                      setLocalFilters(prev => ({
                        ...prev,
                        startDate: e.target.value,
                      }))
                    }
                    className={`w-full px-3 py-2 text-sm ${baseInputClass}`}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Fecha Fin
                  </label>
                  <input
                    type="date"
                    value={localFilters.endDate}
                    onChange={e =>
                      setLocalFilters(prev => ({
                        ...prev,
                        endDate: e.target.value,
                      }))
                    }
                    className={`w-full px-3 py-2 text-sm ${baseInputClass}`}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Ordenar por
                  </label>
                  <Select
                    value={localFilters.sortBy}
                    onValueChange={(value) =>
                      setLocalFilters(prev => ({
                        ...prev,
                        sortBy: value,
                      }))
                    }
                  >
                    <SelectTrigger className={`w-full px-3 py-2 text-sm ${baseInputClass}`}>
                      <SelectValue placeholder="Selecciona ordenamiento" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-900 border border-line">
                      <SelectItem className="hover:bg-gray-800" value="startDate">Fecha Inicio</SelectItem>
                      <SelectItem className="hover:bg-gray-800" value="endDate">Fecha Fin</SelectItem>
                      <SelectItem className="hover:bg-gray-800" value="sessionName">Nombre</SelectItem>
                      <SelectItem className="hover:bg-gray-800" value="status">Estado</SelectItem>
                      <SelectItem className="hover:bg-gray-800" value="createdAt">Fecha Creación</SelectItem>
                      <SelectItem className="hover:bg-gray-800" value="candidatesCount">Núm. Candidatos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Orden
                  </label>
                  <Select
                    value={localFilters.sortOrder}
                    onValueChange={(value) =>
                      setLocalFilters(prev => ({
                        ...prev,
                        sortOrder: value as 'asc' | 'desc',
                      }))
                    }
                  >
                    <SelectTrigger className={`w-full px-3 py-2 text-sm ${baseInputClass}`}>
                      <SelectValue placeholder="Selecciona orden" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-900 border border-line">
                      <SelectItem className="hover:bg-gray-800" value="desc">Descendente</SelectItem>
                      <SelectItem className="hover:bg-gray-800" value="asc">Ascendente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end gap-2">
                  <button
                    onClick={handleSearch}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all"
                  >
                    Aplicar
                  </button>
                  <button
                    onClick={handleClearFilters}
                    className="px-4 py-2 bg-dark-light border border-line rounded-lg hover:bg-dark-light/80 text-gray-300 transition-all"
                  >
                    Limpiar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Tabla */}
        <div className="bg-box border border-line rounded-xl overflow-hidden">
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
            <div className="px-6 py-4 border-t border-line flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-sm text-gray-400">
                Mostrando {(currentPage - 1) * 10 + 1} a{' '}
                {Math.min(currentPage * 10, totalItems)} de {totalItems}{' '}
                sesiones
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => changePage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="p-2 bg-dark-light border border-line rounded-lg hover:bg-dark-light/80 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronLeft className="w-4 h-4 text-gray-400" />
                </button>

                <div className="flex gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const page = i + 1;
                    return (
                      <button
                        key={page}
                        onClick={() => changePage(page)}
                        className={`px-3 py-1 rounded-lg transition-all ${
                          page === currentPage
                            ? 'bg-blue-600 text-white'
                            : 'bg-dark-light border border-line text-gray-400 hover:bg-dark-light/80'
                        }`}
                      >
                        {page}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => changePage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="p-2 bg-dark-light border border-line rounded-lg hover:bg-dark-light/80 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <MainLayout gradientVariant="aurora">
      <div className="max-w-7xl mx-auto space-y-8 epilogue-uniquifier">
        <div className="text-center space-y-3 mb-5">
          <div className="flex justify-center">
            <div className="p-2.5 rounded-full bg-gradient-to-br from-blue-500/15 to-purple-600/15 border border-blue-500/20">
              <BookOpen className="h-3.5 w-3.5 text-blue-300" />
            </div>
          </div>
        </div>

        <GradientWrapper
          intensity="low"
          size="xl"
          position="right"
          animate={false}
          variant="cosmic"
        >
          <div className="min-h-screen">{renderView()}</div>
        </GradientWrapper>
      </div>
    </MainLayout>
  );
};

export default SessionsList;
