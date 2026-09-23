import dotenv from 'dotenv';

// Cargar variables de entorno
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
    // Auth module: refresh-token sessions, in the same database as users.
    sessions: string;
  };

  // Redis
  redisUri: string;
  redis: {
    cachePrefix: string;
    sessionPrefix: string;
    // Auth module prefixes (kept identical to what auth-service used, so a
    // redis instance carried over from before the merge keeps working).
    authSessionPrefix: string;
    authBlacklistPrefix: string;
  };

  // Kafka
  kafka: {
    clientId: string;
    broker: string;
    topics: {
      userEvents: string;
      candidateEvents: string;
      // Auth module: consumed by notifications-service.
      otpEvents: string;
      securityEvents: string;
    };
  };

  // Internal service-to-service auth (kept fail-fast even though the merge
  // removed the only caller that used it — see identity-service report).
  serviceToken: string;

  // Server-side OTP-before-password enforcement on /auth/login. See
  // auth.service.ts login() and otp.service.ts markLoginOtpVerified/
  // consumeLoginOtpVerification.
  otpLoginRequired: boolean;

  // Security
  jwtSecret: string;
  jwt: {
    secret: string;
    expiresIn: string;
    refreshSecret: string;
    refreshExpiresIn: string;
  };

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

const jwtSecret = requireEnv('JWT_SECRET');

const config: Config = {
  // Server
  port: parseInt(process.env.PORT || '3002', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  // Database
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017',
  mongoDbName: process.env.MONGO_DB_NAME || 'cba_identity_db',
  collections: {
    users: process.env.MONGO_COLLECTION_USERS || 'users',
    candidates: process.env.MONGO_COLLECTION_CANDIDATES || 'candidates',
    roles: process.env.MONGO_COLLECTION_ROLES || 'roles',
    sessions: process.env.MONGO_COLLECTION_SESSIONS || 'sessions',
  },

  // Redis
  redisUri: process.env.REDIS_URI || 'redis://localhost:6379',
  redis: {
    cachePrefix: process.env.REDIS_CACHE_PREFIX || 'usermgmt:cache',
    sessionPrefix: process.env.REDIS_SESSION_PREFIX || 'usermgmt:session',
    authSessionPrefix: process.env.AUTH_REDIS_SESSION_PREFIX || 'auth:session',
    authBlacklistPrefix: process.env.AUTH_REDIS_BLACKLIST_PREFIX || 'auth:blacklist',
  },

  // Kafka
  kafka: {
    clientId: process.env.KAFKA_CLIENT_ID || 'identity-service',
    broker: process.env.KAFKA_BROKER || 'localhost:9092',
    topics: {
      userEvents: process.env.KAFKA_TOPIC_USER_EVENTS || 'user-events',
      candidateEvents: process.env.KAFKA_TOPIC_CANDIDATE_EVENTS || 'candidate-events',
      otpEvents: process.env.KAFKA_TOPIC_OTP_EVENTS || 'otp-events',
      securityEvents: process.env.KAFKA_TOPIC_SECURITY_EVENTS || 'security-events',
    },
  },

  // Internal service token (SERVICE_TOKEN). No longer used to gate an
  // inter-service HTTP call now that registration/sync happen in-process,
  // but kept as a required env var per the merge decision, so a future
  // internal-only endpoint has one ready and deployments don't silently
  // drop the secret.
  serviceToken: requireEnv('SERVICE_TOKEN'),

  // OTP_LOGIN_REQUIRED defaults to TRUE when unset — only the literal string
  // 'false' turns it off. In production the flag is ignored outright and
  // enforcement is always on, so a misconfigured/missing env var can never
  // silently disable two-factor login on a real deployment.
  otpLoginRequired:
    (process.env.NODE_ENV || 'development') === 'production'
      ? true
      : process.env.OTP_LOGIN_REQUIRED !== 'false',

  // Security
  jwtSecret,
  jwt: {
    secret: jwtSecret,
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
    refreshSecret: requireEnv('REFRESH_TOKEN_SECRET'),
    refreshExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
  },

  // File Upload
  upload: {
    maxSize: parseInt(process.env.UPLOAD_MAX_SIZE || '10485760', 10), // 10MB
    allowedTypes: (process.env.UPLOAD_ALLOWED_TYPES || '').split(','),
  },

  // CORS
  corsOrigin: (process.env.CORS_ORIGIN || 'http://localhost:3000,http://localhost:5173').split(','),

  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',

  // Import/Export
  import: {
    maxRecords: parseInt(process.env.MAX_IMPORT_RECORDS || '1000', 10),
    excelSheetName: process.env.EXCEL_SHEET_NAME || 'Candidates',
  },
};

console.log(
  `[identity-service] OTP-before-password login enforcement: ${config.otpLoginRequired ? 'ON' : 'OFF'}` +
    (config.nodeEnv === 'production' ? ' (forced ON in production, OTP_LOGIN_REQUIRED is ignored)' : ` (OTP_LOGIN_REQUIRED=${process.env.OTP_LOGIN_REQUIRED ?? '<unset, defaults to true>'})`)
);

export default config;
