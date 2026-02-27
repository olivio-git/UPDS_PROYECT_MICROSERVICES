// // ARCHIVO ELIMINADO - No necesario
// // La lógica de reconexión se maneja directamente en socketService-new.ts
// // y en ExamPreparation.tsx del módulo student

// export interface ExamState {
//   sessionId: string;
//   candidateId: string;
//   status: string;
//   startTime: Date;
//   expiresAt: Date;
//   timeAllowed: number;
//   lastActivity: Date;
// }

// export interface ReconnectionData {
//   sessionId: string;
//   status: 'reconnected' | 'started';
//   examState?: ExamState;
//   timeRemaining?: number;
//   currentQuestion?: any;
//   answeredQuestions?: any[];
//   progress?: { current: number; total: number };
//   isNewExam?: boolean;
//   timestamp: string;
// }

// export class ExamConnectionManager {
//   private socket: Socket | null = null;
//   private reconnectAttempts: number = 0;
//   private maxReconnectAttempts: number = 5;
//   private reconnectDelay: number = 2000; // Empieza con 2 segundos
//   private isConnecting: boolean = false;
//   private examState: ExamState | null = null;
//   private apiBaseUrl: string;
//   private authToken: string;
  
//   // Event handlers
//   private onExamReconnectedHandler?: (data: ReconnectionData) => void;
//   private onExamStartedHandler?: (data: ReconnectionData) => void;
//   private onConnectionErrorHandler?: (error: string) => void;
//   private onTimeUpdateHandler?: (timeRemaining: number) => void;

//   constructor(apiBaseUrl: string, authToken: string) {
//     this.apiBaseUrl = apiBaseUrl;
//     this.authToken = authToken;
//   }

//   /**
//    * Configurar event handlers
//    */
//   setEventHandlers(handlers: {
//     onExamReconnected?: (data: ReconnectionData) => void;
//     onExamStarted?: (data: ReconnectionData) => void;
//     onConnectionError?: (error: string) => void;
//     onTimeUpdate?: (timeRemaining: number) => void;
//   }) {
//     this.onExamReconnectedHandler = handlers.onExamReconnected;
//     this.onExamStartedHandler = handlers.onExamStarted;
//     this.onConnectionErrorHandler = handlers.onConnectionError;
//     this.onTimeUpdateHandler = handlers.onTimeUpdate;
//   }

//   /**
//    * Iniciar conexión al examen - CON LÓGICA DE RECONEXIÓN INTELIGENTE
//    */
//   async startExamConnection(sessionId: string, candidateId: string, forceRestart = false): Promise<void> {
//     if (this.isConnecting) {
//       console.log('🔄 Ya hay una conexión en progreso...');
//       return;
//     }

//     this.isConnecting = true;
    
//     try {
//       console.log(`🚀 [ExamConnectionManager] Iniciando conexión inteligente...`);
//       console.log(`📋 [ExamConnectionManager] sessionId: ${sessionId}, candidateId: ${candidateId}, forceRestart: ${forceRestart}`);

//       // 1. Crear conexión socket
//       await this.createSocketConnection();

//       // 2. Configurar event listeners
//       this.setupSocketEventListeners();

//       // 3. Intentar iniciar examen (el backend manejará reconexión vs nuevo inicio)
//       console.log(`📤 [ExamConnectionManager] Enviando evento startIndividualExam...`);
//       this.socket?.emit('startIndividualExam', {
//         sessionId,
//         candidateId,
//         forceRestart
//       });

//       this.isConnecting = false;

//     } catch (error) {
//       console.error('❌ Error iniciando conexión al examen:', error);
//       this.isConnecting = false;
//       this.onConnectionErrorHandler?.(error instanceof Error ? error.message : 'Error de conexión');
//       throw error;
//     }
//   }

//   /**
//    * Crear conexión socket con autenticación
//    */
//   private async createSocketConnection(): Promise<void> {
//     if (this.socket?.connected) {
//       console.log('✅ Socket ya conectado');
//       return;
//     }

//     return new Promise((resolve, reject) => {
//       console.log(`🔌 [ExamConnectionManager] Creando conexión socket...`);
      
//       this.socket = io(`${this.apiBaseUrl}/sessions`, {
//         auth: {
//           token: this.authToken
//         },
//         transports: ['websocket', 'polling'],
//         timeout: 10000,
//         forceNew: true
//       });

//       this.socket.on('connect', () => {
//         console.log('✅ Socket conectado exitosamente');
//         this.reconnectAttempts = 0;
//         resolve();
//       });

//       this.socket.on('connect_error', (error) => {
//         console.error('❌ Error de conexión socket:', error);
//         reject(error);
//       });

//       // Manejar desconexiones automáticamente
//       this.socket.on('disconnect', (reason) => {
//         console.log(`🔌 Socket desconectado: ${reason}`);
//         if (reason !== 'io client disconnect') {
//           this.handleAutoReconnect();
//         }
//       });
//     });
//   }

