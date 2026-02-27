import Redis from 'ioredis';
import { Server as SocketIOServer } from 'socket.io';
import { logger } from '../utils/logger';
import { SessionService } from './SessionService';
import { technicalVerificationService } from './TechnicalVerificationService';

export interface LobbyParticipant {
  userId: string;
  userEmail: string;
  socketId: string;
  joinedAt: number;
  technicalVerified: boolean;
  role: 'student' | 'proctor' | 'admin';
  status: 'waiting' | 'ready' | 'disconnected';
}

export interface ExamLobby {
  sessionId: string;
  examId: string;
  examName: string;
  scheduledStartTime: number;
  actualStartTime?: number;
  status: 'waiting' | 'starting' | 'in_progress' | 'finished';
  participants: Map<string, LobbyParticipant>;
  proctors: Map<string, LobbyParticipant>;
  maxParticipants: number;
  requiresTechnicalVerification: boolean;
  createdAt: number;
  createdBy?: string;
  settings: {
    autoStartEnabled: boolean;
    minParticipantsToStart: number;
    maxWaitTimeMinutes: number;
    lateJoinAllowedMinutes: number;
  };
}

export class ExamLobbyService {
  private io: SocketIOServer;
  private lobbies: Map<string, ExamLobby> = new Map();
  private sessionService: SessionService;
  private redisClient: Redis;

