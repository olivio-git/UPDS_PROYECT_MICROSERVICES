import { authSDK } from '@/services/sdk-simple-auth';
import axios from 'axios';
import { io, Socket } from 'socket.io-client';

export interface SocketEvents {
  // Eventos de conexión
  'connect': () => void;
  'disconnect': (reason: string) => void;
  'connect_error': (error: Error) => void;

  // Eventos de sesión (sin lobby - directo)
  'session-started': (data: { 
    sessionId: string; 
    status: string; 
    timestamp: string; 
    sections?: any[]; 
    questions?: any[]; 
    timeRemaining?: number 
  }) => void;
  'session-ended': (data: { sessionId: string; status: string; timestamp: string }) => void;
  'session-status-changed': (data: { sessionId: string; status: string; timestamp: string }) => void;
  'participant-joined': (data: any) => void;
  'participant-left': (data: any) => void;

  // Eventos de examen
  'session-joined': (data: any) => void;
  'session-error': (data: { message: string }) => void;
  'exam-started': (data: { sessionId: string; status: string; timestamp: string; isNewExam?: boolean }) => void;
  'exam-reconnected': (data: { 
    sessionId: string; 
    status: string; 
    examState: any; 
    timeRemaining: number; 
    currentQuestion: any; 
    answeredQuestions: any[]; 
    progress: { current: number; total: number }; 
    timestamp: string 
  }) => void;
  'exam-ended': (data: { sessionId: string; status: string; timestamp: string }) => void;
  'question-updated': (data: any) => void;
  'answer-submitted': (data: any) => void;
  'time-warning': (data: { remainingTime: number }) => void;
  
  
  'test-event': (data: any) => void;
  'olivio-event': (data: any) => void;

  
  'startIndividualExam': (data: { sessionId: string; candidateId: string; forceRestart?: boolean }) => void;
}

export type SocketEventName = keyof SocketEvents;

class SocketService {
  private socket: Socket | null = null;
  private isConnecting = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private eventListeners = new Map<string, Function[]>();

  /**
   * Conectar al servidor WebSocket
   */
  async connect(): Promise<boolean> {
    // Si ya está conectado, no hacer nada
    if (this.socket?.connected) {
      console.log('🔌 Socket ya está conectado, reutilizando conexión existente');
      return true;
    }

    // Si ya está en proceso de conexión, esperar
    if (this.isConnecting) {
      console.log('🔌 Conexión ya en progreso, esperando...');
      return new Promise((resolve) => {
        const checkConnection = setInterval(() => {
          if (!this.isConnecting) {
            clearInterval(checkConnection);
            resolve(this.socket?.connected || false);
          }
        }, 100);
        
        // Timeout de seguridad
        setTimeout(() => {
          clearInterval(checkConnection);
          resolve(false);
        }, 15000);
      });
    }

    this.isConnecting = true;

    try {
      const authToken = authSDK.getAccessToken();

      if (!authToken) {
        this.isConnecting = false;
        throw new Error('Token de autenticación requerido');
      }

      // WebSocket needs base URL without /api/v1
      // Use dedicated WebSocket URL or fallback to gateway base
      const serverUrl = import.meta.env.VITE_SESSION_MANAGER_WS_URL ||
                       import.meta.env.VITE_API_GATEWAY_URL ||
                       'http://localhost:80';

      // Si hay socket previo, limpiarlo completamente
      if (this.socket) {
        console.log('🧹 Limpiando socket anterior...');
        this.socket.removeAllListeners();
        this.socket.disconnect();
        this.socket = null;
      }

      console.log(`🔌 Conectando a ${serverUrl}...`);

      this.socket = io(serverUrl, {
        auth: {
          token: authToken
        },
        transports: ['websocket', 'polling'],
        timeout: 20000,
        retries: 3,
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: this.reconnectDelay,
        forceNew: true // Forzar nueva conexión siempre
      });

      this.socket!.on('connect', () => {
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        console.log('✅ Conectado al servidor WebSocket con ID:', this.socket!.id);
      });

      this.socket!.on('connect_error', (error) => {
        this.isConnecting = false;
        this.reconnectAttempts++;
        console.error(`❌ Error conectando al WebSocket (intento ${this.reconnectAttempts}):`, error);
      });

      this.socket!.on('disconnect', (reason) => {
        console.log(`🔌 Desconectado del servidor WebSocket: ${reason}`);
        
        // Auto-reconectar solo si no fue desconexión manual
        if (reason !== 'io client disconnect' && reason !== 'transport close') {
          console.log('🔄 Intentando reconectar automáticamente...');
        }
      });

      // Agregar listener para reconexión exitosa
      this.socket!.on('reconnect', () => {
        console.log('🔄 Reconectado exitosamente al servidor WebSocket');
        this.reconnectAttempts = 0;
      });

      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          this.isConnecting = false;
          console.error('⏰ Timeout conectando al WebSocket');
          resolve(false);
        }, 15000);

