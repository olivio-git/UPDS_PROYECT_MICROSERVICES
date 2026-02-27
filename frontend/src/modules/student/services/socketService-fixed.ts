// import { authSDK } from '@/services/sdk-simple-auth';
// import axios from 'axios';
// import { io, Socket } from 'socket.io-client';

// export interface SocketEvents {
//   // Eventos de conexión
//   'connect': () => void;
//   'disconnect': (reason: string) => void;
//   'connect_error': (error: Error) => void;

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
//   'exam-ended': (data: { sessionId: string; status: string; timestamp: string }) => void;
//   'question-updated': (data: any) => void;
//   'answer-submitted': (data: any) => void;
//   'time-warning': (data: { remainingTime: number }) => void;
//   'test-event': (data: any) => void;
// }

// export type SocketEventName = keyof SocketEvents;

// class SocketService {
//   private socket: Socket | null = null;
//   private serverUrl: string;
//   private isConnecting = false;
//   private reconnectAttempts = 0;
//   private maxReconnectAttempts = 5;
//   private reconnectDelay = 1000;
//   private eventListeners = new Map<string, Function[]>();

//   constructor() {
//     this.serverUrl = import.meta.env.VITE_SESSION_MANAGER_URL || 'http://localhost:3004';
//   }

//   /**
//    * Conectar al servidor WebSocket
//    */
//   async connect(___?: string): Promise<boolean> {
//     // Si ya está conectado, no hacer nada
//     if (this.socket?.connected) {
//       console.log('🔌 Socket ya está conectado, reutilizando conexión existente');
//       return true;
//     }

//     // Si ya está en proceso de conexión, esperar
//     if (this.isConnecting) {
//       console.log('🔌 Conexión ya en progreso, esperando...');
//       return new Promise((resolve) => {
//         const checkConnection = setInterval(() => {
//           if (!this.isConnecting) {
//             clearInterval(checkConnection);
//             resolve(this.socket?.connected || false);
//           }
//         }, 100);
//       });
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
//         reconnectionDelay: this.reconnectDelay,
//         forceNew: true
//       });

//       this.socket!.on('connect', () => {
//         this.isConnecting = false;
//         this.reconnectAttempts = 0;
//         console.log('🔌 Conectado al servidor WebSocket');
//       });

//       this.socket!.on('connect_error', (error) => {
//         this.isConnecting = false;
//         console.error('❌ Error conectando al WebSocket:', error);
//       });

//       this.socket!.on('disconnect', (reason) => {
//         console.log('🔌 Desconectado del servidor WebSocket:', reason);
//       });

//       return new Promise((resolve) => {
//         const timeout = setTimeout(() => {
//           this.isConnecting = false;
//           resolve(false);
//         }, 10000);

//         this.socket!.once('connect', () => {
//           clearTimeout(timeout);
//           resolve(true);
//         });

//         this.socket!.once('connect_error', () => {
//           clearTimeout(timeout);
//           resolve(false);
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
//     return new Promise(async (resolve, reject) => {
      
//       // Define las funciones callback para poder referenciarlas específicamente
//       let examStartedCallback: (data: any) => void;
//       let sessionErrorCallback: (error: any) => void;
//       let timeoutHandle: ReturnType<typeof setTimeout>;

//       const cleanup = () => {
//         if (timeoutHandle) clearTimeout(timeoutHandle);
//         if (examStartedCallback) this.off('exam-started', examStartedCallback);
//         if (sessionErrorCallback) this.off('session-error', sessionErrorCallback);
//       };

//       timeoutHandle = setTimeout(() => {
//         cleanup();
//         reject(new Error('Tiempo agotado esperando respuesta del servidor para iniciar examen'));
//       }, 20000); // 20 segundos de timeout

//       // Define los callbacks específicos
//       examStartedCallback = (data: any) => {
//         console.log('✅ [socketService] exam-started recibido:', data);
//         cleanup();
//         resolve();
//       };

