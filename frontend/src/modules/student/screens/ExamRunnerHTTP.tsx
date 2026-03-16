import { Alert, AlertDescription } from '@/components/atoms/alert';
import { Button } from '@/components/atoms/button';
import {
  Card,
  CardContent,
  CardHeader
} from '@/components/atoms/card';
import GradientWrapper from '@/components/background/GrandWrapperSection';
import { MainLayout } from '@/components/layout';
import { useExamSessionHTTP } from '@/hooks/useExamSessionHTTP';
import { examResultService } from '@/services/examResultService';
import { examService } from '@/services/examService';
import { notificationSocket } from '@/services/notifications/notificationSocket';
import {
  AlertCircle,
  AlertTriangle,
  Bookmark,
  BookmarkCheck,
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
  const [isWaitingForResult, setIsWaitingForResult] = useState(false);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  // Track which questions are uploading audio
  const [uploadingAudio, setUploadingAudio] = useState<Record<string, boolean>>({});
  const uploadingRef = useRef<Record<string, boolean>>({});
  // Preguntas marcadas para revisar (solo frontend, no persiste)
  const [flaggedQuestions, setFlaggedQuestions] = useState<Set<string>>(new Set());

  const toggleFlag = useCallback((questionId: string) => {
    setFlaggedQuestions(prev => {
      const next = new Set(prev);
      if (next.has(questionId)) next.delete(questionId);
      else next.add(questionId);
      return next;
    });
  }, []);

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
    addTime,
    formatTime
  } = useExamSessionHTTP({
    sessionId,
    autoSaveInterval: 10000, // 10 seconds
    timePollingInterval: 30000, // 30 seconds
    onSessionStart: () => {
      toast.success('¡Tu examen ha comenzado!');
    },
    onSessionEnd: (attemptId: string) => {
      setExamCompleting(true);

      if (attemptId) {
        setIsWaitingForResult(true);
        examResultService.pollForResult(attemptId, 30, 2000)
          .then((result) => {
            const resultId = (result as any)._id || (result as any).id;
            navigate(`/student/results/${resultId}`);
          })
          .catch(() => {
            toast.info('Los resultados se están procesando. Los verás en tu dashboard.', { duration: 5000 });
            navigate('/student/dashboard');
          })
          .finally(() => {
            setIsWaitingForResult(false);
          });
      } else {
        toast.success('¡Examen completado! Redirigiendo al dashboard...', { duration: 3000 });
        setTimeout(() => navigate('/student/dashboard'), 2000);
      }
    },
    onAutoSave: (success) => {
      if (!success) {
        toast.error('Error guardando respuestas automáticamente');
      }
    },
    onTimeWarning: (minutes) => {
      if (minutes <= 1) {
        toast.error('Menos de 1 minuto restante', {
          description: 'Entrega tu examen ahora.',
          duration: 8000,
          icon: React.createElement(Timer, { className: 'h-4 w-4' }),
        });
      } else if (minutes <= 2) {
        toast.error(`${minutes} minutos restantes`, {
          description: 'Termina y entrega tu examen.',
          duration: 7000,
          icon: React.createElement(Timer, { className: 'h-4 w-4' }),
        });
      } else {
        toast.warning(`${minutes} minutos restantes`, {
          description: 'Revisa tus respuestas antes de entregar.',
          duration: 6000,
          icon: React.createElement(Timer, { className: 'h-4 w-4' }),
        });
      }
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

  // Ensure notificationSocket is connected (Header is hidden during exam, so it must be connected here)
  useEffect(() => {
    notificationSocket.connect().catch(() => {});
  }, []);

  // Listen for admin time extensions via socket
  useEffect(() => {
    const handleTimeExtended = (data: any) => {
      if (data?.sessionId && data.sessionId !== sessionId) return;
      const extra = Number(data?.extraMinutes) || 0;
      if (extra > 0) {
        addTime(extra * 60);
        toast.success(
          `El administrador extendió el tiempo por ${extra} minuto${extra !== 1 ? 's' : ''}.`,
          { duration: 6000 }
        );
      }
    };
    notificationSocket.on('session.time.extended', handleTimeExtended);
    return () => { notificationSocket.off('session.time.extended', handleTimeExtended); };
  }, [sessionId, addTime]);

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
      <MainLayout hideHeader>
        <div className="min-h-screen flex items-center justify-center">
          <GradientWrapper intensity="medium" size="lg">
            <Card className="w-full max-w-md bg-box backdrop-blur-sm border border-line">
              <CardContent className="p-8">
                <div className="text-center">
                  <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    ¡Examen Completado!
                  </h3>
                  <p className="text-muted-foreground">
                    {isWaitingForResult
                      ? 'Procesando resultados, espera un momento...'
                      : 'Tu examen ha sido finalizado exitosamente. Redirigiendo...'}
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
      <MainLayout hideHeader>
        <div className="min-h-screen flex items-center justify-center">
          <GradientWrapper intensity="medium" size="lg">
            <Card className="w-full max-w-md bg-box backdrop-blur-sm border border-line">
              <CardContent className="p-8">
                <div className="text-center">
                  <Loader2 className="h-12 w-12 animate-spin text-blue-500 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    Iniciando Examen
                  </h3>
                  <p className="text-muted-foreground">
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
      <MainLayout hideHeader>
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
      <MainLayout hideHeader>
        <div className="min-h-screen flex items-center justify-center">
          <GradientWrapper intensity="medium" size="lg">
            <Card className="w-full max-w-md bg-box backdrop-blur-sm border border-line">
              <CardContent className="p-8 text-center">
                <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  Examen No Activo
                </h3>
                <p className="text-muted-foreground mb-4">
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
    <MainLayout hideHeader>
      {/* ── Finish Exam confirmation modal ─────────────────────────────────── */}
      {showFinishConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-700/50 flex items-center justify-center">
                  <Flag className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-foreground">Finalizar examen</h3>
                  <p className="text-xs text-muted-foreground">Esta acción no se puede deshacer</p>
                </div>
              </div>
              <button
                onClick={() => setShowFinishConfirm(false)}
                className="text-muted-foreground hover:text-foreground/80 transition-colors p-1 rounded-lg hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="bg-muted/50 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Preguntas respondidas</span>
                <span className="font-medium text-foreground">{answeredCount} / {totalQuestions}</span>
              </div>
              <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all"
                  style={{ width: `${Math.round(overallProgress * 100)}%` }}
                />
              </div>
              {answeredCount < totalQuestions && (
                <p className="text-xs text-amber-600 dark:text-amber-400 pt-1">
                  Tienes {totalQuestions - answeredCount} pregunta{totalQuestions - answeredCount !== 1 ? "s" : ""} sin responder. Las preguntas omitidas cuentan como 0 puntos.
                </p>
              )}
              {flaggedQuestions.size > 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400 pt-1 flex items-center gap-1.5">
                  <Bookmark className="h-3 w-3 shrink-0" />
                  Tienes {flaggedQuestions.size} pregunta{flaggedQuestions.size !== 1 ? 's' : ''} marcada{flaggedQuestions.size !== 1 ? 's' : ''} para revisar.
                </p>
              )}
            </div>

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setShowFinishConfirm(false)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-border text-foreground/80 hover:bg-muted text-sm font-medium transition-colors"
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
                  sections={sectionStats.map(section => ({
                    ...section,
                    questionStates: section.questionStates.map(q => ({
                      ...q,
                      flagged: flaggedQuestions.has(q.id),
                    })),
                  }))}
                  currentSectionIndex={currentSectionIndex}
                  currentQuestionIndex={currentQuestionIndex}
                  onSectionChange={navigateToSection}
                  onQuestionJump={navigateToQuestionInSection}
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
                    <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border font-mono text-sm font-bold tabular-nums tracking-wider transition-all duration-500 ${
                      timeRemaining && timeRemaining < 300
                        ? 'border-red-500 bg-red-500 text-white animate-pulse'
                        : timeRemaining && timeRemaining < 600
                        ? 'border-amber-400 dark:border-amber-500 bg-amber-400 dark:bg-amber-500 text-white'
                        : 'border-border bg-muted/60 text-foreground'
                    }`}>
                      <Timer className={`h-4 w-4 shrink-0 ${timeRemaining && timeRemaining < 300 ? 'opacity-100' : 'opacity-60'}`} />
                      <span>{timeRemaining ? formatTime(timeRemaining) : '--:--'}</span>
                    </div>

                    {/* Autosave indicator — estilo Google Docs */}
                    <div className="flex items-center gap-1.5 text-xs w-[100px]">
                      {autoSaveStatus === 'dirty' && (
                        <>
                          <span className="relative flex h-2 w-2 shrink-0">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400" />
                          </span>
                          <span className="text-amber-400/80">Sin guardar</span>
                        </>
                      )}
                      {autoSaveStatus === 'saving' && (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground shrink-0" />
                          <span className="text-muted-foreground">Guardando...</span>
                        </>
                      )}
                      {autoSaveStatus === 'saved' && (
                        <>
                          <CheckCircle className="h-3 w-3 text-emerald-400 shrink-0" />
                          <span className="text-emerald-400">Guardado</span>
                        </>
                      )}
                      {autoSaveStatus === 'error' && (
                        <>
                          <AlertCircle className="h-3 w-3 text-red-400 shrink-0" />
                          <span className="text-red-400">Error al guardar</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Right: progress count + save button */}
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground text-sm tabular-nums">
                      <span className="text-foreground font-medium">{answeredCount}</span>
                      <span className="text-muted-foreground"> / </span>
                      {totalQuestions}
                    </span>
                    <Button
                      onClick={handleManualSave}
                      variant="outline"
                      size="sm"
                      disabled={autoSaveStatus === 'saving' || autoSaveStatus === 'idle'}
                      className='text-foreground/80 bg-transparent border-line hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed gap-1.5'
                    >
                      <Save className="h-3.5 w-3.5" />
                      Guardar avance
                    </Button>
                  </div>
                </div>

                {/* Section + question indicator */}
                {currentSection && (
                  <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground/70">{currentSection.name}</span>
                    <span>·</span>
                    <span>Pregunta {currentQuestionIndex + 1} de {currentSection.questions.length}</span>
                    <span className="mx-1 text-border">|</span>
                    <span>{answeredCount} de {totalQuestions} respondidas</span>
                  </div>
                )}
              </CardHeader>
            </Card>

            {/* Question content */}
            <Card className="mb-6 bg-box border border-line">
              <CardContent className="p-6">
                {currentQuestion ? (
                  <div key={currentQuestion._id as string} className="question-enter">
                    {/* Flag button */}
                    <div className="flex justify-end mb-3">
                      <button
                        onClick={() => toggleFlag(currentQuestion._id as string)}
                        className={[
                          'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border',
                          flaggedQuestions.has(currentQuestion._id as string)
                            ? 'border-amber-400 dark:border-amber-500 text-amber-600 dark:text-amber-400 hover:bg-muted'
                            : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground',
                        ].join(' ')}
                      >
                        {flaggedQuestions.has(currentQuestion._id as string)
                          ? <><BookmarkCheck className="h-3.5 w-3.5 text-amber-500 fill-amber-500/20" /><span>Marcada para revisar</span></>
                          : <><Bookmark className="h-3.5 w-3.5" /><span>Marcar para revisar</span></>
                        }
                      </button>
                    </div>
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
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-muted-foreground">No hay pregunta disponible</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Navigation controls */}
            <Card className="bg-box backdrop-blur-sm border border-line text-foreground">
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <Button
                    onClick={goToPreviousQuestion}
                    disabled={isFirstQuestionOverall}
                    variant="outline"
                    className='text-foreground/80 border-line bg-transparent hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed'
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Anterior
                  </Button>

                  <div className="flex items-center gap-2">
                    {currentSection && (
                      <span className="text-xs text-muted-foreground hidden sm:block">
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
