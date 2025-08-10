// src/services/event.service.ts - Implementación completa con Kafka

import { Kafka, Producer, Consumer, EachMessagePayload } from 'kafkajs';
import config from '../config';
import { KAFKA_TOPICS, KAFKA_EVENT_TYPES, UserEventType, CandidateEventType } from '../config/kafka-topics';

export interface UserEvent {
  eventType: UserEventType;
  userId: string;
  userData?: any;
  updatedBy?: string;
  timestamp: Date;
  metadata?: any;
}

export interface CandidateEvent {
  eventType: CandidateEventType;
  candidateId: string;
  candidateData?: any;
  updatedBy?: string;
  timestamp: Date;
  metadata?: any;
}

export class EventService {
  private kafka: Kafka;
  private producer: Producer;
  private consumer: Consumer;
  private isInitialized: boolean = false;
  private isProducerConnected: boolean = false;
  private isConsumerConnected: boolean = false;

  constructor() {
    this.kafka = new Kafka({
      clientId: config.kafka.clientId,
      brokers: [config.kafka.broker],
      retry: {
        initialRetryTime: 100,
        retries: 8
      },
      connectionTimeout: 10000,
      requestTimeout: 30000,
    });

    this.producer = this.kafka.producer({
      allowAutoTopicCreation: true,
      idempotent: true,
      maxInFlightRequests: 1,
      retry: {
        retries: 3
      }
    });

    this.consumer = this.kafka.consumer({
      groupId: 'user-management-group',
      sessionTimeout: 30000,
      allowAutoTopicCreation: true
    });

    console.log('📨 EventService inicializado');
  }

  // ================================
  // INITIALIZATION & CONNECTION
  // ================================

  async initialize(): Promise<void> {
    try {
      if (this.isInitialized) {
        console.log('⚠️ EventService ya está inicializado');
        return;
      }

      console.log('🔄 Conectando al producer de Kafka...');
      await this.producer.connect();
      this.isProducerConnected = true;
      console.log('✅ Producer conectado exitosamente');

      console.log('🔄 Conectando al consumer de Kafka...');
      await this.consumer.connect();
      this.isConsumerConnected = true;
      console.log('✅ Consumer conectado exitosamente');

      // Suscribirse a los topics necesarios
      await this.subscribeToTopics();

      // Iniciar consumer
      await this.startConsumer();

      this.isInitialized = true;
      console.log('🎉 EventService inicializado exitosamente');

    } catch (error) {
      console.error('❌ Error inicializando EventService:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.isConsumerConnected) {
        await this.consumer.disconnect();
        this.isConsumerConnected = false;
        console.log('✅ Consumer desconectado');
      }

      if (this.isProducerConnected) {
        await this.producer.disconnect();
        this.isProducerConnected = false;
        console.log('✅ Producer desconectado');
      }

      this.isInitialized = false;
      console.log('✅ EventService desconectado completamente');
    } catch (error) {
      console.error('❌ Error desconectando EventService:', error);
    }
  }

  // ================================
  // PRODUCER METHODS
  // ================================

  async publishUserEvent(event: UserEvent): Promise<void> {
    console.log(`📤 Publicando evento de usuario: ${event.eventType} para usuario ${event.userId}`);
    try {
      if (!this.isProducerConnected) {
        throw new Error('Producer no está conectado');
      }
      console.log({
        key: event.userId,
        value: JSON.stringify({
          ...event,
          timestamp: event.timestamp.toISOString(),
          service: 'user-management-service'
        }),
        headers: {
          eventType: event.eventType,
          service: 'user-management-service',
          version: '1.0.0'
        }
      },"📤 Evento de usuario a publicar");

      const message = {
        key: event.userId,
        value: JSON.stringify({
          ...event,
          timestamp: event.timestamp.toISOString(),
          service: 'user-management-service'
        }),
        headers: {
          eventType: event.eventType,
          service: 'user-management-service',
          version: '1.0.0'
        }
      };

      await this.producer.send({
        topic: KAFKA_TOPICS.USER_EVENTS,
        messages: [message]
      });

      console.log(`📤 Evento de usuario publicado: ${event.eventType} para usuario ${event.userId}`);
    } catch (error) {
      console.error('❌ Error publicando evento de usuario:', error);
      throw error;
    }
  }

