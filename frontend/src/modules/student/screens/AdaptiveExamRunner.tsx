import { Badge } from '@/components/atoms/badge';
import { Button } from '@/components/atoms/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/atoms/card';
import { MainLayout } from '@/components/layout';
import { examResultService } from '@/services/examResultService';
import { examService } from '@/services/examService';
import { AlertCircle, Brain, CheckCircle, Loader2, XCircle } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import QuestionRenderer from '../components/QuestionRenderer';

interface AdaptiveState {
  currentLevel: string;
  questionsAnswered: number;
  maxQuestions: number;
  consecutiveWrongThreshold: number;
  consecutiveWrong: number;
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
  A1: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
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
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [navigatingToResult, setNavigatingToResult] = useState(false);

  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleFinished = useCallback((reason?: string) => {
    setIsFinished(true);
    setStopReason(reason);
    toast.success('Examen de nivelación completado. Calculando tu nivel...');
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    initializeAdaptiveExam();
    return () => {
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    };
  }, [sessionId]);

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
          const { finished, question, adaptiveState: state, attemptId: aid } = resumeResp.data;
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
          setAttemptId(startResp.data.attemptId);
          setCurrentQuestion(startResp.data.question);
          setAdaptiveState({ ...startResp.data.adaptiveState, consecutiveWrong: 0 });
        } else {
          throw new Error('No se pudo iniciar el examen adaptativo');
        }
      }
    } catch (err: any) {
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

      const { finished, gradeResult, nextQuestion, adaptiveState: newState, stopReason: reason } = resp.data;

      // Show brief feedback
      setFeedback(gradeResult);
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
      toast.error(err?.response?.data?.message || err.message || 'Error al enviar respuesta');
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
            <p className="text-gray-300 text-lg">Iniciando examen de nivelación...</p>
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

  if (isFinished) {
    return (
      <MainLayout gradientVariant="primary">
        <div className="max-w-3xl mx-auto flex items-center justify-center min-h-96">
          <Card className="bg-[#0B1422] border border-line w-full">
            <CardContent className="p-10 text-center space-y-6">
              <CheckCircle className="h-16 w-16 text-green-400 mx-auto" />
              <div>
                <h2 className="text-2xl font-bold text-white mb-2">
                  ¡Examen Completado!
                </h2>
                <p className="text-gray-300">
                  {stopReason === 'consecutive_wrong'
                    ? 'El examen finalizó automáticamente por límite de errores consecutivos.'
                    : stopReason === 'max_questions'
                    ? 'Respondiste el máximo de preguntas permitidas.'
                    : 'Has completado el examen de nivelación.'}
                </p>
              </div>
              {adaptiveState && (
                <div className="bg-gray-800/50 rounded-lg p-4 text-sm text-gray-300">
                  <p>Preguntas respondidas: <span className="text-white font-medium">{adaptiveState.questionsAnswered}</span></p>
                  <p className="mt-1">Nivel final alcanzado: <span className={`font-medium px-2 py-0.5 rounded ${LEVEL_COLORS[adaptiveState.currentLevel] || 'text-white'}`}>{adaptiveState.currentLevel}</span></p>
                </div>
              )}
              <p className="text-gray-400 text-sm">
                Tus resultados estarán disponibles en unos momentos en la sección de resultados.
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
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-white">Examen de Nivelación</h1>
            <p className="text-gray-400 text-sm">Sistema Adaptativo (CAT)</p>
          </div>
          <div className="flex items-center gap-3">
            {adaptiveState && (
              <>
                <Badge className={LEVEL_COLORS[adaptiveState.currentLevel] || 'bg-blue-500/20 text-blue-300 border-blue-500/30'}>
                  Nivel actual: {adaptiveState.currentLevel}
                </Badge>
                <span className="text-gray-400 text-sm">
                  Pregunta {adaptiveState.questionsAnswered + 1} de máx {adaptiveState.maxQuestions}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Feedback overlay */}
        {showFeedback && feedback && (
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
                <p className="text-gray-400 text-sm mt-0.5">{feedback.feedback}</p>
              )}
            </div>
          </div>
        )}

        {/* Question Card */}
        {currentQuestion && !showFeedback && (
          <Card className="bg-[#0B1422] border border-line">
            <CardHeader>
              <CardTitle className="text-white text-base font-medium flex items-center gap-2">
                <Brain className="h-4 w-4 text-blue-400" />
                Pregunta {(adaptiveState?.questionsAnswered ?? 0) + 1}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <QuestionRenderer
                question={currentQuestion}
                answer={currentAnswer}
                onAnswerChange={handleAnswerChange}
                disabled={submitting}
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
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <div className="flex gap-1">
              {Array.from({ length: Math.min(adaptiveState.questionsAnswered, 20) }).map((_, i) => (
                <div key={i} className="w-2 h-2 rounded-full bg-blue-500/50" />
              ))}
              {Array.from({ length: Math.max(0, adaptiveState.maxQuestions - adaptiveState.questionsAnswered) }).map((_, i) => (
                <div key={i} className="w-2 h-2 rounded-full bg-gray-700" />
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