//       sessionErrorCallback = (error: any) => {
//         console.error('❌ [socketService] session-error recibido:', error);
//         cleanup();
//         reject(new Error(error.message || 'Error iniciando examen individual'));
//       };

//       // Registrar listeners ANTES de emitir
//       this.on('exam-started', examStartedCallback);
//       this.on('session-error', sessionErrorCallback);

//       try {
//         // 1. Obtener el ID del candidato
//         const candidateId = await this.getCandidateId();
//         if (!candidateId) {
//           cleanup();
//           reject(new Error('No se pudo obtener el ID del candidato para iniciar el examen.'));
//           return;
//         }

//         // 2. Verificar conexión
//         if (!this.socket?.connected) {
//           cleanup();
//           console.error('❌ [startIndividualExam] Socket no conectado al momento de emitir');
//           reject(new Error('Socket no conectado al momento de enviar evento'));
//           return;
//         }

//         // 3. Log de información de debug
//         console.log(`🚀 [startIndividualExam] Preparando emisión del evento...`);
//         console.log(`🔍 [startIndividualExam] Socket conectado:`, this.socket.connected);
//         console.log(`🔍 [startIndividualExam] Socket ID:`, this.socket.id);
//         console.log(`🔍 [startIndividualExam] Payload:`, { sessionId, candidateId });
        
//         // 4. Enviar evento de prueba primero (opcional para debug)
//         console.log(`📤 [startIndividualExam] Enviando evento de prueba...`);
//         this.emit('test-event', { 
//           message: 'prueba desde startIndividualExamsss', 
//           timestamp: new Date().toISOString(),
//           sessionId,
//           candidateId 
//         });
//         this.emit('olivio-event', { 
//           message: 'prueba desde startIndividualExamsss', 
//           timestamp: new Date().toISOString(),
//           sessionId,
//           candidateId 
//         });
//         // 5. Emitir el evento principal
//         console.log(`📤 [startIndividualExam] Enviando 'start-individual-exam'...`);
//         console.log(`🔍 [startIndividualExam] Estado del socket justo antes del emit:`, {
//           connected: this.socket.connected,
//           id: this.socket.id,
//           transport: this.socket.io.engine?.transport?.name
//         });
        
//         const emitResult = this.emit('startIndividualExam', { sessionId, candidateId });
//         console.log(`📤 [startIndividualExam] Resultado del emit:`, emitResult);
        
//         if (!emitResult) {
//           cleanup();
//           console.error('❌ [startIndividualExam] Emit retornó false');
//           reject(new Error('No se pudo enviar el evento al servidor'));
//           return;
//         }

//         console.log(`✅ [startIndividualExam] Evento enviado exitosamente, esperando respuesta...`);

//       } catch (error) {
//         cleanup();
//         console.error('❌ [startIndividualExam] Error crítico al intentar iniciar el examen:', error);
//         reject(new Error('Error obteniendo la información del candidato.'));
//       }
//     });
//   }

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

//       this.once('session-joined', (data) => {
//         clearTimeout(timeout);
//         console.log('✅ Unido a sesión exitosamente:', data);
//         resolve();
//       });

//       this.once('session-error', (error) => {
//         clearTimeout(timeout);
//         reject(new Error(error.message));
//       });
//     });
//   }

//   /**
//    * Obtener información de la conexión
//    */
//   getConnectionInfo() {
//     return {
//       connected: this.isConnected(),
//       socketId: this.socket?.id,
//       reconnectAttempts: this.reconnectAttempts,
//       transport: this.socket?.io?.engine?.transport?.name
//     };
//   }

//   /**
//    * Limpiar todos los listeners
//    */
//   cleanup(): void {
//     if (this.socket) {
//       this.eventListeners.forEach((listeners, event) => {
//         listeners.forEach(callback => {
//           this.socket?.off(event, callback as any);
//         });
//       });
//       this.eventListeners.clear();
//     }
//   }
// }

// // Exportar instancia singleton
// const socketService = new SocketService();
// export default socketService;
