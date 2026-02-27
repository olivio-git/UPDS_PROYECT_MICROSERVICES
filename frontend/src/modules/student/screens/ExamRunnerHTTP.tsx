import { Alert, AlertDescription } from '@/components/atoms/alert';
import { Button } from '@/components/atoms/button';
import {
  Card,
  CardContent,
  CardHeader
} from '@/components/atoms/card';
import { Progress } from '@/components/atoms/progress';
import GradientWrapper from '@/components/background/GrandWrapperSection';
import { MainLayout } from '@/components/layout';
import { useExamSessionHTTP } from '@/hooks/useExamSessionHTTP';
import { examService } from '@/services/examService';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Flag,
  Loader2,
  Save,
  Timer,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import QuestionRenderer from '../components/QuestionRenderer';
import SectionNavigator from '../components/SectionNavigator';

const ExamRunnerHTTP: React.FC = () => {
  const params = useParams<{ sessionId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const sessionId = params.sessionId;

  // State for starting/resuming detection
  const [initializingExam, setInitializingExam] = useState(false);
  const [examCompleting, setExamCompleting] = useState(false);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  // Track which questions are uploading audio
  const [uploadingAudio, setUploadingAudio] = useState<Record<string, boolean>>({});
  const uploadingRef = useRef<Record<string, boolean>>({});

  // Use the new HTTP-only hook with sections support
  const {
    // State
    isActive,
    sections,
    currentSectionIndex,
    currentQuestionIndex,
    answers,
    timeRemaining,
    sessionStatus,
    autoSaveStatus,
    loading,
    error,
    totalQuestions,

    // Current section and question helpers
    currentSection,
    currentQuestion,

    // Navigation helpers
    isLastQuestionInSection,
    isFirstQuestionInSection,
    isLastSection,
    isFirstSection,
    isLastQuestionOverall,
    isFirstQuestionOverall,

    // Progress calculations
    overallProgress,
    sectionProgress,
    answeredCount,
    sectionStats,

    // Actions
    startSession,
    resumeSession,
    finishExam,
    updateAnswer,

    // Section navigation
    navigateToSection,
    navigateToQuestionInSection,
    goToNextQuestion,
    goToPreviousQuestion,

    performManualSave,
    formatTime
  } = useExamSessionHTTP({
    sessionId,
    autoSaveInterval: 10000, // 10 seconds
    timePollingInterval: 30000, // 30 seconds
    onSessionStart: () => {
      toast.success('¡Tu examen ha comenzado!');
    },
    onSessionEnd: () => {
      // Set completing state to show completion UI
      setExamCompleting(true);

      // Show completion message and navigate after a delay
      toast.success('¡Examen completado! Redirigiendo al dashboard...', {
        duration: 3000,
      });

      setTimeout(() => {
        navigate('/student/dashboard');
      }, 2000);
    },
    onAutoSave: (success) => {
      if (!success) {
        toast.error('Error guardando respuestas automáticamente');
      }
    },
    onTimeWarning: (minutes) => {
      toast.warning(`⏰ Quedan ${minutes} minutos`, {
        duration: 5000,
      });
    }
  });

  // Initialize exam on component mount
  useEffect(() => {
    let hasInitialized = false;

    const initializeExam = async () => {
      if (!sessionId || hasInitialized) {
        return;
      }

      hasInitialized = true;

      if (!sessionId) {
        toast.error('ID de sesión no válido');
        navigate('/student/dashboard');
        return;
      }

      try {
        setInitializingExam(true);
        console.log(`🎯 [ExamRunnerHTTP] Initializing exam for session: ${sessionId}`);

        // Check if this is a resume or fresh start
        const shouldResume = location.state?.resume === true;

        if (shouldResume) {
          console.log('🔄 Resuming exam explicitly requested...');
          await resumeSession(sessionId);
        } else {
          // First try to resume in case there's an existing session
          try {
            console.log('🔄 Checking if exam can be resumed...');
            await resumeSession(sessionId);
          } catch (resumeError: any) {
            console.log('⚠️ Resume failed:', resumeError?.message);

            // Si el error es "time expired", no intentar start
            if (resumeError?.message?.includes('expired') || resumeError?.message?.includes('time')) {
              toast.error('El tiempo del examen ha expirado');
              navigate('/student/dashboard');
              return;
            }

            // If resume fails for other reasons, start fresh
            console.log('🚀 Starting fresh exam...');
            await startSession(sessionId);
          }
        }
      } catch (error: any) {
        console.error('Failed to initialize exam:', error);

        // Check if error is related to expired exam
        if (error?.message?.includes('expired') || error?.message?.includes('time')) {
          toast.error('El tiempo del examen ha expirado');
        } else {
          toast.error('Error al inicializar el examen');
        }

        navigate('/student/dashboard');
      } finally {
        setInitializingExam(false);
      }
    };

    // Only initialize if we haven't started yet AND the session is not completed
    if (!isActive && !loading && !initializingExam && sessionStatus !== 'completed') {
      console.log('🔄 [ExamRunnerHTTP] Conditions met for initialization:', {
        isActive,
        loading,
        initializingExam,
        sessionStatus
      });
      initializeExam();
    } else {
      console.log('⚠️ [ExamRunnerHTTP] Skipping initialization:', {
        isActive,
        loading,
        initializingExam,
        sessionStatus
      });
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]); // SOLO sessionId para evitar loops

  const handleAnswerChange = useCallback(async (questionIdOrAnswer: any, answer?: any) => {
    if (!currentQuestion) return;

    const actualAnswer = answer !== undefined ? answer : questionIdOrAnswer;
    const qId = currentQuestion._id as string;

    // Detect audio response: upload blob to MinIO, replace answer with permanent URL
    if (actualAnswer?.audioBlob instanceof Blob && sessionId && !uploadingRef.current[qId]) {
      uploadingRef.current[qId] = true;
      setUploadingAudio(prev => ({ ...prev, [qId]: true }));

      // Store previewUrl immediately so UI shows the recording
      updateAnswer(qId, { previewUrl: actualAnswer.previewUrl, uploading: true });

      try {
        const audioUrl = await examService.uploadResponseAudio(sessionId, qId, actualAnswer.audioBlob);
        console.log(`🎙️ [ExamRunnerHTTP] Audio uploaded for question ${qId}:`, audioUrl);
        updateAnswer(qId, { audioUrl, previewUrl: actualAnswer.previewUrl });
        toast.success('Audio guardado correctamente');
      } catch (err) {
        console.error('❌ [ExamRunnerHTTP] Audio upload failed:', err);
        updateAnswer(qId, { previewUrl: actualAnswer.previewUrl, uploadFailed: true });
        toast.error('No se pudo guardar el audio. Inténtalo de nuevo.');
      } finally {
        uploadingRef.current[qId] = false;
        setUploadingAudio(prev => ({ ...prev, [qId]: false }));
      }
      return;
    }

    console.log('🎯 [ExamRunnerHTTP] Answer changed:', {
      questionId: qId,
      actualAnswer,
      currentAnswerInState: answers[qId]
    });

    updateAnswer(qId, actualAnswer);
  }, [currentQuestion, sessionId, updateAnswer, answers]);

  const handleFinishExam = () => {
    setShowFinishConfirm(true);
  };

  const confirmFinishExam = async () => {
    setShowFinishConfirm(false);
    await finishExam();
  };

  const handleManualSave = async () => {
    toast.promise(performManualSave(), {
      loading: 'Guardando respuestas...',
      success: 'Respuestas guardadas correctamente',
      error: 'Error al guardar respuestas'
    });
  };

  // Completion state - show completion UI
  if (examCompleting || sessionStatus === 'completed') {
    return (
      <MainLayout>
        <div className="min-h-screen flex items-center justify-center">
          <GradientWrapper intensity="medium" size="lg">
            <Card className="w-full max-w-md bg-box backdrop-blur-sm border border-line">
              <CardContent className="p-8">
                <div className="text-center">
                  <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-white mb-2">
                    ¡Examen Completado!
                  </h3>
                  <p className="text-gray-400">
                    Tu examen ha sido finalizado exitosamente. Redirigiendo...
                  </p>
                  <div className="mt-4">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-500 mx-auto" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </GradientWrapper>
        </div>
      </MainLayout>
    );
  }

  // Loading state during initialization
  if (initializingExam || (loading && !isActive)) {
    return (
      <MainLayout>
        <div className="min-h-screen flex items-center justify-center">
          <GradientWrapper intensity="medium" size="lg">
            <Card className="w-full max-w-md bg-box backdrop-blur-sm border border-line">
              <CardContent className="p-8">
                <div className="text-center">
                  <Loader2 className="h-12 w-12 animate-spin text-blue-500 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-white mb-2">
                    Iniciando Examen
                  </h3>
                  <p className="text-gray-400">
                    Preparando tu examen, por favor espera...
                  </p>
                </div>
              </CardContent>
            </Card>
          </GradientWrapper>
        </div>
      </MainLayout>
    );
  }

  // Error state
  if (error) {
    return (
      <MainLayout>
        <div className="min-h-screen flex items-center justify-center">
          <GradientWrapper intensity="medium" size="lg">
            <Card className="w-full max-w-md bg-box backdrop-blur-sm border border-line">
              <CardContent className="p-8">
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
                <Button
                  onClick={() => navigate('/student/dashboard')}
                  className="w-full mt-4"
                >
                  Volver al Dashboard
                </Button>
              </CardContent>
            </Card>
          </GradientWrapper>
        </div>
      </MainLayout>
    );
  }

  // Not active state (shouldn't happen with proper initialization)
  if (!isActive) {
    return (
      <MainLayout>
        <div className="min-h-screen flex items-center justify-center">
          <GradientWrapper intensity="medium" size="lg">
            <Card className="w-full max-w-md bg-box backdrop-blur-sm border border-line">
              <CardContent className="p-8 text-center">
                <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">
                  Examen No Activo
                </h3>
                <p className="text-gray-400 mb-4">
                  No hay un examen activo para esta sesión.
                </p>
                <Button
                  onClick={() => navigate('/student/dashboard')}
                  className="w-full"
                >
                  Volver al Dashboard
                </Button>
              </CardContent>
            </Card>
          </GradientWrapper>
        </div>
      </MainLayout>
    );
  }

  // Main exam interface
  return (
    <MainLayout>
      {/* ── Finish Exam confirmation modal ─────────────────────────────────── */}
      {showFinishConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-900/40 border border-emerald-700/50 flex items-center justify-center">
                  <Flag className="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">Finalizar examen</h3>
                  <p className="text-xs text-gray-400">Esta acción no se puede deshacer</p>
                </div>
              </div>
              <button
                onClick={() => setShowFinishConfirm(false)}
                className="text-gray-500 hover:text-gray-300 transition-colors p-1 rounded-lg hover:bg-gray-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="bg-gray-800/60 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Preguntas respondidas</span>
                <span className="font-medium text-white">{answeredCount} / {totalQuestions}</span>
              </div>
              <div className="h-1.5 w-full bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all"
                  style={{ width: `${Math.round(overallProgress * 100)}%` }}
                />
              </div>
              {answeredCount < totalQuestions && (
                <p className="text-xs text-amber-400 pt-1">
                  Tienes {totalQuestions - answeredCount} pregunta{totalQuestions - answeredCount !== 1 ? "s" : ""} sin responder. Las preguntas omitidas cuentan como 0 puntos.
                </p>
              )}
            </div>

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setShowFinishConfirm(false)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-600 text-gray-300 hover:bg-gray-800 text-sm font-medium transition-colors"
              >
                Seguir respondiendo
              </button>
              <button
                onClick={confirmFinishExam}
                className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
              >
                <Flag className="h-4 w-4" />
                Entregar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="min-h-screen p-4">
        <GradientWrapper intensity="low" size="xl" variant='cosmic' position='left' animate={false}>
          <div className="max-w-7xl mx-auto">

            {/* Layout with sidebar and main content */}
            <div className="flex flex-col xl:grid xl:grid-cols-4 gap-6">

              {/* Section Navigator - Top on mobile/tablet, sidebar on desktop */}
              <div className="xl:col-span-1 order-2 xl:order-1">
                <SectionNavigator
                  sections={sectionStats}
                  currentSectionIndex={currentSectionIndex}
                  onSectionChange={navigateToSection}
                  className="xl:sticky xl:top-4"
                />
              </div>

              {/* Main Exam Content */}
              <div className="xl:col-span-3 order-1 xl:order-2">

            {/* Header with timer and progress */}
            <Card className="mb-6 bg-box backdrop-blur-sm border border-line">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  {/* Timer */}
                  <div className="flex items-center gap-3">
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border font-mono text-base font-semibold ${
                      timeRemaining && timeRemaining < 300
                        ? 'border-red-700/60 bg-red-900/20 text-red-300'
                        : timeRemaining && timeRemaining < 600
                        ? 'border-amber-700/60 bg-amber-900/20 text-amber-300'
                        : 'border-line bg-gray-800/60 text-white'
                    }`}>
                      <Timer className="h-4 w-4 opacity-70" />
                      {timeRemaining ? formatTime(timeRemaining) : '--:--'}
                    </div>

                    {/* Autosave indicator */}
                    {autoSaveStatus === 'saving' && (
                      <div className="flex items-center gap-1 text-blue-400 text-xs">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Guardando...
                      </div>
                    )}
                    {autoSaveStatus === 'saved' && (
                      <div className="flex items-center gap-1 text-emerald-400 text-xs">
                        <CheckCircle className="h-3 w-3" />
                        Guardado
                      </div>
                    )}
                    {autoSaveStatus === 'error' && (
                      <div className="flex items-center gap-1 text-red-400 text-xs">
                        <AlertCircle className="h-3 w-3" />
                        Error al guardar
                      </div>
                    )}
                  </div>

                  {/* Right: progress count + save button */}
                  <div className="flex items-center gap-3">
                    <span className="text-gray-400 text-sm tabular-nums">
                      <span className="text-white font-medium">{answeredCount}</span>
                      <span className="text-gray-600"> / </span>
                      {totalQuestions}
                    </span>
                    <Button
                      onClick={handleManualSave}
                      variant="outline"
                      size="sm"
                      disabled={autoSaveStatus === 'saving'}
                      className='text-gray-300 bg-transparent border-line hover:bg-gray-800 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed gap-1.5'
                    >
                      <Save className="h-3.5 w-3.5" />
                      Guardar
                    </Button>
                  </div>
                </div>

                {/* Progress bars */}
                <div className="mt-4 space-y-2.5">
                  {/* Overall progress */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-gray-500">
                        Pregunta {currentQuestionIndex + 1} de {totalQuestions}
                      </span>
                      <span className="text-xs text-gray-500">
                        {Math.round(overallProgress * 100)}% completado
                      </span>
                    </div>
                    <Progress value={overallProgress * 100} className="h-1.5" />
                  </div>

                  {/* Current section progress */}
                  {currentSection && (
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs text-blue-400/80">
                          {currentSection.name} · {currentSection.competency}
                        </span>
                        <span className="text-xs text-blue-400/80">
                          {Math.round(sectionProgress * 100)}% de sección
                        </span>
                      </div>
                      <Progress value={sectionProgress * 100} className="h-1 bg-blue-900/30" />
                    </div>
                  )}
                </div>
              </CardHeader>
            </Card>

            {/* Question content */}
            <Card className="mb-6 bg-box border border-line">
              <CardContent className="p-6">
                {currentQuestion ? (
                  <QuestionRenderer
                    key={currentQuestion._id as string}
                    question={currentQuestion}
                    answer={answers[currentQuestion._id]}
                    onChange={handleAnswerChange}
                    showQuestionNumber={true}
                    questionNumber={currentQuestionIndex + 1}
                    totalQuestions={totalQuestions}
                    isUploadingAudio={uploadingAudio[currentQuestion._id as string] ?? false}
                    sectionInfo={currentSection ? {
                      name: currentSection.name,
                      competency: currentSection.competency,
                      questionIndex: currentQuestionIndex - sections.slice(0, currentSectionIndex).reduce((sum, section) => sum + section.questions.length, 0),
                      totalQuestionsInSection: currentSection.questions.length
                    } : undefined}
                  />
                ) : (
                  <div className="text-center py-8">
                    <AlertCircle className="h-8 w-8 text-gray-500 mx-auto mb-2" />
                    <p className="text-gray-400">No hay pregunta disponible</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Navigation controls */}
            <Card className="bg-box backdrop-blur-sm border border-line text-white">
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <Button
                    onClick={goToPreviousQuestion}
                    disabled={isFirstQuestionOverall}
                    variant="outline"
                    className='text-gray-300 border-line bg-transparent hover:bg-gray-800 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed'
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Anterior
                  </Button>

                  <div className="flex items-center gap-2">
                    {currentSection && (
                      <span className="text-xs text-gray-500 hidden sm:block">
                        {currentSection.name} · {currentQuestionIndex + 1}/{totalQuestions}
                      </span>
                    )}

                    {isLastQuestionOverall ? (
                      <Button
                        onClick={handleFinishExam}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white gap-2"
                      >
                        <Flag className="h-4 w-4" />
                        Entregar examen
                      </Button>
                    ) : (
                      <Button
                        onClick={goToNextQuestion}
                        disabled={isLastQuestionOverall}
                        className='bg-blue-600 hover:bg-blue-700 text-white'
                      >
                        {isLastQuestionInSection ? 'Siguiente Sección' : 'Siguiente'}
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

              </div>
            </div>

          </div>
        </GradientWrapper>
      </div>
    </MainLayout>
  );
};

export default ExamRunnerHTTP;