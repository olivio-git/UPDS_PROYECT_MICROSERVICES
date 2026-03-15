import { Consumer, Kafka, KafkaMessage, Producer } from 'kafkajs';
import { Server as SocketIOServer } from 'socket.io';
import { logger } from '../utils/logger';

export class KafkaService {
  private kafka: Kafka;
  private producer: Producer;
  private consumer: Consumer;
  private connected: boolean = false;
  private io?: SocketIOServer;
  constructor(io?: SocketIOServer) {
    this.io = io;
    this.kafka = new Kafka({
      clientId: process.env.KAFKA_CLIENT_ID || 'session-manager-service',
      brokers: [process.env.KAFKA_BROKER || 'kafka:29092'],
      retry: {
        initialRetryTime: 100,
        retries: 8
      }
    });

    this.producer = this.kafka.producer({
      maxInFlightRequests: 1,
      idempotent: true,
      transactionTimeout: 30000
    });

    this.consumer = this.kafka.consumer({
      groupId: process.env.KAFKA_GROUP_ID || 'session-manager-group',
      sessionTimeout: 30000,
      rebalanceTimeout: 60000,
      heartbeatInterval: 3000
    });
  }

  /**
   * Conectar a Kafka
   */
  async connect(): Promise<void> {
    try {
      await this.producer.connect();
      await this.consumer.connect();
      this.connected = true;
      
      logger.info('✅ Conectado a Kafka successfully');
      
      // Configurar suscripciones
      await this.setupSubscriptions();
      
    } catch (error) {
      logger.error('❌ Error connecting to Kafka:', error);
      this.connected = false;
      throw error;
    }
  }

  /**
   * Desconectar de Kafka
   */
  async disconnect(): Promise<void> {
    try {
      await this.producer.disconnect();
      await this.consumer.disconnect();
      this.connected = false;
      logger.info('Disconnected from Kafka');
    } catch (error) {
      logger.error('Error disconnecting from Kafka:', error);
    }
  }

  /**
   * Publicar evento en un topic
   */
  async publishEvent(topic: string, event: any): Promise<void> {
    if (!this.connected) {
      logger.warn(`Kafka not connected, skipping event publish to ${topic}`);
      return;
    }

    try {
      await this.producer.send({
        topic,
        messages: [{
          key: event.sessionId || event.userId || 'session-manager',
          value: JSON.stringify({
            ...event,
            source: 'session-manager-service',
            timestamp: event.timestamp || new Date().toISOString()
          }),
          headers: {
            'content-type': 'application/json',
            'source-service': 'session-manager'
          }
        }]
      });

      logger.debug(`Event published to ${topic}:`, event.type);

    } catch (error) {
      logger.error(`Error publishing event to ${topic}:`, error);
      // No re-lanzar el error para evitar que falle la operación principal
    }
  }

