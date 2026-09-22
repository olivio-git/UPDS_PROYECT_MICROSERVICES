import cors from 'cors';
import dotenv from 'dotenv';
import express, { Router } from 'express';
import helmet from 'helmet';
import { createServer } from 'http';
import mongoose from 'mongoose';

// Importar servicios y controladores
import { TechnicalVerificationController } from './controllers/TechnicalVerificationController';
import {
  authenticate,
  requireOwnershipOrReadRole,
  requireVerificationOwnership,
  verifyServiceToken,
} from './middleware/auth.middleware';
import { logger } from './utils/logger';
import type { NextFunction, Request, Response } from 'express';

// Cargar variables de entorno
dotenv.config();

class SessionManagerServer {
  private app: express.Application;
  private server: any;
  private technicalVerificationController: TechnicalVerificationController;

  constructor() {
    this.app = express();
    this.server = createServer(this.app);

    this.technicalVerificationController = new TechnicalVerificationController();

    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  /**
   * Configurar middleware de Express
   */
  private setupMiddleware(): void {
    // Middleware de seguridad - más permisivo para desarrollo
    this.app.use(helmet({
      contentSecurityPolicy: false, // Deshabilitado para desarrollo
      crossOriginEmbedderPolicy: false,
    }));

    // Configuración CORS
    const corsConfig = {
      origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
        if (!origin) return callback(null, true);

        const allowedOrigins: (string | RegExp)[] = [
          'http://localhost:3000',
          'http://localhost:3001',
          'http://localhost:3002',
          'http://localhost:5173',
          /^http:\/\/localhost:\d+$/
        ];

        const isAllowed = allowedOrigins.some(allowed => {
          if (typeof allowed === 'string') return allowed === origin;
          return allowed.test(origin);
        });

        callback(null, isAllowed);
      },
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Service'],
      credentials: true
    };

    this.app.use(cors(corsConfig));

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Logging mejorado
    this.app.use((req, res, next) => {
      const start = Date.now();

      res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`${req.method} ${req.url} - ${res.statusCode} (${duration}ms) - Origin: ${req.get('Origin') || 'none'}`);
      });

