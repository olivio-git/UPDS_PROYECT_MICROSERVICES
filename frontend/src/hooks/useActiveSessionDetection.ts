import { examService } from '@/services/examService';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface ActiveSessionData {
  sessionId: string;
  attemptId: string;
  startedAt: Date;
  timeRemaining: number;
  status: string;
}

interface UseActiveSessionDetectionOptions {
  checkOnMount?: boolean;
  showModal?: boolean;
  autoNavigate?: boolean;
  onActiveSessionFound?: (session: ActiveSessionData) => void;
}

export const useActiveSessionDetection = (options: UseActiveSessionDetectionOptions = {}) => {
  const {
    checkOnMount = true,
    showModal = true,
    autoNavigate = false,
    onActiveSessionFound
  } = options;

  const navigate = useNavigate();
  const [activeSession, setActiveSession] = useState<ActiveSessionData | null>(null);
  const [loading, setLoading] = useState(false);
  const [showContinueModal, setShowContinueModal] = useState(false);

  const checkActiveSession = useCallback(async () => {
    try {
      setLoading(true);
      console.log('🔍 [useActiveSessionDetection] Checking for active sessions...');

      const response = await examService.getActiveSession();

      if (response.success && response.data) {
        const sessionData = response.data;

        console.log('🎯 [useActiveSessionDetection] Active session found:', {
          sessionId: sessionData.sessionId,
          timeRemaining: sessionData.timeRemaining,
          status: sessionData.status
        });

        setActiveSession(sessionData);
        onActiveSessionFound?.(sessionData);

        if (showModal && !autoNavigate) {
          setShowContinueModal(true);
        } else if (autoNavigate) {
          navigateToExam(sessionData.sessionId);
        }

        return sessionData;
      } else {
        console.log('ℹ️ [useActiveSessionDetection] No active session found');
        setActiveSession(null);
        return null;
      }

    } catch (error) {
      console.error('❌ [useActiveSessionDetection] Error checking active session:', error);
      setActiveSession(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [showModal, autoNavigate, onActiveSessionFound]);

  const navigateToExam = useCallback((sessionId: string) => {
    console.log('🚀 [useActiveSessionDetection] Navigating to exam:', sessionId);
    navigate(`/student/exam/${sessionId}`);
    setShowContinueModal(false);
  }, [navigate]);

  const dismissModal = useCallback(() => {
    setShowContinueModal(false);
  }, []);

  const continueExam = useCallback(() => {
    if (activeSession) {
      navigateToExam(activeSession.sessionId);
    }
  }, [activeSession, navigateToExam]);

  // Check for active session on mount - ONLY ONCE
  useEffect(() => {
    if (checkOnMount) {
      checkActiveSession();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkOnMount]); // Solo checkOnMount, NO checkActiveSession para evitar loop

  return {
    // State
    activeSession,
    loading,
    showContinueModal,
    hasActiveSession: activeSession !== null,

    // Actions
    checkActiveSession,
    navigateToExam,
    continueExam,
    dismissModal,

    // Helpers
    formatTimeRemaining: (seconds: number) => {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const remainingSeconds = seconds % 60;

      if (hours > 0) {
        return `${hours}h ${minutes}m ${remainingSeconds}s`;
      } else if (minutes > 0) {
        return `${minutes}m ${remainingSeconds}s`;
      } else {
        return `${remainingSeconds}s`;
      }
    }
  };
};