import cors from 'cors';
import dotenv from 'dotenv';
import express, { Application } from 'express';
import helmet from 'helmet';
import { createServer } from 'http';
import morgan from 'morgan';
import { Server as SocketIOServer } from 'socket.io';
import { connectDatabase } from './config/database';
import { initKafka } from './config/kafka';
import { connectRedis } from './config/redis';
import { errorHandler } from './middleware/errorHandler.middleware';
import routes from './routes/index';
import { internalRoutes } from './routes/internal.routes';
import { systemMonitoringService } from './services/systemMonitoring.service';
import { logger } from './utils/logger';

// Import models to register them with mongoose
import './models/exam.model';
import './models/level.model';
import './models/question.model';
import './models/response.model';
import './models/rubric.model';
import './models/session.model';
import './models/user.model';

// Load environment variables
dotenv.config();

// Create Express app
const app: Application = express();
const server = createServer(app);
const PORT = process.env.PORT || 3003;
const MONITORING_PORT = process.env.MONITORING_PORT || 3004;

// Create Socket.IO server for monitoring
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? process.env.ALLOWED_ORIGINS?.split(',') || []
      : ['http://localhost:3000', 'http://localhost:5173'],
    methods: ['GET', 'POST'],
    credentials: true
  },
  path: '/socket.io/'
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined', { stream: { write: (message) => logger.info(message.trim()) } }));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'exam-service',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Health check endpoint (simple for connectivity tests)
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    service: 'exam-service',
    timestamp: new Date().toISOString()
  });
});

// API routes
app.use('/api/v1', routes);

// Internal service-to-service routes (not exposed via nginx, Docker network only)
app.use('/internal', internalRoutes);

// Error handling
app.use(errorHandler);

// Start server
const startServer = async () => {
  try {
    // ✅ AGREGAR VERIFICACIÓN DE VARIABLES DE ENTORNO
    logger.info('🔍 Environment variables check:');
    logger.info(`  - REDIS_HOST: ${process.env.REDIS_HOST}`);
    logger.info(`  - REDIS_PORT: ${process.env.REDIS_PORT}`);
    logger.info(`  - REDIS_PASSWORD: ${process.env.REDIS_PASSWORD ? 'SET' : 'NOT SET'}`);
    logger.info(`  - MONGO_URI: ${process.env.MONGO_URI?.substring(0, 50)}...`);
    logger.info(`  - KAFKA_BROKER: ${process.env.KAFKA_BROKER}`);
    logger.info(`  - PORT: ${process.env.PORT || '3003'}`);

    // Connect to databases and services
    await connectDatabase();
    await connectRedis();
    await initKafka();

    // Initialize system monitoring
    systemMonitoringService.initializeWebSocket(io);

    // Start the main server
    server.listen(PORT, () => {
      logger.info(`🚀 Exam Service running on port ${PORT}`);
      logger.info(`📍 Health check: http://localhost:${PORT}/health`);
      logger.info(`📊 System monitoring WebSocket available on port ${PORT}`);
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (error) => {
  logger.error('Unhandled Rejection:', error);
  process.exit(1);
});