  async publishCandidateEvent(event: CandidateEvent): Promise<void> {
    try {
      if (!this.isProducerConnected) {
        throw new Error('Producer no está conectado');
      }

      const message = {
        key: event.candidateId,
        value: JSON.stringify({
          ...event,
          timestamp: event.timestamp.toISOString(),
          service: 'user-management-service'
        }),
        headers: {
          eventType: event.eventType,
          service: 'user-management-service',
          version: '1.0.0'
        }
      };

      await this.producer.send({
        topic: KAFKA_TOPICS.CANDIDATE_EVENTS,
        messages: [message]
      });

      console.log(`📤 Evento de candidato publicado: ${event.eventType} para candidato ${event.candidateId}`);
    } catch (error) {
      console.error('❌ Error publicando evento de candidato:', error);
      throw error;
    }
  }

  // ================================
  // CONVENIENCE METHODS
  // ================================

  async publishUserCreated(userId: string, userData: any, createdBy?: string): Promise<void> {
    const event: UserEvent = {
      eventType: KAFKA_EVENT_TYPES.USER_CREATED,
      userId,
      userData: {
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        role: userData.role,
        status: userData.status,
        permissions: userData.permissions,
        profile: userData.profile,
        teacherData: userData.teacherData,
        proctorData: userData.proctorData,
        createdAt: userData.createdAt,
        updatedAt: userData.updatedAt,
        // Datos adicionales para el notification-service
        temporaryPassword: userData.temporaryPassword,
        isNewUser: userData.isNewUser || true,
        requiresPasswordEmail: userData.requiresPasswordEmail || true
      },
      updatedBy: createdBy,
      timestamp: new Date(),
      metadata: {
        source: 'user-management-service',
        action: 'create',
        emailTemplate: 'new_user_credentials' // Template específico para nuevos usuarios
      }
    };

    await this.publishUserEvent(event);
  }

  async publishUserUpdated(userId: string, updates: any, updatedBy?: string): Promise<void> {
    const event: UserEvent = {
      eventType: KAFKA_EVENT_TYPES.USER_UPDATED,
      userId,
      userData: updates,
      updatedBy,
      timestamp: new Date(),
      metadata: {
        source: 'user-management-service',
        action: 'update'
      }
    };

    await this.publishUserEvent(event);
  }

  async publishUserDeleted(userId: string, deletedBy?: string): Promise<void> {
    const event: UserEvent = {
      eventType: KAFKA_EVENT_TYPES.USER_DELETED,
      userId,
      updatedBy: deletedBy,
      timestamp: new Date(),
      metadata: {
        source: 'user-management-service',
        action: 'delete'
      }
    };

    await this.publishUserEvent(event);
  }

  async publishUserStatusChanged(userId: string, oldStatus: string, newStatus: string, updatedBy?: string): Promise<void> {
    const event: UserEvent = {
      eventType: KAFKA_EVENT_TYPES.USER_STATUS_CHANGED,
      userId,
      userData: {
        oldStatus,
        newStatus
      },
      updatedBy,
      timestamp: new Date(),
      metadata: {
        source: 'user-management-service',
        action: 'status_change'
      }
    };

    await this.publishUserEvent(event);
  }

  async publishUserRoleChanged(userId: string, oldRole: string, newRole: string, updatedBy?: string): Promise<void> {
    const event: UserEvent = {
      eventType: KAFKA_EVENT_TYPES.USER_ROLE_CHANGED,
      userId,
      userData: {
        oldRole,
        newRole
      },
      updatedBy,
      timestamp: new Date(),
      metadata: {
        source: 'user-management-service',
        action: 'role_change'
      }
    };

    await this.publishUserEvent(event);
  }

  async publishUserPasswordChanged(userId: string, updatedBy?: string): Promise<void> {
    const event: UserEvent = {
      eventType: KAFKA_EVENT_TYPES.USER_PASSWORD_CHANGED,
      userId,
      userData: {
        action: 'password_changed'
      },
      updatedBy,
      timestamp: new Date(),
      metadata: {
        source: 'user-management-service',
        action: 'password_change'
      }
    };

    await this.publishUserEvent(event);
  }

