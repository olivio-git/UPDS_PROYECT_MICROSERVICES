import { Button } from '@/components/atoms/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/atoms/card';
import { Progress } from '@/components/atoms/progress';
import GradientWrapper from '@/components/background/GrandWrapperSection';
import { MainLayout } from '@/components/layout';
import { useExamSession } from '@/hooks/useExamSession';
import { examService } from '@/services/examService';
import { useExamStore } from '@/stores/examStore';
import { AlertCircle, ChevronLeft, ChevronRight, Loader2, Play, Rocket, Save, Square, Timer, Unplug, Users } from 'lucide-react';
import React, {
  useCallback,
  useEffect,
  useState
} from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
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
    onSessionEnd: () => {
      navigate('/student/results');
    },
    onAutoSave: (success) => {
      if (!success) {
        toast.error('Error guardando respuestas');
      }
    }
  });

  const [starting, setStarting] = useState(false);

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
            // Store the questions in Zustand
            storeState.setSessionData({
              sessionId,
              sections: response.data.sections || [],
              questions: response.data.questions || [],
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
      <MainLayout>
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
    <MainLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <GradientWrapper
          intensity="low"
          size="lg"
          position="bottom-right"
          animate={false}
          variant="cosmic"
        >
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between mb-2">
                <CardTitle className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  {/* {isIndividualSession ? 'Examen Individual' : 'Examen Grupal'} */}
                  {isIndividualSession && (
                    <span className="bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 px-2 py-1 rounded text-xs font-medium">
                      Flexible
                    </span>
                  )}
                </CardTitle>
                <div className="flex items-center gap-3">
                  <ConnectionIndicator />
                  <AutoSaveIndicator />
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Sesión: {sessionId?.slice(-8) || 'N/A'}
                  </div>
                  {isIndividualSession && timeRemaining !== null && (
                    <div className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 font-mono">
                      <Timer className="w-4 h-4" />
                      {formatTime(timeRemaining)}
                    </div>
                  )}
                </div>
              </div>
              {questions.length > 0 && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                    <span>Progreso del examen</span>
                    <span>{Math.round(progress * 100)}%</span>
                  </div>
                  <Progress
                    value={progress * 100}
                    className="h-2"
                  />
                </div>
              )}
            </CardHeader>
            <CardContent>
              {(!isActive && !storeState.isActive && storeState.sections.length === 0) ? (
                <div className="text-center py-10">
                  <div className="mb-6">
                    {isIndividualSession ? (
                      <div className="bg-[#0F1A2A] border border-line rounded-lg p-4 mb-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Users className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                          <h3 className="font-semibold text-purple-900 dark:text-purple-100">Examen Individual Flexible</h3>
                        </div>
                        <p className="text-sm text-white">
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
