import socketService from '@/modules/student/services/socketService-new';
import type { QuestionSection, SectionProgress } from '@/modules/student/types/sectionedExam';
import { examService } from '@/services/examService';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

export interface ExamSessionState {
  sessionId: string | null;
  isActive: boolean;
  questions: any[];
  currentQuestionIndex: number;
  answers: Record<string, any>;
  timeRemaining: number | null;
  sessionType: 'individual' | 'group';
  sessionStatus: 'waiting' | 'active' | 'completed' | 'expired';
  autoSaveStatus: 'idle' | 'saving' | 'saved' | 'error';
  // Sectioned exam support
  sections: QuestionSection[];
  sectionProgress: { [sectionId: string]: SectionProgress };
  currentSectionId: string | null;
  hasSections: boolean;
}

interface UseExamSessionOptions {
  sessionId?: string;
  sessionType?: 'individual' | 'group';
  autoSaveInterval?: number;
  onSessionStart?: () => void;
  onSessionEnd?: () => void;
  onAutoSave?: (success: boolean) => void;
}

export const useExamSession = (options: UseExamSessionOptions = {}) => {
  const {
    sessionId: initialSessionId,
    sessionType = 'group',
    autoSaveInterval = 10000,
    onSessionStart,
    onSessionEnd,
    onAutoSave
  } = options;

  // State
  const [state, setState] = useState<ExamSessionState>({
    sessionId: initialSessionId || null,
    isActive: false,
    questions: [],
    currentQuestionIndex: 0,
    answers: {},
    timeRemaining: null,
    sessionType,
    sessionStatus: 'waiting',
    autoSaveStatus: 'idle',
    // Sectioned exam support
    sections: [],
    sectionProgress: {},
    currentSectionId: null,
    hasSections: false
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState(false);

  // Refs
  const autoSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaveRef = useRef<number>(Date.now());
  const hasUnsavedChanges = useRef<boolean>(false);

  // Socket connection status
  useEffect(() => {
    const updateConnectionStatus = () => {
      setWsConnected(socketService.isConnected());
    };

    // Check initially
    updateConnectionStatus();

    // Set up interval to check connection status
    const interval = setInterval(updateConnectionStatus, 1000);

    return () => clearInterval(interval);
  }, []);

  // Auto-save functionality
  const performAutoSave = useCallback(async () => {
    if (!state.sessionId || !hasUnsavedChanges.current) return;
    
    const now = Date.now();
    if (now - lastSaveRef.current < 2000) return; // Throttle saves
    
    setState(prev => ({ ...prev, autoSaveStatus: 'saving' }));
    lastSaveRef.current = now;
    hasUnsavedChanges.current = false;

    try {
      const entries = Object.entries(state.answers);
      const savePromises = entries.map(([questionId, answer]) =>
        examService.submitAnswer(state.sessionId!, questionId, answer)
      );

      await Promise.all(savePromises);

      setState(prev => ({ ...prev, autoSaveStatus: 'saved' }));
      onAutoSave?.(true);

    } catch (error) {
      console.error('Auto-save failed:', error);
      setState(prev => ({ ...prev, autoSaveStatus: 'error' }));
      hasUnsavedChanges.current = true; // Mark as having unsaved changes again
      onAutoSave?.(false);
    }
  }, [state.sessionId, state.answers, onAutoSave]);

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

  // Session management functions
  const startSession = useCallback(async (sessionId: string) => {
    try {
      setLoading(true);
      setError(null);
      
      console.log(`🚀 [useExamSession] Iniciando ${sessionType} session para ${sessionId}`);
      
      // Ensure socket is connected
      if (!socketService.isConnected()) {
        console.log('🔌 [useExamSession] Conectando socket para inicio de sesión...');
        await socketService.connect();
      }
      
      // For individual sessions, use the socketService method
      if (sessionType === 'individual') {
        console.log('🚀 [useExamSession] Iniciando examen individual via socket...');
        await socketService.startIndividualExam(sessionId);
      }
      
      // Start the exam via API
      console.log('🌐 [useExamSession] Llamando API para iniciar examen...');
      const response = await examService.startExam(sessionId);
      
      if (response.success) {
        const examData = response.data;
        const questions = examData?.questions || [];
        
        console.log('✅ [useExamSession] Examen iniciado exitosamente:', {
          questions: questions.length,
          sessionId
        });
        
        setState(prev => ({
          ...prev,
          sessionId,
          isActive: true,
          questions,
          timeRemaining: null, // Will be set by socket events or exam configuration
          sessionStatus: 'active',
          autoSaveStatus: 'idle'
        }));

        toast.success(
          sessionType === 'individual' 
            ? 'Tu examen individual ha comenzado' 
            : 'Examen iniciado'
        );
        
        onSessionStart?.();
      } else {
        throw new Error(response.message || 'Failed to start exam');
      }
      
    } catch (error) {
      console.error('❌ [useExamSession] Error starting session:', error);
      setError(error instanceof Error ? error.message : 'Error starting session');
      toast.error('Error iniciando el examen: ' + (error instanceof Error ? error.message : 'Error desconocido'));
    } finally {
      setLoading(false);
    }
  }, [sessionType, onSessionStart]);

  const endSession = useCallback(async () => {
    if (!state.sessionId) return;

    try {
      setLoading(true);
      
      // Perform final auto-save
      await performAutoSave();
      
      const response = await examService.finishExam(state.sessionId);
      
      if (response.success) {
        setState(prev => ({
          ...prev,
          isActive: false,
          sessionStatus: 'completed'
        }));

        // Clear auto-save interval
        if (autoSaveRef.current) {
          clearInterval(autoSaveRef.current);
        }

        toast.success('Examen finalizado exitosamente');
        onSessionEnd?.();
      } else {
        throw new Error(response.message || 'Failed to finish exam');
      }
      
    } catch (error) {
      console.error('Error ending session:', error);
      toast.error('Error finalizando el examen');
    } finally {
      setLoading(false);
    }
  }, [state.sessionId, performAutoSave, onSessionEnd]);

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

  const navigateToQuestion = useCallback((index: number) => {
    setState(prev => ({
      ...prev,
      currentQuestionIndex: Math.max(0, Math.min(index, prev.questions.length - 1))
    }));
  }, []);

  const goToNextQuestion = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentQuestionIndex: Math.min(prev.currentQuestionIndex + 1, prev.questions.length - 1)
    }));
  }, []);

  const goToPreviousQuestion = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentQuestionIndex: Math.max(prev.currentQuestionIndex - 1, 0)
    }));
  }, []);

  // Mock implementations for compatibility
  const requestLateJoin = useCallback(async () => {
    console.log('Late join requested - not implemented for socket service');
    return Promise.resolve();
  }, []);

  // Sync with external state (e.g., Zustand store)
  const syncWithExternalState = useCallback((externalState: Partial<ExamSessionState>) => {
    setState(prev => ({
      ...prev,
      ...externalState
    }));
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (autoSaveRef.current) {
        clearInterval(autoSaveRef.current);
      }
    };
  }, []);

  return {
    // State
    ...state,
    loading,
    error,
    wsConnected,
    canLateJoin: false, // Not implemented for socket service
    
    // Current question helper
    currentQuestion: state.questions[state.currentQuestionIndex] || null,
    isLastQuestion: state.currentQuestionIndex === state.questions.length - 1,
    isFirstQuestion: state.currentQuestionIndex === 0,
    progress: state.questions.length > 0 ? (state.currentQuestionIndex + 1) / state.questions.length : 0,
    
    // Actions
    startSession,
    endSession,
    updateAnswer,
    navigateToQuestion,
    goToNextQuestion,
    goToPreviousQuestion,
    requestLateJoin,
    performManualSave: performAutoSave,
    syncWithExternalState
  };
};