  async publishCandidateRegistered(candidateId: string, candidateData: any, registeredBy: string): Promise<void> {
    const event: CandidateEvent = {
      eventType: KAFKA_EVENT_TYPES.CANDIDATE_REGISTERED,
      candidateId,
      candidateData: {
        personalInfo: candidateData.personalInfo,
        academicInfo: candidateData.academicInfo,
        technicalSetup: candidateData.technicalSetup,
        status: candidateData.status,
        registeredBy,
        createdAt: candidateData.createdAt
      },
      updatedBy: registeredBy,
      timestamp: new Date(),
      metadata: {
        source: 'user-management-service',
        action: 'register'
      }
    };

    await this.publishCandidateEvent(event);
  }

  async publishCandidateUpdated(candidateId: string, updates: any, updatedBy?: string): Promise<void> {
    const event: CandidateEvent = {
      eventType: KAFKA_EVENT_TYPES.CANDIDATE_UPDATED,
      candidateId,
      candidateData: updates,
      updatedBy,
      timestamp: new Date(),
      metadata: {
        source: 'user-management-service',
        action: 'update'
      }
    };

    await this.publishCandidateEvent(event);
  }

  async publishCandidateDeleted(candidateId: string, deletedBy?: string): Promise<void> {
    const event: CandidateEvent = {
      eventType: KAFKA_EVENT_TYPES.CANDIDATE_DELETED,
      candidateId,
      updatedBy: deletedBy,
      timestamp: new Date(),
      metadata: {
        source: 'user-management-service',
        action: 'delete'
      }
    };

    await this.publishCandidateEvent(event);
  }

  async publishCandidateStatusChanged(candidateId: string, oldStatus: string, newStatus: string, updatedBy?: string): Promise<void> {
    const event: CandidateEvent = {
      eventType: KAFKA_EVENT_TYPES.CANDIDATE_STATUS_CHANGED,
      candidateId,
      candidateData: {
        oldStatus,
        newStatus
      },
      updatedBy,
      timestamp: new Date(),
      metadata: {
        source: 'user-management-service',
        action: 'status_change'
      }
    };

    await this.publishCandidateEvent(event);
  }

  // ================================
  // CONSUMER METHODS
  // ================================

  private async subscribeToTopics(): Promise<void> {
    try {
      // Suscribirse a eventos de otros servicios que puedan interesar
      const topics = [
        KAFKA_TOPICS.AUTH_EVENTS,        // Eventos del auth-service
        KAFKA_TOPICS.NOTIFICATION_EVENTS, // Eventos del notification-service
        KAFKA_TOPICS.EMAIL_EVENTS,       // Eventos de email
        KAFKA_TOPICS.EXAM_EVENTS,        // Eventos futuros del exam-service
        KAFKA_TOPICS.SESSION_EVENTS      // Eventos futuros del session-service
      ];

      for (const topic of topics) {
        try {
          await this.consumer.subscribe({ topic, fromBeginning: false });
          console.log(`📥 Suscrito al topic: ${topic}`);
        } catch (error) {
          console.warn(`⚠️ No se pudo suscribir al topic ${topic}:`, (error as Error).message);
        }
      }
    } catch (error) {
      console.error('❌ Error suscribiéndose a topics:', error);
    }
  }

  private async startConsumer(): Promise<void> {
    try {
      await this.consumer.run({
        eachMessage: async ({ topic, partition, message }: EachMessagePayload) => {
          try {
            const eventData = message.value ? JSON.parse(message.value.toString()) : null;
            const eventType = message.headers?.eventType?.toString();

            if (!eventData || !eventType) {
              console.warn('⚠️ Mensaje recibido sin datos válidos');
              return;
            }

            console.log(`📥 Evento recibido en topic ${topic}: ${eventType}`);

            // Procesar eventos según el topic
            switch (topic) {
              case KAFKA_TOPICS.AUTH_EVENTS:
                await this.handleAuthEvent(eventData, eventType);
                break;
              case KAFKA_TOPICS.NOTIFICATION_EVENTS:
              case KAFKA_TOPICS.EMAIL_EVENTS:
                await this.handleNotificationEvent(eventData, eventType);
                break;
              default:
                console.log(`📋 Evento de ${topic} registrado: ${eventType}`);
            }
          } catch (error) {
            console.error('❌ Error procesando mensaje de Kafka:', error);
          }
        },
      });

      console.log('🔄 Consumer iniciado y escuchando eventos');
    } catch (error) {
      console.error('❌ Error iniciando consumer:', error);
      throw error;
    }
  }

