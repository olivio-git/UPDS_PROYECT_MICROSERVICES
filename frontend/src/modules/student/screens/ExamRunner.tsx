import { Button } from '@/components/atoms/button';
import {
  Card,
  CardContent,
  CardHeader,
} from '@/components/atoms/card';
import GradientWrapper from '@/components/background/GrandWrapperSection';
import { MainLayout } from '@/components/layout';
import { useExamSession } from '@/hooks/useExamSession';
import { examService } from '@/services/examService';
import { notificationSocket } from '@/services/notifications/notificationSocket';
import { useExamStore } from '@/stores/examStore';
import { AlertCircle, ChevronLeft, ChevronRight, Loader2, Play, Rocket, Save, Square, Timer, Unplug, Users } from 'lucide-react';
import React, {
  useCallback,
  useEffect,
  useState
} from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { examResultService } from '@/services/examResultService';
import QuestionRenderer from '../components/QuestionRenderer';
import SectionedExamRenderer from '../components/SectionedExamRenderer';

const ExamRunner: React.FC = () => {
  const params = useParams<any>();
  const location = useLocation();
  const navigate = useNavigate();
  const sessionId = params.sessionId || params.examId;

  // Get data from Zustand store (set by ExamPreparation)
  const storeState = useExamStore();
  
  // Detect if this is an individual session from the URL path or default to individual
  // Most exam flows should use the new sectioned system (individual)
  const isIndividualSession = location.pathname.includes('/individual') || location.pathname.includes('/exam/');

  // Use the improved exam session hook
  const {
    // State
    isActive,
    questions,
    currentQuestionIndex,
    answers,
    timeRemaining,
    // sessionStatus,
    autoSaveStatus,
    loading,
    // error,
    wsConnected,
    // canLateJoin,
    
    // Current question helper
    currentQuestion,
    isLastQuestion,
    isFirstQuestion,
    progress,
    
    // Sectioned exam properties
    // sections,
    // sectionProgress,
    // currentSectionId,
    hasSections,
    // currentSection,
    
    // Actions
    startSession,
    endSession,
    updateAnswer,
    // navigateToQuestion,
    goToNextQuestion,
    goToPreviousQuestion,
    // requestLateJoin,
    performManualSave,
    syncWithExternalState,
    // Section actions
    // navigateToSection,
    // updateSectionProgress
  } = useExamSession({
    sessionId,
    sessionType: isIndividualSession ? 'individual' : 'group',
    autoSaveInterval: 10000,
    onSessionStart: () => {
      toast.success(
        isIndividualSession 
          ? 'Tu examen individual ha comenzado' 
          : 'Examen iniciado'
      );
    },
    onSessionEnd: (attemptId: string) => {
      if (attemptId) {
        examResultService.pollForResult(attemptId, 30, 2000)
          .then((result) => {
            const resultId = (result as any).id || (result as any)._id;
            navigate(`/student/results/${resultId}`);
          })
          .catch(() => {
            toast.info('Los resultados se están procesando. Los verás en tu dashboard.', { duration: 5000 });
            navigate('/student/dashboard');
          });
      } else {
        navigate('/student/results');
      }
    },
    onAutoSave: (success) => {
      if (!success) {
        toast.error('Error guardando respuestas');
      }
    }
  });

  const [starting, setStarting] = useState(false);

  // ── Prevent accidental exit (browser close / refresh) ─────────────────────
  const examActive = isActive || storeState.isActive;

  // Bloquear cierre/recarga de pestaña
  useEffect(() => {
    if (!examActive) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [examActive]);

  // Debug logging
  useEffect(() => {
    console.log('🎯 [ExamRunner] Store state:', {
      hasSections: storeState.hasSections,
      sectionsCount: storeState.sections.length,
      questionsCount: storeState.questions.length,
      isActive: storeState.isActive
    });
    console.log('🎯 [ExamRunner] Hook state:', {
      isActive,
      questionsLength: questions.length,
      hasSections
    });
    console.log('🎯 [ExamRunner] Condition check:', {
      condition: (!isActive && !storeState.isActive && storeState.sections.length === 0),
      showButton: (!isActive && !storeState.isActive && storeState.sections.length === 0)
    });
  }, [storeState.hasSections, storeState.sections.length, storeState.questions.length, storeState.isActive, isActive, questions.length, hasSections]);

  // Format time remaining for display
  const formatTime = useCallback((seconds: number) => {
    if (!seconds || seconds < 0) return '--:--';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Auto-save status component
  const AutoSaveIndicator = () => {
    const getStatusConfig = () => {
      switch (autoSaveStatus) {
        case 'saving':
          return { 
            text: 'Guardando...', 
            color: 'text-blue-500', 
            bgColor: 'bg-blue-500/10', 
            icon: <Loader2 className="w-3 h-3 animate-spin" /> 
          };
        case 'saved':
          return { 
            text: 'Guardado', 
            color: 'text-green-500', 
            bgColor: 'bg-green-500/10', 
            icon: <Save className="w-3 h-3" /> 
          };
        case 'error':
          return { 
            text: 'Error al guardar', 
            color: 'text-red-500', 
            bgColor: 'bg-red-500/10', 
            icon: <AlertCircle className="w-3 h-3" /> 
          };
        default:
          return null;
      }
    };

    const config = getStatusConfig();
    if (!config) return null;

    return (
      <div className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${config.color} ${config.bgColor}`}>
        {config.icon}
        {config.text}
      </div>
    );
  };

  // Validate session ID and redirect if invalid
  useEffect(() => {
    if (!sessionId) {
      toast.error('ID de sesión no válido');
      navigate('/student/dashboard');
      return;
    }
  }, [sessionId, navigate]);

  // Listen for kick event — redirect student immediately
  useEffect(() => {
    const handleNotification = (data: any) => {
      if (data?.type === 'candidate.kicked') {
        toast.error('Has sido expulsado de la sesión por el administrador.', { duration: 6000 });
        navigate('/student/dashboard');
      }
    };
    notificationSocket.on('notification.created', handleNotification);
    return () => {
      notificationSocket.off('notification.created', handleNotification);
    };
  }, [navigate]);

  // Listen for time extension
  useEffect(() => {
    const handleTimeExtended = (data: any) => {
      if (data?.sessionId && data.sessionId !== sessionId) return;
      const extra = Number(data?.extraMinutes) || 0;
      if (extra > 0) {
        storeState.addTimeExtension(extra * 60);
        toast.success(`El administrador extendió el tiempo de la sesión por ${extra} minuto${extra !== 1 ? 's' : ''}.`, { duration: 6000 });
      }
    };
    notificationSocket.on('session.time.extended', handleTimeExtended);
    return () => {
      notificationSocket.off('session.time.extended', handleTimeExtended);
    };
  }, [sessionId, storeState.addTimeExtension]);

  // Auto-initialize when we have store data from ExamPreparation
  useEffect(() => {
    if (storeState.isActive && storeState.hasSections && !isActive) {
      console.log('🎯 [ExamRunner] Datos del store detectados, sincronizando estado del hook');
      // Sincronizar el hook con los datos del store
      syncWithExternalState({
        sessionId: storeState.currentSessionId,
        isActive: true,
        questions: storeState.questions,
        sections: storeState.sections,
        hasSections: storeState.hasSections,
        timeRemaining: storeState.timeRemaining,
        sessionStatus: 'active'
      });
    }
  }, [storeState.isActive, storeState.hasSections, isActive, syncWithExternalState, storeState.currentSessionId, storeState.questions, storeState.sections, storeState.timeRemaining]);

  // Fetch questions when ExamRunner mounts and we don't have them in the store
  useEffect(() => {
    const fetchQuestions = async () => {
      if (sessionId && !storeState.hasSections && storeState.sections.length === 0) {
        console.log('🔍 [ExamRunner] No hay secciones en el store, obteniendo preguntas de la API...');
        try {
          const response = await examService.getSessionQuestions(sessionId);
          if (response.success && response.data) {
            console.log('✅ [ExamRunner] Preguntas obtenidas de la API:', response.data);
            // Backend returns sections array directly as `data`
            const sectionsData = Array.isArray(response.data)
              ? response.data
              : (response.data.sections || []);
            const questionsData = sectionsData.flatMap((s: any) => s.questions || []);
            storeState.setSessionData({
              sessionId,
              sections: sectionsData,
              questions: questionsData,
              timeRemaining: response.data.timeRemaining
            });
          }
        } catch (error) {
          console.error('❌ [ExamRunner] Error obteniendo preguntas:', error);
          toast.error('Error cargando las preguntas del examen');
        }
      }
    };

    fetchQuestions();
  }, [sessionId, storeState.hasSections, storeState.sections.length, storeState.setSessionData]);

  // Handle start exam - DEPRECATED: Solo para sesiones que no vinieron desde ExamPreparation
  const handleStart = useCallback(async () => {
    if (!sessionId) return;
    
    console.warn('⚠️ [ExamRunner] handleStart llamado - esto no debería ocurrir si vienes desde ExamPreparation');
    setStarting(true);
    try {
      await startSession(sessionId);
    } catch (error) {
      // Error handling is done in the hook
    } finally {
      setStarting(false);
    }
  }, [sessionId, startSession]);

  // Connection status indicator
  const ConnectionIndicator = () => (
    <div className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
      wsConnected 
        ? 'text-green-500 bg-green-500/10' 
        : 'text-red-500 bg-red-500/10'
    }`}>
      {wsConnected ? <Rocket className="w-4 h-4" /> : <Unplug className="w-4 h-4" />}
      {wsConnected ? 'Conectado' : 'Desconectado'}
    </div>
  );

  if (loading) {
    return (
      <MainLayout hideHeader>
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Preparando examen...</CardTitle>
            </CardHeader>
            <CardContent className="text-center py-12">
              <Loader2 className="animate-spin mx-auto" />
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout hideHeader>
      <div className="max-w-5xl mx-auto space-y-6">
        <GradientWrapper
          intensity="low"
          size="lg"
          position="bottom-right"
          animate={false}
          variant="cosmic"
        >
          <Card>
            <CardHeader className="pb-0">
              <div className="flex items-center justify-between py-1">
                {/* Left: status dot + session type */}
                <div className="flex items-center gap-2.5">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shrink-0" />
                  {isIndividualSession ? (
                    <span className="text-xs font-semibold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/30 px-2 py-0.5 rounded-full">
                      Individual
                    </span>
                  ) : (
                    <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                      Examen Grupal
                    </span>
                  )}
                  <span className="text-[11px] text-muted-foreground font-mono hidden sm:inline">
                    #{sessionId?.slice(-6) ?? '------'}
                  </span>
                </div>

                {/* Right: connection + auto-save + timer */}
                <div className="flex items-center gap-2">
                  <AutoSaveIndicator />
                  <ConnectionIndicator />
                  {timeRemaining !== null && (
                    <div className={[
                      'flex items-center gap-1.5 px-2.5 py-1 rounded-full font-mono text-sm font-bold border',
                      timeRemaining < 300
                        ? 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/30'
                        : timeRemaining < 600
                        ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/30'
                        : 'bg-muted text-foreground border-border',
                    ].join(' ')}>
                      <Timer className={`w-3.5 h-3.5 ${timeRemaining < 300 ? 'animate-pulse' : ''}`} />
                      {formatTime(timeRemaining)}
                    </div>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {(!isActive && !storeState.isActive && storeState.sections.length === 0) ? (
                <div className="text-center py-10">
                  <div className="mb-6">
                    {isIndividualSession ? (
                      <div className="bg-purple-50 border border-purple-200 dark:bg-purple-900/20 dark:border-purple-800/30 rounded-lg p-4 mb-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Users className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                          <h3 className="font-semibold text-purple-900 dark:text-purple-100">Examen Individual Flexible</h3>
                        </div>
                        <p className="text-sm text-foreground">
                          Puedes comenzar cuando estés listo. Tu tiempo individual comenzará al iniciar el examen.
                        </p>
                      </div>
                    ) : (
                      <p className="mb-4">No has iniciado el examen aún.</p>
                    )}
                  </div>
                  
                  <Button onClick={handleStart} disabled={starting} size="sm" className='bg-brand-blue cursor-pointer text-white hover:bg-primary/90 px-8 py-4 gap-2'>
                    <Play className="mr-2" />
                    {starting 
                      ? 'Iniciando...' 
                      : isIndividualSession 
                        ? 'Comenzar Mi Examen' 
                        : 'Iniciar Examen'
                    }
                  </Button>
                  
                  {isIndividualSession && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
                      Tu progreso se guardará automáticamente cada 10 segundos
                    </p>
                  )}
                </div>
              ) : (
                // Priorizar datos del store (desde ExamPreparation) sobre useExamSession
                (storeState.hasSections || hasSections) ? (
                  // Render sectioned exam
                  <SectionedExamRenderer
                    questions={storeState.sections.length > 0 ? storeState.sections.flatMap(s => s.questions) : questions}
                    sessionId={sessionId}
                    timeRemaining={storeState.timeRemaining || timeRemaining}
                    onAnswerChange={storeState.setAnswer || updateAnswer}
                    onSave={performManualSave}
                    onFinish={endSession}
                    answers={storeState.answers || answers}
                    loading={loading}
                    disabled={false}
                    autoSaveStatus={autoSaveStatus}
                    showSectionOverview={true}
                    allowSectionJumping={true}
                  />
                ) : (
                  // Fallback to traditional single-question renderer
                  <div className="space-y-4">
                    <div className="flex items-center justify-between bg-gray-50/80 dark:bg-gray-800/50 p-4 rounded-lg border border-gray-200/50 dark:border-gray-700/50">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full text-sm font-semibold">
                          {currentQuestionIndex + 1}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            Pregunta {currentQuestionIndex + 1} de {questions.length}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {Math.round(progress * 100)}% completado
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          onClick={goToPreviousQuestion}
                          disabled={isFirstQuestion}
                          variant="outline"
                          size="sm"
                          className="gap-2"
                        >
                          <ChevronLeft className="h-4 w-4" />
                          Anterior
                        </Button>

                        <Button
                          onClick={goToNextQuestion}
                          disabled={isLastQuestion}
                          variant="outline"
                          size="sm"
                          className="gap-2"
                        >
                          Siguiente
                          <ChevronRight className="h-4 w-4" />
                        </Button>

                        <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-2" />

                        {/* Manual save button */}
                        <Button
                          onClick={performManualSave}
                          disabled={autoSaveStatus === 'saving'}
                          variant="outline"
                          size="sm"
                          className="gap-2"
                        >
                          {autoSaveStatus === 'saving' ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Save className="h-4 w-4" />
                          )}
                          Guardar
                        </Button>

                        <Button
                          onClick={endSession}
                          disabled={loading}
                          variant="destructive"
                          size="sm"
                          className="gap-2 min-w-[100px] text-white"
                        >
                          {loading ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Enviando...
                            </>
                          ) : (
                            <>
                              <Square className="h-4 w-4" />
                              Finalizar
                            </>
                          )}
                        </Button>
                      </div>
                    </div>

                    <QuestionRenderer
                      question={currentQuestion}
                      answer={answers[currentQuestion?._id || '']}
                      onChange={updateAnswer}
                    />
                  </div>
                )
              )}
            </CardContent>
          </Card>
        </GradientWrapper>
      </div>
    </MainLayout>
  );
};

export default ExamRunner;
