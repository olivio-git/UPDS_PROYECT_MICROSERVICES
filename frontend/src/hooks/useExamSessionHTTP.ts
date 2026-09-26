import { examService, getAttemptTerminationInfo } from '@/services/examService';
import { notificationSocket } from '@/services/notifications/notificationSocket';
import { useExamStore } from '@/stores/examStore';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

export interface ExamSection {
  id: string;
  name: string;
  competency: string;
  duration: number;
  weight: number;
  questionCount: number;
  questions: any[];
}

export interface ExamSessionState {
  sessionId: string | null;
  isActive: boolean;
  sections: ExamSection[];
  currentSectionIndex: number;
  currentQuestionIndex: number;
  answers: Record<string, any>;
  timeRemaining: number | null;
  sessionStatus: 'waiting' | 'active' | 'completed' | 'expired';
  autoSaveStatus: 'idle' | 'dirty' | 'saving' | 'saved' | 'error';
  totalQuestions: number;
  // The candidate was removed from the session by a proctor/admin. This is a
  // distinct terminal state from `sessionStatus === 'completed'`: no finish
  // request is sent (the attempt is already 'cancelled' server-side), the UI
  // just blocks further interaction and sends the candidate back home.
  kicked: boolean;
  kickReason?: string;
  // The teacher cancelled the session. Distinct from `sessionStatus ===
  // 'completed'` (ended by the teacher, attempts force-completed and graded):
  // a cancelled session is NOT graded, so no finish request is sent and the
  // UI must not claim the exam was submitted.
  sessionCancelled: boolean;
  // The attempt id for the current session, captured from start/resume so
  // a remote-termination push (session ended, attempt force-completed
  // server-side) can go straight to onSessionEnd without a finish() round
  // trip that would just 409 against the already-closed attempt.
  attemptId: string | null;
}

interface UseExamSessionHTTPOptions {
  sessionId?: string;
  autoSaveInterval?: number;
  timePollingInterval?: number;
  onSessionStart?: () => void;
  onSessionEnd?: (attemptId: string) => void;
  onAutoSave?: (success: boolean) => void;
  onTimeWarning?: (minutes: number) => void;
}

