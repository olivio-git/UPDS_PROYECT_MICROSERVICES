import cors from 'cors';
import dotenv from 'dotenv';
import express, { Router } from 'express';
import helmet from 'helmet';
import { createServer } from 'http';
import mongoose from 'mongoose';
import { Server as SocketIOServer } from 'socket.io';

// Importar servicios y controladores
import { instrument } from '@socket.io/admin-ui';
import { SessionController } from './controllers/SessionController';
import { TechnicalVerificationController } from './controllers/TechnicalVerificationController';
import { authenticateSocket } from './middleware/auth';
import { examLobbyService, ExamLobbyService } from './services/ExamLobbyService';
import { KafkaService } from './services/KafkaService';
import { SessionService } from './services/SessionService';
import { logger, loggerUtils } from './utils/logger';

// Cargar variables de entorno
dotenv.config();

class SessionManagerServer {
  private app: express.Application;
  private server: any;
  private io: SocketIOServer;
  private sessionService: SessionService;
  private kafkaService: KafkaService;
  private sessionController: SessionController;
  private technicalVerificationController: TechnicalVerificationController;
  private examLobbyService: ExamLobbyService;

  constructor() {
    this.app = express();
    this.server = createServer(this.app);

    // Configuración CORS específica para desarrollo
    const corsConfig = {
      origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
        // Permitir requests sin origin (ej: Postman, mobile apps)
        if (!origin) return callback(null, true);

        // Lista de orígenes permitidos
        const allowedOrigins = [
          'http://localhost:3000',
          'http://localhost:3001',
          'http://localhost:3002',
          'http://localhost:5173',
          'https://amritb.github.io',
          'https://admin.socket.io',
          // Permitir cualquier localhost con cualquier puerto
          /^http:\/\/localhost:\d+$/,
          /^https:\/\/.*\.github\.io$/
        ];

        const isAllowed = allowedOrigins.some(allowed => {
          if (typeof allowed === 'string') return allowed === origin;
          return allowed.test(origin);
        });

        console.log(`🌐 CORS check - Origin: ${origin}, Allowed: ${isAllowed}`);
        callback(null, isAllowed);
      },
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Service'],
      credentials: true
    };

    this.io = new SocketIOServer(this.server, {
      cors: corsConfig,
      pingTimeout: parseInt(process.env.WEBSOCKET_PING_TIMEOUT || '60000'),
      pingInterval: parseInt(process.env.WEBSOCKET_PING_INTERVAL || '25000'),
      transports: ['websocket', 'polling'],
      allowEIO3: true // Permitir compatibilidad con versiones anteriores
    });
    instrument(this.io, {
      auth: false
    });

    this.kafkaService = new KafkaService(this.io);
    this.sessionService = new SessionService(this.io);
    this.sessionController = new SessionController(this.sessionService);
    this.technicalVerificationController = new TechnicalVerificationController();
    this.examLobbyService = examLobbyService(this.io, this.sessionService);

    // Conectar los servicios entre sí
    this.sessionService.setExamLobbyService(this.examLobbyService);

    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
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

