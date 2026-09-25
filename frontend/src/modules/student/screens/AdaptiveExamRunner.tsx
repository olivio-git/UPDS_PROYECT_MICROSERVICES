import { Badge } from '@/components/atoms/badge';
import { Button } from '@/components/atoms/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/atoms/card';
import { MainLayout } from '@/components/layout';
import { useBrowserLockdown } from '@/hooks/useBrowserLockdown';
import { examResultService } from '@/services/examResultService';
import {
  examService,
  getAttemptTerminationInfo,
  getTechnicalVerificationRequiredInfo,
} from '@/services/examService';
import { notificationSocket } from '@/services/notifications/notificationSocket';
import { useExamStore } from '@/stores/examStore';
import { AlertCircle, Brain, CheckCircle, Loader2, Maximize, ShieldAlert, UserX, XCircle } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import QuestionRenderer from '../components/QuestionRenderer';

// Level/correctness fields are absent when the exam hides results
// (showResults=false → backend sends `resultsHidden: true`).
interface AdaptiveState {
  currentLevel?: string;
  questionsAnswered: number;
  maxQuestions: number;
  consecutiveWrongThreshold?: number;
  consecutiveWrong?: number;
  isFinished: boolean;
  stopReason?: string;
}

interface FeedbackState {
  isCorrect: boolean;
  score: number;
  maxScore: number;
  feedback: string;
}

const LEVEL_COLORS: Record<string, string> = {
  A1: 'bg-muted/50 text-muted-foreground border-border',
  A2: 'bg-green-500/20 text-green-300 border-green-500/30',
  B1: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  B2: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  C1: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  C2: 'bg-red-500/20 text-red-300 border-red-500/30',
};