export const useExamSessionHTTP = (options: UseExamSessionHTTPOptions = {}) => {
  const {
    sessionId: initialSessionId,
    autoSaveInterval = 10000, // 10 segundos
    timePollingInterval = 30000, // 30 segundos
    onSessionStart,
    onSessionEnd,
    onAutoSave,
    onTimeWarning
  } = options;

  // State
  const [state, setState] = useState<ExamSessionState>({
    sessionId: initialSessionId || null,
    isActive: false,
    sections: [],
    currentSectionIndex: 0,
    currentQuestionIndex: 0,
    answers: {},
    timeRemaining: null,
    sessionStatus: 'waiting',
    autoSaveStatus: 'idle',
    totalQuestions: 0,
    kicked: false,
    kickReason: undefined,
    sessionCancelled: false,
    attemptId: null
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs for intervals and tracking
  const autoSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timePollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const localTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSaveRef = useRef<number>(Date.now());
  const hasUnsavedChanges = useRef<boolean>(false);
  const lastTimeWarning = useRef<number>(0);
  const lastServerSync = useRef<number>(Date.now());
  const localTimeStart = useRef<number | null>(null);
  // Refs estables — evitan que performAutoSave se recree en cada render/keystroke
  const answersRef = useRef<Record<string, any>>({});
  const sessionIdRef = useRef<string | null>(null);
  const attemptIdRef = useRef<string | null>(null);
  const onAutoSaveRef = useRef(onAutoSave);
  const onTimeWarningRef = useRef(onTimeWarning);
  const onSessionEndRef = useRef(onSessionEnd);
  // Guards the terminal-state transition (kicked or remotely-finished) so it
  // only runs once, whether it's triggered by a socket push or by an
  // exam-taking call's 409 ATTEMPT_NOT_IN_PROGRESS fallback. Without this,
  // an already-terminal attempt could re-trigger finishExam in a loop.
  const terminationHandledRef = useRef(false);
  // Populated by the effect below — called from
  // performAutoSave/pollTimeRemaining/finishExam catch blocks on 409.
  const handleAttemptTerminatedRef = useRef<(attemptStatus?: string) => void>(() => {});
  // Set once the teacher cancels the session (socket push or time-poll
  // fallback) — blocks the exam without submitting it for grading.
  const handleSessionCancelledRef = useRef<() => void>(() => {});
  // Guards against concurrent finish() calls (timer auto-submit + manual
  // button + retries) without flipping sessionStatus before the server has
  // actually accepted the submission.
  const finishingRef = useRef(false);

  // Mantener refs de callbacks sincronizados sin añadirlos a deps de useCallback
  useEffect(() => { answersRef.current = state.answers; }, [state.answers]);
  useEffect(() => { sessionIdRef.current = state.sessionId; }, [state.sessionId]);
  useEffect(() => { attemptIdRef.current = state.attemptId; }, [state.attemptId]);
  useEffect(() => { onAutoSaveRef.current = onAutoSave; }, [onAutoSave]);
  useEffect(() => { onTimeWarningRef.current = onTimeWarning; }, [onTimeWarning]);
  useEffect(() => { onSessionEndRef.current = onSessionEnd; }, [onSessionEnd]);

  // Auto-save functionality — usa refs en lugar de state para no recrearse en cada cambio
  const performAutoSave = useCallback(async () => {
    if (!sessionIdRef.current || !hasUnsavedChanges.current) return;

    const now = Date.now();
    if (now - lastSaveRef.current < 2000) return; // Throttle: mínimo 2s entre saves

    setState(prev => ({ ...prev, autoSaveStatus: 'saving' }));
    lastSaveRef.current = now;
    hasUnsavedChanges.current = false;

    try {
      // Sanitize and save answers — skip audio answers still uploading or failed
      const entries = Object.entries(answersRef.current).filter(([, answer]) => {
        if (answer && typeof answer === 'object') {
          if ((answer as any).uploading === true) return false;
          if ((answer as any).uploadFailed === true && !(answer as any).audioUrl) return false;
        }
        return true;
      });
      const savePromises = entries.map(([questionId, answer]) => {
        let sanitized = answer;
        if (answer && typeof answer === 'object' && ((answer as any).audioUrl || (answer as any).previewUrl)) {
          const { audioBlob: _blob, previewUrl: _preview, uploading: _up, uploadFailed: _fail, ...rest } = answer as any;
          sanitized = rest;
        }
        return examService.submitAnswer(sessionIdRef.current!, questionId, sanitized);
      });

      await Promise.all(savePromises);

      setState(prev => ({ ...prev, autoSaveStatus: 'saved' }));
      onAutoSaveRef.current?.(true);

      setTimeout(() => {
        setState(prev => ({ ...prev, autoSaveStatus: 'idle' }));
      }, 2000);

    } catch (error) {
      const terminationInfo = getAttemptTerminationInfo(error);
      if (terminationInfo) {
        handleAttemptTerminatedRef.current(terminationInfo.attemptStatus);
        return;
      }
      console.error('Auto-save failed:', error);
      setState(prev => ({ ...prev, autoSaveStatus: 'error' }));
      hasUnsavedChanges.current = true;
      onAutoSaveRef.current?.(false);
    }
  }, []); // deps vacías — usa refs para todo, nunca se recrea

  // Local timer functionality for real-time countdown
  const startLocalTimer = useCallback((initialTimeRemaining: number) => {
    // Clear any existing timer
    if (localTimerRef.current) {
      clearInterval(localTimerRef.current);
    }

    localTimeStart.current = Date.now();
    lastServerSync.current = Date.now();

    console.log(`⏱️ [Local Timer] Starting with ${initialTimeRemaining} seconds`);

    localTimerRef.current = setInterval(() => {
      const now = Date.now();
      const localElapsed = Math.floor((now - localTimeStart.current!) / 1000);
      const newTimeRemaining = Math.max(0, initialTimeRemaining - localElapsed);

      // Update state with local time
      setState(prev => {
        // Only update if session is still active
        if (prev.sessionStatus !== 'active') return prev;

        return {
          ...prev,
          timeRemaining: newTimeRemaining
        };
      });

      // Time warnings for local timer
      const minutes = Math.floor(newTimeRemaining / 60);
      if (minutes <= 5 && minutes > 0 && minutes !== lastTimeWarning.current) {
        lastTimeWarning.current = minutes;
        onTimeWarningRef.current?.(minutes);
      }

      // Stop local timer if time is up (server polling will handle finish)
      if (newTimeRemaining <= 0) {
        if (localTimerRef.current) {
          clearInterval(localTimerRef.current);
          localTimerRef.current = null;
        }
      }
    }, 1000); // Update every second
  }, [onTimeWarning]);

  const stopLocalTimer = useCallback(() => {
    if (localTimerRef.current) {
      clearInterval(localTimerRef.current);
      localTimerRef.current = null;
    }
    localTimeStart.current = null;
  }, []);

  // Ref to track current timeRemaining without stale closures
  const timeRemainingRef = useRef<number | null>(null);
  useEffect(() => {
    timeRemainingRef.current = state.timeRemaining;
  }, [state.timeRemaining]);

  // Add seconds to the running countdown (e.g. after admin extends session time)
  const addTime = useCallback((seconds: number) => {
    const current = timeRemainingRef.current ?? 0;
    startLocalTimer(current + seconds);
  }, [startLocalTimer]);

  // Session management functions - define finishExam first
  const finishExam = useCallback(async () => {
    if (!state.sessionId || state.sessionStatus === 'completed' || terminationHandledRef.current) {
      console.log('⚠️ [useExamSessionHTTP] Finish called but exam already completed or no session');
      return;
    }
    if (finishingRef.current) return;
    finishingRef.current = true;

    try {
      setLoading(true);
      console.log('🏁 [useExamSessionHTTP] Finishing exam:', state.sessionId);

      // Force final save bypassing throttle — reset guards so performAutoSave runs unconditionally
      lastSaveRef.current = 0;
      hasUnsavedChanges.current = true;
      await performAutoSave();

      // The final autosave can already find the attempt closed server-side
      // (time-up auto-submit, session ended) — its 409 handler has then
      // shown the right terminal screen, so there is nothing left to finish.
      if (terminationHandledRef.current) return;

      const response = await examService.finishExam(state.sessionId);

      if (response.success) {
        terminationHandledRef.current = true;
        setState(prev => ({
          ...prev,
          isActive: false,
          sessionStatus: 'completed'
        }));

        // Clear intervals
        if (autoSaveRef.current) clearInterval(autoSaveRef.current);
        if (timePollingRef.current) clearInterval(timePollingRef.current);
        stopLocalTimer();

        toast.success('Examen finalizado exitosamente');
        console.log('✅ [useExamSessionHTTP] Exam finished successfully');

        // Call onSessionEnd after a small delay to ensure state is updated
        const attemptId = (response as any)?.data?.attemptId as string | undefined;
        setTimeout(() => {
          onSessionEnd?.(attemptId ?? '');
        }, 500);
      } else {
        throw new Error(response.message || 'Failed to finish exam');
      }

    } catch (error) {
      const terminationInfo = getAttemptTerminationInfo(error);
      if (terminationInfo) {
        handleAttemptTerminatedRef.current(terminationInfo.attemptStatus);
      } else {
        // Not submitted: keep the exam open so the student (or the next
        // time poll, when time is up) can retry the submission.
        console.error('Error finishing exam:', error);
        toast.error('No se pudo enviar el examen. Inténtalo de nuevo.');
      }
    } finally {
      finishingRef.current = false;
      setLoading(false);
    }
  }, [state.sessionId, state.sessionStatus, performAutoSave, onSessionEnd, stopLocalTimer]);

  // Time polling functionality
  const pollTimeRemaining = useCallback(async () => {
    if (!state.sessionId || !state.isActive || state.sessionStatus !== 'active') return;

    try {
      const response = await examService.getTimeRemaining(state.sessionId);
      if (response.success && response.data) {
        const { timeRemaining, sessionEnded, sessionStatus: remoteSessionStatus, attemptStatus } = response.data;

        // HTTP fallback for a missed socket push: the session was closed
        // remotely, or the attempt was already closed server-side.
        if (sessionEnded) {
          if (remoteSessionStatus === 'cancelled') {
            console.log('🔴 [useExamSessionHTTP] Session cancelled by the teacher (HTTP fallback)');
            handleSessionCancelledRef.current();
            return;
          }
          if (remoteSessionStatus === 'completed') {
            console.log('🔴 [useExamSessionHTTP] Session ended by the teacher (HTTP fallback)');
            toast.error('La sesión fue finalizada por el docente. Tu examen fue enviado.');
          }
          // Ended session (attempts force-completed server-side) or an
          // attempt already submitted: show the "Examen enviado" screen.
          handleAttemptTerminatedRef.current(attemptStatus ?? 'completed');
          return;
        }

        // Sync with server time and adjust local timer if needed
        const now = Date.now();
        const timeSinceLastSync = Math.floor((now - lastServerSync.current) / 1000);

        console.log(`🔄 [Server Sync] Server time: ${timeRemaining}s, Local expected: ${state.timeRemaining}s`);

        // Check for significant drift (more than 5 seconds difference)
        const expectedLocalTime = state.timeRemaining ? state.timeRemaining - timeSinceLastSync : timeRemaining;
        const timeDrift = Math.abs(timeRemaining - expectedLocalTime);

        if (timeDrift > 5 || !localTimerRef.current) {
          console.log(`⚠️ [Time Sync] Drift detected: ${timeDrift}s, resyncing local timer`);
          // Restart local timer with server time
          startLocalTimer(timeRemaining);
        }

        // Update server sync time
        lastServerSync.current = now;

        // Time is up: submit with whatever answers were saved. The server
        // auto-submits on time-up too, so finish() normally resolves as an
        // idempotent success (or a 409 'completed' → "Examen enviado").
        // sessionStatus only flips once the submission is confirmed; on
        // failure the exam stays open and the next poll retries.
        if (timeRemaining <= 0) {
          console.log('⏰ [useExamSessionHTTP] Auto-finishing exam: time expired');
          await finishExam();
          return;
        }
      }
    } catch (error) {
      const terminationInfo = getAttemptTerminationInfo(error);
      if (terminationInfo) {
        handleAttemptTerminatedRef.current(terminationInfo.attemptStatus);
        return;
      }
      console.error('Error polling time:', error);
    }
  }, [state.sessionId, state.isActive, state.sessionStatus, onTimeWarning, finishExam, startLocalTimer, stopLocalTimer]);

  // Initialize auto-save interval — performAutoSave es estable (deps vacías), nunca se reinicia
  useEffect(() => {
    if (state.isActive && state.sessionId) {
      autoSaveRef.current = setInterval(performAutoSave, autoSaveInterval);
      return () => {
        if (autoSaveRef.current) clearInterval(autoSaveRef.current);
      };
    }
  }, [state.isActive, state.sessionId, performAutoSave, autoSaveInterval]);

  // Initialize time polling interval
  useEffect(() => {
    if (state.isActive && state.sessionId && state.sessionStatus === 'active') {
      timePollingRef.current = setInterval(pollTimeRemaining, timePollingInterval);
      // Poll immediately but with a small delay to avoid conflicts
      setTimeout(() => pollTimeRemaining(), 1000);
      return () => {
        if (timePollingRef.current) {
          clearInterval(timePollingRef.current);
        }
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.isActive, state.sessionId, state.sessionStatus]); // Sin pollTimeRemaining para evitar loops

  // Wire up the shared 409/kick termination handlers.
  // `attemptStatus === 'cancelled'` means the candidate was kicked — block
  // further interaction without calling finish (the attempt is already
  // terminal server-side). Any other status ('completed', legacy 'expired')
  // means the attempt was already submitted server-side: the caller's
  // onSessionEnd shows the "Examen enviado" screen — no polling, no waiting
  // for a score. A cancelled SESSION is handled separately (not graded).
  useEffect(() => {
    handleAttemptTerminatedRef.current = (attemptStatus?: string) => {
      if (terminationHandledRef.current) return;
      terminationHandledRef.current = true;

      if (autoSaveRef.current) clearInterval(autoSaveRef.current);
      if (timePollingRef.current) clearInterval(timePollingRef.current);
      stopLocalTimer();

      if (attemptStatus === 'cancelled') {
        setState(prev => ({ ...prev, isActive: false, kicked: true }));
        return;
      }

      // Any other terminal status (e.g. 'completed') means the attempt was
      // already closed server-side (endSession force-completes in-progress
      // attempts and queues grading) — calling finish() here would just hit
      // the same 409 that got us here. Go straight to the completion path
      // with the attemptId this runner already has instead.
      setState(prev => ({ ...prev, isActive: false, sessionStatus: 'completed' }));
      const attemptId = attemptIdRef.current ?? '';
      setTimeout(() => {
        onSessionEndRef.current?.(attemptId);
      }, 500);
    };

    handleSessionCancelledRef.current = () => {
      if (terminationHandledRef.current) return;
      terminationHandledRef.current = true;

      if (autoSaveRef.current) clearInterval(autoSaveRef.current);
      if (timePollingRef.current) clearInterval(timePollingRef.current);
      stopLocalTimer();

      setState(prev => ({ ...prev, isActive: false, sessionCancelled: true }));
    };
  }, [stopLocalTimer]);

  // Listen for remote session termination via WebSocket (teacher/admin ends session)
  useEffect(() => {
    if (!state.sessionId || !state.isActive) return;

    const handleSessionStatusChanged = async (data: any) => {
      if (String(data.sessionId) !== String(state.sessionId)) return;
      if (data.status !== 'completed' && data.status !== 'cancelled') return;
      if (terminationHandledRef.current) return;

      console.log('🔴 [useExamSessionHTTP] Session terminated remotely, status:', data.status);

      if (data.status === 'cancelled') {
        // Product rule: a session cancelled by the teacher is NOT graded —
        // no finish request, and a distinct screen instead of "Examen enviado".
        toast.error('La sesión fue cancelada por el docente.');
        handleSessionCancelledRef.current();
        return;
      }

      terminationHandledRef.current = true;
      if (autoSaveRef.current) clearInterval(autoSaveRef.current);
      if (timePollingRef.current) clearInterval(timePollingRef.current);
      stopLocalTimer();

      // session.ended already force-completes in-progress attempts and
      // queues grading server-side (see exam-service session.service.ts
      // endSession), so finish() is not called. Best-effort flush of any
      // unsaved answers first — it normally 409s because the attempt is
      // already closed, which the (already handled) termination guard
      // ignores.
      lastSaveRef.current = 0;
      hasUnsavedChanges.current = true;
      try {
        await performAutoSave();
      } catch {
        // Best-effort only.
      }

      setState(prev => ({ ...prev, sessionStatus: 'completed', isActive: false }));
      toast.error('La sesión fue finalizada por el docente. Tu examen fue enviado.');
      const attemptId = attemptIdRef.current ?? '';
      setTimeout(() => {
        onSessionEndRef.current?.(attemptId);
      }, 500);
    };

    notificationSocket.on('session.status.changed', handleSessionStatusChanged);
    return () => {
      notificationSocket.off('session.status.changed', handleSessionStatusChanged);
    };
  }, [state.sessionId, state.isActive, stopLocalTimer, performAutoSave]);

  // Listen for being kicked by a proctor/admin — distinct from a session-wide
  // status change: only this candidate is affected, the attempt is already
  // 'cancelled' server-side, and no finish request should be sent.
  useEffect(() => {
    if (!state.sessionId || !state.isActive) return;

    const handleCandidateKicked = (data: any) => {
      if (String(data.sessionId) !== String(state.sessionId)) return;
      if (terminationHandledRef.current) return;
      terminationHandledRef.current = true;

      console.log('🔴 [useExamSessionHTTP] Kicked from session:', data);

      if (autoSaveRef.current) clearInterval(autoSaveRef.current);
      if (timePollingRef.current) clearInterval(timePollingRef.current);
      stopLocalTimer();

      setState(prev => ({
        ...prev,
        isActive: false,
        kicked: true,
        kickReason: data.reason,
      }));
    };

    notificationSocket.on('session.candidate.kicked', handleCandidateKicked);
    return () => {
      notificationSocket.off('session.candidate.kicked', handleCandidateKicked);
    };
  }, [state.sessionId, state.isActive, stopLocalTimer]);

  // Session management functions
  const startSession = useCallback(async (sessionId: string) => {
    // Prevent starting if already active or completed
    if (state.sessionStatus === 'active' || state.sessionStatus === 'completed') {
      console.log('⚠️ [useExamSessionHTTP] Start session called but exam already active/completed');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      console.log(`🚀 [useExamSessionHTTP] Iniciando sesión: ${sessionId}`);

      terminationHandledRef.current = false;
      const response = await examService.startExam(sessionId);

      if (response.success && response.data) {
        const { sections, timeAllowedSeconds, examId, totalQuestions, answers, attemptId, browserLockdown } = response.data;

        // Keep examStore's browserLockdown in sync with the authoritative
        // server value — covers the deep-link/hard-refresh case where the
        // candidate lands directly on the runner without going through
        // ExamPreparation (which is the other place this gets set).
        useExamStore.setState({ browserLockdown: !!browserLockdown });

        // Check if exam time is already expired
        if (timeAllowedSeconds <= 0) {
          console.log('⚠️ [useExamSessionHTTP] Examen iniciado pero ya expiró');
          toast.error('El examen ya ha expirado');
          throw new Error('Exam already expired');
        }

        setState(prev => ({
          ...prev,
          sessionId,
          attemptId: attemptId ?? null,
          isActive: true,
          sections: sections || [],
          currentSectionIndex: 0,
          currentQuestionIndex: 0,
          timeRemaining: timeAllowedSeconds || null,
          sessionStatus: 'active',
          autoSaveStatus: 'idle',
          answers: answers || {}, // Include existing answers
          totalQuestions: totalQuestions || 0
        }));

        console.log('✅ [useExamSessionHTTP] Examen iniciado:', {
          sections: sections?.length || 0,
          totalQuestions: totalQuestions || 0,
          examId,
          timeAllowed: timeAllowedSeconds
        });

        // Start local timer with initial time
        if (timeAllowedSeconds > 0) {
          startLocalTimer(timeAllowedSeconds);
        }

        // La pantalla del examen ya es la confirmación.
        onSessionStart?.();

      } else {
        throw new Error(response.message || 'Failed to start exam');
      }

    } catch (error) {
      console.error('❌ [useExamSessionHTTP] Error starting session:', error);
      setError(error instanceof Error ? error.message : 'Error starting session');

      // Re-throw the error so the caller can handle it
      throw error;
    } finally {
      setLoading(false);
    }
  }, [state.sessionStatus, onSessionStart, startLocalTimer]);

  const resumeSession = useCallback(async (sessionId: string) => {
    try {
      setLoading(true);
      setError(null);

      console.log(`🔄 [useExamSessionHTTP] Resumiendo sesión: ${sessionId}`);

      terminationHandledRef.current = false;
      const response = await examService.resumeExam(sessionId);

      if (response.success && response.data) {
        const {
          sections,
          answers,
          currentSectionIndex,
          currentQuestionIndex,
          timeRemaining,
          progress,
          examId,
          totalQuestions,
          attemptId,
          browserLockdown
        } = response.data;

        useExamStore.setState({ browserLockdown: !!browserLockdown });

        setState(prev => ({
          ...prev,
          sessionId,
          attemptId: attemptId ?? null,
          isActive: true,
          sections: sections || [],
          answers: answers || {},
          currentSectionIndex: currentSectionIndex || 0,
          currentQuestionIndex: currentQuestionIndex || 0,
          timeRemaining,
          sessionStatus: 'active',
          autoSaveStatus: 'idle',
          totalQuestions: totalQuestions || 0
        }));

        console.log('✅ [useExamSessionHTTP] Sesión resumida:', {
          sections: sections?.length || 0,
          totalQuestions: totalQuestions || 0,
          answered: progress?.answered || 0,
          currentSection: currentSectionIndex,
          currentQuestion: currentQuestionIndex,
          timeRemaining,
          examId
        });

        // Start local timer with resumed time
        if (timeRemaining > 0) {
          startLocalTimer(timeRemaining);
        }

        toast.success(`Examen resumido - ${progress?.answered || 0}/${progress?.total || 0} preguntas respondidas`);

      } else {
        throw new Error(response.message || 'Failed to resume exam');
      }

    } catch (error) {
      console.error('❌ [useExamSessionHTTP] Error resuming session:', error);
      setError(error instanceof Error ? error.message : 'Error resuming session');

      // Don't show toast here - let the caller handle the error
      // toast.error('Error resumiendo el examen: ' + (error instanceof Error ? error.message : 'Error desconocido'));

      // Re-throw the error so the caller can handle it
      throw error;
    } finally {
      setLoading(false);
    }
  }, [startLocalTimer]);

  const updateAnswer = useCallback((questionId: string, answer: any) => {
    setState(prev => ({
      ...prev,
      answers: {
        ...prev.answers,
        [questionId]: answer
      },
      autoSaveStatus: 'dirty'
    }));
    hasUnsavedChanges.current = true;
  }, []);

  // Section navigation
  const navigateToSection = useCallback((sectionIndex: number) => {
    if (hasUnsavedChanges.current) {
      lastSaveRef.current = 0;
      performAutoSave();
    }
    setState(prev => ({
      ...prev,
      currentSectionIndex: Math.max(0, Math.min(sectionIndex, prev.sections.length - 1)),
      currentQuestionIndex: 0
    }));
  }, [performAutoSave]);

  const navigateToQuestionInSection = useCallback((sectionIndex: number, questionIndex: number) => {
    if (hasUnsavedChanges.current) {
      lastSaveRef.current = 0;
      performAutoSave();
    }
    setState(prev => {
      const targetSection = prev.sections[sectionIndex];
      if (!targetSection) return prev;

      return {
        ...prev,
        currentSectionIndex: sectionIndex,
        currentQuestionIndex: Math.max(0, Math.min(questionIndex, targetSection.questions.length - 1))
      };
    });
  }, [performAutoSave]);

  const goToNextQuestion = useCallback(() => {
    if (hasUnsavedChanges.current) {
      lastSaveRef.current = 0; // bypass throttle so el auto-save dispara de inmediato
      performAutoSave();
    }
    setState(prev => {
      const currentSection = prev.sections[prev.currentSectionIndex];
      if (!currentSection) return prev;

      // If not at the last question of current section, move to next question
      if (prev.currentQuestionIndex < currentSection.questions.length - 1) {
        return {
          ...prev,
          currentQuestionIndex: prev.currentQuestionIndex + 1
        };
      }

      // If at last question of current section, move to next section
      if (prev.currentSectionIndex < prev.sections.length - 1) {
        return {
          ...prev,
          currentSectionIndex: prev.currentSectionIndex + 1,
          currentQuestionIndex: 0
        };
      }

      // Already at the last question of the last section
      return prev;
    });
  }, [performAutoSave]);

  const goToPreviousQuestion = useCallback(() => {
    if (hasUnsavedChanges.current) {
      lastSaveRef.current = 0;
      performAutoSave();
    }
    setState(prev => {
      // If not at the first question of current section, move to previous question
      if (prev.currentQuestionIndex > 0) {
        return {
          ...prev,
          currentQuestionIndex: prev.currentQuestionIndex - 1
        };
      }

      // If at first question of current section, move to last question of previous section
      if (prev.currentSectionIndex > 0) {
        const previousSection = prev.sections[prev.currentSectionIndex - 1];
        return {
          ...prev,
          currentSectionIndex: prev.currentSectionIndex - 1,
          currentQuestionIndex: previousSection.questions.length - 1
        };
      }

      // Already at the first question of the first section
      return prev;
    });
  }, [performAutoSave]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (autoSaveRef.current) clearInterval(autoSaveRef.current);
      if (timePollingRef.current) clearInterval(timePollingRef.current);
      if (localTimerRef.current) clearInterval(localTimerRef.current);
    };
  }, []);

  // Determina si una respuesta tiene contenido real (no vacía/inicializada)
  const isAnswered = (answer: any): boolean => {
    if (answer === null || answer === undefined) return false;
    if ('selectedOptions' in answer) return Array.isArray(answer.selectedOptions) && answer.selectedOptions.length > 0;
    if ('blanks' in answer) return Array.isArray(answer.blanks) && answer.blanks.some((b: string) => b.trim() !== '');
    if ('pairs' in answer) return typeof answer.pairs === 'object' && Object.keys(answer.pairs).length > 0;
    if ('positions' in answer) return typeof answer.positions === 'object' && Object.keys(answer.positions).length > 0;
    if ('order' in answer) return Array.isArray(answer.order) && answer.order.length > 0;
    if ('text' in answer) return typeof answer.text === 'string' && answer.text.trim() !== '';
    if ('audioUrl' in answer) return typeof answer.audioUrl === 'string' && answer.audioUrl !== '';
    if ('answer' in answer) return answer.answer !== null && answer.answer !== undefined && answer.answer !== '';
    return false;
  };

  return {
    // State
    ...state,
    loading,
    error,

    // Current section and question helpers
    currentSection: state.sections[state.currentSectionIndex] || null,
    currentQuestion: state.sections[state.currentSectionIndex]?.questions[state.currentQuestionIndex] || null,

    // Navigation helpers
    isLastQuestionInSection: state.sections[state.currentSectionIndex] ?
      state.currentQuestionIndex === state.sections[state.currentSectionIndex].questions.length - 1 : false,
    isFirstQuestionInSection: state.currentQuestionIndex === 0,
    isLastSection: state.currentSectionIndex === state.sections.length - 1,
    isFirstSection: state.currentSectionIndex === 0,
    isLastQuestionOverall: state.currentSectionIndex === state.sections.length - 1 &&
      state.sections[state.currentSectionIndex]?.questions &&
      state.currentQuestionIndex === state.sections[state.currentSectionIndex].questions.length - 1,
    isFirstQuestionOverall: state.currentSectionIndex === 0 && state.currentQuestionIndex === 0,

    // Progress calculations
    overallProgress: state.totalQuestions > 0 ?
      (state.sections.slice(0, state.currentSectionIndex).reduce((sum, section) => sum + section.questions.length, 0) +
       state.currentQuestionIndex + 1) / state.totalQuestions : 0,

    sectionProgress: state.sections[state.currentSectionIndex] ?
      (state.currentQuestionIndex + 1) / state.sections[state.currentSectionIndex].questions.length : 0,

    answeredCount: Object.values(state.answers).filter(isAnswered).length,

    sectionStats: state.sections.map(section => {
      const answered = section.questions.filter(q => isAnswered(state.answers[q._id])).length;
      return {
        id: section.id,
        name: section.name,
        competency: section.competency,
        answered,
        total: section.questions.length,
        progress: section.questions.length > 0 ? answered / section.questions.length : 0,
        questionStates: section.questions.map(q => ({
          id: q._id as string,
          answered: isAnswered(state.answers[q._id]),
          text: (q.content?.question || q.title || q.text || '') as string,
        })),
      };
    }),

    // Actions
    startSession,
    resumeSession,
    finishExam: finishExam,
    updateAnswer,

    // Section navigation
    navigateToSection,
    navigateToQuestionInSection,
    goToNextQuestion,
    goToPreviousQuestion,

    performManualSave: performAutoSave,
    addTime,

    // Utility
    formatTime: (seconds: number) => {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
  };
};