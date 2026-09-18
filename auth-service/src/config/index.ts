import dotenv from 'dotenv';

dotenv.config();

/**
 * Reads a required secret from the environment.
 *
 * Throws at startup instead of falling back to a default: a service that signs
 * or verifies tokens with a guessable literal is worse than one that refuses to
 * boot, because the failure is silent and each service would pick a different
 * default, breaking cross-service token validation with no error.
 */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. Refusing to start with an insecure default.`
    );
  }
  return value;
}

export const config = {
  app: {
    port: parseInt(process.env.PORT || '3000'),
    nodeEnv: process.env.NODE_ENV || 'development',
    corsOrigin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
  },
  
  database: {
    mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017',
    dbName: process.env.MONGO_DB_NAME || 'auth_db',
    collections: {
      users: process.env.MONGO_COLLECTION_USERS || 'users',
      sessions: process.env.MONGO_COLLECTION_SESSIONS || 'sessions'
    }
  },

  redis: {
    uri: process.env.REDIS_URI || 'redis://localhost:6379',
    sessionPrefix: process.env.REDIS_SESSION_PREFIX || 'auth:session:',
    blacklistPrefix: process.env.REDIS_BLACKLIST_PREFIX || 'auth:blacklist:'
  },

  jwt: {
    secret: requireEnv('JWT_SECRET'),
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
    refreshSecret: requireEnv('REFRESH_TOKEN_SECRET'),
    refreshExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d'
  },

  kafka: {
    clientId: process.env.KAFKA_CLIENT_ID || 'auth-service',
    broker: process.env.KAFKA_BROKER || 'localhost:9092',
    topics: {
      userEvents: process.env.KAFKA_TOPIC_USER_EVENTS || 'user-events'
    }
  },

  service: {
    token: requireEnv('SERVICE_TOKEN'),
    allowDirectRegistration: process.env.ALLOW_DIRECT_REGISTRATION === 'true'
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info'
  }
};

// Validación de configuración crítica
const requiredEnvVars = ['JWT_SECRET', 'REFRESH_TOKEN_SECRET', 'MONGO_URI'];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`⚠️  Variable de entorno requerida faltante: ${envVar}`);
    process.exit(1);
  }
}

export default config;
