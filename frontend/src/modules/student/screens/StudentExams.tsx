import { useState, useEffect } from "react";
import { 
  Calendar, 
  Clock, 
  Users, 
  Play,
  Info,
  CheckCircle,
  XCircle,
  AlertCircle,
  Filter,
  Loader2,
  RefreshCcw
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/atoms/card";
import { Button } from "@/components/atoms/button";
import { Badge } from "@/components/atoms/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/atoms/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/atoms/select";
import { MainLayout } from "@/components/layout";
import { ContentGradientSection } from "@/components/background";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import studentSessionService, { type AvailableSession } from "../services/sessionService";

const StudentExams = () => {
  const navigate = useNavigate();
  const [selectedLevel, setSelectedLevel] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<AvailableSession[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadAvailableSessions();
  }, []);

  const loadAvailableSessions = async () => {
    try {
      setLoading(true);
      const availableSessions = await studentSessionService.getAvailableSessions();
      setSessions(availableSessions);
    } catch (error) {
      console.error('Error cargando sesiones:', error);
      toast.error('Error al cargar las sesiones disponibles');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      studentSessionService.clearCandidateCache();
      await loadAvailableSessions();
      toast.success('Sesiones actualizadas');
    } catch (error) {
      toast.error('Error al actualizar sesiones');
    } finally {
      setRefreshing(false);
    }
  };

  const getStatusBadge = (status: string, lobbyStatus?: string) => {
    if (lobbyStatus === 'waiting') {
      return <Badge className="bg-blue-500/20 text-blue-300 border border-blue-500/30">En Lobby</Badge>;
    }
    if (lobbyStatus === 'starting') {
      return <Badge className="bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">Iniciando</Badge>;
    }
    if (lobbyStatus === 'in_progress') {
      return <Badge className="bg-green-500/20 text-green-300 border border-green-500/30">En Progreso</Badge>;
    }
    
    switch (status) {
      case 'scheduled':
        return <Badge className="bg-purple-500/20 text-purple-300 border border-purple-500/30">Programado</Badge>;
      case 'active':
        return <Badge className="bg-blue-500/20 text-blue-300 border border-blue-500/30">Activo</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getStatusIcon = (status: string, hasLobby: boolean) => {
    if (hasLobby) {
      return <Users className="h-4 w-4 text-blue-400" />;
    }
    switch (status) {
      case 'scheduled':
        return <Calendar className="h-4 w-4 text-purple-400" />;
      case 'active':
        return <CheckCircle className="h-4 w-4 text-green-400" />;
      default:
        return <Info className="h-4 w-4" />;
    }
  };

  const formatDate = (date: Date | string) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (date: Date | string) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleStartExam = async (session: AvailableSession) => {
    const canJoin = await studentSessionService.canJoinSession(session.sessionId);
    
    if (!canJoin.canJoin) {
      toast.error(canJoin.reason || 'No puedes acceder a este examen');
      return;
    }

    if (session.hasLobby && session.lobbyStatus === 'waiting') {
      // Ir directamente al lobby si está disponible
      navigate(`/student/exam/${session.sessionId}/lobby`);
    } else if (session.requiresTechnicalVerification) {
      // Ir a preparación técnica primero
      navigate(`/student/exam/${session.sessionId}/preparation`);
    } else {
      // Ir al lobby
      navigate(`/student/exam/${session.sessionId}/lobby`);
    }
  };

  const filteredSessions = sessions.filter(session => {
    // Por ahora no filtrar por nivel/tipo ya que no tenemos esos campos
    // Esto se puede expandir cuando se agreguen más metadatos
    return true;
  });

  const activeSessions = filteredSessions.filter(s => s.hasLobby && s.lobbyStatus !== 'finished');
  const upcomingSessions = filteredSessions.filter(s => !s.hasLobby || s.lobbyStatus === 'finished');

  if (loading) {
    return (
      <MainLayout gradientVariant="primary">
        <div className="max-w-7xl mx-auto flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-blue-500 mx-auto" />
            <p className="text-gray-400">Cargando sesiones disponibles...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout gradientVariant="primary">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <ContentGradientSection variant="secondary" position="top-right" className="mb-8">
          <div className="text-center space-y-6 m-6">
            <div className="space-y-2">
              <h1 className="mb-4 text-3xl font-extrabold text-gray-900 dark:text-white md:text-5xl lg:text-6xl">
                <span className="text-transparent bg-clip-text bg-gradient-to-r to-emerald-600 from-sky-400">
                  Mis Exámenes
                </span>
              </h1>
              <p className="text-lg font-normal text-gray-500 lg:text-xl dark:text-gray-400">
                Accede a tus exámenes programados y revisa tu progreso
              </p>
            </div>
          </div>
        </ContentGradientSection>

        {/* Filtros y Acciones */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <Button
              onClick={handleRefresh}
              variant="outline"
              size="sm"
              disabled={refreshing}
              className="border-gray-600"
            >
              <RefreshCcw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>
          </div>
          
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Users className="h-4 w-4" />
            <span>{sessions.length} sesiones disponibles</span>
          </div>
        </div>

        {/* Tabs de Sesiones */}
        <Tabs defaultValue="active" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-[#0B1422]/50 border border-gray-700/50">
            <TabsTrigger value="active">
              Activas ({activeSessions.length})
            </TabsTrigger>
            <TabsTrigger value="upcoming">
              Próximas ({upcomingSessions.length})
            </TabsTrigger>
          </TabsList>

          {/* Sesiones Activas */}
          <TabsContent value="active" className="space-y-4 mt-6">
            {activeSessions.length === 0 ? (
              <Card className="bg-[#0B1422] backdrop-blur-sm border border-gray-700/50">
                <CardContent className="pt-6 text-center">
                  <AlertCircle className="h-12 w-12 text-gray-500 mx-auto mb-4" />
                  <p className="text-gray-400">No hay sesiones activas en este momento</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {activeSessions.map((session) => (
                  <SessionCard 
                    key={session.sessionId} 
                    session={session}
                    onStart={handleStartExam}
                    formatDate={formatDate}
                    formatTime={formatTime}
                    getStatusBadge={getStatusBadge}
                    getStatusIcon={getStatusIcon}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Sesiones Próximas */}
          <TabsContent value="upcoming" className="space-y-4 mt-6">
            {upcomingSessions.length === 0 ? (
              <Card className="bg-[#0B1422] backdrop-blur-sm border border-gray-700/50">
                <CardContent className="pt-6 text-center">
                  <Calendar className="h-12 w-12 text-gray-500 mx-auto mb-4" />
                  <p className="text-gray-400">No hay sesiones programadas</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {upcomingSessions.map((session) => (
                  <SessionCard 
                    key={session.sessionId} 
                    session={session}
                    onStart={handleStartExam}
                    formatDate={formatDate}
                    formatTime={formatTime}
                    getStatusBadge={getStatusBadge}
                    getStatusIcon={getStatusIcon}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
};

// Componente SessionCard para las tarjetas de sesión
interface SessionCardProps {
  session: AvailableSession;
  onStart: (session: AvailableSession) => void;
  formatDate: (date: Date | string) => string;
  formatTime: (date: Date | string) => string;
  getStatusBadge: (status: string, lobbyStatus?: string) => JSX.Element;
  getStatusIcon: (status: string, hasLobby: boolean) => JSX.Element;
}

const SessionCard = ({ 
  session, 
  onStart, 
  formatDate, 
  formatTime, 
  getStatusBadge, 
  getStatusIcon 
}: SessionCardProps) => {
  const getButtonText = () => {
    if (session.hasLobby && session.lobbyStatus === 'waiting') {
      return 'Unirse al Lobby';
    }
    if (session.hasLobby && session.lobbyStatus === 'starting') {
      return 'Examen Iniciando...';
    }
    if (session.hasLobby && session.lobbyStatus === 'in_progress') {
      return 'Examen en Progreso';
    }
    return 'Prepararse para el Examen';
  };

  const isButtonDisabled = () => {
    return session.lobbyStatus === 'in_progress' || session.lobbyStatus === 'finished';
  };

  return (
    <Card className="bg-[#0B1422] backdrop-blur-sm border border-gray-700/50 hover:border-gray-600/50 transition-all">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-white text-lg mb-2">{session.examName}</CardTitle>
            <CardDescription className="text-gray-300">
              {session.sessionName || 'Sesión de evaluación'}
            </CardDescription>
          </div>
          <div className="flex flex-col gap-2">
            {getStatusBadge(session.status, session.lobbyStatus)}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-2 text-gray-300">
            <Calendar className="h-4 w-4" />
            {formatDate(session.scheduledAt)}
          </div>
          <div className="flex items-center gap-2 text-gray-300">
            <Clock className="h-4 w-4" />
            {formatTime(session.scheduledAt)} - {session.duration} min
          </div>
          <div className="flex items-center gap-2 text-gray-300">
            <Users className="h-4 w-4" />
            {session.currentParticipants || 0}/{session.maxParticipants || '∞'} participantes
          </div>
          <div className="flex items-center gap-2">
            {getStatusIcon(session.status, session.hasLobby)}
            <span className="text-gray-300">
              {session.hasLobby ? 'Lobby Activo' : 'Programado'}
            </span>
          </div>
        </div>

        {session.competencies && session.competencies.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-300">Competencias:</p>
            <div className="flex flex-wrap gap-1">
              {session.competencies.map((competency, index) => (
                <Badge 
                  key={index} 
                  variant="secondary" 
                  className="bg-gray-700/50 text-gray-300 text-xs"
                >
                  {competency}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {session.requiresTechnicalVerification && (
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
            <p className="text-sm text-yellow-300">
              <strong>Nota:</strong> Requiere verificación técnica antes de iniciar
            </p>
          </div>
        )}

        {session.registrationDeadline && new Date(session.registrationDeadline) > new Date() && (
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
            <p className="text-sm text-blue-300">
              <strong>Cierre de registro:</strong> {formatDate(session.registrationDeadline)}
            </p>
          </div>
        )}

        <div className="pt-4">
          <Button
            onClick={() => onStart(session)}
            disabled={isButtonDisabled()}
            className={`w-full ${
              session.hasLobby && session.lobbyStatus === 'waiting'
                ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700'
                : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700'
            } text-white`}
          >
            <Play className="h-4 w-4 mr-2" />
            {getButtonText()}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default StudentExams;
