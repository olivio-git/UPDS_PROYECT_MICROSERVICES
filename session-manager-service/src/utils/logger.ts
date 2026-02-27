import winston from 'winston';

// Safe JSON stringify function that handles circular references
const safeStringify = (obj: any, space?: number): string => {
  const seen = new WeakSet();
  return JSON.stringify(obj, (key, val) => {
    if (val !== null && typeof val === 'object') {
      if (seen.has(val)) {
        return '[Circular]';
      }
      seen.add(val);
    }
    return val;
  }, space);
};

// Configurar formato de logs
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.printf((info) => {
    return safeStringify(info);
  })
);

// Configurar formato para consola
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'HH:mm:ss'
  }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let log = `${timestamp} [${level}]: ${message}`;
    
    if (Object.keys(meta).length > 0) {
      log += ` ${safeStringify(meta, 2)}`;
    }
    
    return log;
  })
);

// Crear logger
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { 
    service: 'session-manager-service',
    version: process.env.npm_package_version || '1.0.0'
  },
  transports: [
    // Console transport
    new winston.transports.Console({
      format: consoleFormat,
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug'
    }),

    // File transport para errores
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      tailable: true
    }),

    // File transport para todos los logs
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 10,
      tailable: true
    })
  ],

  // Manejar excepciones no capturadas
  exceptionHandlers: [
    new winston.transports.File({ 
      filename: 'logs/exceptions.log',
      maxsize: 10 * 1024 * 1024,
      maxFiles: 3
    })
  ],

  // Manejar promesas rechazadas
  rejectionHandlers: [
    new winston.transports.File({ 
      filename: 'logs/rejections.log',
      maxsize: 10 * 1024 * 1024,
      maxFiles: 3
    })
  ]
});

// Crear directorio de logs si no existe
import { existsSync, mkdirSync } from 'fs';
if (!existsSync('logs')) {
  mkdirSync('logs');
}

// Agregar métodos de conveniencia
export const loggerUtils = {
  /**
   * Log para eventos de sesión
   */
  sessionEvent: (sessionId: string, event: string, data?: any) => {
    logger.info(`Session Event: ${event}`, {
      sessionId,
      event,
      data,
      category: 'session'
    });
  },

  /**
   * Log para eventos de usuario
   */
  userEvent: (userId: string, event: string, sessionId?: string, data?: any) => {
    logger.info(`User Event: ${event}`, {
      userId,
      sessionId,
      event,
      data,
      category: 'user'
    });
  },

  /**
   * Log para errores de evaluación
   */
  evaluationError: (questionId: string, userId: string, error: any) => {
    logger.error('Evaluation Error', {
      questionId,
      userId,
      error: error.message || error,
      stack: error.stack,
      category: 'evaluation'
    });
  },

  /**
   * Log para eventos de Kafka
   */
  kafkaEvent: (topic: string, event: string, data?: any) => {
    logger.debug(`Kafka Event: ${event}`, {
      topic,
      event,
      data,
      category: 'kafka'
    });
  },

  /**
   * Log para métricas de rendimiento
   */
  performance: (operation: string, duration: number, metadata?: any) => {
    logger.info(`Performance: ${operation}`, {
      operation,
      duration: `${duration}ms`,
      metadata,
      category: 'performance'
    });
  },

  /**
   * Log para eventos de conexión WebSocket
   */
  socketEvent: (socketId: string, userId: string, event: string, sessionId?: string) => {
    logger.debug(`Socket Event: ${event}`, {
      socketId,
      userId,
      sessionId,
      event,
      category: 'socket'
    });
  },

  /**
   * Log para eventos de seguridad
   */
  securityEvent: (userId: string, event: string, details?: any) => {
    logger.warn(`Security Event: ${event}`, {
      userId,
      event,
      details,
      category: 'security',
      timestamp: new Date().toISOString()
    });
  },

  /**
   * Log para eventos de base de datos
   */
  dbEvent: (operation: string, collection: string, duration?: number, error?: any) => {
    if (error) {
      logger.error(`DB Error: ${operation}`, {
        operation,
        collection,
        error: error.message || error,
        category: 'database'
      });
    } else {
      logger.debug(`DB Operation: ${operation}`, {
        operation,
        collection,
        duration: duration ? `${duration}ms` : undefined,
        category: 'database'
      });
    }
  },

  /**
   * Log para eventos de servicios externos
   */
  externalServiceEvent: (service: string, operation: string, success: boolean, duration?: number, error?: any) => {
    const level = success ? 'info' : 'error';
    const message = `External Service: ${service} - ${operation}`;
    
    logger.log(level, message, {
      service,
      operation,
      success,
      duration: duration ? `${duration}ms` : undefined,
      error: error?.message || error,
      category: 'external'
    });
  }
};

// Middleware para logging de Express
export const expressLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({
      filename: 'logs/access.log',
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5
    })
  ]
});

// En modo desarrollo, también mostrar logs HTTP en consola
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

export default logger;
