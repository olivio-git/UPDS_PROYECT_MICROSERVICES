// import { authSDK } from '@/services/sdk-simple-auth';
// import axios from 'axios';
// import { io, Socket } from 'socket.io-client';

// export interface SocketEvents {
//   // Eventos de conexión
//   'connect': () => void;
//   'disconnect': (reason: string) => void;
//   'connect_error': (                // 4. Enviar evento de prueba primero (opcional para debug)
//         console.log(`📤 [startIndividualExam] Enviando evento de prueba...`);
//         this.emit('test-event', { 
//           message: 'prueba desde startIndividualExam', 
//           timestamp: new Date().toISOString(),
//           sessionId,
//           candidateId 
//         });
        
//         // 5. Emitir el evento principal
//         console.log(`📤 [startIndividualExam] Enviando 'start-individual-exam'...`);
//         console.log(`� [startIndividualExam] Estado del socket justo antes del emit:`, {
//           connected: this.socket.connected,
//           id: this.socket.id,
//           transport: this.socket.io.engine?.transport?.name
//         });
        
//         const emitResult = this.emit('start-individual-exam', { sessionId, candidateId });
//         console.log(`📤 [startIndividualExam] Resultado del emit:`, emitResult);r: Error) => void;

//   // Eventos de sesión (sin lobby - directo)
//   'session-started': (data: { sessionId: string; status: string; timestamp: string }) => void;
//   'session-ended': (data: { sessionId: string; status: string; timestamp: string }) => void;
//   'session-status-changed': (data: { sessionId: string; status: string; timestamp: string }) => void;
//   'participant-joined': (data: any) => void;
//   'participant-left': (data: any) => void;

//   // Eventos de examen
//   'session-joined': (data: any) => void;
//   'session-error': (data: { message: string }) => void;
//   'exam-started': (data: { sessionId: string; status: string; timestamp: string }) => void;
//   'question-data': (data: any) => void;
//   'answer-received': (data: any) => void;
//   'answer-error': (data: { message: string }) => void;
//   'exam-finished': (data: any) => void;
//   'time-warning': (data: { minutes: number }) => void;
//   'proctor-message': (data: { message: string; from: string }) => void;
// }

// export type SocketEventName = keyof SocketEvents;

// class SocketService {
//   private socket: Socket | null = null;
//   private reconnectAttempts = 0;
//   private maxReconnectAttempts = 5;
//   private reconnectDelay = 1000;
//   private isConnecting = false;
//   private eventListeners = new Map<string, Function[]>();

//   /**
//    * Conectar al servidor WebSocket
//    */
//   async connect(___?: string): Promise<boolean> {
//     if (this.isConnecting || this.socket?.connected) {
//       return true;
//     }

//     this.isConnecting = true;

//     try {
//       const authToken = authSDK.getAccessToken();

//       if (!authToken) {
//         throw new Error('Token de autenticación requerido');
//       }

//       const serverUrl = import.meta.env.VITE_SESSION_MANAGER_URL || 'http://localhost:3004';

//       this.socket = io(serverUrl, {
//         auth: {
//           token: authToken
//         },
//         transports: ['websocket', 'polling'],
//         timeout: 20000,
//         retries: 3,
//         reconnection: true,
//         reconnectionAttempts: this.maxReconnectAttempts,
//         reconnectionDelay: this.reconnectDelay
//       });

//       // Configurar event listeners básicos
//       this.setupBasicEventListeners();

//       // Esperar conexión exitosa
//       return new Promise((resolve, reject) => {
//         const timeoutId = setTimeout(() => {
//           reject(new Error('Tiempo de conexión agotado'));
//         }, 10000);

//         this.socket!.on('connect', () => {
//           clearTimeout(timeoutId);
//           this.isConnecting = false;
//           this.reconnectAttempts = 0;
//           console.log('🔌 Conectado al servidor WebSocket');
//           resolve(true);
//         });

//         this.socket!.on('connect_error', (error) => {
//           clearTimeout(timeoutId);
//           this.isConnecting = false;
//           console.error('❌ Error conectando al WebSocket:', error);
//           reject(error);
//         });
//       });
//     } catch (error) {
//       this.isConnecting = false;
//       console.error('❌ Error iniciando conexión WebSocket:', error);
//       throw error;
//     }
//   }