const AdaptiveExamRunner: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<any | null>(null);
  const [currentAnswer, setCurrentAnswer] = useState<any>(null);
  const [adaptiveState, setAdaptiveState] = useState<AdaptiveState | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [stopReason, setStopReason] = useState<string | undefined>(undefined);
  // result-visibility: exam configured with showResults=false → no per-answer
  // correctness, points or level anywhere in the runner.
  const [resultsHidden, setResultsHidden] = useState(false);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [navigatingToResult, setNavigatingToResult] = useState(false);
  // Candidate was removed from the session by a proctor/admin — blocking,
  // distinct from the normal "finished" screen (no finish request sent).
  const [kicked, setKicked] = useState(false);
  const [kickReason, setKickReason] = useState<string | undefined>(undefined);

  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guards the terminal transition so it only runs once, whether triggered
  // by a socket push or by a 409 ATTEMPT_NOT_IN_PROGRESS fallback.
  const terminatedRef = useRef(false);

  // Browser lockdown — armed only while the session has it enabled AND the
  // attempt is actually active (not loading/errored/kicked/finished).
  const browserLockdown = useExamStore((s) => s.browserLockdown);
  const lockdownEnabled = !loading && !error && !kicked && !isFinished && browserLockdown;
  const {
    infractionCount: lockdownInfractionCount,
    showFullscreenPrompt,
    reenterFullscreen,
  } = useBrowserLockdown({ enabled: lockdownEnabled, sessionId: sessionId ?? null });

  const handleFinished = useCallback((reason?: string) => {
    // Gate the kick/status-changed socket listeners the same way a 409
    // fallback does — without this, a late push (session ended by the
    // supervisor right after the candidate naturally finished) could replace
    // the results screen with the kicked/terminated one, or re-run finish().
    terminatedRef.current = true;
    setIsFinished(true);
    setStopReason(reason);
    toast.success('Examen de nivelación completado. Calculando tu nivel...');
  }, []);

  // Shared terminal-state handler: 'cancelled' attemptStatus means kicked
  // (block, no further requests); anything else (session ended/expired
  // externally) mirrors the normal finish flow — force-finish (idempotent
  // if already closed server-side) then show the standard "finished" screen
  // so the existing pollForResult button flow takes over.
  const handleTerminated = useCallback((attemptStatus?: string) => {
    if (terminatedRef.current) return;
    terminatedRef.current = true;
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);

    if (attemptStatus === 'cancelled') {
      setKicked(true);
      return;
    }

    if (sessionId) {
      examService.finishExam(sessionId).catch(() => { /* already terminal server-side — ignore */ });
    }
    handleFinished('session_ended');
  }, [sessionId, handleFinished]);

  useEffect(() => {
    if (!sessionId) return;
    initializeAdaptiveExam();
    return () => {
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    };
  }, [sessionId]);

  // Ensure notificationSocket is connected — MainLayout renders the Header
  // here (unlike ExamRunnerHTTP), which normally connects it, but this makes
  // the dependency explicit rather than implicit.
  useEffect(() => {
    notificationSocket.connect().catch(() => {});
  }, []);

  // Listen for being kicked, and for the session ending/being cancelled by
  // a proctor/admin.
  useEffect(() => {
    if (!sessionId) return;

    const handleCandidateKicked = (data: any) => {
      if (String(data.sessionId) !== String(sessionId)) return;
      if (terminatedRef.current) return;
      terminatedRef.current = true;
      setKicked(true);
      setKickReason(data.reason);
    };

    const handleSessionStatusChanged = (data: any) => {
      if (String(data.sessionId) !== String(sessionId)) return;
      if (data.status !== 'completed' && data.status !== 'cancelled') return;
      if (terminatedRef.current) return;

      toast.error(
        data.status === 'completed'
          ? 'La sesión fue finalizada por el supervisor. Tu examen fue enviado.'
          : 'La sesión fue cancelada por el supervisor. Tu examen fue enviado con tus respuestas actuales.'
      );
      handleTerminated(undefined);
    };

    notificationSocket.on('session.candidate.kicked', handleCandidateKicked);
    notificationSocket.on('session.status.changed', handleSessionStatusChanged);
    return () => {
      notificationSocket.off('session.candidate.kicked', handleCandidateKicked);
      notificationSocket.off('session.status.changed', handleSessionStatusChanged);
    };
  }, [sessionId, handleTerminated]);

  const initializeAdaptiveExam = async () => {
    if (!sessionId) return;
    setLoading(true);
    setError(null);
    try {
      // Try to resume an in-progress attempt first
      let resumed = false;
      try {
        const resumeResp = await examService.resumeAdaptiveExam(sessionId);
        if (resumeResp.success && resumeResp.data) {
          const { finished, question, adaptiveState: state, attemptId: aid, browserLockdown, resultsHidden: hidden } = resumeResp.data;
          useExamStore.setState({ browserLockdown: !!browserLockdown });
          setResultsHidden(!!hidden);
          if (aid) setAttemptId(aid);
          if (finished) {
            handleFinished();
            return;
          }
          if (question && state) {
            setCurrentQuestion(question);
            setAdaptiveState(state);
            resumed = true;
          }
        }
      } catch (_resumeErr) {
        // No existing attempt yet — will start fresh below
      }

      if (!resumed) {
        // Start a new adaptive attempt
        const startResp = await examService.startAdaptiveExam(sessionId);
        if (startResp.success && startResp.data) {
          useExamStore.setState({ browserLockdown: !!startResp.data.browserLockdown });
          setResultsHidden(!!startResp.data.resultsHidden);
          setAttemptId(startResp.data.attemptId);
          setCurrentQuestion(startResp.data.question);
          setAdaptiveState({ ...startResp.data.adaptiveState, consecutiveWrong: 0 });
        } else {
          throw new Error('No se pudo iniciar el examen adaptativo');
        }
      }
    } catch (err: any) {
      if (err?.response?.data?.code === 'CANDIDATE_REMOVED') {
        setKicked(true);
        setKickReason(err?.response?.data?.message);
        return;
      }
      // Deep-link / stale-tab edge case: a brand-new attempt was rejected by
      // exam-service's server-side technical verification gate. Resuming an
      // existing in_progress attempt is never blocked this way, so this only
      // fires when the candidate skipped (or lost) the preparation screen.
      const technicalInfo = getTechnicalVerificationRequiredInfo(err);
      if (technicalInfo && sessionId) {
        navigate(`/student/exam/${sessionId}/preparation`, {
          replace: true,
          state: { technicalVerificationReasons: technicalInfo.reasons },
        });
        return;
      }
      const msg = err?.response?.data?.message || err.message || 'Error al iniciar el examen';
      if (msg.includes('already completed')) {
        handleFinished();
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitAnswer = async () => {
    if (!sessionId || !currentQuestion || !currentAnswer || submitting) return;
    setSubmitting(true);
    try {
      const resp = await examService.submitAdaptiveAnswer(
        sessionId,
        String(currentQuestion._id),
        currentAnswer
      );
      if (!resp.success || !resp.data) throw new Error('Respuesta no procesada');

      const { finished, gradeResult, nextQuestion, adaptiveState: newState, stopReason: reason, resultsHidden: hidden } = resp.data;

      // Show brief feedback — neutral "answer recorded" when results are hidden
      // (the backend omits gradeResult in that case).
      setResultsHidden(!!hidden);
      setFeedback(hidden ? null : gradeResult ?? null);
      setShowFeedback(true);

      if (finished) {
        setAdaptiveState(newState);
        feedbackTimerRef.current = setTimeout(() => {
          setShowFeedback(false);
          handleFinished(reason);
        }, 1500);
      } else {
        setAdaptiveState(newState);
        feedbackTimerRef.current = setTimeout(() => {
          setShowFeedback(false);
          setCurrentAnswer(null);
          setCurrentQuestion(nextQuestion);
        }, 1500);
      }
    } catch (err: any) {
      const terminationInfo = getAttemptTerminationInfo(err);
      if (terminationInfo) {
        handleTerminated(terminationInfo.attemptStatus);
      } else {
        toast.error(err?.response?.data?.message || err.message || 'Error al enviar respuesta');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleAnswerChange = useCallback((answer: any) => {
    setCurrentAnswer(answer);
  }, []);

  if (loading) {
    return (
      <MainLayout gradientVariant="primary">
        <div className="max-w-3xl mx-auto flex items-center justify-center min-h-96">
          <div className="text-center space-y-4">
            <Brain className="h-12 w-12 text-blue-400 mx-auto animate-pulse" />
            <p className="text-foreground/80 text-lg">Iniciando examen de nivelación...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (error) {
    return (
      <MainLayout gradientVariant="primary">
        <div className="max-w-3xl mx-auto flex items-center justify-center min-h-96">
          <div className="text-center space-y-4">
            <AlertCircle className="h-10 w-10 text-red-400 mx-auto" />
            <p className="text-red-300">{error}</p>
            <Button variant="outline" onClick={() => navigate('/student/dashboard')}>
              Volver al Panel
            </Button>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (kicked) {
    return (
      <MainLayout gradientVariant="primary">
        <div className="max-w-3xl mx-auto flex items-center justify-center min-h-96">
          <Card className="bg-card border border-line w-full max-w-md">
            <CardContent className="p-10 text-center space-y-4">
              <UserX className="h-12 w-12 text-red-400 mx-auto" />
              <h2 className="text-xl font-bold text-foreground">Has sido retirado del examen</h2>
              <p className="text-foreground/80">Has sido retirado del examen por el supervisor.</p>
              {kickReason && <p className="text-muted-foreground text-sm">Motivo: {kickReason}</p>}
              <Button onClick={() => navigate('/student/dashboard')} className="w-full">
                Volver al Panel
              </Button>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  if (isFinished) {
    return (
      <MainLayout gradientVariant="primary">
        <div className="max-w-3xl mx-auto flex items-center justify-center min-h-96">
          <Card className="bg-card border border-line w-full">
            <CardContent className="p-10 text-center space-y-6">
              <CheckCircle className="h-16 w-16 text-green-400 mx-auto" />
              <div>
                <h2 className="text-2xl font-bold text-foreground mb-2">
                  {resultsHidden ? 'Examen completado' : '¡Examen Completado!'}
                </h2>
                <p className="text-foreground/80">
                  {resultsHidden
                    ? 'Has completado el examen de nivelación.'
                    : stopReason === 'consecutive_wrong'
                    ? 'El examen finalizó automáticamente por límite de errores consecutivos.'
                    : stopReason === 'max_questions'
                    ? 'Respondiste el máximo de preguntas permitidas.'
                    : 'Has completado el examen de nivelación.'}
                </p>
              </div>
              {adaptiveState && (
                <div className="bg-muted/50 rounded-lg p-4 text-sm text-foreground/80">
                  <p>Preguntas respondidas: <span className="text-foreground font-medium">{adaptiveState.questionsAnswered}</span></p>
                  {!resultsHidden && adaptiveState.currentLevel && (
                    <p className="mt-1">Nivel final alcanzado: <span className={`font-medium px-2 py-0.5 rounded ${LEVEL_COLORS[adaptiveState.currentLevel] || 'text-foreground'}`}>{adaptiveState.currentLevel}</span></p>
                  )}
                </div>
              )}
              <p className="text-muted-foreground text-sm">
                {resultsHidden
                  ? 'Tus respuestas fueron registradas. Los resultados estarán disponibles cuando el docente los publique.'
                  : 'Tus resultados estarán disponibles en unos momentos en la sección de resultados.'}
              </p>
              <Button
                disabled={navigatingToResult}
                onClick={() => {
                  if (!attemptId) { navigate('/student/results'); return; }
                  setNavigatingToResult(true);
                  examResultService.pollForResult(attemptId, 30, 2000)
                    .then((result) => {
                      const resultId = (result as any).id || (result as any)._id;
                      navigate(`/student/results/${resultId}`);
                    })
                    .catch(() => {
                      toast.info('Los resultados se están procesando...', { duration: 5000 });
                      navigate('/student/results');
                    });
                }}
                className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white"
              >
                {navigatingToResult
                  ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Cargando resultados...</>
                  : 'Ver Mis Resultados'
                }
              </Button>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout gradientVariant="primary">
      {/* ── Fullscreen re-entry overlay (browser lockdown) ─────────────────── */}
      {lockdownEnabled && showFullscreenPrompt && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <Card className="bg-card border border-amber-400/60 dark:border-amber-500/50 w-full max-w-sm">
            <CardContent className="p-6 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-700/50 flex items-center justify-center mx-auto">
                <Maximize className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-foreground">Pantalla completa requerida</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {/* Also shown right at load when lockdown arms but the page
                      isn't in fullscreen yet (reload, auto-start, deep link)
                      — not only after a real exit — so this copy stays
                      accurate for both instead of implying an infraction
                      was always just logged. */}
                  El examen requiere pantalla completa para continuar. Salir de ella queda registrado.
                </p>
              </div>
              <Button onClick={reenterFullscreen} className="w-full">
                <Maximize className="h-4 w-4 mr-2" />
                Volver a pantalla completa
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-foreground">Examen de Nivelación</h1>
            <p className="text-muted-foreground text-sm">Sistema Adaptativo (CAT)</p>
          </div>
          <div className="flex items-center gap-3">
            {lockdownEnabled && (
              <div
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-amber-400/60 dark:border-amber-500/50 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs font-medium"
                title="El examen registra salidas de pantalla completa, cambios de pestaña y atajos bloqueados."
              >
                <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden sm:inline">Modo bloqueo activo</span>
                {lockdownInfractionCount > 0 && (
                  <span className="tabular-nums">({lockdownInfractionCount})</span>
                )}
              </div>
            )}
            {adaptiveState && (
              <>
                {!resultsHidden && adaptiveState.currentLevel && (
                  <Badge className={LEVEL_COLORS[adaptiveState.currentLevel] || 'bg-blue-500/20 text-blue-300 border-blue-500/30'}>
                    Nivel actual: {adaptiveState.currentLevel}
                  </Badge>
                )}
                <span className="text-muted-foreground text-sm">
                  Pregunta {adaptiveState.questionsAnswered + 1} de máx {adaptiveState.maxQuestions}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Feedback overlay — neutral when results are hidden */}
        {showFeedback && resultsHidden && (
          <div className="p-4 rounded-lg border flex items-center gap-3 transition-all bg-muted/50 border-line">
            <CheckCircle className="h-5 w-5 text-muted-foreground shrink-0" />
            <p className="font-medium text-foreground">Respuesta registrada</p>
          </div>
        )}
        {showFeedback && !resultsHidden && feedback && (
          <div className={`p-4 rounded-lg border flex items-center gap-3 transition-all ${
            feedback.isCorrect
              ? 'bg-green-500/10 border-green-500/30'
              : 'bg-red-500/10 border-red-500/30'
          }`}>
            {feedback.isCorrect
              ? <CheckCircle className="h-5 w-5 text-green-400 shrink-0" />
              : <XCircle className="h-5 w-5 text-red-400 shrink-0" />
            }
            <div>
              <p className={`font-medium ${feedback.isCorrect ? 'text-green-300' : 'text-red-300'}`}>
                {feedback.isCorrect ? '¡Correcto!' : 'Incorrecto'}
                {' '}— {feedback.score}/{feedback.maxScore} puntos
              </p>
              {feedback.feedback && (
                <p className="text-muted-foreground text-sm mt-0.5">{feedback.feedback}</p>
              )}
            </div>
          </div>
        )}

        {/* Question Card */}
        {currentQuestion && !showFeedback && (
          <Card className="bg-card border border-line">
            <CardHeader>
              <CardTitle className="text-foreground text-base font-medium flex items-center gap-2">
                <Brain className="h-4 w-4 text-blue-400" />
                Pregunta {(adaptiveState?.questionsAnswered ?? 0) + 1}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <QuestionRenderer
                question={currentQuestion}
                answer={currentAnswer}
                onChange={(_questionId, value) => handleAnswerChange(value)}
              />

              <div className="mt-6 flex justify-end">
                <Button
                  onClick={handleSubmitAnswer}
                  disabled={submitting || !currentAnswer}
                  className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white min-w-32"
                >
                  {submitting ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Evaluando...</>
                  ) : (
                    'Confirmar Respuesta'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Progress indicator */}
        {adaptiveState && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="flex gap-1">
              {Array.from({ length: Math.min(adaptiveState.questionsAnswered, 20) }).map((_, i) => (
                <div key={i} className="w-2 h-2 rounded-full bg-blue-500/50" />
              ))}
              {Array.from({ length: Math.max(0, adaptiveState.maxQuestions - adaptiveState.questionsAnswered) }).map((_, i) => (
                <div key={i} className="w-2 h-2 rounded-full bg-muted" />
              ))}
            </div>
            <span>{adaptiveState.questionsAnswered}/{adaptiveState.maxQuestions}</span>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default AdaptiveExamRunner;