  constructor(io: SocketIOServer, sessionService: SessionService) {
    this.io = io;
    this.sessionService = sessionService;
    
    // Inicializar Redis
    this.redisClient = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      }
    });

    // Manejar eventos de Redis
    this.redisClient.on('connect', () => {
      logger.info('🔗 Redis conectado para ExamLobbyService');
      this.initializeLobbiesFromRedis();
    });

    this.redisClient.on('error', (error) => {
      logger.error('❌ Error de Redis en ExamLobbyService:', error);
    });
  }

  /**
   * Crear nuevo lobby para una sesión de examen
   */
  async createLobby(sessionId: string, examData: any, settings?: any, createdBy?: string): Promise<ExamLobby> {
    const lobby: ExamLobby = {
      sessionId,
      examId: examData.examId || examData._id,
      examName: examData.name || `Examen ${sessionId}`,
      scheduledStartTime: examData.scheduledStartTime || Date.now(),
      status: 'waiting',
      participants: new Map(),
      proctors: new Map(),
      maxParticipants: examData.maxParticipants || 50,
      requiresTechnicalVerification: examData.requiresTechnicalVerification ?? true,
      createdAt: Date.now(),
      createdBy,
      settings: {
        autoStartEnabled: settings?.autoStartEnabled ?? false,
        minParticipantsToStart: settings?.minParticipantsToStart ?? 1,
        maxWaitTimeMinutes: settings?.maxWaitTimeMinutes ?? 15,
        lateJoinAllowedMinutes: settings?.lateJoinAllowedMinutes ?? 5,
        ...settings
      }
    };

    this.lobbies.set(sessionId, lobby);
    console.log(`Lobby creado: ${JSON.stringify(lobby)}`);
    // Persistir en Redis
    await this.saveLobbyToRedis(sessionId, lobby);
    
    logger.info(`🏢 Lobby creado para sesión ${sessionId}: ${lobby.examName}`);
    
    // Configurar timer de auto-inicio si está habilitado
    if (lobby.settings.autoStartEnabled) {
      this.scheduleAutoStart(lobby);
    }

    return lobby;
  }

  /**
   * Unirse al lobby de una sesión
   */
  async joinLobby(socket: any, sessionId: string, role: 'student' | 'proctor' | 'admin' = 'student', candidateId: any,token:string): Promise<void> {
    const lobby = this.lobbies.get(sessionId); 
    if (!lobby) {
      socket.emit('lobby-error', {
        code: 'LOBBY_NOT_FOUND',
        message: 'Lobby no encontrado para esta sesión'
      });
      return;
    }

    // Verificar si el examen ya comenzó y no permite entrada tardía
    if (lobby.status === 'in_progress') {
      const minutesLate = (Date.now() - (lobby.actualStartTime || 0)) / 60000;
      if (minutesLate > lobby.settings.lateJoinAllowedMinutes) {
        socket.emit('lobby-error', {
          code: 'EXAM_ALREADY_STARTED',
          message: `El examen ya comenzó hace ${Math.round(minutesLate)} minutos. No se permite entrada tardía.`
        });
        return;
      }
    }

    // Verificar capacidad del lobby
    if (role === 'student' && lobby.participants.size >= lobby.maxParticipants) {
      socket.emit('lobby-error', {
        code: 'LOBBY_FULL',
        message: 'El lobby está lleno. No hay cupos disponibles.'
      });
      return;
    }

    // Verificar verificación técnica si es requerida
    let technicalVerified = false;
    if (lobby.requiresTechnicalVerification && role === 'student') {
      const verificationCheck = await technicalVerificationService.canUserProceed(candidateId, token);
      technicalVerified = verificationCheck.canProceed;
      
      if (!technicalVerified) {
        socket.emit('lobby-error', {
          code: 'TECHNICAL_VERIFICATION_REQUIRED',
          message: verificationCheck.reason || 'Verificación técnica requerida',
          data: { verification: verificationCheck }
        });
        return;
      }
    } else {
      technicalVerified = true; // Para proctors y admins
    }

    // Crear participante
    const participant: LobbyParticipant = {
      userId: socket.userId,
      userEmail: socket.userEmail,
      socketId: socket.id,
      joinedAt: Date.now(),
      technicalVerified,
      role,
      status: technicalVerified ? 'ready' : 'waiting'
    };
    console.log(participant,' <--- participant in ExamLobbyService.ts');
    // Agregar al lobby según el rol
    if (role === 'student') {
      lobby.participants.set(socket.userId, participant);
    } else {
      lobby.proctors.set(socket.userId, participant);
    }
    
    // Sincronizar con Redis
    await this.syncLobbyToRedis(sessionId);

    // Unirse al room de Socket.IO
    socket.join(`lobby-${sessionId}`);

    logger.info(`👥 ${role} ${socket.userEmail} se unió al lobby ${sessionId} (${lobby.participants.size}/${lobby.maxParticipants})`);

    // Notificar al participante que se unió exitosamente
    console.log('A punto de enviar el evento de Lobby-Joined!')
    socket.emit('lobby-joined', {
      sessionId,
      lobby: this.getLobbyPublicData(lobby),
      participant,
      message: 'Te has unido al lobby exitosamente'
    });

    // Notificar a todos los participantes del lobby
    this.broadcastToLobby(sessionId, 'participant-joined', {
      participant,
      lobbyStats: this.getLobbyStats(lobby)
    });

    // Verificar si se puede auto-iniciar
    this.checkAutoStart(lobby);
  }

  /**
   * Salir del lobby
   */
  async leaveLobby(socket: any, sessionId: string): Promise<void> {
    const lobby = this.lobbies.get(sessionId);
    if (!lobby) return;

    const wasParticipant = lobby.participants.has(socket.userId);
    const wasProctor = lobby.proctors.has(socket.userId);

    if (wasParticipant) {
      lobby.participants.delete(socket.userId);
    } else if (wasProctor) {
      lobby.proctors.delete(socket.userId);
    }
    
    // Sincronizar con Redis
    await this.syncLobbyToRedis(sessionId);

    socket.leave(`lobby-${sessionId}`);

    logger.info(`👋 Usuario ${socket.userEmail} salió del lobby ${sessionId}`);

    // Notificar a los demás participantes
    if (wasParticipant || wasProctor) {
      this.broadcastToLobby(sessionId, 'participant-left', {
        userId: socket.userId,
        lobbyStats: this.getLobbyStats(lobby)
      });
    }

    // Si no quedan participantes, limpiar el lobby después de un tiempo
    if (lobby.participants.size === 0 && lobby.proctors.size === 0) {
      setTimeout(() => {
        if (this.lobbies.has(sessionId) && 
            this.lobbies.get(sessionId)!.participants.size === 0 && 
            this.lobbies.get(sessionId)!.proctors.size === 0) {
          this.lobbies.delete(sessionId);
          logger.info(`🧹 Lobby ${sessionId} eliminado por inactividad`);
        }
      }, 5 * 60 * 1000); // 5 minutos
    }
  }

  /**
   * Iniciar examen manualmente (por proctor/admin)
   */
  async startExam(socket: any, sessionId: string): Promise<void> {
    const lobby = this.lobbies.get(sessionId);
    
    if (!lobby) {
      socket.emit('lobby-error', {
        code: 'LOBBY_NOT_FOUND',
        message: 'Lobby no encontrado'
      });
      return;
    }

    // Verificar permisos (solo proctors y admins pueden iniciar)
    // const userRole = lobby.proctors.get(socket.userId)?.role;
    // if (userRole !== 'proctor' && userRole !== 'admin') {
    //   socket.emit('lobby-error', {
    //     code: 'INSUFFICIENT_PERMISSIONS',
    //     message: 'Solo proctors y administradores pueden iniciar el examen'
    //   });
    //   return;
    // }

    // Verificar estado del lobby
    if (lobby.status === 'in_progress') {
      socket.emit('lobby-error', {
        code: 'EXAM_ALREADY_STARTED',
        message: 'El examen ya está en progreso'
      });
      return;
    }

    if (lobby.status === 'finished') {
      socket.emit('lobby-error', {
        code: 'EXAM_FINISHED',
        message: 'El examen ya finalizó'
      });
      return;
    }

    await this.initiateExamStart(lobby, socket.userId);
  }

  /**
   * Obtener estado actual del lobby
   */
  getLobbyStatus(sessionId: string): ExamLobby | null {
    return this.lobbies.get(sessionId) || null;
  }

  /**
   * Obtener todos los lobbies activos
   */
  getActiveLobbies(): ExamLobby[] {
    return Array.from(this.lobbies.values());
  }

  /**
   * Actualizar estado de un participante
   */
  async updateParticipantStatus(socket: any, sessionId: string, status: LobbyParticipant['status']): Promise<void> {
    const lobby = this.lobbies.get(sessionId);
    if (!lobby) return;

    const participant = lobby.participants.get(socket.userId) || lobby.proctors.get(socket.userId);
    if (!participant) return;

    participant.status = status;
    
    // Sincronizar con Redis
    await this.syncLobbyToRedis(sessionId);

    // Notificar cambio de estado
    this.broadcastToLobby(sessionId, 'participant-status-changed', {
      userId: socket.userId,
      status,
      lobbyStats: this.getLobbyStats(lobby)
    });

    logger.info(`📊 Estado de participante actualizado: ${socket.userEmail} -> ${status} en lobby ${sessionId}`);
  }

  /**
   * Enviar mensaje en el chat del lobby
   */
  async sendLobbyMessage(socket: any, sessionId: string, message: string): Promise<void> {
    const lobby = this.lobbies.get(sessionId);
    if (!lobby) return;

    const participant = lobby.participants.get(socket.userId) || lobby.proctors.get(socket.userId);
    if (!participant) return;

    const chatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: socket.userId,
      userEmail: socket.userEmail,
      role: participant.role,
      message: message.trim(),
      timestamp: Date.now()
    };

    // Broadcast mensaje a todos en el lobby
    this.broadcastToLobby(sessionId, 'lobby-message', chatMessage);

    logger.info(`💬 Mensaje en lobby ${sessionId} de ${socket.userEmail}: ${message.substring(0, 50)}...`);
  }

  // Métodos privados auxiliares

  private async initiateExamStart(lobby: ExamLobby, initiatedBy?: string): Promise<void> {
    lobby.status = 'starting';
    lobby.actualStartTime = Date.now();
    
    // Sincronizar con Redis
    await this.syncLobbyToRedis(lobby.sessionId);

    logger.info(`🚀 Iniciando examen para lobby ${lobby.sessionId} (${lobby.participants.size} participantes)`);

    // Notificar que el examen está comenzando
    this.broadcastToLobby(lobby.sessionId, 'exam-starting', {
      message: 'El examen está comenzando...',
      countdown: 10, // 10 segundos de cuenta regresiva
      initiatedBy
    });

    // Cuenta regresiva de 10 segundos
    for (let i = 10; i > 0; i--) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      this.broadcastToLobby(lobby.sessionId, 'exam-countdown', { seconds: i - 1 });
    }

    // Cambiar estado a en progreso
    lobby.status = 'in_progress';
    
    // Sincronizar con Redis
    await this.syncLobbyToRedis(lobby.sessionId);

    try {
      // Activar la sesión programada con los participantes del lobby
      const participantIds = Array.from(lobby.participants.keys());
      
      if (participantIds.length > 0) {
        await this.sessionService.activateScheduledSession(lobby.sessionId, participantIds);
      }
      
      // Notificar que el examen comenzó
      this.broadcastToLobby(lobby.sessionId, 'exam-started', {
        message: 'El examen ha comenzado',
        sessionId: lobby.sessionId,
        startTime: lobby.actualStartTime
      });

      logger.info(`✅ Examen iniciado exitosamente para lobby ${lobby.sessionId}`);

    } catch (error) {
      logger.error(`❌ Error iniciando examen para lobby ${lobby.sessionId}:`, error);
      
      lobby.status = 'waiting';
      lobby.actualStartTime = undefined;
      
      // Sincronizar con Redis
      await this.syncLobbyToRedis(lobby.sessionId);
      
      this.broadcastToLobby(lobby.sessionId, 'exam-start-failed', {
        message: 'Error iniciando el examen. Inténtalo nuevamente.'
      });
    }
  }

  private scheduleAutoStart(lobby: ExamLobby): void {
    const timeUntilStart = lobby.scheduledStartTime - Date.now();
    
    if (timeUntilStart > 0) {
      setTimeout(() => {
        if (lobby.status === 'waiting' && lobby.participants.size >= lobby.settings.minParticipantsToStart) {
          this.initiateExamStart(lobby);
        }
      }, timeUntilStart);

      logger.info(`⏰ Auto-inicio programado para lobby ${lobby.sessionId} en ${Math.round(timeUntilStart / 60000)} minutos`);
    }
  }

  private checkAutoStart(lobby: ExamLobby): void {
    if (lobby.settings.autoStartEnabled && 
        lobby.status === 'waiting' && 
        lobby.participants.size >= lobby.settings.minParticipantsToStart) {
      
      const timeUntilScheduled = lobby.scheduledStartTime - Date.now();
      
      // Si ya pasó la hora programada o quedan menos de 2 minutos
      if (timeUntilScheduled <= 2 * 60 * 1000) {
        setTimeout(() => {
          if (lobby.status === 'waiting') {
            this.initiateExamStart(lobby);
          }
        }, Math.max(0, timeUntilScheduled));
      }
    }
  }

  private broadcastToLobby(sessionId: string, event: string, data: any): void {
    this.io.to(`lobby-${sessionId}`).emit(event, data);
  }

  private getLobbyPublicData(lobby: ExamLobby) {
    return {
      sessionId: lobby.sessionId,
      examId: lobby.examId,
      examName: lobby.examName,
      scheduledStartTime: lobby.scheduledStartTime,
      actualStartTime: lobby.actualStartTime,
      status: lobby.status,
      maxParticipants: lobby.maxParticipants,
      requiresTechnicalVerification: lobby.requiresTechnicalVerification,
      settings: lobby.settings,
      stats: this.getLobbyStats(lobby)
    };
  }

  private getLobbyStats(lobby: ExamLobby) {
    return {
      totalParticipants: lobby.participants.size,
      totalProctors: lobby.proctors.size,
      readyParticipants: Array.from(lobby.participants.values()).filter(p => p.status === 'ready').length,
      waitingParticipants: Array.from(lobby.participants.values()).filter(p => p.status === 'waiting').length,
      maxParticipants: lobby.maxParticipants,
      canStart: lobby.participants.size >= lobby.settings.minParticipantsToStart,
      timeUntilScheduledStart: Math.max(0, lobby.scheduledStartTime - Date.now())
    };
  }

  /**
   * Crear lobby para una sesión de examen automáticamente
   */
  async createLobbyForSession(sessionId: string, examData: any, settings?: any): Promise<ExamLobby> {
    return await this.createLobby(sessionId, examData, settings);
  }

  /**
   * Verificar si un lobby existe para una sesión
   */
  hasLobbyForSession(sessionId: string): boolean {
    return this.lobbies.has(sessionId);
  }
  async cleanup(): Promise<void> {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 horas

    for (const [sessionId, lobby] of this.lobbies.entries()) {
      if (now - lobby.createdAt > maxAge || 
          (lobby.status === 'finished' && now - (lobby.actualStartTime || lobby.createdAt) > 60 * 60 * 1000)) {
        this.lobbies.delete(sessionId);
        await this.removeLobbyFromRedis(sessionId);
        logger.info(`🧹 Lobby ${sessionId} eliminado por antigüedad`);
      }
    }
  }

  /**
   * Inicializar lobbies desde Redis al arrancar el servicio
   */
  private async initializeLobbiesFromRedis(): Promise<void> {
    try {
      const keys = await this.redisClient.keys('lobby:*');
      
      for (const key of keys) {
        const lobbyData = await this.redisClient.get(key);
        if (lobbyData) {
          try {
            const lobby = JSON.parse(lobbyData) as ExamLobby;
            const sessionId = key.replace('lobby:', '');
            
            // Reconstruir Maps desde objetos planos
            lobby.participants = new Map(Object.entries(lobby.participants as any));
            lobby.proctors = new Map(Object.entries(lobby.proctors as any));
            
            // Solo recuperar lobbies activos
            if (lobby.status === 'waiting' || lobby.status === 'starting') {
              this.lobbies.set(sessionId, lobby);
              logger.info(`🔄 Lobby recuperado de Redis: ${sessionId}`);
              
              // Re-programar auto-inicio si aplica
              if (lobby.settings.autoStartEnabled && lobby.status === 'waiting') {
                this.scheduleAutoStart(lobby);
              }
            } else if (lobby.status === 'finished') {
              // Limpiar lobbies finalizados antiguos
              await this.removeLobbyFromRedis(sessionId);
            }
          } catch (error) {
            logger.error(`Error parsing lobby data for ${key}:`, error);
            await this.redisClient.del(key);
          }
        }
      }
      
      logger.info(`✅ ${this.lobbies.size} lobbies activos recuperados de Redis`);
    } catch (error) {
      logger.error('Error inicializando lobbies desde Redis:', error);
    }
  }

  /**
   * Guardar lobby en Redis
   */
  private async saveLobbyToRedis(sessionId: string, lobby: ExamLobby): Promise<void> {
    try {
      // Convertir Maps a objetos planos para serialización
      const lobbyToSave = {
        ...lobby,
        participants: Object.fromEntries(lobby.participants),
        proctors: Object.fromEntries(lobby.proctors)
      };
      
      const ttl = 86400; // 24 horas
      await this.redisClient.setex(
        `lobby:${sessionId}`,
        ttl,
        JSON.stringify(lobbyToSave)
      );
      
      logger.debug(`💾 Lobby ${sessionId} guardado en Redis`);
    } catch (error) {
      logger.error(`Error guardando lobby ${sessionId} en Redis:`, error);
    }
  }

  /**
   * Eliminar lobby de Redis
   */
  private async removeLobbyFromRedis(sessionId: string): Promise<void> {
    try {
      await this.redisClient.del(`lobby:${sessionId}`);
      logger.debug(`🗑️ Lobby ${sessionId} eliminado de Redis`);
    } catch (error) {
      logger.error(`Error eliminando lobby ${sessionId} de Redis:`, error);
    }
  }

  /**
   * Sincronizar cambios del lobby con Redis
   */
  private async syncLobbyToRedis(sessionId: string): Promise<void> {
    const lobby = this.lobbies.get(sessionId);
    if (lobby) {
      await this.saveLobbyToRedis(sessionId, lobby);
    }
  }
}

export const examLobbyService = (io: SocketIOServer, sessionService: SessionService) => new ExamLobbyService(io, sessionService);