//   /**
//    * Desconectar del servidor
//    */
//   disconnect(): void {
//     if (this.socket) {
//       this.socket.disconnect();
//       this.socket = null;
//       this.eventListeners.clear();
//       console.log('🔌 Desconectado del servidor WebSocket');
//     }
//   }

//   /**
//    * Verificar si está conectado
//    */
//   isConnected(): boolean {
//     return this.socket?.connected || false;
//   }

//   /**
//    * Emitir evento al servidor
//    */
//   emit<T = any>(event: string, data?: T): boolean {
//     if (!this.socket?.connected) {
//       console.warn('⚠️ Socket no conectado, no se puede emitir evento:', event);
//       return false;
//     }

//     this.socket.emit(event, data);
//     return true;
//   }

//   /**
//    * Escuchar evento del servidor
//    */
//   on<K extends SocketEventName>(event: K, callback: SocketEvents[K]): void {
//     if (!this.socket) {
//       console.warn('⚠️ Socket no inicializado, no se puede agregar listener:', event);
//       return;
//     }

//     this.socket.on(event, callback as any);

//     // Guardar referencia para cleanup
//     if (!this.eventListeners.has(event)) {
//       this.eventListeners.set(event, []);
//     }
//     this.eventListeners.get(event)!.push(callback);
//   }

//   /**
//    * Dejar de escuchar evento
//    */
//   off<K extends SocketEventName>(event: K, callback?: SocketEvents[K]): void {
//     if (!this.socket) return;

//     if (callback) {
//       this.socket.off(event, callback as any);

//       // Remover de la lista de listeners
//       const listeners = this.eventListeners.get(event) || [];
//       const index = listeners.indexOf(callback);
//       if (index > -1) {
//         listeners.splice(index, 1);
//       }
//     } else {
//       this.socket.off(event);
//       this.eventListeners.delete(event);
//     }
//   }

//   /**
//    * Escuchar evento una sola vez
//    */
//   once<K extends SocketEventName>(event: K, callback: SocketEvents[K]): void {
//     if (!this.socket) {
//       console.warn('⚠️ Socket no inicializado, no se puede agregar listener once:', event);
//       return;
//     }

//     this.socket.once(event, callback as any);
//   }

//   // ❌ LOBBY ELIMINADO - Métodos de acceso directo a sesión

//   // Métodos específicos para Examen

//   /**
//    * Obtener candidate ID del usuario actual
//    */
//   private async getCandidateId(): Promise<string | null> {
//     try {
//       const currentUser = authSDK.getCurrentUser();
//       const token = authSDK.getAccessToken();
      
//       console.log('🔍 Obteniendo candidateId para usuario:', currentUser?.id);
//       console.log('🔍 URL:', `${import.meta.env.VITE_USER_MANAGEMENT_URL}/api/v1/candidates/by-auth-user/${currentUser?.id}`);
      
//       if (!currentUser?.id) {
//         throw new Error('No hay usuario autenticado');
//       }
      
//       if (!token) {
//         throw new Error('No hay token de autenticación');
//       }
      
//       const response = await axios.get(
//         `${import.meta.env.VITE_USER_MANAGEMENT_URL}/api/v1/candidates/by-auth-user/${currentUser.id}`,
//         {
//           headers: {
//             'Content-Type': 'application/json',
//             'Authorization': `Bearer ${token}`
//           }
//         }
//       );
      
//       console.log('✅ Respuesta candidateId:', response.data);
      
//       const candidateId = response.data.data._id;
//       if (!candidateId) {
//         throw new Error('Candidate ID no encontrado en la respuesta');
//       }
      
//       return candidateId;
//     } catch (error) {
//       console.error('❌ Error obteniendo ID de candidato:', error);
//       if (axios.isAxiosError(error)) {
//         console.error('❌ Axios error details:', {
//           status: error.response?.status,
//           data: error.response?.data,
//           message: error.message
//         });
//       }
//       return null;
//     }
//   }

//   /**
//    * Iniciar examen individual (marca como iniciado)
//    */
//   async startIndividualExam(sessionId: string): Promise<void> {
//   // La promesa ya maneja el éxito/error a través de los listeners de respuesta
//   return new Promise(async (resolve, reject) => {
    