  // ================================
  // EVENT HANDLERS
  // ================================

  private async handleAuthEvent(eventData: any, eventType: string): Promise<void> {
    try {
      switch (eventType) {
        case KAFKA_EVENT_TYPES.PASSWORD_CHANGED:
          console.log(`🔑 Contraseña cambiada para usuario: ${eventData.userId}`);
          // Aquí podrías actualizar algo en user-management si es necesario
          break;
        
        case KAFKA_EVENT_TYPES.USER_LOGIN:
          console.log(`🚪 Usuario logueado: ${eventData.userId}`);
          // Podrías actualizar lastLogin o similar
          break;
          
        case KAFKA_EVENT_TYPES.USER_LOGOUT:
          console.log(`👋 Usuario deslogueado: ${eventData.userId}`);
          break;

        case KAFKA_EVENT_TYPES.USER_LOCKED:
          console.log(`🔒 Usuario bloqueado: ${eventData.userId}`);
          break;
          
        default:
          console.log(`📋 Evento de auth no manejado: ${eventType}`);
      }
    } catch (error) {
      console.error('❌ Error manejando evento de auth:', error);
    }
  }

  private async handleNotificationEvent(eventData: any, eventType: string): Promise<void> {
    try {
      switch (eventType) {
        case KAFKA_EVENT_TYPES.EMAIL_SENT:
          console.log(`📧 Email enviado a: ${eventData.recipient}`);
          break;
          
        case KAFKA_EVENT_TYPES.EMAIL_FAILED:
          console.log(`📧❌ Falló envío de email a: ${eventData.recipient}`);
          break;

        case KAFKA_EVENT_TYPES.SMS_SENT:
          console.log(`📱 SMS enviado a: ${eventData.recipient}`);
          break;
          
        case KAFKA_EVENT_TYPES.SMS_FAILED:
          console.log(`📱❌ Falló envío de SMS a: ${eventData.recipient}`);
          break;
          
        default:
          console.log(`📋 Evento de notificación no manejado: ${eventType}`);
      }
    } catch (error) {
      console.error('❌ Error manejando evento de notificación:', error);
    }
  }

  // ================================
  // HEALTH CHECK
  // ================================

  async healthCheck(): Promise<boolean> {
    try {
      if (!this.isInitialized) {
        return false;
      }

      // Verificar conexiones
      if (!this.isProducerConnected || !this.isConsumerConnected) {
        return false;
      }

      return true;
    } catch (error) {
      console.error('❌ Health check fallido:', error);
      return false;
    }
  }

  // ================================
  // UTILS
  // ================================

  getConnectionStatus(): { producer: boolean; consumer: boolean; initialized: boolean } {
    return {
      producer: this.isProducerConnected,
      consumer: this.isConsumerConnected,
      initialized: this.isInitialized
    };
  }

  async flushEvents(): Promise<void> {
    try {
      if (this.isProducerConnected) {
        await this.producer.send({
          topic: KAFKA_TOPICS.USER_EVENTS,
          messages: []
        });
        console.log('🔄 Eventos flusheados');
      }
    } catch (error) {
      console.error('❌ Error flusheando eventos:', error);
    }
  }

  // ================================
  // TESTING METHODS
  // ================================

  async publishTestEvent(topic: string, eventType: string, data: any): Promise<void> {
    try {
      if (!this.isProducerConnected) {
        throw new Error('Producer no está conectado');
      }

      const message = {
        key: `test-${Date.now()}`,
        value: JSON.stringify({
          eventType,
          data,
          timestamp: new Date().toISOString(),
          service: 'user-management-service',
          isTest: true
        }),
        headers: {
          eventType,
          service: 'user-management-service',
          version: '1.0.0',
          isTest: 'true'
        }
      };

      await this.producer.send({
        topic,
        messages: [message]
      });

      console.log(`📤 Evento de prueba publicado: ${eventType} en topic ${topic}`);
    } catch (error) {
      console.error('❌ Error publicando evento de prueba:', error);
      throw error;
    }
  }
}

// Singleton instance
export const eventService = new EventService();
