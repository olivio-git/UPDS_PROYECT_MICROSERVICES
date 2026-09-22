import { Alert, AlertDescription } from '@/components/atoms/alert';
import { Badge } from '@/components/atoms/badge';
import { Button } from '@/components/atoms/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/atoms/card';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/atoms/hover-card';
import { useToast } from '@/hooks/use-toast';
import { UserAvatar } from '@/components/atoms/UserAvatar';
import {
  AlertCircle,
  BookOpen,
  Calendar,
  Clock,
  GraduationCap,
  Loader2,
  Mail,
  MonitorCheck,
  Play,
} from 'lucide-react';
import { notificationSocket } from '@/services/notifications/notificationSocket';
import React, { useEffect, useState, useCallback } from 'react';
import { studentExamService, type NextExamData } from '../services/examService';
import SystemCheckPanel from './SystemCheckPanel';

interface PropsNextExam {
  formatDate?: (date: string) => string;
  onStartExam?: (sessionId: string) => void;
}

const NextExam: React.FC<PropsNextExam> = ({
  formatDate = (date: string) =>
    new Date(date).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
  onStartExam,
}) => {
  const [nextExam, setNextExam] = useState<NextExamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startingExam, setStartingExam] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [showSystemCheck, setShowSystemCheck] = useState(false);
  const { toast } = useToast();

  // Tick cada 30 segundos para actualizar countdown/elapsed
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const formatCountdown = useCallback((targetIso: string): string => {
    const diff = new Date(targetIso).getTime() - now;
    if (diff <= 0) return 'en breve';
    const totalMin = Math.floor(diff / 60_000);
    const days = Math.floor(totalMin / 1440);
    const hours = Math.floor((totalMin % 1440) / 60);
    const mins = totalMin % 60;
    if (days > 0) return `${days}d ${hours}h ${mins}m`;
    if (hours > 0) return `${hours}h ${mins}m`;
    if (mins === 0) return 'en breve';
    return `${mins} min`;
  }, [now]);

  const formatElapsed = useCallback((startIso: string): string => {
    const diff = now - new Date(startIso).getTime();
    if (diff < 0) return 'hace un momento';
    const totalMin = Math.floor(diff / 60_000);
    const hours = Math.floor(totalMin / 60);
    const mins = totalMin % 60;
    if (hours > 0) return `hace ${hours}h ${mins}m`;
    if (mins === 0) return 'hace un momento';
    return `hace ${mins} min`;
  }, [now]);

  useEffect(() => {
    loadNextExam();

    // Recargar cuando cambie el estado de la sesión o cuando nos agreguen a una
    // Usar background=true para no desmontar SystemCheckPanel durante la recarga
    const onStatusChanged = (data: any) => {
      console.log('🔄 [NextExam] session.status.changed:', data);
      loadNextExam(true);
    };
    const onNotificationCreated = (data: any) => {
      if (data?.type === 'session.candidate.added') {
        console.log('🔔 [NextExam] Agregado a sesión, recargando...');
        loadNextExam(true);
      } else if (data?.type === 'candidate.kicked' || data?.type === 'session.candidate.removed') {
        console.log('🚫 [NextExam] Removido/expulsado de sesión, recargando...');
        loadNextExam(true);
      }
    };

    notificationSocket.on('session.status.changed', onStatusChanged);
    notificationSocket.on('notification.created', onNotificationCreated);
    // Ensure socket is connected (Header may have already connected it)
    notificationSocket.connect().catch(() => {});

    return () => {
      notificationSocket.off('session.status.changed', onStatusChanged);
      notificationSocket.off('notification.created', onNotificationCreated);
    };
  }, []);

  // background=true → actualiza datos sin flash de loading (no desmonta hijos como SystemCheckPanel)
  const loadNextExam = async (background = false) => {
    try {
      if (!background) setLoading(true);
      setError(null);
      const exams = await studentExamService.getNextExams();
      const nextExamData = exams && exams.length > 0 ? exams[0] : null;
      setNextExam(nextExamData);
    } catch (error) {
      console.error('❌ Error loading next exam:', error);
      if (!background) {
        setError(
          error instanceof Error
            ? error.message
            : 'Error al cargar el próximo examen'
        );
      }
    } finally {
      if (!background) setLoading(false);
    }
  };
  const handleStartExam = async () => {
    if (!nextExam) return;
    try {
      setStartingExam(true);
      if (onStartExam) onStartExam(nextExam.sessionId);

      // const result = await studentExamService.startExam(nextExam.sessionId);
      // if (result.success) {
      //   toast({
      //     title: '¡Examen iniciado!',
      //     description: 'Serás redirigido a la plataforma de examen.',
      //   });
      // } else {
      //   toast({
      //     title: 'Error al iniciar examen',
      //     description: result.message,
      //     variant: 'destructive',
      //   });
      // }
    } catch (error) {
      toast({
        title: 'Error inesperado',
        description: 'No se pudo iniciar el examen. Intenta nuevamente.',
        variant: 'destructive',
      });
    } finally {
      setStartingExam(false);
    }
  };

  const getRoleDisplayName = (role: string) => {
    const roleNames = {
      admin: 'Administrador',
      teacher: 'Profesor',
      proctor: 'Supervisor',
      student: 'Estudiante',
    };
    return roleNames[role as keyof typeof roleNames] || role;
  };

  // Helper para clases de los badges de estado
  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'scheduled':
        return 'border border-emerald-400/30 bg-emerald-500/10 text-emerald-600';
      case 'active':
        return 'border border-amber-400/30 bg-amber-500/10 text-amber-600';
      default:
        return 'border border-border bg-muted/50 text-muted-foreground';
    }
  };

  // Helper para el texto del badge de estado
  const getStatusDisplayName = (status: string) => {
    switch (status) {
      case 'scheduled':
        return 'Programado';
      case 'active':
        return 'Activo';
      case 'in_progress':
        return 'En Progreso';
      case 'completed':
        return 'Completado';
      case 'cancelled':
        return 'Cancelado';
      case 'expired':
        return 'Expirado';
      default:
        return status;
    }
  };

  if (loading) {
    return ( 
        <Card className="bg-card backdrop-blur-sm border border-line shadow-none">
          <CardHeader className="space-y-2 border-b border-line pb-4">
            <CardTitle className="text-foreground flex items-center gap-2 font-bold">
              <Calendar className="h-6 w-6 text-brand-gray bg-muted rounded-full p-1" />
              Próximo Examen
            </CardTitle>
            <CardDescription className="text-brand-gray text-xs">
              Cargando información...
            </CardDescription>
          </CardHeader>
          <CardContent className="py-6">
            <div className="flex items-center justify-center h-40">
              <Loader2 className="h-8 w-8 animate-spin text-brand-gray" />
            </div>
          </CardContent>
        </Card>
    );
  }

  if (error) {
    return ( 
        <Card className="bg-card backdrop-blur-sm border border-line shadow-none">
          <CardHeader className="space-y-2 border-b border-line pb-4">
            <CardTitle className="text-foreground flex items-center gap-2 font-bold">
              <Calendar className="h-6 w-6 text-brand-gray bg-muted rounded-full p-1" />
              Próximo Examen
            </CardTitle>
            <CardDescription className="text-brand-gray text-xs">
              Error al cargar información
            </CardDescription>
          </CardHeader>
          <CardContent className="py-6">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <Button
              onClick={loadNextExam}
              variant="secondary"
              className="mt-4 w-full"
            >
              Reintentar
            </Button>
          </CardContent>
        </Card>
    );
  }
  if (!nextExam) {
    return ( 
        <Card className="bg-card backdrop-blur-sm border border-line shadow-none">
          <CardHeader className="space-y-2 border-b border-line pb-4">
            <CardTitle className="text-foreground flex items-center gap-2 font-bold">
              <Calendar className="h-6 w-6 text-brand-gray bg-muted rounded-full p-1" />
              Próximo Examen
            </CardTitle>
            <CardDescription className="text-brand-gray text-xs">
              Sin exámenes programados
            </CardDescription>
          </CardHeader>
          <CardContent className="py-6">
            <div className="text-center">
              <Calendar className="mx-auto h-8 w-8 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground mb-2">
                No tienes exámenes programados
              </p>
              <p className="text-sm text-muted-foreground/70 mb-4">
                Los nuevos exámenes aparecerán aquí cuando sean programados
              </p>
              <Button
                onClick={loadNextExam}
                variant="default"
                className="mt-2 w-full"
              >
                Actualizar
              </Button>
            </div>
          </CardContent>
        </Card>
    );
  }

  return (
    <Card className="bg-card backdrop-blur-sm border border-line shadow-none">
      <CardHeader className="space-y-2 border-b border-line pb-4">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-foreground flex items-center gap-2 font-bold">
            <Calendar className="h-6 w-6 text-brand-gray bg-muted rounded-full p-1" />
            Próximo Examen
          </CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowSystemCheck((v) => !v)}
            className="h-8 gap-1.5 text-xs border-border text-muted-foreground hover:text-foreground hover:bg-muted shrink-0"
          >
            <MonitorCheck className="h-3.5 w-3.5" />
            {showSystemCheck ? 'Cerrar prueba' : 'Prueba técnica'}
          </Button>
        </div>
          <CardDescription className="text-brand-gray text-xs">
            Tu siguiente evaluación programada
          </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 transition-all py-6">
        <div className="border border-line rounded-lg p-4 transition-colors thin-border">
          <h3 className="text-lg font-semibold text-foreground mb-3">
            {nextExam.name}
          </h3>

          {/* --- Información básica del examen --- */}
          <div className="grid grid-cols-2 gap-4 text-sm text-foreground/80 mb-4">
            <div className="flex items-center gap-2 font-light">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              {formatDate(nextExam.rawStartDate)}
            </div>
            <div className="flex items-center gap-2 font-light">
              <Clock className="h-4 w-4 text-muted-foreground" />
              {nextExam.time}
            </div>
          </div>

          {/* --- Badges con información del examen --- */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <Badge
              variant="secondary"
              className="border border-fuchsia-400/30 bg-fuchsia-500/10 text-fuchsia-600"
            >
              Nivel {nextExam.level}
            </Badge>
            <Badge
              variant="secondary"
              className="border border-sky-400/30 bg-sky-500/10 text-sky-600"
            >
              {nextExam.duration}
            </Badge>
            <Badge
              variant="secondary"
              className={getStatusBadgeClass(nextExam.status)}
            >
              {getStatusDisplayName(nextExam.status)}
            </Badge>
          </div>


          {/* --- Información del creador --- */}
          {nextExam.createdBy && (
            <HoverCard openDelay={200} closeDelay={100}>
              <HoverCardTrigger asChild>
                <div className="bg-muted/20 rounded-lg p-3 mb-4 border border-line cursor-pointer hover:bg-muted/40 hover:border-muted-foreground/20 transition-colors group">
                  <div className="flex items-center gap-3">
                    <UserAvatar
                      avatarUrl={nextExam.createdBy.avatarUrl}
                      firstName={nextExam.createdBy.firstName}
                      lastName={nextExam.createdBy.lastName}
                      size="sm"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground group-hover:text-indigo-500 transition-colors">
                        {nextExam.createdBy.firstName} {nextExam.createdBy.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {getRoleDisplayName(nextExam.createdBy.role)}
                      </p>
                    </div>
                    {nextExam.createdBy.teacherData && (
                      <div className="text-right">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <GraduationCap className="h-4 w-4" />
                          <span>{nextExam.createdBy.teacherData.department}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </HoverCardTrigger>

              <HoverCardContent
                side="top"
                align="start"
                className="w-80 p-0 overflow-hidden border border-line bg-card shadow-xl"
              >
                {/* Header con avatar y nombre */}
                <div className="relative bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent p-4 border-b border-line">
                  <div className="flex items-center gap-3">
                    <UserAvatar
                      avatarUrl={nextExam.createdBy.avatarUrl}
                      firstName={nextExam.createdBy.firstName}
                      lastName={nextExam.createdBy.lastName}
                      size="lg"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground truncate">
                        {nextExam.createdBy.firstName} {nextExam.createdBy.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {getRoleDisplayName(nextExam.createdBy.role)}
                      </p>
                      {nextExam.createdBy.teacherData?.department && (
                        <div className="flex items-center gap-1 mt-1">
                          <GraduationCap className="h-3 w-3 text-indigo-500 shrink-0" />
                          <span className="text-xs text-indigo-500 font-medium truncate">
                            {nextExam.createdBy.teacherData.department}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Cuerpo con detalles */}
                <div className="p-4 space-y-3">
                  {/* Email si existe */}
                  {nextExam.createdBy.email && (
                    <div className="flex items-center gap-2 text-xs">
                      <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
                      <a
                        href={`mailto:${nextExam.createdBy.email}`}
                        onClick={(e) => {
                          e.preventDefault();
                          navigator.clipboard.writeText(nextExam.createdBy!.email);
                        }}
                        title="Clic para copiar"
                        className="truncate text-sky-500 hover:text-sky-400 hover:underline cursor-pointer transition-colors"
                      >
                        {nextExam.createdBy.email}
                      </a>
                    </div>
                  )}

                  {/* Especializaciones */}
                  {nextExam.createdBy.teacherData?.specialization &&
                    nextExam.createdBy.teacherData.specialization.length > 0 && (
                      <div>
                        <div className="flex items-center gap-1.5 mb-2">
                          <BookOpen className="h-3.5 w-3.5 text-muted-foreground/60" />
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            Especializaciones
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {nextExam.createdBy.teacherData.specialization.map((spec, index) => (
                            <span
                              key={index}
                              className="px-2.5 py-0.5 text-xs font-medium border border-teal-400/30 bg-teal-500/10 text-teal-600 rounded-full"
                            >
                              {spec}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* Sin datos extra */}
                  {!nextExam.createdBy.email &&
                    (!nextExam.createdBy.teacherData?.specialization ||
                      nextExam.createdBy.teacherData.specialization.length === 0) && (
                      <p className="text-xs text-muted-foreground/60 text-center py-1">
                        Sin información adicional
                      </p>
                    )}
                </div>
              </HoverCardContent>
            </HoverCard>
          )}

          {/* --- Botón para iniciar examen --- */}
          {nextExam.status === 'scheduled' ? (
            <div className="w-full flex items-center justify-center gap-1.5 py-2 text-sm text-muted-foreground">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              <span>Inicia en <span className="font-semibold text-foreground">{formatCountdown(nextExam.rawStartDate)}</span></span>
            </div>
          ) : (
            <>
              {nextExam.status === 'in_progress' && !nextExam.myAttemptStatus && (
                <div className="w-full flex items-center justify-center gap-1.5 py-1 text-xs text-muted-foreground mb-2">
                  <Clock className="h-3 w-3 shrink-0" />
                  <span>Inició <span className="font-semibold text-foreground">{formatElapsed(nextExam.rawStartDate)}</span></span>
                </div>
              )}
            <Button
              onClick={handleStartExam}
              size="sm"
              disabled={startingExam || nextExam.status !== 'in_progress'}
              className="w-full font-semibold text-white uppercase tracking-wider transition-all duration-300
                ease-in-out bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-500/20 hover:shadow-lg
                hover:shadow-indigo-500/30 transform hover:-translate-y-0.5 disabled:bg-muted disabled:shadow-none
                disabled:transform-none disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
            >
              {startingExam ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Iniciando...
                </>
              ) : nextExam.status === 'in_progress' ? (
                <>
                  <Play className="h-5 w-5 mr-2" />
                  {nextExam.myAttemptStatus === 'in_progress' ? 'Continuar Examen' : 'Entrar al Examen'}
                </>
              ) : (
                <>
                  <AlertCircle className="h-5 w-5 mr-2" />
                  No Disponible
                </>
              )}
            </Button>
            </>
          )}

          {showSystemCheck && <SystemCheckPanel key={nextExam.sessionId} sessionId={nextExam.sessionId} />}
        </div>
      </CardContent>
    </Card>
  );
};

export default NextExam;
