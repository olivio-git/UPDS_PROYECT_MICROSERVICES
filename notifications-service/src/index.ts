import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';

import { config } from './config';
import DatabaseConnections from './database/connections';

// Repositories
import { CacheRepository } from './repositories/cache.repository';
import { NotificationRepository } from './repositories/notification.repository';
import NotificationInAppRepository from './repositories/notification_inapp.repository';

// Services
import { EmailService } from './services/email.service';
import { EventService } from './services/event.service';
import { KafkaConsumerService } from './services/kafka-consumer.service';
import { NotificationService } from './services/notification.service';
import { startGradingNotificationConsumer } from './services/grading-notification.consumer';
import SocketService from './services/socket.service';
import type { ConsumerHandle } from '@cba/events';
import type { Kafka } from 'kafkajs';
import type Redis from 'ioredis';

// Controllers
import { NotificationController } from './controllers/notification.controller';

// Middleware
import { errorHandler, notFoundHandler } from './middleware/error.middleware';

// Routes
import { createNotificationRoutes } from './routes/notification.routes';

class NotificationServiceApp {
  private app: express.Application;
  private dbConnections: DatabaseConnections;
  private kafkaConsumerService?: KafkaConsumerService;
  private socketService?: SocketService;
  private gradingNotificationConsumerHandle?: ConsumerHandle;
  private kafkaClient?: Kafka;
  private notificationService?: NotificationService;
  private redisClient?: Redis;

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
    this.redisClient = redisClient;
    const { kafka: kafkaClient, producer: kafkaProducer, consumer: kafkaConsumer } = await this.dbConnections.connectKafka();
    this.kafkaClient = kafkaClient;

  console.log('📦 Inicializando repositorios...');
  // Repositories
  const notificationRepository = new NotificationRepository(database);
  const notificationInAppRepository = new NotificationInAppRepository(database);
  const cacheRepository = new CacheRepository(redisClient);

    console.log('⚙️ Inicializando servicios...');
    // Services
    const emailService = new EmailService();
    const eventService = new EventService(kafkaProducer);
    // Socket service
    this.socketService = new SocketService();

    const notificationService = new NotificationService(
      notificationRepository,
      cacheRepository,
      emailService,
      eventService,
      notificationInAppRepository,
      this.socketService as any
    );
    this.notificationService = notificationService;

    // Kafka Consumer Service
    this.kafkaConsumerService = new KafkaConsumerService(kafkaConsumer, notificationService);

    console.log('🎮 Inicializando controladores...');
    // Controllers
    const notificationController = new NotificationController(notificationService);

    // Iniciar procesamiento de cola en background
    this.startBackgroundProcesses(notificationService);

    return {
      notificationController,
      notificationService,
      notificationInAppRepository
    };

    return {
      notificationController,
      notificationService
    };
  }

  private startBackgroundProcesses(notificationService: NotificationService): void {
    console.log('🔄 Iniciando procesos en background...');

    // Procesar cola de emails cada 30 segundos
    setInterval(async () => {
      try {
        await notificationService.processEmailQueue();
      } catch (error) {
        console.error('❌ Error en procesamiento de cola:', error);
      }
    }, 30000);

    // Reintentar emails fallidos cada 5 minutos
    setInterval(async () => {
      try {
        await notificationService.retryFailedEmails();
      } catch (error) {
        console.error('❌ Error en reintentos:', error);
      }
    }, 5 * 60 * 1000);

    console.log('✅ Procesos en background iniciados');
  }

  private setupRoutes(controllers: {
    notificationController: NotificationController;
  }): void {
    console.log('🛣️ Configurando rutas...');
    
    // Health check principal
    this.app.get('/health', (req, res) => {
      res.status(200).json({
        success: true,
        message: 'Notifications Service is healthy',
        data: {
          service: 'notifications-service',
          version: '1.0.0',
          timestamp: new Date().toISOString(),
          environment: config.app.nodeEnv
        }
      });
    });

    // Notification routes
    this.app.use('/notifications', createNotificationRoutes(
      controllers.notificationController
    ));

    // 404 handler
    this.app.use('*', notFoundHandler);

    // Error handler
    this.app.use(errorHandler);
  }

  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      console.log(`\n🛑 Received ${signal}. Iniciando cierre graceful...`);
      
      // Detener consumidores de Kafka
      if (this.kafkaConsumerService) {
        await this.kafkaConsumerService.stopConsumers();
      }
      if (this.gradingNotificationConsumerHandle) {
        await this.gradingNotificationConsumerHandle.stop();
      }

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
      console.log(`🌟 Iniciando Notifications Service v1.0.0`);
      console.log(`📍 Entorno: ${config.app.nodeEnv}`);
      console.log(`🔧 Puerto: ${config.app.port}`);
      
      // Inicializar dependencias
      const controllers = await this.initializeDependencies();

      // Iniciar consumidores de Kafka una vez que la conexión esté lista.
      // Kafka se conecta en background (ver DatabaseConnections.connectKafka),
      // así que el arranque del HTTP API/Socket.IO nunca queda bloqueado ni
      // se cae si el broker está caído.
      if (this.kafkaConsumerService) {
        this.dbConnections.onKafkaReady(() => {
          this.kafkaConsumerService!.startConsumers().catch((error) => {
            console.error('❌ Error iniciando consumidores de Kafka:', error);
          });
        });
      }

      // grading.result.published consumer: independent of the legacy
      // consumer group above (own groupId 'notifications-grading') and of
      // onKafkaReady — @cba/events' runConsumer() manages its own
      // connect/retry loop, so this never blocks or depends on the legacy
      // Kafka bootstrap.
      if (this.kafkaClient && this.notificationService && this.redisClient) {
        startGradingNotificationConsumer(this.kafkaClient, this.notificationService, this.redisClient)
          .then((handle) => {
            this.gradingNotificationConsumerHandle = handle;
          })
          .catch((error) => {
            console.error('❌ Error iniciando consumidor grading-notification:', error);
          });
      }

      // Configurar rutas
      this.setupRoutes(controllers);
      
      // Configurar cierre graceful
      this.setupGracefulShutdown();

      // Iniciar servidor y adjuntar Socket.IO
      const http = require('http');
      const server = http.createServer(this.app);

      // iniciar socket service
      if (this.socketService) {
        this.socketService.init(server);
      }

      server.listen(config.app.port, () => {
        console.log(`\n✅ Notifications Service ejecutándose en puerto ${config.app.port}`);
        console.log(`🌐 Entorno: ${config.app.nodeEnv}`);
        console.log(`📊 Health check: http://localhost:${config.app.port}/health`);
        console.log(`📧 Notifications endpoints: http://localhost:${config.app.port}/notifications/*`);
        console.log(`\n🚀 Servicio listo para procesar notificaciones!\n`);
      });
      
    } catch (error) {
      console.error('❌ Error iniciando el servicio:', error);
      process.exit(1);
    }
  }
}

// Iniciar la aplicación
const notificationService = new NotificationServiceApp();
notificationService.start().catch((error) => {
  console.error('💥 Error fatal:', error);
  process.exit(1);
});