//     const timeout = setTimeout(() => {
//       cleanup();
//       reject(new Error('Tiempo agotado esperando respuesta del servidor para iniciar examen'));
//     }, 20000);

//     // Define las funciones callback para poder referenciarlas específicamente
//     let examStartedCallback: (data: any) => void;
//     let sessionErrorCallback: (error: any) => void;

//     const cleanup = () => {
//       if (timeout) clearTimeout(timeout);
//       if (examStartedCallback) this.off('exam-started', examStartedCallback);
//       if (sessionErrorCallback) this.off('session-error', sessionErrorCallback);
//     };

//     // Define los callbacks específicos
//     examStartedCallback = (data: any) => {
//       console.log('✅ [socketService] exam-started recibido:', data);
//       cleanup();
//       resolve();
//     };

//     sessionErrorCallback = (error: any) => {
//       console.error('❌ [socketService] session-error recibido:', error);
//       cleanup();
//       reject(new Error(error.message || 'Error iniciando examen individual'));
//     };

//     // Registrar listeners ANTES de emitir
//     this.on('exam-started', examStartedCallback);
//     this.on('session-error', sessionErrorCallback);

//     try {
//       // 1. Obtener el ID del candidato
//       const candidateId = await this.getCandidateId();
//       if (!candidateId) {
//         cleanup();
//         reject(new Error('No se pudo obtener el ID del candidato para iniciar el examen.'));
//         return;
//       }

//       // 2. Emitir el evento (si todo lo anterior fue exitoso)
//       console.log(`� [startIndividualExam] Preparando emisión del evento...`);
//       console.log(`🔍 [startIndividualExam] Socket conectado:`, this.socket?.connected);
//       console.log(`🔍 [startIndividualExam] Socket ID:`, this.socket?.id);
//       console.log(`🔍 [startIndividualExam] Payload:`, { sessionId, candidateId });
      
//       // Verificar conexión antes de emitir
//       if (!this.socket?.connected) {
//         cleanup();
//         console.error('❌ [startIndividualExam] Socket no conectado al momento de emitir');
//         reject(new Error('Socket no conectado al momento de enviar evento'));
//         return;
//       }
      
//       // Enviar evento de prueba primero
//       console.log(`📤 [startIndividualExam] Enviando evento de prueba...`);
//       this.emit('test-event', { message: 'prueba desde frontend', timestamp: new Date().toISOString() });
      
//       // Emitir el evento principal
//       console.log(`📤 [startIndividualExam] Enviando 'start-individual-exam'...`);
//       const emitResult = this.emit('start-individual-exam', { sessionId, candidateId });
//       console.log(`📤 [startIndividualExam] Resultado del emit:`, emitResult);
      
//       if (!emitResult) {
//         cleanup();
//         console.error('❌ [startIndividualExam] Emit retornó false');
//         reject(new Error('No se pudo enviar el evento al servidor'));
//         return;
//       }

//       console.log(`✅ [startIndividualExam] Evento enviado, esperando respuesta...`);

//     } catch (error) {
//       cleanup();
//       console.error('❌ [startIndividualExam] Error crítico al intentar iniciar el examen:', error);
//       reject(new Error('Error obteniendo la información del candidato.'));
//     }
//   });
// }

//   /**
//    * Unirse directamente a sesión de examen (sin lobby)
//    */
//   async joinExamSession(sessionId: string, role: 'student' | 'proctor' = 'student'): Promise<void> {
//     return new Promise((resolve, reject) => {
//       // Usar el evento correcto que coincide con el backend
//       if (!this.emit('join-exam-session', { sessionId, role })) {
//         reject(new Error('No se pudo enviar solicitud de unirse a la sesión'));
//         return;
//       }

//       const timeout = setTimeout(() => {
//         reject(new Error('Tiempo agotado esperando respuesta de la sesión'));
//       }, 10000);

//       this.once('session-joined', () => {
//         clearTimeout(timeout);
//         console.log('✅ Unido a sesión de examen:', sessionId);
//         resolve();
//       });

//       this.once('session-error', (error) => {
//         clearTimeout(timeout);
//         reject(new Error(error.message));
//       });
//     });
//   }

//   /**
//    * Enviar respuesta de pregunta
//    */
//   submitAnswer(sessionId: string, questionId: string, answer: any): void {
//     this.emit('submit-answer', {
//       sessionId,
//       questionId,
//       answer
//     });
//   }

