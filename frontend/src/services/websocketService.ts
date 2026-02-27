import { io, Socket } from 'socket.io-client';

export interface WebSocketConfig {
  url: string;
  accessToken: string;
  sessionId: string;
  userId: string;
  role: 'student' | 'proctor' | 'admin';
}

export interface TechnicalVerificationEvent {
  type: 'verification-update' | 'verification-completed' | 'verification-failed';
  data: any;
  timestamp: Date;
}

export interface SessionEvent {
  type: 'participant-joined' | 'participant-left' | 'session-started' | 'session-ended';
  data: any;
  timestamp: Date;
}

class WebSocketService {
  private socket: Socket | null = null;
  private isConnected = false;
  private config: WebSocketConfig | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  // Event callbacks
  private onConnectedCallback: ((sessionId: string) => void) | null = null;
  private onDisconnectedCallback: ((reason: string) => void) | null = null;
  private onTechnicalVerificationCallback: ((data: any) => void) | null = null;
  private onSessionEventCallback: ((event: SessionEvent) => void) | null = null;
  private onErrorCallback: ((error: any) => void) | null = null;

  /**
   * Conectar al servidor WebSocket
   */
  async connect(config: WebSocketConfig): Promise<void> {
    if (this.socket && this.isConnected) {
      console.warn('🔌 WebSocket ya está conectado');
      return;
    }

    this.config = config;

    return new Promise((resolve, reject) => {
      console.log(`🔌 Conectando a WebSocket: ${config.url}`);

      this.socket = io(config.url, {
        auth: {
          token: config.accessToken,
          sessionId: config.sessionId,
          userId: config.userId,
          role: config.role
        },
        transports: ['websocket', 'polling'],
        timeout: 10000,
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: this.reconnectDelay,
        reconnectionDelayMax: 5000,
        randomizationFactor: 0.5
      });

      // Eventos de conexión
      this.socket.on('connect', () => {
        console.log('✅ WebSocket conectado exitosamente');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        
        if (this.onConnectedCallback) {
          this.onConnectedCallback(config.sessionId);
        }
        
        resolve();
      });

      this.socket.on('connect_error', (error) => {
        console.error('❌ Error de conexión WebSocket:', error);
        this.isConnected = false;
        
        if (this.onErrorCallback) {
          this.onErrorCallback(error);
        }
        
        reject(error);
      });

      this.socket.on('disconnect', (reason) => {
        console.log(`🔌 WebSocket desconectado: ${reason}`);
        this.isConnected = false;
        
        if (this.onDisconnectedCallback) {
          this.onDisconnectedCallback(reason);
        }
      });

      // Eventos de sesión
      this.socket.on('session-joined', (data) => {
        console.log('✅ Unido a sesión exitosamente:', data);
      });

      this.socket.on('session-error', (error) => {
        console.error('❌ Error de sesión:', error);
        if (this.onErrorCallback) {
          this.onErrorCallback(error);
        }
      });

      // Eventos de verificación técnica
      this.socket.on('technical-verification-updated', (data) => {
        console.log('🔧 Verificación técnica actualizada:', data);
        if (this.onTechnicalVerificationCallback) {
          this.onTechnicalVerificationCallback(data);
        }
      });

      // Eventos de progreso
      this.socket.on('verification-progress', (data) => {
        console.log('📊 Progreso de verificación:', data);
        if (this.onTechnicalVerificationCallback) {
          this.onTechnicalVerificationCallback(data);
        }
      });

      // Eventos de participantes
      this.socket.on('participant-status-updated', (data) => {
        console.log('👤 Estado de participante actualizado:', data);
        if (this.onSessionEventCallback) {
          this.onSessionEventCallback({
            type: 'participant-joined',
            data,
            timestamp: new Date()
          });
        }
      });

      // Ping/Pong para mantener conexión
      this.socket.on('pong', () => {
        // Respuesta al ping
      });

      // Auto-unirse a la sesión
      this.joinSession();
    });
  }

  /**
   * Unirse a una sesión específica
   */
  joinSession(): void {
    if (!this.socket || !this.isConnected || !this.config) {
      console.error('❌ WebSocket no está conectado');
      return;
    }

    console.log(`🚪 Uniéndose a sesión: ${this.config.sessionId}`);
    
    this.socket.emit('join-exam-session', {
      sessionId: this.config.sessionId,
      role: this.config.role,
      userId: this.config.userId
    });
  }

