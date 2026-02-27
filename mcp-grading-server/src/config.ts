import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3007', 10),
  corsOrigin: process.env.CORS_ORIGIN || '*',
  groq: {
    apiKey: process.env.GROQ_API_KEY || '',
    model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
    temperature: 0.3,
    maxTokens: 1024,
  },
  mongo: {
    uri: process.env.MONGO_URI || 'mongodb://localhost:27017/cba_platform',
    dbName: process.env.MONGO_DB_NAME || 'cba_platform',
    levelsDbName: process.env.MONGO_LEVELS_DB_NAME || 'cba_user_management_db',
  },
  aiGradingService: {
    url: process.env.AI_GRADING_SERVICE_URL || 'http://localhost:3006',
  },
  notificationService: {
    url: process.env.NOTIFICATION_SERVICE_URL || 'http://notifications-service:3003',
  },
  examService: {
    url: process.env.EXAM_SERVICE_URL || 'http://exam-service:3003',
  },
  minio: {
    internalEndpoint: process.env.MINIO_INTERNAL_ENDPOINT || 'http://minio:9000',
    bucketName: process.env.MINIO_BUCKET_NAME || 'exam-files',
  },
  kafka: {
    broker: process.env.KAFKA_BROKER || 'kafka:9092',
    clientId: 'grading-service',
    topic: 'exam-events',
  },
};