      next();
    });

    // Configurar trust proxy
    this.app.set('trust proxy', true);
  }

  /**
   * Configurar rutas de la API
   */
  private setupRoutes(): void {
    // Ruta de salud básica
    this.app.get('/', (req, res) => {
      res.json({
        service: 'session-manager-service',
        version: process.env.npm_package_version || '1.0.0',
        status: 'running',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
      });
    });

    // Health check endpoint for Docker
    this.app.get('/health', (req, res) => {
      res.status(200).json({
        status: 'healthy',
        service: 'session-manager-service',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      });
    });

    // Rutas de la API (authenticated — see getTechnicalRoutes)
    this.app.use('/api/v1/technical', this.getTechnicalRoutes());

    // Internal, service-to-service routes. NOT proxied by nginx (see
    // nginx/nginx.conf, only /api/v1/technical is exposed there) — reachable
    // only from inside the Docker network, and additionally guarded by
    // verifyServiceToken.
    this.app.use('/internal/technical', verifyServiceToken, this.getInternalTechnicalRoutes());

    // Ruta para métricas (opcional)
    this.app.get('/metrics', async (req, res) => {
      try {
        const metrics = await this.getSystemMetrics();
        res.json(metrics);
      } catch (error) {
        logger.error('Error getting metrics:', error);
        res.status(500).json({ error: 'Error retrieving metrics' });
      }
    });

    // Manejo de rutas no encontradas
    this.app.use('*', (req, res) => {
      // Solo log rutas que no sean health checks repetitivos
      if (req.originalUrl !== '/' && req.originalUrl !== '/health') {
        console.log('❌ 404 - Route not found:', req.method, req.originalUrl, 'Origin:', req.get('Origin') || 'none');
      }
      res.status(404).json({
        success: false,
        message: 'Endpoint not found',
        path: req.originalUrl
      });
    });
  }

  /**
   * Configurar manejo de errores
   */
  private setupErrorHandling(): void {
    // Manejo de errores de Express
    this.app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      logger.error('Express error:', error);

      if (error.type === 'entity.parse.failed') {
        res.status(400).json({
          success: false,
          message: 'JSON inválido en el cuerpo de la petición'
        });
        return;
      }

      if (error.type === 'entity.too.large') {
        res.status(413).json({
          success: false,
          message: 'Payload demasiado grande'
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
      });
    });

    // Manejo de promesas rechazadas no capturadas
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });

    // Manejo de excepciones no capturadas
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);

      // Intentar cerrar gracefully
      this.gracefulShutdown('UNCAUGHT_EXCEPTION');
    });

    // Manejo de señales del sistema
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received');
      this.gracefulShutdown('SIGTERM');
    });

    process.on('SIGINT', () => {
      logger.info('SIGINT received');
      this.gracefulShutdown('SIGINT');
    });
  }

  /**
   * Rutas para verificación técnica
   */
  private getTechnicalRoutes() {
    const router = Router();
    const controller = this.technicalVerificationController;
    const ownRead = requireVerificationOwnership('read');
    const ownWrite = requireVerificationOwnership('write');

    // Every route below requires a valid access token. Ownership rules:
    //  - /:verificationId routes: caller must own the record (write routes),
    //    or own it / hold admin|teacher|proctor for the GET (read).
    //  - /user/:userId routes: caller must be that user, or hold
    //    admin|teacher|proctor for the GET (monitoring), never for writes.
    router.post('/init', authenticate, this.requireBodyUserIdIsSelf, controller.initializeVerification.bind(controller));
    router.get('/:verificationId', authenticate, ownRead, controller.getVerification.bind(controller));
    router.get('/user/:userId', authenticate, requireOwnershipOrReadRole, controller.getUserVerification.bind(controller));
    router.post('/:verificationId/browser', authenticate, ownWrite, controller.updateBrowserInfo.bind(controller));
    router.post('/:verificationId/permissions', authenticate, ownWrite, controller.updatePermissions.bind(controller));
    router.post('/:verificationId/devices', authenticate, ownWrite, controller.updateDevices.bind(controller));
    router.post('/:verificationId/network-test', authenticate, ownWrite, controller.testNetworkConnection.bind(controller));
    router.post('/:verificationId/microphone-test', authenticate, ownWrite, controller.verifyMicrophone.bind(controller));
    router.post('/:verificationId/camera-test', authenticate, ownWrite, controller.verifyCamera.bind(controller));
    router.post('/:verificationId/audio-test', authenticate, ownWrite, controller.verifyAudio.bind(controller));
    router.post('/:verificationId/finalize', authenticate, ownWrite, controller.finalizeVerification.bind(controller));
    router.get('/user/:userId/can-proceed', authenticate, requireOwnershipOrReadRole, controller.canUserProceed.bind(controller));
    router.post('/:verificationId/mark-used', authenticate, ownWrite, controller.markVerificationUsed.bind(controller));
    router.get('/stats', authenticate, controller.getVerificationStats.bind(controller));

    return router;
  }

  /**
   * POST /init carries userId in the body, not the path — a user may only
   * initialize their own verification.
   */
  private requireBodyUserIdIsSelf(req: Request, res: Response, next: NextFunction): void {
    const bodyUserId = req.body?.userId;
    if (bodyUserId && req.user && bodyUserId !== req.user.userId) {
      res.status(403).json({ success: false, message: 'Forbidden: cannot initialize verification for another user' });
      return;
    }
    next();
  }

  /**
   * Internal, service-to-service routes (see verifyServiceToken above).
   */
  private getInternalTechnicalRoutes() {
    const router = Router();
    router.get('/can-proceed/:userId', this.technicalVerificationController.internalCanProceed.bind(this.technicalVerificationController));
    return router;
  }

  /**
   * Conectar a MongoDB
   */
  private async connectToMongoDB(): Promise<void> {
    try {
      const mongoUri = process.env.MONGO_URI;

      if (!mongoUri) {
        throw new Error('MONGO_URI environment variable is required');
      }

      await mongoose.connect(mongoUri, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        bufferCommands: false // removed deprecated/unsupported bufferMaxEntries
      });

      logger.info('✅ Conectado a MongoDB');

      // Configurar eventos de MongoDB
      mongoose.connection.on('error', (error) => {
        logger.error('MongoDB connection error:', error);
      });

      mongoose.connection.on('disconnected', () => {
        logger.warn('📡 MongoDB desconectado');
      });

      mongoose.connection.on('reconnected', () => {
        logger.info('📡 MongoDB reconectado');
      });

    } catch (error) {
      logger.error('❌ Error conectando a MongoDB:', error);
      throw error;
    }
  }

  /**
   * Obtener métricas del sistema
   */
  private async getSystemMetrics(): Promise<any> {
    try {
      const memoryUsage = process.memoryUsage();
      const uptime = process.uptime();

      // Métricas de MongoDB
      const mongoStats = mongoose.connection.readyState === 1 ? {
        connected: true,
        collections: (await mongoose.connection.db.collections()).length
      } : {
        connected: false
      };

      return {
        timestamp: new Date().toISOString(),
        service: 'session-manager-service',
        version: process.env.npm_package_version || '1.0.0',
        uptime: `${Math.floor(uptime / 60)}m ${Math.floor(uptime % 60)}s`,
        memory: {
          used: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
          total: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
          rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`
        },
        database: mongoStats,
        environment: process.env.NODE_ENV || 'development'
      };

    } catch (error) {
      logger.error('Error getting system metrics:', error);
      throw error;
    }
  }

  /**
   * Cierre graceful del servidor
   */
  private async gracefulShutdown(signal: string): Promise<void> {
    logger.info(`🔄 Iniciando cierre graceful del servidor (${signal})`);

    try {
      // Parar de aceptar nuevas conexiones
      this.server.close(() => {
        logger.info('📡 Servidor HTTP cerrado');
      });

      // Cerrar conexión a MongoDB
      await mongoose.connection.close();
      logger.info('📡 MongoDB desconectado');

      logger.info('✅ Cierre graceful completado');
      process.exit(0);

    } catch (error) {
      logger.error('❌ Error durante cierre graceful:', error);
      process.exit(1);
    }
  }

  /**
   * Iniciar el servidor
   */
  public async start(): Promise<void> {
    try {
      // Conectar a MongoDB
      await this.connectToMongoDB();

      // Iniciar servidor
      const port = process.env.PORT || 3004;

      this.server.listen(port, () => {
        logger.info(`🚀 Session Manager Service iniciado en puerto ${port}`);
        logger.info(`🌐 API REST disponible en http://localhost:${port}/api/v1`);
        logger.info(`🏥 Health check en http://localhost:${port}/health`);
      });

    } catch (error) {
      logger.error('❌ Error iniciando servidor:', error);
      process.exit(1);
    }
  }
}

// Inicializar y ejecutar servidor
const server = new SessionManagerServer();
server.start().catch((error) => {
  logger.error('Fatal error starting server:', error);
  process.exit(1);
});

export default SessionManagerServer;