  /**
   * Configurar suscripciones a topics
   */
  private async setupSubscriptions(): Promise<void> {
    try {
      // Suscribirse a eventos relevantes
      await this.consumer.subscribe({
        topics: [
          'exam-events',
          'user-events',
          'session-commands'
        ],
        fromBeginning: false
      });

      // Iniciar el consumidor
      await this.consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          await this.handleMessage(topic, partition, message);
        }
      });

      logger.info('Kafka subscriptions configured');

    } catch (error) {
      logger.error('Error setting up Kafka subscriptions:', error);
    }
  }

  /**
   * Manejar mensajes recibidos
   */
  private async handleMessage(topic: string, partition: number, message: KafkaMessage): Promise<void> {
    try {
      const eventData = JSON.parse(message.value?.toString() || '{}');
      
      logger.debug(`Received message from ${topic}:`, eventData.type);

      switch (topic) {
        case 'exam-events':
          await this.handleExamEvent(eventData);
          break;
        
        case 'user-events':
          await this.handleUserEvent(eventData);
          break;
        
        case 'session-commands':
          await this.handleSessionCommand(eventData);
          break;
        
        default:
          logger.warn(`Unhandled topic: ${topic}`);
      }

    } catch (error) {
      logger.error(`Error handling message from ${topic}:`, error);
    }
  }

  /**
   * Manejar eventos de examen
   */
  private async handleExamEvent(event: any): Promise<void> {
    switch (event.type) {
      case 'EXAM_SESSION_SCHEDULED':
        await this.handleExamSessionScheduled(event);
        break;
      
      case 'EXAM_SESSION_CANCELLED':
        await this.handleExamSessionCancelled(event);
        break;
      
      case 'EXAM_UPDATED':
        await this.handleExamUpdated(event);
        break;

      case 'session.candidate.added':
        await this.handleCandidateAdded(event);
        break;

      case 'session.proctor.added':
        await this.handleProctorAdded(event);
        break;

      case 'session.start_requested':
        await this.handleSessionStartRequested(event);
        break;
      case 'session.end_requested':
        await this.handleEndSessionCommand(event);
        break;
      default:
        logger.debug(`Unhandled exam event: ${event.type}`);
    }
  }

  /**
   * Manejar eventos de usuario
   */
  private async handleUserEvent(event: any): Promise<void> {
    switch (event.type) {
      case 'USER_UPDATED':
        await this.handleUserUpdated(event);
        break;
      
      case 'USER_DEACTIVATED':
        await this.handleUserDeactivated(event);
        break;
      
      default:
        logger.debug(`Unhandled user event: ${event.type}`);
    }
  }

  /**
   * Manejar comandos de sesión
   */
  private async handleSessionCommand(event: any): Promise<void> {
    switch (event.type) {
      case 'START_SESSION':
        await this.handleStartSessionCommand(event);
        break;
      
      case 'END_SESSION':
        await this.handleEndSessionCommand(event);
        break;
      
      case 'PAUSE_SESSION':
        await this.handlePauseSessionCommand(event);
        break;
      
      default:
        logger.debug(`Unhandled session command: ${event.type}`);
    }
  }

  // Handlers específicos para eventos

  private async handleExamSessionScheduled(event: any): Promise<void> {
    try {
      // Importar aquí para evitar dependencias circulares
      const { ActiveSessionModel } = await import('../models/ActiveSession');
      
      // Crear nueva sesión activa
      const activeSession = new ActiveSessionModel({
        sessionId: event.sessionId,
        examId: event.examId,
        sessionName: event.sessionName,
        examName: event.examName,
        status: 'scheduled',
        settings: event.settings,
        participants: {
          registeredCandidates: event.registeredCandidates || [],
          activeCandidates: [],
          proctors: event.proctors || [],
          status: new Map()
        },
        questions: {
          totalQuestions: event.totalQuestions || 0,
          questionsPerCandidate: new Map(),
          responses: []
        },
        stats: {
          totalParticipants: event.registeredCandidates?.length || 0,
          activeParticipants: 0,
          completedParticipants: 0,
          averageProgress: 0,
          averageTimeSpent: 0
        },
        technical: {
          serverInstance: process.env.HOSTNAME || 'unknown',
          lastHeartbeat: new Date(),
          connections: 0
        },
        createdBy: event.createdBy
      });

      await activeSession.save();
      logger.info(`Active session created: ${event.sessionId}`);

    } catch (error) {
      logger.error('Error handling exam session scheduled:', error);
    }
  }

  private async handleExamSessionCancelled(event: any): Promise<void> {
    try {
      const { ActiveSessionModel } = await import('../models/ActiveSession');
      
      await ActiveSessionModel.findOneAndUpdate(
        { sessionId: event.sessionId },
        { 
          status: 'cancelled',
          endedAt: new Date()
        }
      );

      logger.info(`Session cancelled: ${event.sessionId}`);

    } catch (error) {
      logger.error('Error handling exam session cancelled:', error);
    }
  }

  private async handleExamUpdated(event: any): Promise<void> {
    try {
      const { ActiveSessionModel } = await import('../models/ActiveSession');
      
      // Actualizar sesiones activas relacionadas con el examen
      await ActiveSessionModel.updateMany(
        { 
          examId: event.examId,
          status: { $in: ['scheduled', 'active'] }
        },
        {
          examName: event.examName,
          'settings.duration': event.duration,
          'settings.instructions': event.instructions
        }
      );

      logger.info(`Sessions updated for exam: ${event.examId}`);

    } catch (error) {
      logger.error('Error handling exam updated:', error);
    }
  }

  private async handleUserUpdated(event: any): Promise<void> {
    try {
      // Actualizar información del usuario en sesiones activas si es necesario
      logger.info(`User updated: ${event.userId}`);

    } catch (error) {
      logger.error('Error handling user updated:', error);
    }
  }

  private async handleUserDeactivated(event: any): Promise<void> {
    try {
      const { ActiveSessionModel } = await import('../models/ActiveSession');
      
      // Remover usuario de sesiones activas
      await ActiveSessionModel.updateMany(
        {
          $or: [
            { 'participants.registeredCandidates': event.userId },
            { 'participants.activeCandidates': event.userId },
            { 'participants.proctors': event.userId }
          ]
        },
        {
          $pull: {
            'participants.registeredCandidates': event.userId,
            'participants.activeCandidates': event.userId,
            'participants.proctors': event.userId
          }
        }
      );

      logger.info(`User removed from active sessions: ${event.userId}`);

    } catch (error) {
      logger.error('Error handling user deactivated:', error);
    }
  }

  private async handleStartSessionCommand(event: any): Promise<void> {
    try {
      const { ActiveSessionModel } = await import('../models/ActiveSession');
      
      const session = await ActiveSessionModel.findOneAndUpdate(
        { sessionId: event.sessionId },
        { 
          status: 'active',
          startedAt: new Date()
        },
        { new: true }
      );

      if (session) {
        logger.info(`Session started: ${event.sessionId}`);
        
        // Publicar evento Kafka de sesión iniciada
        await this.publishEvent('session-events', {
          type: 'SESSION_STARTED',
          sessionId: event.sessionId,
          startedAt: new Date()
        });

        // Emitir evento WebSocket para notificar al frontend
        this.emitSessionStatusChange(event.sessionId, 'active');
      }

    } catch (error) {
      logger.error('Error handling start session command:', error);
    }
  }

  private async handleEndSessionCommand(data: any): Promise<void> {
    const { data:event } = data;
    try {
      const { ActiveSessionModel } = await import('../models/ActiveSession');
      
      const session = await ActiveSessionModel.findOneAndUpdate(
        { sessionId: event.sessionId },
        { 
          status: 'completed',
          endedAt: new Date()
        },
        { new: true }
      );

      if (session) {
        logger.info(`Session ended: ${event.sessionId}`);
        
        // Publicar evento Kafka de sesión finalizada
        await this.publishEvent('session-events', {
          type: 'SESSION_ENDED',
          sessionId: event.sessionId,
          endedAt: new Date()
        });

        // Emitir evento WebSocket para notificar al frontend
        this.emitSessionStatusChange(event.sessionId, 'completed');
      }

    } catch (error) {
      logger.error('Error handling end session command:', error);
    }
  }

  private async handlePauseSessionCommand(event: any): Promise<void> {
    try {
      const { ActiveSessionModel } = await import('../models/ActiveSession');
      
      await ActiveSessionModel.findOneAndUpdate(
        { sessionId: event.sessionId },
        { status: 'paused' }
      );

      logger.info(`Session paused: ${event.sessionId}`);

    } catch (error) {
      logger.error('Error handling pause session command:', error);
    }
  }

  private async handleCandidateAdded(event: any): Promise<void> {
    try {
      const { ActiveSessionModel } = await import('../models/ActiveSession');
      
      // Buscar la sesión activa por sessionId
      await ActiveSessionModel.findOneAndUpdate(
        { sessionId: event.sessionId },
        { 
          $addToSet: { 'participants.registeredCandidates': event.candidateId },
          $inc: { 'stats.totalParticipants': 1 }
        }
      );

      logger.info(`Candidate added to session: ${event.candidateId} -> ${event.sessionId}`);

    } catch (error) {
      logger.error('Error handling candidate added:', error);
    }
  }

  private async handleProctorAdded(event: any): Promise<void> {
    try {
      const { ActiveSessionModel } = await import('../models/ActiveSession');
      
      await ActiveSessionModel.findOneAndUpdate(
        { sessionId: event.sessionId },
        { 
          $addToSet: { 'participants.proctors': event.proctorId }
        }
      );

      logger.info(`Proctor added to session: ${event.proctorId} -> ${event.sessionId}`);

    } catch (error) {
      logger.error('Error handling proctor added:', error);
    }
  }

  private async handleSessionStartRequested(data: any): Promise<void> {
    const { data: event } = data;
    try {
      const { ActiveSessionModel } = await import('../models/ActiveSession');
      
      // Buscar o crear la sesión activa
      let activeSession = await ActiveSessionModel.findOne({ sessionId: event.sessionId });
      if (!activeSession) {
        // Si no existe, crear la sesión activa desde la data del evento
        const settings = { ...event.settings || {} };
        if (event.sessionType === 'individual_flexible') {
          settings.duration = event.timing?.examDuration || event.settings?.duration || 30;
        };

        activeSession = new ActiveSessionModel({
          sessionId: event.sessionId,
          examId: event.examId,
          sessionName: event.sessionName || 'Exam Session',
          examName: event.examName || 'Exam',
          status: 'active',
          sessionType: event.sessionType || 'group_synchronized',
          timing: event.timing || {},
          settings: settings,
          participants: {
            registeredCandidates: event.registeredCandidates || [],
            activeCandidates: [],
            proctors: event.proctors || [],
            status: new Map()
          },
          questions: {
            totalQuestions: 0,
            questionsPerCandidate: new Map(),
            responses: []
          },
          stats: {
            totalParticipants: (event.registeredCandidates || []).length,
            activeParticipants: 0,
            completedParticipants: 0,
            averageProgress: 0,
            averageTimeSpent: 0
          },
          technical: {
            serverInstance: process.env.HOSTNAME || 'unknown',
            lastHeartbeat: new Date(),
            connections: 0
          },
          createdBy: event.createdBy
        });

        await activeSession.save();
        logger.info(`Active session created for start request: ${event.sessionId}`);
      } else {
        // Si existe, actualizar estado
        activeSession.status = 'active';
        activeSession.technical.lastHeartbeat = new Date();
        await activeSession.save();
      }
 
      await this.publishEvent('session-events', {
        type: 'SESSION_LOBBY_OPENED',
        sessionId: event.sessionId,
        timestamp: new Date().toISOString()
      });

      // Emitir evento WebSocket para notificar al frontend
      this.emitSessionStatusChange(event.sessionId, 'active');
      // Ademas vamos a crear las salas
    } catch (error) {
      logger.error('Error handling session start requested:', error);
    }
  }
  // private async handleSessionEndRequested(data: any): Promise<void> {
  //   const { data: event } = data;
  //   try {
  //     const { ActiveSessionModel } = await import('../models/ActiveSession');

  //     // Marcar la sesión como finalizada
  //     await ActiveSessionModel.updateOne({ sessionId: event.sessionId }, { status: 'completed' });

  //     logger.info(`Session ended: ${event.sessionId}`);

  //     // Publicar evento de sesión finalizada
  //     await this.publishEvent('session-events', {
  //       type: 'SESSION_ENDED',
  //       sessionId: event.sessionId,
  //       timestamp: new Date().toISOString()
  //     });
      
  //   } catch (error) {
  //     logger.error('Error handling session end requested:', error);
  //   }
  // }


  /**
   * Emitir evento WebSocket para cambio de estado de sesión
   */
  private emitSessionStatusChange(sessionId: string, status: string, additionalData?: any): void {
    if (this.io) {
      const eventData = {
        sessionId,
        status,
        timestamp: new Date().toISOString(),
        ...additionalData
      };

      const connectedClients = this.io.engine.clientsCount;
      logger.info(`🔌 [BACKEND] Emitiendo eventos WebSocket para sesión ${sessionId}: ${status} (${connectedClients} clientes conectados)`);

      // Emitir eventos específicos
      if (status === 'active') {
        this.io.emit('session-started', eventData);
        logger.info(`📤 [BACKEND] Evento 'session-started' emitido:`, eventData);
      } else if (status === 'completed') {
        this.io.emit('session-ended', eventData);
        logger.info(`📤 [BACKEND] Evento 'session-ended' emitido:`, eventData);
      }

      // Emitir evento genérico para cualquier cambio de estado
      this.io.emit('session-status-changed', eventData);
      logger.info(`📤 [BACKEND] Evento 'session-status-changed' emitido:`, eventData);

      if (connectedClients === 0) {
        logger.warn(`⚠️ [BACKEND] No hay clientes conectados para recibir los eventos de la sesión ${sessionId}`);
      }
    } else {
      logger.error(`❌ [BACKEND] No se puede emitir eventos WebSocket: this.io es null para sesión ${sessionId}`);
    }
  }

  /**
   * Verificar estado de conexión
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Obtener métricas de Kafka
   */
  async getMetrics(): Promise<any> {
    if (!this.connected) {
      return { connected: false };
    }

    try {
      // Obtener información básica de conexión
      return {
        connected: true,
        clientId: process.env.KAFKA_CLIENT_ID,
        brokers: [process.env.KAFKA_BROKER],
        subscribedTopics: ['exam-events', 'user-events', 'session-commands']
      };
    } catch (error:any) {
      logger.error('Error getting Kafka metrics:', error);
      return { connected: false, error: error.message };
    }
  }
}