//   /**
//    * Configurar listeners para eventos de examen
//    */
//   private setupSocketEventListeners(): void {
//     if (!this.socket) return;

//     // ✅ EVENTO: Examen reconectado exitosamente
//     this.socket.on('exam-reconnected', (data: ReconnectionData) => {
//       console.log('🔄 ¡Reconectado al examen exitosamente!', data);
//       this.examState = data.examState || null;
      
//       if (data.timeRemaining) {
//         this.startTimeCountdown(data.timeRemaining);
//       }
      
//       this.onExamReconnectedHandler?.(data);
//     });

//     // ✅ EVENTO: Nuevo examen iniciado
//     this.socket.on('exam-started', (data: ReconnectionData) => {
//       console.log('🚀 ¡Nuevo examen iniciado!', data);
      
//       this.onExamStartedHandler?.(data);
//     });

//     // ❌ EVENTO: Error en la sesión
//     this.socket.on('session-error', (error: { message: string; canRetry?: boolean }) => {
//       console.error('❌ Error de sesión:', error);
//       this.onConnectionErrorHandler?.(error.message);
      
//       // Si puede reintentar, ofrecer la opción
//       if (error.canRetry) {
//         setTimeout(() => {
//           console.log('🔄 Reintentando conexión automáticamente...');
//           // El reintento se maneja automáticamente por el handleAutoReconnect
//         }, this.reconnectDelay);
//       }
//     });
//   }

//   /**
//    * Manejar reconexión automática cuando se pierde la conexión
//    */
//   private async handleAutoReconnect(): Promise<void> {
//     if (this.reconnectAttempts >= this.maxReconnectAttempts) {
//       console.error('❌ Máximo número de reintentos alcanzado');
//       this.onConnectionErrorHandler?.('No se pudo reconectar al examen. Por favor, actualiza la página.');
//       return;
//     }

//     this.reconnectAttempts++;
//     const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts), 30000); // Máximo 30 segundos
    
//     console.log(`🔄 Reintento de reconexión ${this.reconnectAttempts}/${this.maxReconnectAttempts} en ${delay}ms...`);
    
//     setTimeout(async () => {
//       try {
//         await this.createSocketConnection();
//         console.log('✅ Reconexión automática exitosa');
        
//         // Si tenemos estado de examen, intentar reconectar a ese examen específico
//         if (this.examState) {
//           this.socket?.emit('startIndividualExam', {
//             sessionId: this.examState.sessionId,
//             candidateId: this.examState.candidateId,
//             forceRestart: false // Siempre intentar reconectar primero
//           });
//         }
        
//       } catch (error) {
//         console.error(`❌ Reintento ${this.reconnectAttempts} falló:`, error);
//         this.handleAutoReconnect(); // Recursivo hasta agotar intentos
//       }
//     }, delay);
//   }

//   /**
//    * Iniciar countdown de tiempo del examen
//    */
//   private startTimeCountdown(initialSeconds: number): void {
//     let timeRemaining = initialSeconds;
    
//     const countdown = setInterval(() => {
//       timeRemaining--;
//       this.onTimeUpdateHandler?.(timeRemaining);
      
//       if (timeRemaining <= 0) {
//         clearInterval(countdown);
//         console.log('⏰ Tiempo de examen agotado');
//       }
//     }, 1000);
//   }

//   /**
//    * Forzar reinicio del examen (eliminar progreso)
//    */
//   async forceRestartExam(): Promise<void> {
//     if (!this.examState) {
//       throw new Error('No hay examen activo para reiniciar');
//     }

//     console.log('🔄 Forzando reinicio del examen...');
//     this.socket?.emit('startIndividualExam', {
//       sessionId: this.examState.sessionId,
//       candidateId: this.examState.candidateId,
//       forceRestart: true
//     });
//   }

//   /**
//    * Desconectar y limpiar recursos
//    */
//   disconnect(): void {
//     console.log('🔌 Desconectando ExamConnectionManager...');
    
//     if (this.socket) {
//       this.socket.disconnect();
//       this.socket = null;
//     }
    
//     this.examState = null;
//     this.reconnectAttempts = 0;
//     this.isConnecting = false;
//   }

//   /**
//    * Obtener estado actual de la conexión
//    */
//   getConnectionState(): {
//     connected: boolean;
//     examState: ExamState | null;
//     reconnectAttempts: number;
//     isConnecting: boolean;
//   } {
//     return {
//       connected: this.socket?.connected || false,
//       examState: this.examState,
//       reconnectAttempts: this.reconnectAttempts,
//       isConnecting: this.isConnecting
//     };
//   }

//   /**
//    * Emitir evento personalizado al backend
//    */
//   emitEvent(eventName: string, data: any): void {
//     this.socket?.emit(eventName, data);
//   }

//   /**
//    * Escuchar evento personalizado del backend
//    */
//   onEvent(eventName: string, handler: (data: any) => void): void {
//     this.socket?.on(eventName, handler);
//   }
// }
