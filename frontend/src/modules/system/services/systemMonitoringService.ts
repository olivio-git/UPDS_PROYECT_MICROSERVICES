import { useCallback, useEffect, useRef, useState } from 'react';

interface WebSocketMessage {
  type: string;
  data?: any;
  stats?: any;
  message?: string;
}

interface WebSocketOptions {
  onMessage?: (data: WebSocketMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export const useWebSocket = (url: string, options: WebSocketOptions = {}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const websocket = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const reconnectAttempts = useRef(0);
  const isConnecting = useRef(false);

  const {
    onMessage,
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

  // Sin mock data - el frontend debe mostrar estado de "no disponible" cuando no hay backend

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
      websocket.current = new WebSocket(url);

      websocket.current.onopen = () => {
        isConnecting.current = false;
        setIsConnected(true);
        setConnectionState('connected');
        reconnectAttempts.current = 0;
        console.log('🔌 WebSocket connected to system monitoring');
        onConnect?.();
      };

      websocket.current.onmessage = (event) => {
        try {
          const data: WebSocketMessage = JSON.parse(event.data);
          onMessage?.(data);
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

        // Intentar reconexión si no fue manual (pero solo para sistema de monitoreo, ser menos agresivo)
        if (!event.wasClean && reconnectAttempts.current < maxReconnectAttempts) {
          reconnectAttempts.current++;
          console.log(`🔄 System monitoring reconnect attempt ${reconnectAttempts.current}/${maxReconnectAttempts}`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectInterval);
        } else if (reconnectAttempts.current >= maxReconnectAttempts) {
          console.log('🚫 System monitoring: Max reconnect attempts reached. Stopping attempts.');
        }
      };

      websocket.current.onerror = (error) => {
        isConnecting.current = false;
        // Solo mostrar warning en el primer intento
        if (reconnectAttempts.current === 0) {
          console.warn('🚨 System monitoring WebSocket connection failed. Backend may not be running.');
        }
        setConnectionState('disconnected');
        onError?.(error);
      };

    } catch (error) {
      isConnecting.current = false;
      console.warn('🚨 Failed to create WebSocket connection. Backend may not be running.');
      setConnectionState('disconnected');
    }
  }, [url, onConnect, onDisconnect, onMessage, onError, reconnectInterval, maxReconnectAttempts, clearReconnectTimeout]);

  const disconnect = useCallback(() => {
    clearReconnectTimeout();
    reconnectAttempts.current = maxReconnectAttempts; // Prevent reconnection
    
    if (websocket.current) {
      websocket.current.close(1000, 'Manual disconnect');
      websocket.current = null;
    }
    
    setIsConnected(false);
    setConnectionState('disconnected');
  }, [clearReconnectTimeout, maxReconnectAttempts]);

  const sendMessage = useCallback((message: any) => {
    if (websocket.current && websocket.current.readyState === WebSocket.OPEN) {
      websocket.current.send(JSON.stringify(message));
      return true;
    }
    console.warn('🚨 WebSocket not connected, message not sent:', message);
    return false;
  }, []);

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
    reconnectAttempts: reconnectAttempts.current
  };
};

// Servicio para obtener estadísticas del sistema via API REST
export class SystemMonitoringService {
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:3003/api/v1') {
    this.baseUrl = baseUrl;
  }

  async getSystemStats() {
    try {
      const response = await fetch(`${this.baseUrl}/api/system/stats`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching system stats:', error);
      throw error;
    }
  }

  async getMemoryStats() {
    try {
      const response = await fetch(`${this.baseUrl}/api/system/memory`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching memory stats:', error);
      throw error;
    }
  }

  async forceMemoryCleanup() {
    try {
      const response = await fetch(`${this.baseUrl}/api/system/cleanup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error forcing memory cleanup:', error);
      throw error;
    }
  }

  async getActiveConnections() {
    try {
      const response = await fetch(`${this.baseUrl}/api/system/connections`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching active connections:', error);
      throw error;
    }
  }
}

// Hook personalizado para usar el servicio de monitoreo
export const useSystemMonitoring = () => {
  const [service] = useState(() => new SystemMonitoringService());
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const systemStats = await service.getSystemStats();
      setStats(systemStats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, [service]);

  const forceCleanup = useCallback(async () => {
    setLoading(true);
    try {
      await service.forceMemoryCleanup();
      // Refetch stats after cleanup
      await fetchStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error en limpieza');
    } finally {
      setLoading(false);
    }
  }, [service, fetchStats]);

  return {
    stats,
    loading,
    error,
    fetchStats,
    forceCleanup,
    service
  };
};