//   /**
//    * Solicitar siguiente pregunta
//    */
//   requestNextQuestion(sessionId: string): void {
//     this.emit('next-question', { sessionId });
//   }

//   /**
//    * Finalizar examen
//    */
//   finishExam(sessionId: string): void {
//     this.emit('finish-exam', { sessionId });
//   }

//   /**
//    * Habilitar monitoreo (proctors)
//    */
//   enableMonitoring(sessionId: string): void {
//     this.emit('monitor-session', { sessionId });
//   }

//   // Métodos privados

//   private setupBasicEventListeners(): void {
//     if (!this.socket) return;

//     this.socket.on('connect', () => {
//       console.log('🔌 Conectado al servidor WebSocket');
//       toast.success('Conectado al servidor');
//     });

//     this.socket.on('disconnect', (reason) => {
//       console.log('🔌 Desconectado del servidor WebSocket:', reason);
//       if (reason !== 'io client disconnect') {
//         toast.error('Conexión perdida con el servidor');
//         this.handleReconnection();
//       }
//     });

//     this.socket.on('connect_error', (error) => {
//       console.error('❌ Error de conexión WebSocket:', error);
//       toast.error('Error de conexión con el servidor');
//     });

//     this.socket.on('session-error', (error) => {
//       console.error('❌ Error de sesión:', error);
//       toast.error(`Error de sesión: ${error.message}`);
//     });

//     // Mantener conexión activa con ping/pong
//     this.socket.on('pong', () => {
//       // Respuesta del servidor al ping
//     });

//     // Enviar ping cada 30 segundos
//     setInterval(() => {
//       if (this.socket?.connected) {
//         this.socket.emit('ping!!!!!!');
//       }
//     }, 30000);
//   }

//   private async handleReconnection(): Promise<void> {
//     if (this.reconnectAttempts >= this.maxReconnectAttempts) {
//       console.error('❌ Máximo número de intentos de reconexión alcanzado');
//       toast.error('No se pudo reconectar al servidor');
//       return;
//     }

//     this.reconnectAttempts++;
//     const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

//     console.log(`🔄 Intentando reconexión ${this.reconnectAttempts}/${this.maxReconnectAttempts} en ${delay}ms`);

//     setTimeout(async () => {
//       try {
//         await this.connect();
//         toast.success('Reconectado al servidor');
//       } catch (error) {
//         console.error('❌ Fallo en reconexión:', error);
//         this.handleReconnection();
//       }
//     }, delay);
//   }

//   /**
//    * Limpiar todos los event listeners
//    */
//   cleanup(): void {
//     this.eventListeners.forEach((listeners, event) => {
//       listeners.forEach(callback => {
//         this.socket?.off(event, callback as any);
//       });
//     });
//     this.eventListeners.clear();
//   }

//   /**
//    * Obtener información de conexión
//    */
//   getConnectionInfo() {
//     return {
//       connected: this.isConnected(),
//       socketId: this.socket?.id || null,
//       reconnectAttempts: this.reconnectAttempts,
//       transport: this.socket?.io.engine.transport.name || null
//     };
//   }
// }

// // Instancia singleton - SOLO UNA INSTANCIA PERMITIDA
// const socketService = new SocketService();

// // Función de utilidad para conectar automáticamente
// export const connectSocket = async (token?: string): Promise<boolean> => {
//   try {
//     return await socketService.connect(token);
//   } catch (error) {
//     console.error('❌ Error conectando socket:', error);
//     return false;
//   }
// };

// // Función de utilidad para desconectar
// export const disconnectSocket = (): void => {
//   socketService.disconnect();
// };

// // Hook personalizado para React (si se usa)
// // Hook que usa la misma instancia singleton
// export const useSocket = () => {
//   return {
//     socket: socketService,
//     isConnected: socketService.isConnected(),
//     connect: socketService.connect.bind(socketService),
//     disconnect: socketService.disconnect.bind(socketService),
//     emit: socketService.emit.bind(socketService),
//     on: socketService.on.bind(socketService),
//     off: socketService.off.bind(socketService),
//     once: socketService.once.bind(socketService),
//     startIndividualExam: socketService.startIndividualExam.bind(socketService),
//     joinExamSession: socketService.joinExamSession.bind(socketService)
//   };
// };

// export default socketService;
