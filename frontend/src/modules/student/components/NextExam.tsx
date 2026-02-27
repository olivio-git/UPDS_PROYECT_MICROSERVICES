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
import { useToast } from '@/hooks/use-toast';
import {
  AlertCircle,
  Calendar,
  Clock,
  GraduationCap,
  Loader2,
  Play,
  User,
} from 'lucide-react';
import { notificationSocket } from '@/services/notifications/notificationSocket';
import React, { useEffect, useState } from 'react';
import { studentExamService, type NextExamData } from '../services/examService';

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
  const { toast } = useToast();

  useEffect(() => {
    loadNextExam();

    // Recargar cuando cambie el estado de la sesión o cuando nos agreguen a una
    const onStatusChanged = (data: any) => {
      console.log('🔄 [NextExam] session.status.changed:', data);
      loadNextExam();
    };
    const onNotificationCreated = (data: any) => {
      if (data?.type === 'session.candidate.added') {
        console.log('🔔 [NextExam] Agregado a sesión, recargando...');
        loadNextExam();
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

  const loadNextExam = async () => {
    try {
      setLoading(true);
      setError(null);
      const exams = await studentExamService.getNextExams();
      const nextExamData = exams && exams.length > 0 ? exams[0] : null;
      setNextExam(nextExamData);
    } catch (error) {
      console.error('❌ Error loading next exam:', error);
      setError(
        error instanceof Error
          ? error.message
          : 'Error al cargar el próximo examen'
      );
    } finally {
      setLoading(false);
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
        return 'border border-emerald-400/30 bg-emerald-500/10 text-emerald-300';
      case 'active':
        return 'border border-amber-400/30 bg-amber-500/10 text-amber-300';
      default:
        return 'border border-gray-400/30 bg-gray-500/10 text-gray-300';
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
        <Card className="bg-box backdrop-blur-sm border border-line">
          <CardHeader className="space-y-2 border-b border-line pb-4">
            <CardTitle className="text-white flex items-center gap-2 font-bold">
              <Calendar className="h-6 w-6 text-brand-gray bg-gray-800 rounded-full p-1" />
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
        <Card className="bg-box backdrop-blur-sm border border-line">
          <CardHeader className="space-y-2 border-b border-line pb-4">
            <CardTitle className="text-white flex items-center gap-2 font-bold">
              <Calendar className="h-6 w-6 text-brand-gray bg-gray-800 rounded-full p-1" />
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
              variant="outline"
              className="mt-4 w-full bg-[#0F1A2A] hover:bg-[#16233F] text-white"
            >
              Reintentar
            </Button>
          </CardContent>
        </Card>
    );
  }
  if (!nextExam) {
    return ( 
        <Card className="bg-box backdrop-blur-sm border border-line">
          <CardHeader className="space-y-2 border-b border-line pb-4">
            <CardTitle className="text-white flex items-center gap-2 font-bold">
              <Calendar className="h-6 w-6 text-brand-gray bg-gray-800 rounded-full p-1" />
              Próximo Examen
            </CardTitle>
            <CardDescription className="text-brand-gray text-xs">
              Sin exámenes programados
            </CardDescription>
          </CardHeader>
          <CardContent className="py-6">
            <div className="text-center">
              <Calendar className="mx-auto h-8 w-8 text-gray-500 mb-4" />
              <p className="text-gray-400 mb-2">
                No tienes exámenes programados
              </p>
              <p className="text-sm text-gray-500 mb-4">
                Los nuevos exámenes aparecerán aquí cuando sean programados
              </p>
              <Button
                onClick={loadNextExam}
                variant="outline"
                className="mt-2 bg-[#0F1A2A] hover:bg-[#16233F] text-white w-full"
              >
                Actualizar
              </Button>
            </div>
          </CardContent>
        </Card>
    );
  }

  return (
    <Card className="bg-box backdrop-blur-sm border border-line">
      <CardHeader className="space-y-2 border-b border-line pb-4">
        <CardTitle className="text-white flex items-center gap-2 font-bold">
          <Calendar className="h-6 w-6 text-brand-gray bg-gray-800 rounded-full p-1" />
          Próximo Examen
        </CardTitle>
          <CardDescription className="text-brand-gray text-xs">
            Tu siguiente evaluación programada
          </CardDescription> 
      </CardHeader>
      <CardContent className="space-y-6 transition-all py-6">
        <div className="border border-line rounded-lg p-4 transition-colors thin-border">
          <h3 className="text-lg font-semibold text-white mb-3">
            {nextExam.name}
          </h3>

          {/* --- Información básica del examen --- */}
          <div className="grid grid-cols-2 gap-4 text-sm text-gray-300 mb-4">
            <div className="flex items-center gap-2 font-light">
              <Calendar className="h-4 w-4 text-gray-400" />
              {formatDate(nextExam.date)}
            </div>
            <div className="flex items-center gap-2 font-light">
              <Clock className="h-4 w-4 text-gray-400" />
              {nextExam.time}
            </div>
          </div>

          {/* --- Badges con información del examen --- */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <Badge
              variant="secondary"
              className="border border-fuchsia-400/30 bg-fuchsia-500/10 text-fuchsia-300"
            >
              Nivel {nextExam.level}
            </Badge>
            <Badge
              variant="secondary"
              className="border border-sky-400/30 bg-sky-500/10 text-sky-300"
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

          {/* --- Información del examen --- */}
          {nextExam.exam && (
            <div className="bg-gray-800/20 rounded-lg p-3 mb-4 border border-line">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-900 to-purple-900 flex items-center justify-center shrink-0">
                  <span className="text-white font-bold text-sm">
                    {nextExam.exam.type?.charAt(0).toUpperCase() || 'E'}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-white">
                    {nextExam.exam.name}
                  </p>
                  <p className="text-xs text-gray-400">
                    Tipo: {nextExam.exam.type || 'Evaluación'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* --- Información del creador --- */}
          {nextExam.createdBy && (
            <div className="bg-gray-800/20 rounded-lg p-3 mb-4 border border-line">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-green-900 to-emerald-900 flex items-center justify-center shrink-0">
                  <User className="h-4 w-4 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">
                    {nextExam.createdBy.firstName} {nextExam.createdBy.lastName}
                  </p>
                  <p className="text-xs text-gray-400">
                    {getRoleDisplayName(nextExam.createdBy.role)}
                  </p>
                </div>
                {nextExam.createdBy.teacherData && (
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-xs text-gray-400">
                      <GraduationCap className="h-4 w-4" />
                      <span>{nextExam.createdBy.teacherData.department}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* --- Especializaciones del profesor --- */}
              {nextExam.createdBy.teacherData?.specialization &&
                nextExam.createdBy.teacherData.specialization.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-700/50">
                    <p className="text-xs text-gray-400 mb-2">
                      Especializaciones:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {nextExam.createdBy.teacherData.specialization
                        .slice(0, 3)
                        .map((spec, index) => (
                          <span
                            key={index}
                            className="px-2.5 py-0.5 text-xs font-medium border border-teal-400/30 bg-teal-500/10 text-teal-300 rounded-full"
                          >
                            {spec}
                          </span>
                        ))}
                      {nextExam.createdBy.teacherData.specialization.length >
                        3 && (
                        <span className="px-2.5 py-0.5 text-xs bg-gray-500/20 text-gray-400 rounded-full">
                          +
                          {nextExam.createdBy.teacherData.specialization
                            .length - 3}{' '}
                          más
                        </span>
                      )}
                    </div>
                  </div>
                )}
            </div>
          )}

          {/* --- Botón para iniciar examen --- */}
          {nextExam.status === 'scheduled' ? (
            <div className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-md bg-gray-800/60 border border-line text-gray-400 text-sm">
              <Clock className="h-4 w-4 text-yellow-400" />
              <span>En espera — el examen aún no ha iniciado</span>
            </div>
          ) : (
            <Button
              onClick={handleStartExam}
              size="sm"
              disabled={startingExam || nextExam.status !== 'in_progress'}
              className="w-full font-semibold text-white uppercase tracking-wider transition-all duration-300
                ease-in-out bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-500/20 hover:shadow-lg
                hover:shadow-indigo-500/30 transform hover:-translate-y-0.5 disabled:bg-gray-700 disabled:shadow-none
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
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default NextExam;
