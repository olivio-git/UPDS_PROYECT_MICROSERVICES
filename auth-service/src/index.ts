import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import { config } from './config';
import DatabaseConnections from './database/connections';

// Repositories
import { UserRepository } from './repositories/user.repository';
import { CacheRepository } from './repositories/cache.repository';

// Services
import { JwtService } from './services/jwt.service';
import { AuthService } from './services/auth.service';
import { EventService } from './services/event.service';
import { OtpService } from './services/otp.service';

// Controllers
import { AuthController } from './controllers/auth.controller';
import { OtpController } from './controllers/otp.controller';

// Middleware
import { AuthMiddleware } from './middleware/auth.middleware';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';

// Routes
import { createAuthRoutes } from './routes/auth.routes';

class AuthServiceApp {
  private app: express.Application;
  private dbConnections: DatabaseConnections;

  constructor() {
    this.app = express();
    this.dbConnections = DatabaseConnections.getInstance();
    this.setupMiddleware();
  }

  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet());
    
    // CORS
    this.app.use(cors({
      origin: config.app.corsOrigin,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      allowedHeaders: ['Content-Type', 'Authorization']
    }));

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Logging
    if (config.app.nodeEnv === 'development') {
      this.app.use(morgan('dev'));
    } else {
      this.app.use(morgan('combined'));
    }

    // Trust proxy for accurate IP addresses
    this.app.set('trust proxy', 1);
  }

  private async initializeDependencies() {
    console.log('🚀 Inicializando dependencias...');
    
    // Conectar a las bases de datos
    const database = await this.dbConnections.connectMongoDB();
    const redisClient = await this.dbConnections.connectRedis();
    const { producer: kafkaProducer } = await this.dbConnections.connectKafka();

    console.log('📦 Inicializando repositorios...');
    // Repositories
    const userRepository = new UserRepository(database);
    const cacheRepository = new CacheRepository(redisClient);

    console.log('⚙️ Inicializando servicios...');
    // Services
    const jwtService = new JwtService();
    const eventService = new EventService(kafkaProducer);
    const authService = new AuthService(userRepository, cacheRepository, jwtService, eventService);
    const otpService = new OtpService(cacheRepository, eventService);

    console.log('🎮 Inicializando controladores...');
    // Controllers
    const authController = new AuthController(authService, otpService);
    const otpController = new OtpController(otpService);

    console.log('🛡️ Inicializando middleware...');
    // Middleware
    const authMiddleware = new AuthMiddleware(jwtService, authService, cacheRepository);

    return {
      authController,
      otpController,
      authMiddleware
    };
  }

  private setupRoutes(controllers: {
    authController: AuthController;
    otpController: OtpController;
    authMiddleware: AuthMiddleware;
  }): void {
    console.log('🛣️ Configurando rutas...');
    
    // Health check
    this.app.get('/health', (req, res) => {
      res.status(200).json({
        success: true,
        message: 'Auth Service is healthy',
        data: {
          service: 'auth-service',
          version: '1.0.0',
          timestamp: new Date().toISOString(),
          environment: config.app.nodeEnv
        }
      });
    });

    // Auth routes
    this.app.use('/auth', createAuthRoutes(
      controllers.authController,
      controllers.otpController,
      controllers.authMiddleware
    ));

    // 404 handler
    this.app.use('*', notFoundHandler);

    // Error handler
    this.app.use(errorHandler);
  }

  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      console.log(`\n🛑 Received ${signal}. Iniciando cierre graceful...`);
      
      // Cerrar conexiones
      await this.dbConnections.closeConnections();
      
      console.log('✅ Cierre graceful completado');
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    
    process.on('uncaughtException', (error) => {
      console.error('🚨 Uncaught Exception:', error);
      shutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
      shutdown('unhandledRejection');
    });
  }

  public async start(): Promise<void> {
    try {
      console.log(`🌟 Iniciando Auth Service v1.0.0`);
      console.log(`📍 Entorno: ${config.app.nodeEnv}`);
      console.log(`🔧 Puerto: ${config.app.port}`);
      
      // Inicializar dependencias
      const controllers = await this.initializeDependencies();
      
      // Configurar rutas
      this.setupRoutes(controllers);
      
      // Configurar cierre graceful
      this.setupGracefulShutdown();
      
      // Iniciar servidor
      this.app.listen(config.app.port, () => {
        console.log(`\n✅ Auth Service ejecutándose en puerto ${config.app.port}`);
        console.log(`🌐 Entorno: ${config.app.nodeEnv}`);
        console.log(`📊 Health check: http://localhost:${config.app.port}/health`);
        console.log(`🔐 Auth endpoints: http://localhost:${config.app.port}/auth/*`);
        console.log(`\n🚀 Servicio listo para recibir solicitudes!\n`);
      });
      
    } catch (error) {
      console.error('❌ Error iniciando el servicio:', error);
      process.exit(1);
    }
  }
}

// Iniciar la aplicación
const authService = new AuthServiceApp();
authService.start().catch((error) => {
  console.error('💥 Error fatal:', error);
  process.exit(1);
});