  /**
   * Enviar actualización de verificación técnica
   */
  sendTechnicalVerification(data: any): void {
    if (!this.socket || !this.isConnected) {
      console.error('❌ WebSocket no está conectado - no se puede enviar verificación técnica');
      return;
    }

    console.log('📤 Enviando verificación técnica:', data);
    
    this.socket.emit('technical-verification-update', {
      sessionId: this.config?.sessionId,
      verification: data,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Enviar finalización de verificación técnica
   */
  completeTechnicalVerification(data: any): void {
    if (!this.socket || !this.isConnected) {
      console.error('❌ WebSocket no está conectado');
      return;
    }

    console.log('✅ Verificación técnica completada:', data);
    
    this.socket.emit('technical-verification-completed', {
      sessionId: this.config?.sessionId,
      verification: data,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Enviar ping para mantener conexión
   */
  ping(): void {
    if (this.socket && this.isConnected) {
      this.socket.emit('ping');
    }
  }

  /**
   * Desconectar WebSocket
   */
  disconnect(): void {
    if (this.socket) {
      console.log('🔌 Desconectando WebSocket...');
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.config = null;
    }
  }

  /**
   * Verificar si está conectado
   */
  isSocketConnected(): boolean {
    return this.isConnected && this.socket?.connected === true;
  }

  /**
   * Obtener información de conexión
   */
  getConnectionInfo(): { isConnected: boolean; sessionId?: string; userId?: string } {
    return {
      isConnected: this.isConnected,
      sessionId: this.config?.sessionId,
      userId: this.config?.userId
    };
  }

  // ================================
  // EVENT LISTENERS
  // ================================

  onConnected(callback: (sessionId: string) => void): void {
    this.onConnectedCallback = callback;
  }

  onDisconnected(callback: (reason: string) => void): void {
    this.onDisconnectedCallback = callback;
  }

  onTechnicalVerificationUpdate(callback: (data: any) => void): void {
    this.onTechnicalVerificationCallback = callback;
  }

  onSessionEvent(callback: (event: SessionEvent) => void): void {
    this.onSessionEventCallback = callback;
  }

  onError(callback: (error: any) => void): void {
    this.onErrorCallback = callback;
  }

  // ================================
  // UTILITY METHODS
  // ================================

  /**
   * Obtener latencia de conexión
   */
  async getLatency(): Promise<number> {
    if (!this.socket || !this.isConnected) {
      return -1;
    }

    return new Promise((resolve) => {
      const start = Date.now();
      
      this.socket!.emit('ping', start, () => {
        const latency = Date.now() - start;
        resolve(latency);
      });
      
      // Timeout después de 5 segundos
      setTimeout(() => resolve(-1), 5000);
    });
  }

  /**
   * Obtener información de la sesión
   */
  requestSessionInfo(): void {
    if (!this.socket || !this.isConnected) {
      return;
    }

    this.socket.emit('get-session-info', {
      sessionId: this.config?.sessionId
    });
  }

  /**
   * Enviar evento personalizado
   */
  emit(event: string, data: any): void {
    if (!this.socket || !this.isConnected) {
      console.error(`❌ No se puede enviar evento '${event}' - WebSocket no conectado`);
      return;
    }

    this.socket.emit(event, data);
  }

  /**
   * Escuchar evento personalizado
   */
  on(event: string, callback: (data: any) => void): void {
    if (!this.socket) {
      console.error(`❌ No se puede escuchar evento '${event}' - WebSocket no inicializado`);
      return;
    }

    this.socket.on(event, callback);
  }

  /**
   * Remover listener de evento
   */
  off(event: string, callback?: (data: any) => void): void {
    if (!this.socket) {
      return;
    }

    if (callback) {
      this.socket.off(event, callback);
    } else {
      this.socket.off(event);
    }
  }
}

// Instancia singleton
export const websocketService = new WebSocketService();

// Hook personalizado para React
export const useWebSocket = () => {
  const connect = (config: WebSocketConfig) => websocketService.connect(config);
  const disconnect = () => websocketService.disconnect();
  const isConnected = () => websocketService.isSocketConnected();
  const sendVerification = (data: any) => websocketService.sendTechnicalVerification(data);
  const completeVerification = (data: any) => websocketService.completeTechnicalVerification(data);

  return {
    connect,
    disconnect,
    isConnected,
    sendVerification,
    completeVerification,
    service: websocketService
  };
};

export default websocketService;
