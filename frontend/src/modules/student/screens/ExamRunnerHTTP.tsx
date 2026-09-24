import { Alert, AlertDescription } from '@/components/keel/alert';
import { Button } from '@/components/keel/button';
import {
  Card,
  CardContent
} from '@/components/keel/card';
import { Kbd, KbdGroup } from '@/components/keel/kbd';
import { Spinner } from '@/components/keel/spinner';
import GradientWrapper from '@/components/background/GrandWrapperSection';
import { MainLayout } from '@/components/layout';
import { cn } from '@/lib/utils';
import { useBrowserLockdown } from '@/hooks/useBrowserLockdown';
import { useExamSessionHTTP } from '@/hooks/useExamSessionHTTP';
import { examResultService } from '@/services/examResultService';
import { examService, getAttemptTerminationInfo, getTechnicalVerificationRequiredInfo } from '@/services/examService';
import { notificationSocket } from '@/services/notifications/notificationSocket';
import { useExamStore } from '@/stores/examStore';
import {
  AlertCircle,
  AlertTriangle,
  Bookmark,
  BookmarkCheck,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Flag,
  Maximize,
  Save,
  ShieldAlert,
  Timer,
  UserX,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import QuestionRenderer from '../components/QuestionRenderer';
import SectionNavigator from '../components/SectionNavigator';
import { ProgressRing } from '../components/ProgressRing';

// Thresholds shared between the ring and the rest of the timer's visual
// state — amber under 5 minutes, red (+ pulse) under 1 minute.
const TIMER_WARNING_SECONDS = 300;
const TIMER_CRITICAL_SECONDS = 60;

/** Circular countdown: elapsed vs total time, remaining time printed inside.
 * Stays the single most prominent element in the header, per the redesign
 * brief — a plain digital readout was not visually loud enough at a glance.
 * The ring geometry itself lives in the shared `ProgressRing` (also used by
 * the result screen's score ring); this only supplies the countdown ratio,
 * the warning/critical color states, and the centered readout. */
const TimerRing: React.FC<{
  timeRemaining: number | null;
  totalTime: number | null;
  formatTime: (seconds: number) => string;
}> = ({ timeRemaining, totalTime, formatTime }) => {
  const ratio = timeRemaining != null && totalTime && totalTime > 0
    ? timeRemaining / totalTime
    : 1;

  const isCritical = timeRemaining != null && timeRemaining < TIMER_CRITICAL_SECONDS;
  const isWarning = !isCritical && timeRemaining != null && timeRemaining < TIMER_WARNING_SECONDS;

  return (
    <ProgressRing
      ratio={ratio}
      size={84}
      strokeWidth={6}
      role="timer"
      aria-label={timeRemaining != null ? `Tiempo restante: ${formatTime(timeRemaining)}` : 'Cargando tiempo restante'}
      className={cn(isCritical && 'animate-pulse')}
      trackClassName={cn(
        isCritical ? 'stroke-red-100 dark:stroke-red-950/40' : isWarning ? 'stroke-amber-100 dark:stroke-amber-950/40' : 'stroke-muted'
      )}
      indicatorClassName={cn(isCritical ? 'stroke-red-600' : isWarning ? 'stroke-amber-500' : 'stroke-primary')}
    >
      <span
        className={cn(
          'font-mono text-[13px] font-bold tabular-nums tracking-tight',
          isCritical ? 'text-red-600 dark:text-red-400' : isWarning ? 'text-amber-600 dark:text-amber-500' : 'text-foreground'
        )}
      >
        {timeRemaining != null ? formatTime(timeRemaining) : '--:--'}
      </span>
    </ProgressRing>
  );
};

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
    currentSectionIndex,
    currentQuestionIndex,
    answers,
    timeRemaining,
    sessionStatus,
    autoSaveStatus,
    loading,
    error,
    totalQuestions,
    kicked,
    kickReason,

    // Current section and question helpers
    currentSection,
    currentQuestion,

    // Navigation helpers
    isLastQuestionInSection,
    isLastQuestionOverall,
    isFirstQuestionOverall,

    // Progress calculations
    overallProgress,
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

  // The hook only exposes the current countdown, never the exam's original
  // duration (resume doesn't get it back from the server either) — capture
  // the first non-null value locally so the timer ring has an "elapsed vs
  // total" baseline. A later admin time extension grows this baseline too,
  // so the ring doesn't just read as "almost full" forever after a bump.
  const totalTimeRef = useRef<number | null>(null);
  useEffect(() => {
    if (timeRemaining != null && totalTimeRef.current == null) {
      totalTimeRef.current = timeRemaining;
    }
  }, [timeRemaining]);

  // Browser lockdown — armed only while the session has it enabled AND the
  // attempt is actually in progress (not during load/completion/kicked).
  const browserLockdown = useExamStore((s) => s.browserLockdown);
  const lockdownEnabled = isActive && sessionStatus === 'active' && browserLockdown;
  const {
    infractionCount: lockdownInfractionCount,
    showFullscreenPrompt,
    reenterFullscreen,
  } = useBrowserLockdown({ enabled: lockdownEnabled, sessionId: sessionId ?? null });

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

        // A candidate kicked by a proctor/admin (including before ever
        // starting) is refused by startExam with 403 CANDIDATE_REMOVED.
        if (error?.response?.data?.code === 'CANDIDATE_REMOVED') {
          toast.error('Has sido expulsado de esta sesión por el supervisor.', { duration: 6000 });
          navigate('/student/dashboard');
          return;
        }

        // A candidate kicked mid-exam who reloads the page hits resumeExam,
        // which 409s with attemptStatus 'cancelled' (the attempt itself is
        // already terminal server-side).
        const terminationInfo = getAttemptTerminationInfo(error);
        if (terminationInfo?.attemptStatus === 'cancelled') {
          toast.error('Has sido expulsado de esta sesión por el supervisor.', { duration: 6000 });
          navigate('/student/dashboard');
          return;
        }

        // Deep-link / stale-tab edge case: a brand-new attempt was rejected
        // by exam-service's server-side technical verification gate.
        // Resuming an existing in_progress attempt is never blocked this
        // way, so this only fires when the candidate skipped (or lost) the
        // preparation screen. Send them back there with the reasons.
        const technicalInfo = getTechnicalVerificationRequiredInfo(error);
        if (technicalInfo) {
          navigate(`/student/exam/${sessionId}/preparation`, {
            replace: true,
            state: { technicalVerificationReasons: technicalInfo.reasons },
          });
          return;
        }

        // session-manager-service is reachable but misconfigured/erroring —
        // the gate fails closed with a specific student-facing message.
        if (error?.response?.data?.code === 'TECHNICAL_GATE_UNAVAILABLE') {
          toast.error(
            error.response.data.message || 'No se pudo validar la verificación técnica. Avisa al supervisor.',
            { duration: 8000 }
          );
          navigate('/student/dashboard');
          return;
        }

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
        if (totalTimeRef.current != null) totalTimeRef.current += extra * 60;
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

  // Selects the option at `index` for the current question, mirroring the
  // same single/multi-select and true_false logic QuestionRenderer uses so
  // the digit/letter shortcuts below produce identical answers to a click.
  const selectOptionByIndex = useCallback((index: number) => {
    if (!currentQuestion) return;
    const qId = currentQuestion._id as string;
    const qType = (currentQuestion as any).type;

    if (qType === 'true_false') {
      if (index === 0) handleAnswerChange(qId, { answer: true });
      else if (index === 1) handleAnswerChange(qId, { answer: false });
      return;
    }

    if (qType === 'multiple_choice') {
      const content = (currentQuestion as any).content || {};
      const options = content.options || (currentQuestion as any).options || [];
      const opt = options[index];
      if (!opt) return;
      const optId = opt.id || opt._id;
      const correctCount = options.filter((o: any) => o.isCorrect).length;
      const isSingleSelect = correctCount <= 1 || Boolean(content.correctAnswer);

      if (isSingleSelect) {
        handleAnswerChange(qId, { selectedOptions: [optId] });
      } else {
        const prevSelected: string[] = answers[qId]?.selectedOptions || [];
        const next = prevSelected.includes(optId)
          ? prevSelected.filter((s) => s !== optId)
          : [...prevSelected, optId];
        handleAnswerChange(qId, { selectedOptions: next });
      }
    }
  }, [currentQuestion, answers, handleAnswerChange]);

  // Exam-wide keyboard shortcuts. Disarmed whenever a text answer (or any
  // other form control) has focus, so typing an essay/fill-blank answer is
  // never hijacked — see the isEditableTarget check below.
  //
  // NOTE: "f" is reserved exclusively for "marcar para revisar". Letters
  // A-I map 1:1 to QuestionRenderer's option badges (A=index 0 ... I=index
  // 8), which means an option that would land on letter F cannot be picked
  // by its letter — digits 1-9 cover that case instead (option 6 -> "6").
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isActive || sessionStatus !== 'active') return;
      if (showFinishConfirm || (lockdownEnabled && showFullscreenPrompt)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const isEditableTarget = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable;
      if (isEditableTarget) return;
      if (!currentQuestion) return;

      if (e.key >= '1' && e.key <= '9') {
        selectOptionByIndex(Number(e.key) - 1);
        return;
      }

      if (e.key.length === 1) {
        const lower = e.key.toLowerCase();
        if (lower === 'f') {
          toggleFlag(currentQuestion._id as string);
          return;
        }
        if (lower >= 'a' && lower <= 'i') {
          selectOptionByIndex(lower.charCodeAt(0) - 'a'.charCodeAt(0));
          return;
        }
      }

      if (e.key === 'ArrowLeft') {
        if (!isFirstQuestionOverall) goToPreviousQuestion();
        return;
      }
      if (e.key === 'ArrowRight') {
        if (!isLastQuestionOverall) goToNextQuestion();
        return;
      }
      if (e.key === 'Enter') {
        if (!isLastQuestionOverall) goToNextQuestion();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isActive,
    sessionStatus,
    showFinishConfirm,
    lockdownEnabled,
    showFullscreenPrompt,
    currentQuestion,
    selectOptionByIndex,
    toggleFlag,
    isFirstQuestionOverall,
    isLastQuestionOverall,
    goToPreviousQuestion,
    goToNextQuestion,
  ]);

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

  // Kicked state — the candidate was removed from the session by a
  // proctor/admin. Blocking, no auto-navigation, no further exam-taking
  // requests: the attempt is already 'cancelled' server-side.
  if (kicked) {
    return (
      <MainLayout hideHeader>
        <div className="min-h-screen flex items-center justify-center">
          <GradientWrapper intensity="medium" size="lg">
            <Card className="w-full max-w-md bg-box backdrop-blur-sm border border-line">
              <CardContent className="p-8 text-center">
                <UserX className="h-12 w-12 text-red-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  Has sido retirado del examen
                </h3>
                <p className="text-muted-foreground mb-1">
                  Has sido retirado del examen por el supervisor.
                </p>
                {kickReason && (
                  <p className="text-muted-foreground text-sm mb-4">Motivo: {kickReason}</p>
                )}
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
                    <Spinner className="h-6 w-6 text-blue-500 mx-auto" />
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
                  <Spinner className="h-12 w-12 text-blue-500 mx-auto mb-4" />
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
      {/* ── Fullscreen re-entry overlay (browser lockdown) ─────────────────── */}
      {lockdownEnabled && showFullscreenPrompt && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-card border border-amber-400/60 dark:border-amber-500/50 rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-700/50 flex items-center justify-center mx-auto">
              <Maximize className="h-6 w-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">Pantalla completa requerida</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {/* Also shown right at load when the session arms lockdown but
                    the page isn't in fullscreen yet (reload, auto-start,
                    deep link) — not only after a real exit — so this copy
                    stays accurate for both instead of implying an
                    infraction was always just logged. */}
                El examen requiere pantalla completa para continuar. Salir de ella queda registrado.
              </p>
            </div>
            <Button onClick={reenterFullscreen} className="w-full">
              <Maximize className="h-4 w-4 mr-2" />
              Volver a pantalla completa
            </Button>
          </div>
        </div>
      )}

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

      <div className="flex h-full flex-col">
        {/* ── Top bar: timer gets real weight, position is stated once ── */}
        <header className="shrink-0 border-b border-border bg-card px-4 py-2.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              {/* Timer — the single most prominent element of the header,
                  a ring instead of a digital badge so remaining-vs-total
                  reads at a glance, not just the raw seconds. */}
              <TimerRing timeRemaining={timeRemaining} totalTime={totalTimeRef.current} formatTime={formatTime} />

              {/* Browser lockdown chip — informational, tells the
                  candidate their activity is being monitored */}
              {lockdownEnabled && (
                <div
                  className="flex items-center gap-1.5 rounded-xl border border-amber-400/60 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-700 dark:border-amber-500/50 dark:bg-amber-500/10 dark:text-amber-400"
                  title="El examen registra salidas de pantalla completa, cambios de pestaña y atajos bloqueados."
                >
                  <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                  <span className="hidden sm:inline">Modo bloqueo activo</span>
                  {lockdownInfractionCount > 0 && <span className="tabular-nums">({lockdownInfractionCount})</span>}
                </div>
              )}

              {/* Autosave indicator — estilo Google Docs */}
              <div className="flex w-[110px] items-center gap-1.5 text-xs">
                {autoSaveStatus === 'dirty' && (
                  <>
                    <span className="relative flex h-2 w-2 shrink-0">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
                    </span>
                    <span className="text-amber-400/80">Sin guardar</span>
                  </>
                )}
                {autoSaveStatus === 'saving' && (
                  <>
                    <Spinner className="h-3 w-3 shrink-0 text-muted-foreground" />
                    <span className="text-muted-foreground">Guardando...</span>
                  </>
                )}
                {autoSaveStatus === 'saved' && (
                  <>
                    <CheckCircle className="h-3 w-3 shrink-0 text-emerald-400" />
                    <span className="text-emerald-400">Guardado</span>
                  </>
                )}
                {autoSaveStatus === 'error' && (
                  <>
                    <AlertCircle className="h-3 w-3 shrink-0 text-red-400" />
                    <span className="text-red-400">Error al guardar</span>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* The single, canonical position indicator — replaces the
                  header badge, the question-card badge and the
                  section-info line that used to say this three times. */}
              {currentSection && (
                <div className="text-right">
                  <p className="text-sm font-semibold text-foreground">
                    Pregunta {currentQuestionIndex + 1} de {currentSection.questions.length}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {currentSection.name} · {answeredCount}/{totalQuestions} respondidas
                  </p>
                </div>
              )}
              <Button
                onClick={handleManualSave}
                variant="outline"
                size="sm"
                disabled={autoSaveStatus === 'saving' || autoSaveStatus === 'idle'}
                className="gap-1.5 border-line bg-transparent text-foreground/80 hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Save className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Guardar avance</span>
              </Button>
            </div>
          </div>
        </header>

        {/* ── Rail (full-height question navigator) + main content ── */}
        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[320px_1fr]">
          <div className="order-2 max-h-64 overflow-hidden border-t border-line bg-box p-3 lg:order-1 lg:h-full lg:max-h-none lg:border-t-0 lg:border-r">
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
              className="h-full"
            />
          </div>

          <div className="order-1 flex min-h-0 flex-col overflow-hidden bg-muted/40 lg:order-2">
            {/* Question content — the only scrolling region, so answers stay
                reachable without scrolling the page itself. The tinted
                surface behind the elevated white card is what tells the eye
                "this is the exam area" instead of a card floating on the
                page background. */}
            <div className="flex min-h-0 flex-1 flex-col overflow-auto p-3">
              {/* The card owns the whole pane: a short question used to leave
                  a third of the screen as empty tint below it. */}
              <Card flat className="flex flex-col">
                <CardContent className="flex flex-col gap-4 p-5 lg:p-6">
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
                        showQuestionNumber={false}
                        isUploadingAudio={uploadingAudio[currentQuestion._id as string] ?? false}
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
            </div>

            {/* Navigation controls — pinned below the scroll area */}
            <div className="shrink-0 border-t border-line bg-box px-4 py-3 lg:px-6">
              <div className="flex items-center justify-between gap-3">
                <Button
                  onClick={goToPreviousQuestion}
                  disabled={isFirstQuestionOverall}
                  variant="outline"
                  className="text-foreground/80 border-line bg-transparent hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Anterior
                </Button>

                {/* Discreet keyboard-shortcut hint — desktop only, out of
                    the way of the primary actions it sits between. */}
                <div className="hidden items-center gap-4 text-[11px] text-muted-foreground lg:flex">
                  <span className="flex items-center gap-1.5">
                    <KbdGroup><Kbd>1-9</Kbd><Kbd>A-I</Kbd></KbdGroup> elegir
                  </span>
                  <span className="flex items-center gap-1.5">
                    <KbdGroup><Kbd>←</Kbd><Kbd>→</Kbd></KbdGroup> pregunta
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Kbd>F</Kbd> marcar
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Kbd>Enter</Kbd> siguiente
                  </span>
                </div>

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
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {isLastQuestionInSection ? 'Siguiente Sección' : 'Siguiente'}
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default ExamRunnerHTTP;
