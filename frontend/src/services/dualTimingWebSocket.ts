import { useCallback, useEffect, useRef, useState } from 'react';

interface DualTimingMessage {
  type: 'session-update' | 'individual-timer' | 'session-start' | 'session-end' | 'auto-save-status' | 'late-join-approved' | 'session-expired';
  sessionId: string;
  data?: any;
  individualData?: {
    timeRemaining: number;
    allowedDuration: number;
    studentId: string;
  };
  error?: string;
  message?: string;
}

interface DualTimingWebSocketOptions {
  onSessionUpdate?: (data: any) => void;
  onIndividualTimer?: (data: { timeRemaining: number; allowedDuration: number }) => void;
  onSessionStart?: (data: any) => void;
  onSessionEnd?: (data: any) => void;
  onAutoSaveStatus?: (status: 'saving' | 'saved' | 'error') => void;
  onLateJoinApproved?: (data: any) => void;
  onSessionExpired?: (data: any) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export const useDualTimingWebSocket = (
  sessionId: string, 
  isIndividualSession: boolean = false,
  options: DualTimingWebSocketOptions = {}
) => {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const websocket = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttempts = useRef(0);
  const isConnecting = useRef(false);

  const {
    onSessionUpdate,
    onIndividualTimer,
    onSessionStart,
    onSessionEnd,
    onAutoSaveStatus,
    onLateJoinApproved,
    onSessionExpired,
    onConnect,
    onDisconnect,
    onError,
    reconnectInterval = 5000,
    maxReconnectAttempts = 5
  } = options;

  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (isConnecting.current || (websocket.current && websocket.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    if (websocket.current && websocket.current.readyState === WebSocket.OPEN) {
      return;
    }

    isConnecting.current = true;
    setConnectionState('connecting');
    clearReconnectTimeout();

    try {
      // WebSocket URL with session type parameter
      const wsUrl = `http://localhost:3004/session/${sessionId}?type=${isIndividualSession ? 'individual' : 'group'}`;
      websocket.current = new WebSocket(wsUrl);

      websocket.current.onopen = () => {
        isConnecting.current = false;
        setIsConnected(true);
        setConnectionState('connected');
        reconnectAttempts.current = 0;
        console.log(`🔌 WebSocket connected to ${isIndividualSession ? 'individual' : 'group'} session:`, sessionId);
        
        // Register student for this session
        sendMessage({
          type: 'register-student',
          sessionId,
          sessionType: isIndividualSession ? 'individual' : 'group'
        });
        
        onConnect?.();
      };

      websocket.current.onmessage = (event) => {
        try {
          const message: DualTimingMessage = JSON.parse(event.data);
          
          // Route messages based on type
          switch (message.type) {
            case 'session-update':
              onSessionUpdate?.(message.data);
              break;
            case 'individual-timer':
              if (message.individualData && isIndividualSession) {
                onIndividualTimer?.(message.individualData);
              }
              break;
            case 'session-start':
              onSessionStart?.(message.data);
              break;
            case 'session-end':
              onSessionEnd?.(message.data);
              break;
            case 'auto-save-status':
              if (message.data?.status) {
                onAutoSaveStatus?.(message.data.status);
              }
              break;
            case 'late-join-approved':
              onLateJoinApproved?.(message.data);
              break;
            case 'session-expired':
              onSessionExpired?.(message.data);
              break;
            default:
              console.log('Unknown message type:', message.type);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      websocket.current.onclose = (event) => {
        isConnecting.current = false;
        setIsConnected(false);
        setConnectionState('disconnected');
        console.log('🔌 WebSocket disconnected:', event.code, event.reason);
        onDisconnect?.();

        // Attempt reconnection if not intentional
        if (!event.wasClean && reconnectAttempts.current < maxReconnectAttempts) {
          reconnectAttempts.current++;
          console.log(`🔄 Reconnect attempt ${reconnectAttempts.current}/${maxReconnectAttempts}`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectInterval);
        }
      };

      websocket.current.onerror = (error) => {
        isConnecting.current = false;
        console.error('🚨 WebSocket error:', error);
        onError?.(error);
      };

    } catch (error) {
      isConnecting.current = false;
      console.error('🚨 Failed to create WebSocket connection:', error);
    }
  }, [sessionId, isIndividualSession, onSessionUpdate, onIndividualTimer, onSessionStart, onSessionEnd, onAutoSaveStatus, onLateJoinApproved, onSessionExpired, onConnect, onDisconnect, onError, reconnectInterval, maxReconnectAttempts, clearReconnectTimeout]);

  const disconnect = useCallback(() => {
    clearReconnectTimeout();
    reconnectAttempts.current = maxReconnectAttempts;
    
    if (websocket.current) {
      websocket.current.close(1000, 'Manual disconnect');
      websocket.current = null;
    }
    
    setIsConnected(false);
    setConnectionState('disconnected');
  }, [clearReconnectTimeout, maxReconnectAttempts]);

  const sendMessage = useCallback((message: any) => {
    if (websocket.current && websocket.current.readyState === WebSocket.OPEN) {
      websocket.current.send(JSON.stringify({
        ...message,
        sessionId,
        timestamp: Date.now()
      }));
      return true;
    }
    console.warn('🚨 WebSocket not connected, message not sent:', message);
    return false;
  }, [sessionId]);

  // Specific methods for dual timing
  const requestIndividualTime = useCallback(() => {
    return sendMessage({
      type: 'request-individual-time'
    });
  }, [sendMessage]);

  const reportProgress = useCallback((questionId: string, answer: any) => {
    return sendMessage({
      type: 'progress-update',
      data: {
        questionId,
        answer,
        timestamp: Date.now()
      }
    });
  }, [sendMessage]);

  const requestLateJoin = useCallback(() => {
    return sendMessage({
      type: 'request-late-join'
    });
  }, [sendMessage]);

  const startIndividualSession = useCallback(() => {
    return sendMessage({
      type: 'start-individual-session'
    });
  }, [sendMessage]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearReconnectTimeout();
      if (websocket.current) {
        websocket.current.close();
      }
    };
  }, [clearReconnectTimeout]);

  return {
    isConnected,
    connectionState,
    connect,
    disconnect,
    sendMessage,
    requestIndividualTime,
    reportProgress,
    requestLateJoin,
    startIndividualSession,
    reconnectAttempts: reconnectAttempts.current
  };
};

// Hook for managing session state with dual timing support
export const useSessionManagement = (sessionId: string, isIndividualSession: boolean = false) => {
  const [sessionState, setSessionState] = useState<'waiting' | 'active' | 'paused' | 'ended'>('waiting');
  const [individualTimeLeft, setIndividualTimeLeft] = useState<number | null>(null);
  const [canLateJoin, setCanLateJoin] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  
  const webSocketOptions: DualTimingWebSocketOptions = {
    onSessionUpdate: (data) => {
      if (data.state) {
        setSessionState(data.state);
      }
      if (data.canLateJoin !== undefined) {
        setCanLateJoin(data.canLateJoin);
      }
    },
    onIndividualTimer: (data) => {
      setIndividualTimeLeft(data.timeRemaining);
    },
    onSessionStart: (data) => {
      setSessionState('active');
      console.log('Session started:', data);
    },
    onSessionEnd: (data) => {
      setSessionState('ended');
      console.log('Session ended:', data);
    },
    onAutoSaveStatus: (status) => {
      setAutoSaveStatus(status);
    },
    onLateJoinApproved: (data) => {
      setSessionState('active');
      console.log('Late join approved:', data);
    },
    onSessionExpired: (data) => {
      setSessionState('ended');
      console.log('Session expired:', data);
    }
  };

  const {
    isConnected,
    connect,
    disconnect,
    requestIndividualTime,
    reportProgress,
    requestLateJoin,
    startIndividualSession
  } = useDualTimingWebSocket(sessionId, isIndividualSession, webSocketOptions);

  // Auto-connect on mount
  useEffect(() => {
    if (sessionId) {
      connect();
    }
    return () => disconnect();
  }, [sessionId, connect, disconnect]);

  // Request individual time updates every 30 seconds if individual session
  useEffect(() => {
    if (!isIndividualSession || !isConnected) return;

    const interval = setInterval(() => {
      requestIndividualTime();
    }, 30000);

    return () => clearInterval(interval);
  }, [isIndividualSession, isConnected, requestIndividualTime]);

  return {
    sessionState,
    individualTimeLeft,
    canLateJoin,
    autoSaveStatus,
    isConnected,
    connect,
    disconnect,
    reportProgress,
    requestLateJoin,
    startIndividualSession,
    requestIndividualTime
  };
};