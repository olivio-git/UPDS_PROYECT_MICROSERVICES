import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export const env = {
  // Server
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3003', 10),
  
  // Database
  MONGO_URI: process.env.MONGO_URI || 'mongodb://localhost:27017/cba_platform',
  MONGO_DB_NAME: process.env.MONGO_DB_NAME || 'cba_platform',
  // User-management-service database (used for User/Candidate lookups via useDb)
  MONGO_UMS_DB_NAME: process.env.MONGO_UMS_DB_NAME || 'cba_user_management_db',
  
  // Redis
  REDIS_HOST: process.env.REDIS_HOST || 'localhost',
  REDIS_PORT: parseInt(process.env.REDIS_PORT || '6379', 10),
  REDIS_PASSWORD: process.env.REDIS_PASSWORD || '',
  
  // Kafka
  KAFKA_BROKER: process.env.KAFKA_BROKER || 'localhost:9092',
  KAFKA_GROUP_ID: process.env.KAFKA_GROUP_ID || 'exam-service',
  KAFKA_CLIENT_ID: process.env.KAFKA_CLIENT_ID || 'exam-service-client',
  
  // Auth Service
  AUTH_SERVICE_URL: process.env.AUTH_SERVICE_URL || 'http://localhost:3000',

  // Grading Service
  GRADING_SERVICE_URL: process.env.GRADING_SERVICE_URL || 'http://grading-service:3007',

  // User Management Service (internal)
  USER_MANAGEMENT_SERVICE_URL: process.env.USER_MANAGEMENT_SERVICE_URL || 'http://user-management-service:3002',
  JWT_SECRET: process.env.JWT_SECRET || 'your-secret-key',
  
  // MinIO Configuration
  MINIO_ENDPOINT: process.env.MINIO_ENDPOINT || 'localhost',
  MINIO_PORT: parseInt(process.env.MINIO_PORT || '9000', 10),
  MINIO_USE_SSL: process.env.MINIO_USE_SSL === 'true',
  MINIO_ACCESS_KEY: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  MINIO_SECRET_KEY: process.env.MINIO_SECRET_KEY || 'minioadmin',
  MINIO_BUCKET_NAME: process.env.MINIO_BUCKET_NAME || 'exam-files',
  MINIO_PUBLIC_URL: process.env.MINIO_PUBLIC_URL || '', // URL pública para acceso externo
  MINIO_PUBLIC_ENDPOINT: process.env.MINIO_PUBLIC_ENDPOINT || 'localhost', // Endpoint público para URLs
  MINIO_INTERNAL_ENDPOINT: process.env.MINIO_INTERNAL_ENDPOINT || '', // URL interna Docker (e.g. http://minio:9000)
  
  // Logging
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  LOG_FILE: process.env.LOG_FILE || 'logs/exam-service.log',
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
  RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  
  // File Upload
  MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10), // 10MB
  ALLOWED_FILE_TYPES: process.env.ALLOWED_FILE_TYPES?.split(',') || ['pdf', 'doc', 'docx', 'mp3', 'mp4', 'jpg', 'jpeg', 'png'],
  
  // AWS S3 (optional, for production)
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID || '',
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY || '',
  AWS_REGION: process.env.AWS_REGION || 'us-east-1',
  AWS_S3_BUCKET: process.env.AWS_S3_BUCKET || 'cba-exam-files'
};

// Validate required environment variables
const requiredEnvVars = ['MONGO_URI', 'JWT_SECRET'];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`❌ Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}