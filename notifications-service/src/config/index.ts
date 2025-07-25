import dotenv from 'dotenv';

dotenv.config();

export const config = {
  app: {
    port: parseInt(process.env.PORT || '3000'),
    nodeEnv: process.env.NODE_ENV || 'development',
    corsOrigin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
  },
  
  database: {
    mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017',
    dbName: process.env.MONGO_DB_NAME || 'notifications_db',
    collections: {
      emails: process.env.MONGO_COLLECTION_EMAILS || 'notification_emails',
      templates: process.env.MONGO_COLLECTION_TEMPLATES || 'email_templates'
    }
  },

  redis: {
    uri: process.env.REDIS_URI || 'redis://localhost:6379',
    cachePrefix: process.env.REDIS_CACHE_PREFIX || 'notifications:cache:',
    queuePrefix: process.env.REDIS_QUEUE_PREFIX || 'notifications:queue:'
  },

  kafka: {
    clientId: process.env.KAFKA_CLIENT_ID || 'notifications-service',
    broker: process.env.KAFKA_BROKER || 'localhost:9092',
    groupId: process.env.KAFKA_GROUP_ID || 'notifications-group',
    topics: {
      userEvents: process.env.KAFKA_TOPICS_USER_EVENTS || 'user-events',
      otpEvents: process.env.KAFKA_TOPICS_OTP_EVENTS || 'otp-events',
      emailEvents: process.env.KAFKA_TOPICS_EMAIL_EVENTS || 'email-events'
    }
  },

  resend: {
    apiKey: process.env.RESEND_API_KEY || '',
    fromEmail: process.env.RESEND_FROM_EMAIL || 'noreply@oliviodev.com',
    fromName: process.env.RESEND_FROM_NAME || 'CBA Platform'
  },

  email: {
    retryAttempts: parseInt(process.env.EMAIL_RETRY_ATTEMPTS || '3'),
    retryDelay: parseInt(process.env.EMAIL_RETRY_DELAY || '5000'),
    batchSize: parseInt(process.env.EMAIL_BATCH_SIZE || '50')
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info'
  }
};

// Validación de configuración crítica
const requiredEnvVars = ['RESEND_API_KEY', 'MONGO_URI'];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`⚠️  Variable de entorno requerida faltante: ${envVar}`);
    process.exit(1);
  }
}

export default config;
