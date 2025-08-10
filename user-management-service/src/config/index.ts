import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

interface Config {
  // Server
  port: number;
  nodeEnv: string;
  
  // Database
  mongoUri: string;
  mongoDbName: string;
  collections: {
    users: string;
    candidates: string;
    roles: string;
  };
  
  // Redis
  redisUri: string;
  redis: {
    cachePrefix: string;
    sessionPrefix: string;
  };
  
  // Kafka
  kafka: {
    clientId: string;
    broker: string;
    topics: {
      userEvents: string;
      candidateEvents: string;
    };
  };
  
  // Auth Service Integration
  authService: {
    baseUrl: string;
    serviceToken: string;
  };
  
  // Security
  jwtSecret: string;
  
  // File Upload
  upload: {
    maxSize: number;
    allowedTypes: string[];
  };
  
  // CORS
  corsOrigin: string[];
  
  // Logging
  logLevel: string;
  
  // Import/Export
  import: {
    maxRecords: number;
    excelSheetName: string;
  };
}

const config: Config = {
  // Server
  port: parseInt(process.env.PORT || '3002', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Database
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017',
  mongoDbName: process.env.MONGO_DB_NAME || 'cba_platform_db',
  collections: {
    users: process.env.MONGO_COLLECTION_USERS || 'users',
    candidates: process.env.MONGO_COLLECTION_CANDIDATES || 'candidates',
    roles: process.env.MONGO_COLLECTION_ROLES || 'roles',
  },
  
  // Redis
  redisUri: process.env.REDIS_URI || 'redis://localhost:6379',
  redis: {
    cachePrefix: process.env.REDIS_CACHE_PREFIX || 'usermgmt:cache',
    sessionPrefix: process.env.REDIS_SESSION_PREFIX || 'usermgmt:session',
  },
  
  // Kafka
  kafka: {
    clientId: process.env.KAFKA_CLIENT_ID || 'user-management-service',
    broker: process.env.KAFKA_BROKER || 'localhost:9092',
    topics: {
      userEvents: process.env.KAFKA_TOPIC_USER_EVENTS || 'user-events',
      candidateEvents: process.env.KAFKA_TOPIC_CANDIDATE_EVENTS || 'candidate-events',
    },
  },
  
  // Auth Service Integration
  authService: {
    baseUrl: process.env.AUTH_SERVICE_URL || 'http://localhost:3000',
    serviceToken: process.env.SERVICE_TOKEN || 'auth-service-token-2024',
  },
  
  // Security
  jwtSecret: process.env.JWT_SECRET || 'default-secret-key',
  
  // File Upload
  upload: {
    maxSize: parseInt(process.env.UPLOAD_MAX_SIZE || '10485760', 10), // 10MB
    allowedTypes: (process.env.UPLOAD_ALLOWED_TYPES || '').split(','),
  },
  
  // CORS
  corsOrigin: (process.env.CORS_ORIGIN || 'http://localhost:3000').split(','),
  
  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',
  
  // Import/Export
  import: {
    maxRecords: parseInt(process.env.MAX_IMPORT_RECORDS || '1000', 10),
    excelSheetName: process.env.EXCEL_SHEET_NAME || 'Candidates',
  },
};

export default config;