    // CORS con la misma configuración que Socket.IO
    const corsConfig = {
      origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
        if (!origin) return callback(null, true);

        const allowedOrigins = [
          'http://localhost:3000',
          'http://localhost:3001',
          'http://localhost:3002',
          'http://localhost:5173',
          'https://amritb.github.io',
          'https://admin.socket.io',
          /^http:\/\/localhost:\d+$/,
          /^https:\/\/.*\.github\.io$/
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

    // Rutas de la API
    this.app.use('/api/v1/sessions', this.sessionController.getRouter());
    this.app.use('/api/v1/technical', this.getTechnicalRoutes());
    this.app.use('/api/v1/lobby', this.getLobbyRoutes());

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

    // Ruta de test para enviar eventos WebSocket manuales
    this.app.post('/test/websocket-event', (req, res) => {
      try {
        const { eventType, sessionId, status } = req.body;

        if (!eventType || !sessionId) {
          res.status(400).json({
            success: false,
            message: 'eventType y sessionId son requeridos'
          });
          return;
        }

        const eventData = {
          sessionId,
          status: status || 'active',
          timestamp: new Date().toISOString(),
          source: 'manual_test'
        };

        const connectedClients = this.io.engine.clientsCount;
        logger.info(`🧪 [TEST] Enviando evento manual: ${eventType} para sesión ${sessionId} (${connectedClients} clientes conectados)`);

        this.io.emit(eventType, eventData);

        res.json({
          success: true,
          message: `Evento ${eventType} enviado`,
          data: eventData,
          connectedClients
        });

      } catch (error) {
        logger.error('Error enviando evento de test:', error);
        res.status(500).json({
          success: false,
          message: 'Error enviando evento de test'
        });
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
   * Configurar WebSocket
   */
  private setupWebSocket(): void {
    // Middleware de autenticación para WebSocket
    this.io.use(authenticateSocket);

    // Manejo de conexiones WebSocket
    this.io.on('connection', (socket) => {
      const authenticatedSocket = socket as any;

      console.log(`🔌 [CONEXION] === NUEVA CONEXION WEBSOCKET ===`);
      console.log(`🔌 [CONEXION] Socket ID: ${socket.id}`);
      console.log(`🔌 [CONEXION] Usuario ID: ${authenticatedSocket.userId}`);
      console.log(`🔌 [CONEXION] Email: ${authenticatedSocket.userEmail}`);
      console.log(`🔌 [CONEXION] Rooms iniciales:`, Array.from(socket.rooms));
      console.log(`🔌 [CONEXION] Timestamp: ${new Date().toISOString()}`);

      loggerUtils.socketEvent(
        socket.id,
        authenticatedSocket.userId,
        'CONNECTED'
      );

      logger.info(`🔌 Usuario conectado: ${authenticatedSocket.userId} (${authenticatedSocket.userEmail})`);

      // Debug: Listener para TODOS los eventos
      socket.onAny((eventName, ...args) => {
        console.log(`📥 [onAny] === EVENTO DETECTADO ===`);
        console.log(`📥 [onAny] Evento: "${eventName}"`);
        console.log(`📥 [onAny] Socket ID: ${socket.id}`);
        console.log(`📥 [onAny] Usuario: ${authenticatedSocket.userId}`);
        console.log(`📥 [onAny] Args:`, args);
        console.log(`📥 [onAny] Timestamp: ${new Date().toISOString()}`);
        logger.info(`📥 Evento recibido: ${eventName}`, { args: args.length > 0 ? args[0] : 'sin datos' });
      });

      // Evento de prueba específico
      socket.on('test-event', (data) => {
        logger.info('🧪 Evento de prueba recibido correctamente:', data);
      });
      
      socket.on('olivio-event', (data:any) => {
        console.log(`🚀 [BACKEND] ===== EVENTO OLIVIO-EVENT RECIBIDO =====`);
        console.log(`📥 [BACKEND] Datos de olivio-event:`, data);
        logger.info('🧪 Evento olivio-event recibido correctamente:', data);
      });

      // EVENTO DE PING PARA DIAGNOSTICO
      socket.on('diagnostic-ping', (data) => {
        console.log(`🏓 [DIAGNOSTIC] Ping recibido:`, data);
        socket.emit('diagnostic-pong', { 
          received: data, 
          timestamp: new Date().toISOString(),
          socketId: socket.id,
          userId: authenticatedSocket.userId 
        });
        console.log(`🏓 [DIAGNOSTIC] Pong enviado de vuelta`);
      });
      // Eventos de sesión
      socket.on('join-exam-session', async (data) => {
        try {
          const { sessionId, role } = data;

          loggerUtils.socketEvent(
            socket.id,
            authenticatedSocket.userId,
            'JOIN_SESSION_ATTEMPT',
            sessionId
          );

          await this.sessionService.joinSession(authenticatedSocket, sessionId, role);

          logger.info(`✅ Usuario ${authenticatedSocket.userId} se unió a sesión ${sessionId} como ${role}`);

        } catch (error) {
          logger.error(`❌ Error joining session:`, error);
          socket.emit('session-error', {
            message: error instanceof Error ? error.message : 'Error desconocido'
          });

          loggerUtils.securityEvent(authenticatedSocket.userId, 'JOIN_SESSION_FAILED', {
            sessionId: data.sessionId,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      });

      // Iniciar examen individual - MEJORADO con lógica de reconexión
      socket.on('startIndividualExam', async (data) => { 
        try {
          const { sessionId, candidateId, forceRestart = false } = data; 
          if (!candidateId) {
            logger.error('❌ candidateId requerido pero no proporcionado');
            socket.emit('session-error', {
              message: 'ID de candidato requerido para examen individual'
            });
            return;
          }

          loggerUtils.socketEvent(
            socket.id,
            authenticatedSocket.userId,
            'START_INDIVIDUAL_EXAM_ATTEMPT',
            sessionId
          );

          const reconnectionResult = await this.sessionService.checkExamReconnection(sessionId, candidateId, forceRestart);
          if (reconnectionResult.canReconnect && !forceRestart) {
            console.log(`🔄 [BACKEND] Reconectando a examen existente...`);
            await this.sessionService.reconnectToExam(authenticatedSocket, sessionId, candidateId);
            // Emitir evento de reconexión con estado actual
            console.log(`� [BACKEND] Enviando evento exam-reconnected a cliente...`);
            const reconnectedPayload = {
              sessionId,
              status: 'reconnected',
              examState: reconnectionResult.examState,
              timeRemaining: reconnectionResult.timeRemaining,
              currentQuestion: reconnectionResult.currentQuestion,
              answeredQuestions: reconnectionResult.answeredQuestions,
              progress: reconnectionResult.progress,
              timestamp: new Date().toISOString()
            };
            
            socket.emit('exam-reconnected', reconnectedPayload);
            console.log(`✅ [BACKEND] Evento exam-reconnected enviado exitosamente`);
            logger.info(`✅ [BACKEND] Usuario ${authenticatedSocket.userId} reconectado a examen individual ${sessionId}`);
            
            return; // Terminar aquí para reconexión
          }

          // Si no puede reconectar o forceRestart=true, iniciar nuevo examen
          if (reconnectionResult.reason) {
            console.log(`ℹ️ [BACKEND] No se puede reconectar: ${reconnectionResult.reason}`);
          }
          
          await this.sessionService.startIndividualExam(authenticatedSocket, sessionId, candidateId, forceRestart);
          logger.info(`✅ [BACKEND] Usuario ${authenticatedSocket.userId} inició examen individual ${sessionId}`);
          const responsePayload = {
            sessionId,
            status: 'started',
            isNewExam: true,
            timestamp: new Date().toISOString()
          };
          socket.emit('exam-started', responsePayload);
          
        } catch (error) {
          const errorPayload = {
            message: error instanceof Error ? error.message : 'Error iniciando examen individual',
            canRetry: true
          };
          socket.emit('session-error', errorPayload);
          loggerUtils.securityEvent(authenticatedSocket.userId, 'START_INDIVIDUAL_EXAM_FAILED', {
            sessionId: data.sessionId,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      });

      // Enviar respuesta
      socket.on('submit-answer', async (data) => {
        try {
          const start = Date.now();

          await this.sessionService.submitAnswer(authenticatedSocket, data);

          const duration = Date.now() - start;
          loggerUtils.performance('SUBMIT_ANSWER', duration, {
            userId: authenticatedSocket.userId,
            sessionId: data.sessionId,
            questionId: data.questionId
          });

        } catch (error) {
          logger.error('❌ Error submitting answer:', error);
          socket.emit('answer-error', {
            message: error instanceof Error ? error.message : 'Error procesando respuesta'
          });
        }
      });

      // Solicitar siguiente pregunta
      socket.on('next-question', async (data) => {
        try {
          await this.sessionService.getNextQuestion(authenticatedSocket, data.sessionId);

        } catch (error) {
          logger.error('❌ Error getting next question:', error);
          socket.emit('question-error', {
            message: error instanceof Error ? error.message : 'Error obteniendo pregunta'
          });
        }
      });

      // Finalizar examen
      socket.on('finish-exam', async (data) => {
        try {
          await this.sessionService.finishExamForStudent(authenticatedSocket, data.sessionId);

          loggerUtils.userEvent(authenticatedSocket.userId, 'EXAM_FINISHED', data.sessionId);

        } catch (error) {
          logger.error('❌ Error finishing exam:', error);
          socket.emit('finish-error', {
            message: error instanceof Error ? error.message : 'Error finalizando examen'
          });
        }
      });

      // Habilitar monitoreo (solo proctors)
      socket.on('monitor-session', async (data) => {
        try {
          await this.sessionService.enableMonitoring(authenticatedSocket, data.sessionId);

          loggerUtils.userEvent(authenticatedSocket.userId, 'MONITORING_ENABLED', data.sessionId);

        } catch (error) {
          logger.error('❌ Error enabling monitoring:', error);
          socket.emit('monitor-error', {
            message: error instanceof Error ? error.message : 'Error habilitando monitoreo'
          });
        }
      });

      // Ping/Pong para mantener conexión activa
      socket.on('ping', () => {
        socket.emit('pong');
      });

      // Eventos de lobby
      socket.on('join-lobby', async (data) => {
        try {
          const { sessionId, role, candidateId, token } = data;
          await this.examLobbyService.joinLobby(authenticatedSocket, sessionId, role, candidateId, token);
        } catch (error) {
          logger.error('❌ Error joining lobby:', error);
          socket.emit('lobby-error', {
            message: error instanceof Error ? error.message : 'Error unirse al lobby'
          });
        }
      });

      socket.on('leave-lobby', async (data) => {
        try {
          const { sessionId } = data;
          await this.examLobbyService.leaveLobby(authenticatedSocket, sessionId);
        } catch (error) {
          logger.error('❌ Error leaving lobby:', error);
        }
      });

      socket.on('start-exam-manual', async (data) => {
        try {
          const { sessionId } = data;
          await this.examLobbyService.startExam(authenticatedSocket, sessionId);
        } catch (error) {
          logger.error('❌ Error starting exam manually:', error);
          socket.emit('lobby-error', {
            message: error instanceof Error ? error.message : 'Error iniciando examen'
          });
        }
      });

      socket.on('lobby-chat-message', async (data) => {
        try {
          const { sessionId, message } = data;
          await this.examLobbyService.sendLobbyMessage(authenticatedSocket, sessionId, message);
        } catch (error) {
          logger.error('❌ Error sending lobby message:', error);
        }
      });

      socket.on('update-participant-status', async (data) => {
        try {
          const { sessionId, status } = data;
          await this.examLobbyService.updateParticipantStatus(authenticatedSocket, sessionId, status);
        } catch (error) {
          logger.error('❌ Error updating participant status:', error);
        }
      });

      // Manejo de desconexión
      socket.on('disconnect', (reason) => {
        loggerUtils.socketEvent(
          socket.id,
          authenticatedSocket.userId,
          'DISCONNECTED'
        );

        logger.info(`🔌 Usuario desconectado: ${authenticatedSocket.userId} - Razón: ${reason}`);

        // Salir de cualquier lobby que esté activo
        const activeLobbies = this.examLobbyService.getActiveLobbies();
        activeLobbies.forEach(lobby => {
          if (lobby.participants.has(authenticatedSocket.userId) || lobby.proctors.has(authenticatedSocket.userId)) {
            this.examLobbyService.leaveLobby(authenticatedSocket, lobby.sessionId);
          }
        });

        this.sessionService.handleDisconnection(authenticatedSocket);
      });

      // Manejo de errores del socket
      socket.on('error', (error) => {
        logger.error(`Socket error for user ${authenticatedSocket.userId}:`, error);

        loggerUtils.securityEvent(authenticatedSocket.userId, 'SOCKET_ERROR', {
          error: error.message || error,
          socketId: socket.id
        });
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

    router.post('/init', this.technicalVerificationController.initializeVerification.bind(this.technicalVerificationController));
    router.get('/:verificationId', this.technicalVerificationController.getVerification.bind(this.technicalVerificationController));
    router.get('/user/:userId', this.technicalVerificationController.getUserVerification.bind(this.technicalVerificationController));
    router.post('/:verificationId/browser', this.technicalVerificationController.updateBrowserInfo.bind(this.technicalVerificationController));
    router.post('/:verificationId/permissions', this.technicalVerificationController.updatePermissions.bind(this.technicalVerificationController));
    router.post('/:verificationId/devices', this.technicalVerificationController.updateDevices.bind(this.technicalVerificationController));
    router.post('/:verificationId/network-test', this.technicalVerificationController.testNetworkConnection.bind(this.technicalVerificationController));
    router.post('/:verificationId/microphone-test', this.technicalVerificationController.verifyMicrophone.bind(this.technicalVerificationController));
    router.post('/:verificationId/camera-test', this.technicalVerificationController.verifyCamera.bind(this.technicalVerificationController));
    router.post('/:verificationId/audio-test', this.technicalVerificationController.verifyAudio.bind(this.technicalVerificationController));
    router.post('/:verificationId/finalize', this.technicalVerificationController.finalizeVerification.bind(this.technicalVerificationController));
    router.get('/user/:userId/can-proceed', this.technicalVerificationController.canUserProceed.bind(this.technicalVerificationController));
    router.post('/:verificationId/mark-used', this.technicalVerificationController.markVerificationUsed.bind(this.technicalVerificationController));
    router.get('/stats', this.technicalVerificationController.getVerificationStats.bind(this.technicalVerificationController));

    return router;
  }

  /**
   * Rutas para manejo de lobby
   */
  private getLobbyRoutes() {
    const router = Router();

    router.post('/', async (req, res) => {
      try {
        const { sessionId, examData, settings, createdBy } = req.body;

        if (!sessionId || !examData) {
          return res.status(400).json({
            success: false,
            message: 'sessionId y examData son requeridos'
          });
        }

        // Crear la sesión en el SessionService primero
        await this.sessionService.createExamSession({
          sessionId,
          examId: examData.examId || examData._id,
          examName: examData.name || `Examen ${sessionId}`,
          scheduledStartTime: examData.scheduledStartTime || Date.now(),
          duration: examData.duration || 120,
          maxParticipants: examData.maxParticipants || 50,
          settings: examData.settings,
          createdBy: createdBy
        });
        // Crear el lobby
        const lobby = await this.examLobbyService.createLobby(sessionId, examData, settings, createdBy);
        // console.log(`Lobby creado, message in index.ts: ${JSON.stringify(lobby)}`);
        return res.json({
          success: true,
          message: 'Lobby creado exitosamente',
          data: {
            sessionId: lobby.sessionId,
            examName: lobby.examName,
            status: lobby.status,
            scheduledStartTime: lobby.scheduledStartTime,
            maxParticipants: lobby.maxParticipants
          }
        });
      } catch (error) {
        logger.error('Error creating lobby:', error);
        return res.status(500).json({
          success: false,
          message: error instanceof Error ? error.message : 'Error interno del servidor'
        });
      }
    });

    router.get('/:sessionId/status', async (req, res) => {
      try {
        const { sessionId } = req.params;

        // Primero buscar en el lobby service
        const lobby = this.examLobbyService.getLobbyStatus(sessionId);

        if (lobby) {
          return res.json({
            success: true,
            data: {
              sessionId: lobby.sessionId,
              examName: lobby.examName,
              status: lobby.status,
              participants: lobby.participants.size,
              maxParticipants: lobby.maxParticipants,
              scheduledStartTime: lobby.scheduledStartTime,
              actualStartTime: lobby.actualStartTime,
              source: 'lobby'
            }
          });
        }

        // Si no existe en lobby, buscar en ActiveSession
        const { ActiveSessionModel } = await import('./models/ActiveSession');
        const activeSession = await ActiveSessionModel.findOne({ sessionId });

        if (activeSession) {
          return res.json({
            success: true,
            data: {
              sessionId: activeSession.sessionId,
              examName: activeSession.examName,
              status: activeSession.status,
              participants: activeSession.stats.activeParticipants,
              totalParticipants: activeSession.stats.totalParticipants,
              createdAt: activeSession.createdAt,
              source: 'active_session'
            }
          });
        }

        return res.status(404).json({
          success: false,
          code: 'LOBBY_NOT_FOUND',
          message: 'Lobby no encontrado para esta sesión'
        });
      } catch (error) {
        logger.error('Error getting lobby status:', error);
        return res.status(500).json({
          success: false,
          message: 'Error interno del servidor'
        });
      }
    });

    router.get('/active', (req, res) => {
      try {
        const lobbies = this.examLobbyService.getActiveLobbies();

        return res.json({
          success: true,
          data: lobbies.map(lobby => ({
            sessionId: lobby.sessionId,
            examName: lobby.examName,
            status: lobby.status,
            participants: lobby.participants.size,
            maxParticipants: lobby.maxParticipants,
            scheduledStartTime: lobby.scheduledStartTime,
            actualStartTime: lobby.actualStartTime
          }))
        });
      } catch (error) {
        logger.error('Error getting active lobbies:', error);
        return res.status(500).json({
          success: false,
          message: 'Error interno del servidor'
        });
      }
    });

    return router;
  }

  /**
   * Inicializar servicios
   */
  // private async initializeServices(): Promise<void> {
  //   try {
  //     // Conectar Kafka
  //     await this.kafkaService.connect();
  //     logger.info('✅ Kafka conectado');

  //     // Inicializar otros servicios si es necesario
  //     logger.info('✅ Servicios inicializados correctamente');

  //   } catch (error) {
  //     logger.error('❌ Error inicializando servicios:', error);
  //     throw error;
  //   }
  // }

  /**
   * Inicializar servicios
   */
  private async initializeServices(): Promise<void> {
    try {
      // Conectar Kafka
      await this.kafkaService.connect();
      logger.info('✅ Kafka conectado');

      // Inicializar otros servicios si es necesario
      logger.info('✅ Servicios inicializados correctamente');

    } catch (error) {
      logger.error('❌ Error inicializando servicios:', error);
      throw error;
    }
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
   * Inicializar servicios
   */
  // private async initializeServices(): Promise<void> {
  //   try {
  //     // Conectar a Kafka
  //     if (process.env.KAFKA_BROKER) {
  //       await this.kafkaService.connect();
  //       logger.info('✅ Kafka conectado y configurado');
  //     } else {
  //       logger.warn('⚠️ Kafka no configurado - funcionando sin eventos');
  //     }

  //   } catch (error) {
  //     logger.error('❌ Error inicializando servicios:', error);
  //     // No lanzar error aquí para permitir que el servicio funcione sin Kafka
  //   }
  // }

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

      // Métricas de Kafka
      const kafkaMetrics = await this.kafkaService.getMetrics();

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
        connections: {
          websocket: this.io.engine.clientsCount
        },
        database: mongoStats,
        kafka: kafkaMetrics,
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

      // Cerrar conexiones WebSocket
      this.io.close(() => {
        logger.info('🔌 Servidor WebSocket cerrado');
      });

      // Desconectar servicios
      if (this.kafkaService) {
        await this.kafkaService.disconnect();
        logger.info('📡 Kafka desconectado');
      }

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

      // Inicializar servicios
      await this.initializeServices();

      // Configurar limpieza periódica de lobbies
      setInterval(() => {
        this.examLobbyService.cleanup();
      }, 60 * 60 * 1000); // Cada hora

      // Iniciar servidor
      const port = process.env.PORT || 3004;

      this.server.listen(port, () => {
        logger.info(`🚀 Session Manager Service iniciado en puerto ${port}`);
        logger.info(`📡 WebSocket disponible en ws://localhost:${port}`);
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
