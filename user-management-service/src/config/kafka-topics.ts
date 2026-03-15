// src/config/kafka-topics.ts - Configuración de topics de Kafka

export const KAFKA_TOPICS = {
  // User Management Topics (este servicio los produce)
  USER_EVENTS: 'user-events',
  CANDIDATE_EVENTS: 'candidate-events',
  
  // Topics de otros servicios (este servicio los consume)
  AUTH_EVENTS: 'auth-events',
  NOTIFICATION_EVENTS: 'notification-events',
  EMAIL_EVENTS: 'email-events',
  
  // Topics futuros
  EXAM_EVENTS: 'exam-events',
  SESSION_EVENTS: 'session-events',
  RESULT_EVENTS: 'result-events'
} as const;

export const KAFKA_EVENT_TYPES = {
  // User Events
  USER_CREATED: 'USER_CREATED',
  USER_UPDATED: 'USER_UPDATED',
  USER_DELETED: 'USER_DELETED',
  USER_STATUS_CHANGED: 'USER_STATUS_CHANGED',
  USER_ROLE_CHANGED: 'USER_ROLE_CHANGED',
  USER_PASSWORD_CHANGED: 'USER_PASSWORD_CHANGED',
  
  // Candidate Events
  CANDIDATE_REGISTERED: 'CANDIDATE_REGISTERED',
  CANDIDATE_UPDATED: 'CANDIDATE_UPDATED',
  CANDIDATE_DELETED: 'CANDIDATE_DELETED',
  CANDIDATE_STATUS_CHANGED: 'CANDIDATE_STATUS_CHANGED',
  
  // Auth Events (consumed)
  PASSWORD_CHANGED: 'PASSWORD_CHANGED',
  USER_LOGIN: 'USER_LOGIN',
  USER_LOGOUT: 'USER_LOGOUT',
  USER_LOCKED: 'USER_LOCKED',
  
  // Notification Events (consumed)
  EMAIL_SENT: 'EMAIL_SENT',
  EMAIL_FAILED: 'EMAIL_FAILED',
  SMS_SENT: 'SMS_SENT',
  SMS_FAILED: 'SMS_FAILED'
} as const;

export type UserEventType = typeof KAFKA_EVENT_TYPES[keyof Pick<typeof KAFKA_EVENT_TYPES, 
  'USER_CREATED' | 'USER_UPDATED' | 'USER_DELETED' | 'USER_STATUS_CHANGED' | 'USER_ROLE_CHANGED' | 'USER_PASSWORD_CHANGED'>];

export type CandidateEventType = typeof KAFKA_EVENT_TYPES[keyof Pick<typeof KAFKA_EVENT_TYPES, 
  'CANDIDATE_REGISTERED' | 'CANDIDATE_UPDATED' | 'CANDIDATE_DELETED' | 'CANDIDATE_STATUS_CHANGED'>];

export type ConsumedEventType = typeof KAFKA_EVENT_TYPES[keyof Pick<typeof KAFKA_EVENT_TYPES, 
  'PASSWORD_CHANGED' | 'USER_LOGIN' | 'USER_LOGOUT' | 'USER_LOCKED' | 'EMAIL_SENT' | 'EMAIL_FAILED' | 'SMS_SENT' | 'SMS_FAILED'>];

// Configuración de tópicos con sus metadatos
export const TOPIC_CONFIG = {
  [KAFKA_TOPICS.USER_EVENTS]: {
    description: 'Eventos relacionados con usuarios (creación, actualización, eliminación)',
    producer: 'user-management-service',
    consumers: ['auth-service', 'notification-service', 'audit-service'],
    schema: {
      eventType: 'string',
      userId: 'string',
      userData: 'object',
      updatedBy: 'string?',
      timestamp: 'date',
      metadata: 'object?'
    }
  },
  [KAFKA_TOPICS.CANDIDATE_EVENTS]: {
    description: 'Eventos relacionados con candidatos a exámenes',
    producer: 'user-management-service',
    consumers: ['exam-service', 'notification-service', 'audit-service'],
    schema: {
      eventType: 'string',
      candidateId: 'string',
      candidateData: 'object',
      updatedBy: 'string?',
      timestamp: 'date',
      metadata: 'object?'
    }
  },
  [KAFKA_TOPICS.AUTH_EVENTS]: {
    description: 'Eventos del servicio de autenticación',
    producer: 'auth-service',
    consumers: ['user-management-service', 'audit-service']
  },
  [KAFKA_TOPICS.NOTIFICATION_EVENTS]: {
    description: 'Eventos del servicio de notificaciones',
    producer: 'notification-service',
    consumers: ['user-management-service', 'audit-service']
  }
} as const;