        this.socket!.once('connect', () => {
          clearTimeout(timeout);
          console.log('🎉 Conexión WebSocket establecida exitosamente');
          resolve(true);
        });

        this.socket!.once('connect_error', () => {
          clearTimeout(timeout);
          console.error('💥 Error estableciendo conexión WebSocket');
          resolve(false);
        });
      });

    } catch (error) {
      this.isConnecting = false;
      console.error('❌ Error iniciando conexión WebSocket:', error);
      throw error;
    }
  }

  /**
   * Desconectar del servidor
   */
  disconnect(): void {
    if (this.socket) {
      console.log('🔌 Desconectando del servidor WebSocket...');
      
      // Limpiar todos los listeners
      this.socket.removeAllListeners();
      
      // Desconectar
      this.socket.disconnect();
      this.socket = null;
      
      // Limpiar estado interno
      this.eventListeners.clear();
      this.reconnectAttempts = 0;
      this.isConnecting = false;
      
      console.log('✅ Desconectado del servidor WebSocket');
    }
  }

  /**
   * Verificar si está conectado
   */
  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  /**
   * NUEVO: Asegurar conexión activa (reconectar si es necesario)
   */
  async ensureConnection(): Promise<boolean> {
    if (this.isConnected()) {
      console.log('✅ Conexión ya activa');
      return true;
    }

    console.log('🔄 Conexión perdida, intentando reconectar...');
    return await this.connect();
  }

  /**
   * Emitir evento al servidor
   */
  emit<T = any>(event: string, data?: T): boolean {
    if (!this.socket?.connected) {
      console.warn(`⚠️ Socket no conectado, no se puede emitir evento: ${event}`);
      return false;
    }

    try {
      console.log(`📤 [emit] Enviando "${event}"`);
      this.socket.emit(event, data);
      console.log(`✅ [emit] "${event}" enviado correctamente`);
      return true;
    } catch (error) {
      console.error(`❌ [emit] Error enviando evento "${event}":`, error);
      return false;
    }
  }

  /**
   * Escuchar evento del servidor
   */
  on<K extends SocketEventName>(event: K, callback: SocketEvents[K]): void {
    if (!this.socket) {
      console.warn('⚠️ Socket no inicializado, no se puede agregar listener:', event);
      return;
    }

    this.socket.on(event, callback as any);

    // Guardar referencia para cleanup
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  /**
   * Dejar de escuchar evento
   */
  off<K extends SocketEventName>(event: K, callback?: SocketEvents[K]): void {
    if (!this.socket) return;

    if (callback) {
      this.socket.off(event, callback as any);

      // Remover de la lista de listeners
      const listeners = this.eventListeners.get(event) || [];
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    } else {
      this.socket.off(event);
      this.eventListeners.delete(event);
    }
  }

  /**
   * Escuchar evento una sola vez
   */
  once<K extends SocketEventName>(event: K, callback: SocketEvents[K]): void {
    if (!this.socket) {
      console.warn('⚠️ Socket no inicializado, no se puede agregar listener once:', event);
      return;
    }

    this.socket.once(event, callback as any);
  }

  /**
   * Obtener candidate ID del usuario actual
   */
  private async getCandidateId(): Promise<string | null> {
    try {
      const currentUser = authSDK.getCurrentUser();
      const token = authSDK.getAccessToken();
      
      console.log('🔍 Obteniendo candidateId para usuario:', currentUser?.id);
      
      if (!currentUser?.id) {
        throw new Error('No hay usuario autenticado');
      }
      
      if (!token) {
        throw new Error('No hay token de autenticación');
      }
      
      const response = await axios.get(
        `${import.meta.env.VITE_USER_MANAGEMENT_URL}/api/v1/candidates/by-auth-user/${currentUser.id}`,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      console.log('✅ Respuesta candidateId:', response.data);
      
      const candidateId = response.data.data._id;
      if (!candidateId) {
        throw new Error('Candidate ID no encontrado en la respuesta');
      }
      
      return candidateId;
    } catch (error) {
      console.error('❌ Error obteniendo ID de candidato:', error);
      return null;
    }
  }

  /**
   * Función de testing - enviar eventos de prueba individualmente
   */
  async testEvents(sessionId: string, candidateId: string): Promise<void> {
    if (!this.socket?.connected) {
      console.error('❌ Socket no conectado para testing');
      return;
    }

    console.log('🧪 Iniciando test de eventos individuales...');
    
    // Test 1: test-event
    console.log('📤 Test 1: Enviando test-event...');
    this.emit('test-event', {
      message: 'TEST EVENTO INDIVIDUAL',
      timestamp: new Date().toISOString(),
      sessionId,
      candidateId
    });
    
    // Esperar entre eventos
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Test 2: olivio-event  
    console.log('📤 Test 2: Enviando olivio-event...');
    this.emit('olivio-event', {
      message: 'OLIVIO EVENTO INDIVIDUAL', 
      timestamp: new Date().toISOString(),
      sessionId,
      candidateId
    });
    
    // Esperar entre eventos
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Test 3: startIndividualExam
    console.log('📤 Test 3: Enviando startIndividualExam...');
    this.emit('startIndividualExam', { sessionId, candidateId });
    
    console.log('✅ Todos los eventos de testing enviados individualmente');
  }

  /**
   * Iniciar examen individual (marca como iniciado)
   */
  async startIndividualExam(sessionId: string): Promise<void> {
    // console.log(`🚀 [startIndividualExam] Iniciando examen para sesión: ${sessionId}`);
    
    // DIAGNÓSTICO INICIAL
    // this.diagnose();
    
    // IMPORTANTE: Limpiar listeners previos para evitar duplicados
    // console.log('🧹 [startIndividualExam] Limpiando listeners previos...');
    // this.off('exam-started');
    // this.off('exam-reconnected');
    // this.off('session-error');
    
    return new Promise(async (resolve, reject) => {
      
      // Define las funciones callback para poder referenciarlas específicamente
      let examStartedCallback: (data: any) => void;
      let examReconnectedCallback: (data: any) => void;
      let sessionErrorCallback: (error: any) => void;
      let timeoutHandle: ReturnType<typeof setTimeout>;
      let isResolved = false; // Flag para evitar resoluciones múltiples

      const cleanup = () => {
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
        }
        if (examStartedCallback) this.off('exam-started', examStartedCallback);
        if (examReconnectedCallback) this.off('exam-reconnected', examReconnectedCallback);
        if (sessionErrorCallback) this.off('session-error', sessionErrorCallback);
      };

      const safeResolve = () => {
        if (!isResolved) {
          console.log('✅ [startIndividualExam] Resolviendo promise exitosamente');
          isResolved = true;
          cleanup();
          resolve();
        } else {
          console.warn('⚠️ [startIndividualExam] Intento de resolver promise ya resuelta');
        }
      };

      const safeReject = (error: Error) => {
        if (!isResolved) {
          console.error('❌ [startIndividualExam] Rechazando promise con error:', error.message);
          isResolved = true;
          cleanup();
          reject(error);
        } else {
          console.warn('⚠️ [startIndividualExam] Intento de rechazar promise ya resuelta');
        }
      };

      // Timeout más largo y con mejor logging
      timeoutHandle = setTimeout(() => {
        console.error('⏰ [startIndividualExam] TIMEOUT después de 25 segundos');
        console.error('📊 [startIndividualExam] Estado final del socket:', this.diagnose());
        safeReject(new Error('Tiempo agotado esperando respuesta del servidor para iniciar examen (25s)'));
      }, 25000); // Aumentado a 25 segundos

      // Define los callbacks específicos
      examStartedCallback = (data: any) => {
        console.log('✅ [socketService] exam-started recibido:', data);
        console.log('🆕 [socketService] Nuevo examen iniciado exitosamente');
        safeResolve();
      };

      // NUEVO: Callback para reconexión exitosa
      examReconnectedCallback = (data: any) => {
        console.log('🔄 [socketService] exam-reconnected recibido:', data);
        console.log('📊 [socketService] Estado del examen restaurado:', data.examState);
        console.log('⏰ [socketService] Tiempo restante:', data.timeRemaining, 'segundos');
        console.log('📈 [socketService] Progreso restaurado:', data.progress);
        console.log('✅ [socketService] Reconexión exitosa - continuando examen');
        safeResolve();
      };

      sessionErrorCallback = (error: any) => {
        console.error('❌ [socketService] session-error recibido:', error);
        safeReject(new Error(error.message || 'Error iniciando examen individual'));
      };

      try {
        // 0. Asegurar conexión activa
        // console.log('🔌 [startIndividualExam] Asegurando conexión activa...');
        // const connected = await this.ensureConnection();
        // if (!connected) {
        //   safeReject(new Error('No se pudo establecer conexión con el servidor'));
        //   return;
        // }
        // console.log('✅ [startIndividualExam] Conexión asegurada');

        // // 1. Obtener el ID del candidato
        // console.log('👤 [startIndividualExam] Obteniendo ID del candidato...');
        const candidateId = await this.getCandidateId();
        if (!candidateId) {
          safeReject(new Error('No se pudo obtener el ID del candidato para iniciar el examen'));
          return;
        }

        // 2. Verificar conexión una vez más (crucial)
        if (!this.socket?.connected) {
          console.error('❌ [startIndividualExam] Socket se desconectó inesperadamente antes de enviar evento');
          safeReject(new Error('Socket se desconectó antes de enviar el evento'));
          return;
        } 
        const result = this.emit('startIndividualExam', { sessionId, candidateId, forceRestart: false });
        
        if (!result) {
          safeReject(new Error('Error enviando evento startIndividualExam - emit() devolvió false'));
          return;
        } 
      } catch (error) {
        console.error('💥 [startIndividualExam] Error crítico al intentar iniciar el examen:', error);
        safeReject(new Error(error instanceof Error ? error.message : 'Error desconocido al iniciar examen'));
      }
    });
  }

  /**
   * Test de conectividad bidireccional con diagnósticos específicos
   */
  async testConnection(): Promise<boolean> {
    return new Promise((resolve) => {
      console.log(`🧪 [TEST] Iniciando test de conectividad...`);
      
      if (!this.socket) {
        console.log(`❌ [TEST] Socket no disponible`);
        resolve(false);
        return;
      }

      console.log(`🧪 [TEST] Estado del socket:`, {
        connected: this.socket.connected,
        id: this.socket.id,
        transport: this.socket.io.engine.transport.name,
        rooms: Array.from((this.socket as any).rooms || [])
      });

      // Timeout para el test
      const timeout = setTimeout(() => {
        console.log(`⏰ [TEST] Timeout del test de conectividad`);
        resolve(false);
      }, 5000);

      // Listener para el pong
      this.socket.once('diagnostic-pong', (data) => {
        console.log(`✅ [TEST] Pong recibido:`, data);
        clearTimeout(timeout);
        resolve(true);
      });

      // Enviar ping
      const pingData = {
        timestamp: new Date().toISOString(),
        testId: Math.random().toString(36).substr(2, 9)
      };
      
      console.log(`🏓 [TEST] Enviando ping:`, pingData);
      this.socket.emit('diagnostic-ping', pingData);
    });
  }

  /**
   * NUEVO: Diagnóstico de estado del socket
   */
  diagnose(): { 
    connected: boolean; 
    connecting: boolean; 
    socketId?: string; 
    transport?: string; 
    listeners: string[];
  } {
    const activeListeners = Array.from(this.eventListeners.keys());
    
    const diagnosis = {
      connected: this.isConnected(),
      connecting: this.isConnecting,
      socketId: this.socket?.id,
      transport: this.socket?.io?.engine?.transport?.name,
      listeners: activeListeners
    };

    console.log('🔍 [SocketService] Diagnóstico actual:', diagnosis);
    return diagnosis;
  }

  /**
   * Obtener información de la conexión
   */
  getConnectionInfo() {
    return {
      connected: this.isConnected(),
      socketId: this.socket?.id,
      reconnectAttempts: this.reconnectAttempts,
      transport: this.socket?.io?.engine?.transport?.name
    };
  }

  /**
   * NUEVO: Forzar reinicio del examen (eliminar progreso)
   */
  async forceRestartExam(sessionId: string): Promise<void> {
    console.log("🔄 [forceRestartExam] Forzando reinicio del examen...");
    
    return new Promise(async (resolve, reject) => {
      
      let examStartedCallback: (data: any) => void;
      let sessionErrorCallback: (error: any) => void;
      let timeoutHandle: ReturnType<typeof setTimeout>;

      const cleanup = () => {
        if (timeoutHandle) clearTimeout(timeoutHandle);
        if (examStartedCallback) this.off('exam-started', examStartedCallback);
        if (sessionErrorCallback) this.off('session-error', sessionErrorCallback);
      };

      timeoutHandle = setTimeout(() => {
        cleanup();
        reject(new Error('Tiempo agotado esperando respuesta del servidor para reiniciar examen'));
      }, 20000);

      // Define los callbacks específicos
      examStartedCallback = (data: any) => {
        console.log('✅ [forceRestartExam] exam-started recibido:', data);
        cleanup();
        resolve();
      };

      sessionErrorCallback = (error: any) => {
        console.error('❌ [forceRestartExam] session-error recibido:', error);
        cleanup();
        reject(new Error(error.message || 'Error reiniciando examen'));
      };

      // Registrar listeners ANTES de emitir
      this.on('exam-started', examStartedCallback);
      this.on('session-error', sessionErrorCallback);

      try {
        // 1. Obtener el ID del candidato
        const candidateId = await this.getCandidateId();
        if (!candidateId) {
          cleanup();
          reject(new Error('No se pudo obtener el ID del candidato para reiniciar el examen.'));
          return;
        }

        // 2. Verificar conexión
        if (!this.socket?.connected) {
          cleanup();
          console.error('❌ [forceRestartExam] Socket no conectado al momento de emitir');
          reject(new Error('Socket no conectado al momento de enviar evento'));
          return;
        }

        // 3. Enviar evento con forceRestart=true
        console.log(`📤 [forceRestartExam] Enviando startIndividualExam con forceRestart=true...`);
        const result = this.emit('startIndividualExam', { sessionId, candidateId, forceRestart: true });
        console.log(`📤 [forceRestartExam] Evento enviado con resultado:`, result);

        if (!result) {
          cleanup();
          reject(new Error('Error enviando evento de reinicio'));
          return;
        }

        console.log(`✅ [forceRestartExam] Evento enviado exitosamente, esperando respuesta...`);
         
      } catch (error) {
        cleanup();
        console.error('❌ [forceRestartExam] Error crítico al intentar reiniciar el examen:', error);
        reject(new Error('Error obteniendo la información del candidato.'));
      }
    });
  }

  /**
   * Limpiar todos los listeners
   */
  cleanup(): void {
    if (this.socket) {
      this.eventListeners.forEach((listeners, event) => {
        listeners.forEach(callback => {
          this.socket?.off(event, callback as any);
        });
      });
      this.eventListeners.clear();
    }
  }
}

// Exportar instancia singleton
const socketService = new SocketService();
export default socketService;
