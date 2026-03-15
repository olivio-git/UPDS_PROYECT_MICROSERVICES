import { examService } from '@/services/examService';
import { notificationSocket } from '@/services/notifications/notificationSocket';
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
  autoSaveStatus: 'idle' | 'saving' | 'saved' | 'error';
  totalQuestions: number;
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
    totalQuestions: 0
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

  // Auto-save functionality
  const performAutoSave = useCallback(async () => {
    if (!state.sessionId || !hasUnsavedChanges.current) return;

    const now = Date.now();
    if (now - lastSaveRef.current < 2000) return; // Throttle saves to 2 seconds minimum

    setState(prev => ({ ...prev, autoSaveStatus: 'saving' }));
    lastSaveRef.current = now;
    hasUnsavedChanges.current = false;

    try {
      // Sanitize and save answers — skip audio answers still uploading or failed
      const entries = Object.entries(state.answers).filter(([, answer]) => {
        if (answer && typeof answer === 'object') {
          if ((answer as any).uploading === true) return false; // still uploading
          if ((answer as any).uploadFailed === true && !(answer as any).audioUrl) return false; // failed, no URL
        }
        return true;
      });
      const savePromises = entries.map(([questionId, answer]) => {
        // Strip non-serializable / local-only fields from audio answers before sending JSON
        let sanitized = answer;
        if (answer && typeof answer === 'object' && ((answer as any).audioUrl || (answer as any).previewUrl)) {
          const { audioBlob: _blob, previewUrl: _preview, uploading: _up, uploadFailed: _fail, ...rest } = answer as any;
          sanitized = rest; // keeps only audioUrl (permanent MinIO URL)
        }
        return examService.submitAnswer(state.sessionId!, questionId, sanitized);
      });

      await Promise.all(savePromises);

      setState(prev => ({ ...prev, autoSaveStatus: 'saved' }));
      onAutoSave?.(true);

      // Reset to idle after 2 seconds
      setTimeout(() => {
        setState(prev => ({ ...prev, autoSaveStatus: 'idle' }));
      }, 2000);

    } catch (error) {
      console.error('Auto-save failed:', error);
      setState(prev => ({ ...prev, autoSaveStatus: 'error' }));
      hasUnsavedChanges.current = true; // Mark as having unsaved changes again
      onAutoSave?.(false);
    }
  }, [state.sessionId, state.answers, onAutoSave]);

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
        onTimeWarning?.(minutes);
        toast.warning(`⏰ Quedan ${minutes} minutos para finalizar el examen`);
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

  // Session management functions - define finishExam first
  const finishExam = useCallback(async () => {
    if (!state.sessionId || state.sessionStatus === 'completed') {
      console.log('⚠️ [useExamSessionHTTP] Finish called but exam already completed or no session');
      return;
    }

    try {
      setLoading(true);
      console.log('🏁 [useExamSessionHTTP] Finishing exam:', state.sessionId);

      // Force final save bypassing throttle — reset guards so performAutoSave runs unconditionally
      lastSaveRef.current = 0;
      hasUnsavedChanges.current = true;
      await performAutoSave();

      const response = await examService.finishExam(state.sessionId);

      if (response.success) {
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
      console.error('Error finishing exam:', error);
      toast.error('Error finalizando el examen');
    } finally {
      setLoading(false);
    }
  }, [state.sessionId, state.sessionStatus, performAutoSave, onSessionEnd, stopLocalTimer]);

  // Time polling functionality
  const pollTimeRemaining = useCallback(async () => {
    if (!state.sessionId || !state.isActive || state.sessionStatus !== 'active') return;

    try {
      const response = await examService.getTimeRemaining(state.sessionId);
      if (response.success && response.data) {
        const { timeRemaining, sessionEnded } = response.data;

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

        // HTTP fallback: session ended by admin/teacher (WebSocket may have been missed)
        if (sessionEnded && timeRemaining <= 0) {
          console.log('🔴 [useExamSessionHTTP] Session ended by admin (HTTP fallback)');
          toast.warning('La sesión ha sido finalizada por el administrador');
        }

        // Auto-finish when time is up or session was ended externally
        if (timeRemaining <= 0) {
          const reason = sessionEnded ? 'ended by admin' : 'time expired';
          console.log(`⏰ [useExamSessionHTTP] Auto-finishing exam: ${reason}`);

          // Set status to completed immediately to prevent multiple calls
          setState(prev => ({
            ...prev,
            sessionStatus: 'completed',
            isActive: false
          }));

          // Clear intervals before finishing
          if (autoSaveRef.current) clearInterval(autoSaveRef.current);
          if (timePollingRef.current) clearInterval(timePollingRef.current);
          stopLocalTimer();

          await finishExam();
          return;
        }
      }
    } catch (error) {
      console.error('Error polling time:', error);
    }
  }, [state.sessionId, state.isActive, state.sessionStatus, onTimeWarning, finishExam, startLocalTimer, stopLocalTimer]);

  // Initialize auto-save interval
  useEffect(() => {
    if (state.isActive && state.sessionId) {
      autoSaveRef.current = setInterval(performAutoSave, autoSaveInterval);
      return () => {
        if (autoSaveRef.current) {
          clearInterval(autoSaveRef.current);
        }
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

  // Ref to always have the latest finishExam without stale closure in socket handler
  const finishExamRef = useRef(finishExam);
  useEffect(() => { finishExamRef.current = finishExam; }, [finishExam]);

  // Listen for remote session termination via WebSocket (teacher/admin ends session)
  useEffect(() => {
    if (!state.sessionId || !state.isActive) return;

    const handleSessionStatusChanged = async (data: any) => {
      if (String(data.sessionId) !== String(state.sessionId)) return;
      if (data.status !== 'completed' && data.status !== 'cancelled') return;

      console.log('🔴 [useExamSessionHTTP] Session terminated remotely, status:', data.status);

      setState(prev => ({ ...prev, sessionStatus: 'completed', isActive: false }));
      if (autoSaveRef.current) clearInterval(autoSaveRef.current);
      if (timePollingRef.current) clearInterval(timePollingRef.current);
      stopLocalTimer();

      toast.warning('La sesión ha sido finalizada por el administrador');
      await finishExamRef.current();
    };

    notificationSocket.on('session.status.changed', handleSessionStatusChanged);
    return () => {
      notificationSocket.off('session.status.changed', handleSessionStatusChanged);
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

      const response = await examService.startExam(sessionId);

      if (response.success && response.data) {
        const { sections, timeAllowedSeconds, examId, totalQuestions, answers } = response.data;

        // Check if exam time is already expired
        if (timeAllowedSeconds <= 0) {
          console.log('⚠️ [useExamSessionHTTP] Examen iniciado pero ya expiró');
          toast.error('El examen ya ha expirado');
          throw new Error('Exam already expired');
        }

        setState(prev => ({
          ...prev,
          sessionId,
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

        toast.success('¡Examen iniciado exitosamente!');
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
          totalQuestions
        } = response.data;

        setState(prev => ({
          ...prev,
          sessionId,
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
      autoSaveStatus: 'idle'
    }));
    hasUnsavedChanges.current = true;
  }, []);

  // Section navigation
  const navigateToSection = useCallback((sectionIndex: number) => {
    setState(prev => ({
      ...prev,
      currentSectionIndex: Math.max(0, Math.min(sectionIndex, prev.sections.length - 1)),
      currentQuestionIndex: 0 // Reset to first question of the section
    }));
  }, []);

  const navigateToQuestionInSection = useCallback((sectionIndex: number, questionIndex: number) => {
    setState(prev => {
      const targetSection = prev.sections[sectionIndex];
      if (!targetSection) return prev;

      return {
        ...prev,
        currentSectionIndex: sectionIndex,
        currentQuestionIndex: Math.max(0, Math.min(questionIndex, targetSection.questions.length - 1))
      };
    });
  }, []);

  const goToNextQuestion = useCallback(() => {
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
  }, []);

  const goToPreviousQuestion = useCallback(() => {
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
  }, []);

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

    sectionStats: state.sections.map(section => ({
      id: section.id,
      name: section.name,
      competency: section.competency,
      answered: section.questions.filter(q => isAnswered(state.answers[q._id])).length,
      total: section.questions.length,
      progress: section.questions.length > 0 ?
        section.questions.filter(q => isAnswered(state.answers[q._id])).length / section.questions.length : 0
    })),

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

    // Utility
    formatTime: (seconds: number) => {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
  };
};