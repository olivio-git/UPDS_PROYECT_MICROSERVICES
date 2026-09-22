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
    // Candidates now live in identity-service's own database (post auth+user-management
    // merge — see exam-service/src/models/candidate.model.ts useDb('cba_identity_db')).
    // Levels stay in the exam DB (same as attempts/exams), so getLevels() reuses getDB().
    candidatesDbName: process.env.MONGO_CANDIDATES_DB_NAME || 'cba_identity_db',
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
    broker: process.env.KAFKA_BROKER || 'kafka:29092',
    clientId: 'grading-service',
    topic: 'exam-events',
  },
  gradingSweep: {
    // How often the reconciliation sweeper runs. 0 or negative disables it.
    intervalMs: parseInt(process.env.GRADING_SWEEP_INTERVAL_MS || '120000', 10),
    // Only sweep attempts finished longer ago than this, so the sweeper never
    // races the normal fire-and-forget HTTP grading call from exam-service.
    minAgeMs: parseInt(process.env.GRADING_SWEEP_MIN_AGE_MS || '180000', 10),
    // Per-run cap on how many ungraded attempts to grade in a single tick.
    batchSize: parseInt(process.env.GRADING_SWEEP_BATCH || '20', 10),
  },
};
