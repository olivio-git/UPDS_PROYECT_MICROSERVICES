import { Request, Response, Router } from 'express';
import Joi from 'joi';
import jwt from 'jsonwebtoken';
import { AuthenticatedHttpRequest, authenticateHTTP, requireRole } from '../middleware/auth';
import { ActiveSessionModel } from '../models/ActiveSession';
import { SessionService } from '../services/SessionService';
import { logger, loggerUtils } from '../utils/logger';

// Using AuthenticatedHttpRequest from middleware/auth to ensure consistent typing

interface AvailableSessionDTO {
  sessionId: string;
  examId: string;
  examName: string;
  sessionName: string;
  scheduledAt: Date;
  duration: number;
  status: string;
  hasLobby: boolean;
  lobbyStatus?: string;
  maxParticipants?: number;
  currentParticipants?: number;
  requiresTechnicalVerification?: boolean;
  registrationDeadline?: Date;
  competencies?: string[];
}

export class SessionController {
  private router: Router;
  private sessionService: SessionService;

  constructor(sessionService: SessionService) {
    this.router = Router();
    this.sessionService = sessionService;
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // Rutas públicas
    this.router.get('/health', this.healthCheck.bind(this));

    // Rutas autenticadas
    this.router.use(authenticateHTTP);

    // Rutas para todos los usuarios autenticados
    this.router.get('/sessions/:sessionId', this.getSession.bind(this));
    this.router.get('/sessions/:sessionId/status', this.getSessionStatus.bind(this));
    this.router.get('/sessions/:sessionId/rooms', this.getSessionRooms.bind(this));
    
    // Rutas para estudiantes
    this.router.post('/sessions/:sessionId/join', this.joinSession.bind(this));
    this.router.get('/sessions/:sessionId/my-progress', this.getMyProgress.bind(this));
    this.router.get('/available-for-candidate/:candidateId', this.getAvailableSessionsForCandidate.bind(this));
    
    // Rutas para proctors y admins
    this.router.get('/sessions/:sessionId/monitoring', 
      requireRole(['proctor', 'admin']), 
      this.getMonitoringData.bind(this)
    );
    
    // Rutas solo para admins
    this.router.get('/sessions', 
      requireRole(['admin']), 
      this.getAllSessions.bind(this)
    );
    this.router.post('/sessions', 
      requireRole(['admin']), 
      this.createSession.bind(this)
    );
    this.router.patch('/sessions/:sessionId', 
      requireRole(['admin']), 
      this.updateSession.bind(this)
    );
    this.router.delete('/sessions/:sessionId', 
      requireRole(['admin']), 
      this.deleteSession.bind(this)
    );
    this.router.post('/sessions/:sessionId/start', 
      requireRole(['admin', 'proctor']), 
      this.startSession.bind(this)
    );
    this.router.post('/sessions/:sessionId/end', 
      requireRole(['admin', 'proctor']), 
      this.endSession.bind(this)
    );
    this.router.get('/sessions/:sessionId/results', 
      requireRole(['admin', 'proctor']), 
      this.getSessionResults.bind(this)
    );
    this.router.get('/sessions/:sessionId/export', 
      requireRole(['admin']), 
      this.exportSessionData.bind(this)
    );
  }

  /**
   * Health check endpoint
   */
  async healthCheck(req: Request, res: Response): Promise<void> {
    try {
      // Verificar conexión a base de datos
      const dbStatus = await this.checkDatabaseConnection();
      
      // Verificar servicios externos
      const externalServices = await this.checkExternalServices();

      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'session-manager-service',
        version: process.env.npm_package_version || '1.0.0',
        uptime: process.uptime(),
        database: dbStatus,
        externalServices,
        memory: process.memoryUsage(),
        connections: this.sessionService ? 'initialized' : 'not_initialized'
      };

      res.status(200).json(health);
    } catch (error) {
      logger.error('Health check failed:', error);
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Obtener información de una sesión
   */
  async getSession(req: AuthenticatedHttpRequest, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;

      const session = await ActiveSessionModel.findBySessionId(sessionId);

      if (!session) {
        res.status(404).json({
          success: false,
          message: 'Sesión no encontrada'
        });
        return;
      }

      // Asegurar que el usuario está presente (typing safety)
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Usuario no autenticado'
        });
        return;
      }

      // Verificar permisos
      if (!this.canUserAccessSession(req.user, session)) {
        res.status(403).json({
          success: false,
          message: 'No tienes permisos para acceder a esta sesión'
        });
        return;
      }

      // Filtrar datos según el rol del usuario
      const sessionData = this.filterSessionDataByRole(session, req.user.role);

      res.json({
        success: true,
        session: sessionData
      });

      loggerUtils.userEvent(req.user.id, 'SESSION_INFO_ACCESSED', sessionId);

    } catch (error) {
      logger.error('Error getting session:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Obtener estado de una sesión
   */
  async getSessionStatus(req: AuthenticatedHttpRequest, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;

      const session = await ActiveSessionModel.findBySessionId(sessionId);

      if (!session) {
        res.status(404).json({
          success: false,
          message: 'Sesión no encontrada'
        });
        return;
      }

      // Asegurar que el usuario está presente (type safety)
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'No autenticado'
        });
        return;
      }

      if (!this.canUserAccessSession(req.user, session)) {
        res.status(403).json({
          success: false,
          message: 'No tienes permisos para acceder a esta sesión'
        });
        return;
      }

      const status = {
        sessionId: session.sessionId,
        status: session.status,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        participants: {
          total: session.stats.totalParticipants,
          active: session.stats.activeParticipants,
          completed: session.stats.completedParticipants
        },
        timeRemaining: this.calculateTimeRemaining(session),
        canJoin: session.canJoin(req.user.id)
      };

      res.json({
        success: true,
        status
      });

    } catch (error) {
      logger.error('Error getting session status:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Unirse a una sesión
   */
  async joinSession(req: AuthenticatedHttpRequest, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;
      const { role = 'student' } = req.body;

      // Validar input
      const schema = Joi.object({
        role: Joi.string().valid('student', 'proctor').default('student')
      });

      const { error } = schema.validate({ role });
      if (error) {
        res.status(400).json({
          success: false,
          message: error.details[0].message
        });
        return;
      }

      const session = await ActiveSessionModel.findBySessionId(sessionId);

      if (!session) {
        res.status(404).json({
          success: false,
          message: 'Sesión no encontrada'
        });
        return;
      }

      // Asegurar que el usuario está presente (type safety)
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'No autenticado'
        });
        return;
      }

      // Verificar que puede unirse
      if (!session.canJoin(req.user.id)) {
        res.status(403).json({
          success: false,
          message: 'No puedes unirte a esta sesión'
        });
        return;
      }

      // Verificar rol
      if (role === 'proctor' && !session.participants.proctors.includes(req.user.id)) {
        res.status(403).json({
          success: false,
          message: 'No eres proctor de esta sesión'
        });
        return;
      }

      if (role === 'student' && !session.participants.registeredCandidates.includes(req.user.id)) {
        res.status(403).json({
          success: false,
          message: 'No estás registrado en esta sesión'
        });
        return;
      }

  // Generar token de acceso temporal (JWT firmado)
  const accessToken = this.generateSessionAccessToken(req.user.id, req.user.email || '', sessionId, role);

      res.json({
        success: true,
        message: 'Autorizado para unirse a la sesión',
        data: {
          sessionId,
          accessToken,
          role,
          websocketUrl: process.env.WEBSOCKET_URL || `ws://localhost:${process.env.PORT || 3004}`,
          session: {
            name: session.sessionName,
            examName: session.examName,
            status: session.status,
            duration: session.settings.duration,
            instructions: session.settings.instructions
          }
        }
      });

      loggerUtils.userEvent(req.user.id, 'SESSION_JOIN_AUTHORIZED', sessionId, { role });

    } catch (error) {
      logger.error('Error joining session:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Obtener progreso personal en la sesión
   */
  async getMyProgress(req: AuthenticatedHttpRequest, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;

      const session = await ActiveSessionModel.findBySessionId(sessionId);

      if (!session) {
        res.status(404).json({
          success: false,
          message: 'Sesión no encontrada'
        });
        return;
      }

      // Asegurar que el usuario está presente (type safety)
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'No autenticado'
        });
        return;
      }

      if (!session.participants.registeredCandidates.includes(req.user.id)) {
        res.status(403).json({
          success: false,
          message: 'No estás registrado en esta sesión'
        });
        return;
      }
      

      const userId = req.user!.id;
      const participantStatus = session.participants.status.get(userId);
      const candidateQuestions = session.questions.questionsPerCandidate.get(userId);
      
      const userResponses = session.questions.responses.filter((r: any) => r.candidateId === userId);

      const progress = {
        userId: req.user.id,
        sessionId,
        status: participantStatus?.status || 'waiting',
        questionsAnswered: participantStatus?.answeredQuestions.length || 0,
        totalQuestions: candidateQuestions?.length || 0,
        timeSpent: participantStatus?.timeSpent || 0,
        currentQuestionIndex: participantStatus?.currentQuestionIndex || 0,
        responses: userResponses.map(r => ({
          questionId: r.questionId,
          timestamp: r.timestamp,
          timeSpent: r.timeSpent,
          score: r.evaluation?.score,
          maxScore: r.evaluation?.maxScore
        })),
        joinedAt: participantStatus?.joinedAt,
        lastActivity: participantStatus?.lastActivity
      };

      res.json({
        success: true,
        progress
      });

    } catch (error) {
      logger.error('Error getting user progress:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Obtener datos de monitoreo (solo proctors)
   */
  async getMonitoringData(req: AuthenticatedHttpRequest, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;

      const session = await ActiveSessionModel.findBySessionId(sessionId);

      if (!session) {
        res.status(404).json({
          success: false,
          message: 'Sesión no encontrada'
        });
        return;
      }
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'No autenticado'
        });
        return;
      }
      // Verificar que es proctor de esta sesión
      if (!session.participants.proctors.includes(req.user.id) && req.user.role !== 'admin') {
        res.status(403).json({
          success: false,
          message: 'No eres proctor de esta sesión'
        });
        return;
      }

      const monitoringData = this.buildMonitoringData(session);

      res.json({
        success: true,
        monitoring: monitoringData
      });

    } catch (error) {
      logger.error('Error getting monitoring data:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Obtener todas las sesiones (solo admin)
   */
  async getAllSessions(req: AuthenticatedHttpRequest, res: Response): Promise<void> {
    try {
      const {
        page = 1,
        limit = 20,
        status,
        examId,
        search
      } = req.query;

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const skip = (pageNum - 1) * limitNum;

      // Construir filtros
      const filters: any = {};
      
      if (status) {
        filters.status = status;
      }
      
      if (examId) {
        filters.examId = examId;
      }
      
      if (search) {
        filters.$or = [
          { sessionName: { $regex: search, $options: 'i' } },
          { examName: { $regex: search, $options: 'i' } }
        ];
      }

      const [sessions, total] = await Promise.all([
        ActiveSessionModel.find(filters)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNum)
          .lean(),
        ActiveSessionModel.countDocuments(filters)
      ]);

      res.json({
        success: true,
        data: {
          sessions,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            pages: Math.ceil(total / limitNum)
          }
        }
      });

    } catch (error) {
      logger.error('Error getting all sessions:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Crear nueva sesión
   */
  async createSession(req: AuthenticatedHttpRequest, res: Response): Promise<void> {
    try {
      const schema = Joi.object({
        sessionId: Joi.string().required(),
        examId: Joi.string().required(),
        sessionName: Joi.string().required(),
        examName: Joi.string().required(),
        sessionType: Joi.string().valid('group_synchronized', 'individual_flexible').required().default('group_synchronized'),
        settings: Joi.object({
          duration: Joi.number().min(1).required(),
          autoStart: Joi.boolean().default(false),
          autoEnd: Joi.boolean().default(true),
          allowLateJoin: Joi.boolean().default(true),
          showResults: Joi.boolean().default(false),
          randomizeQuestions: Joi.boolean().default(true),
          maxAttempts: Joi.number().min(1).default(1),
          instructions: Joi.string().allow('')
        }).required(),
        participants: Joi.object({
          registeredCandidates: Joi.array().items(Joi.string()).default([]),
          proctors: Joi.array().items(Joi.string()).default([])
        }).default({}),
        timing: Joi.object({
          sessionWindow: Joi.object({
            start: Joi.date().optional(),
            end: Joi.date().optional()
          }).optional(),
          examDuration: Joi.number()
            .min(1)
            .max(480)
            .optional()
            .messages({
              'number.min': 'Duración mínima 1 minuto',
              'number.max': 'Duración máxima 8 horas'
            }),
          lateJoinPolicy: Joi.string()
            .valid('guaranteed', 'remaining', 'sliding')
            .optional(),
          maxLateness: Joi.number()
            .min(0)
            .max(120)
            .optional()
            .messages({
              'number.min': 'No puede ser negativo',
              'number.max': 'Máximo 2 horas'
            }),
          autoSaveInterval: Joi.number()
            .min(10)
            .max(300)
            .optional()
            .messages({
              'number.min': 'Mínimo 10 segundos',
              'number.max': 'Máximo 5 minutos'
            }),
          guaranteedTime: Joi.boolean().optional()
        })
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        res.status(400).json({
          success: false,
          message: error.details[0].message
        });
        return;
      }

      // Verificar que no existe una sesión con el mismo ID
      const existingSession = await ActiveSessionModel.findBySessionId(value.sessionId);
      if (existingSession) {
        res.status(409).json({
          success: false,
          message: 'Ya existe una sesión con este ID'
        });
        return;
      }
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'No autenticado'
        });
        return;
      }
      const session = new ActiveSessionModel({
        ...value,
        status: 'scheduled',
        participants: {
          registeredCandidates: value.participants.registeredCandidates || [],
          activeCandidates: [],
          proctors: value.participants.proctors || [],
          status: new Map()
        },
        questions: {
          totalQuestions: 0,
          questionsPerCandidate: new Map(),
          responses: []
        },
        stats: {
          totalParticipants: value.participants.registeredCandidates?.length || 0,
          activeParticipants: 0,
          completedParticipants: 0,
          averageProgress: 0,
          averageTimeSpent: 0
        },
        technical: {
          serverInstance: process.env.HOSTNAME || 'unknown',
          lastHeartbeat: new Date(),
          connections: 0
        },
        createdBy: req.user.id,
        sessionType: value.sessionType,
        timing: value.timing
      });

      await session.save();

      res.status(201).json({
        success: true,
        message: 'Sesión creada exitosamente',
        session: session.toObject()
      });

      loggerUtils.sessionEvent(value.sessionId, 'SESSION_CREATED', {
        createdBy: req.user.id,
        examId: value.examId
      });

    } catch (error) {
      logger.error('Error creating session:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Actualizar sesión
   */
  async updateSession(req: AuthenticatedHttpRequest, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;

      const schema = Joi.object({
        sessionName: Joi.string(),
        examName: Joi.string(),
        settings: Joi.object({
          duration: Joi.number().min(1),
          autoStart: Joi.boolean(),
          autoEnd: Joi.boolean(),
          allowLateJoin: Joi.boolean(),
          showResults: Joi.boolean(),
          randomizeQuestions: Joi.boolean(),
          maxAttempts: Joi.number().min(1),
          instructions: Joi.string().allow('')
        }),
        participants: Joi.object({
          registeredCandidates: Joi.array().items(Joi.string()),
          proctors: Joi.array().items(Joi.string())
        })
      }).min(1);

      const { error, value } = schema.validate(req.body);
      if (error) {
        res.status(400).json({
          success: false,
          message: error.details[0].message
        });
        return;
      }

      const session = await ActiveSessionModel.findBySessionId(sessionId);
      if (!session) {
        res.status(404).json({
          success: false,
          message: 'Sesión no encontrada'
        });
        return;
      }
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'No autenticado'
        });
        return;
      }
      // Restrict certain updates if session already started
      if (session.status !== 'scheduled' && (value.settings || value.participants)) {
        res.status(400).json({
          success: false,
          message: 'No se pueden modificar settings o participantes después de iniciar la sesión'
        });
        return;
      }

      if (value.sessionName) session.sessionName = value.sessionName;
      if (value.examName) session.examName = value.examName;

      if (value.settings) {
        session.settings = {
          ...session.settings,
          ...value.settings
        };
      }

      if (value.participants) {
        if (value.participants.registeredCandidates) {
          session.participants.registeredCandidates = value.participants.registeredCandidates;
          session.stats.totalParticipants = value.participants.registeredCandidates.length;
        }
        if (value.participants.proctors) {
          session.participants.proctors = value.participants.proctors;
        }
      }

      await session.save();

      res.json({
        success: true,
        message: 'Sesión actualizada correctamente',
        session: session.toObject()
      });

      loggerUtils.sessionEvent(sessionId, 'SESSION_UPDATED', {
        updatedBy: req.user.id,
        fields: Object.keys(value)
      });

    } catch (err) {
      logger.error('Error updating session:', err);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Iniciar sesión
   */
  async startSession(req: AuthenticatedHttpRequest, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;

      const session = await ActiveSessionModel.findBySessionId(sessionId);

      if (!session) {
        res.status(404).json({
          success: false,
          message: 'Sesión no encontrada'
        });
        return;
      }

      if (session.status !== 'scheduled') {
        res.status(400).json({
          success: false,
          message: `No se puede iniciar la sesión en estado: ${session.status}`
        });
        return;
      }
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'No autenticado'
        });
        return;
      }
      session.status = 'active';
      session.startedAt = new Date();
      await session.save();

      res.json({
        success: true,
        message: 'Sesión iniciada exitosamente',
        session: {
          sessionId,
          status: session.status,
          startedAt: session.startedAt
        }
      });

      loggerUtils.sessionEvent(sessionId, 'SESSION_STARTED', {
        startedBy: req.user.id
      });

    } catch (error) {
      logger.error('Error starting session:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Finalizar sesión (admin / proctor)
   */
  async endSession(req: AuthenticatedHttpRequest, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;
      const session = await ActiveSessionModel.findBySessionId(sessionId);

      if (!session) {
        res.status(404).json({ success: false, message: 'Sesión no encontrada' });
        return;
      }

      if (session.status !== 'active') {
        res.status(400).json({ success: false, message: `La sesión no está activa (estado actual: ${session.status})` });
        return;
      }
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'No autenticado'
        });
        return;
      }
      session.status = 'completed';
      session.endedAt = new Date();

      // Recalcular estadísticas básicas
      try {
        const statusEntries = Array.from(session.participants.status.values()) as any[];
        const completed = statusEntries.filter(s => s.status === 'completed').length;
        const active = statusEntries.filter(s => s.status === 'active').length;
        session.stats.completedParticipants = completed;
        session.stats.activeParticipants = active;
        if (statusEntries.length > 0) {
          const avgProgress = statusEntries.reduce((acc, s) => acc + (s.answeredQuestions?.length || 0), 0) / statusEntries.length;
            session.stats.averageProgress = avgProgress;
          const avgTime = statusEntries.reduce((acc, s) => acc + (s.timeSpent || 0), 0) / statusEntries.length;
          session.stats.averageTimeSpent = avgTime;
        }
      } catch (calcErr) {
        logger.warn('Error recalculating stats al finalizar sesión', calcErr);
      }

      await session.save();

      res.json({
        success: true,
        message: 'Sesión finalizada correctamente',
        session: {
          sessionId,
          status: session.status,
          endedAt: session.endedAt
        }
      });

      loggerUtils.sessionEvent(sessionId, 'SESSION_ENDED', { endedBy: req.user.id });
    } catch (error) {
      logger.error('Error ending session:', error);
      res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
  }

  /**
   * Eliminar sesión (admin)
   */
  async deleteSession(req: AuthenticatedHttpRequest, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;
      const session = await ActiveSessionModel.findBySessionId(sessionId);

      if (!session) {
        res.status(404).json({ success: false, message: 'Sesión no encontrada' });
        return;
      }

      if (session.status === 'active') {
        res.status(400).json({
          success: false,
          message: 'No se puede eliminar una sesión activa; finalízala primero'
        });
        return;
      }
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'No autenticado'
        });
        return;
      }
      await ActiveSessionModel.findOneAndDelete({ sessionId });

      res.json({
        success: true,
        message: 'Sesión eliminada correctamente',
        sessionId
      });

      loggerUtils.sessionEvent(sessionId, 'SESSION_DELETED', { deletedBy: req.user.id });
    } catch (error) {
      logger.error('Error deleting session:', error);
      res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
  }

  /**
   * Obtener resultados de la sesión (admin / proctor)
   */
  async getSessionResults(req: AuthenticatedHttpRequest, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;
      const session = await ActiveSessionModel.findBySessionId(sessionId);

      if (!session) {
        res.status(404).json({ success: false, message: 'Sesión no encontrada' });
        return;
      }

      if (!['completed', 'active'].includes(session.status)) {
        res.status(400).json({
          success: false,
            message: 'La sesión aún no ha iniciado o no tiene resultados disponibles'
        });
        return;
      }

      const participantStatuses = Array.from(session.participants.status.entries()).map(
        ([userId, st]: any) => ({
          userId,
          status: st.status,
          answeredQuestions: st.answeredQuestions?.length || 0,
          timeSpent: st.timeSpent || 0,
          score: st.score
        })
      );

      const results = {
        sessionId: session.sessionId,
        status: session.status,
        stats: session.stats,
        participants: participantStatuses,
        responses: session.questions.responses.map((r: any) => ({
          candidateId: r.candidateId,
          questionId: r.questionId,
          timestamp: r.timestamp,
          evaluation: r.evaluation
        }))
      };

      res.json({ success: true, results });
    } catch (error) {
      logger.error('Error getting session results:', error);
      res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
  }

  /**
   * Exportar datos completos de la sesión (admin)
   */
  async exportSessionData(req: AuthenticatedHttpRequest, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;
      const session = await ActiveSessionModel.findBySessionId(sessionId);

      if (!session) {
        res.status(404).json({ success: false, message: 'Sesión no encontrada' });
        return;
      }
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'No autenticado'
        });
        return;
      }
      const exportPayload = {
        meta: {
          exportedAt: new Date().toISOString(),
          sessionId: session.sessionId,
          examName: session.examName,
          status: session.status
        },
        session: session.toObject()
      };

      res.setHeader('Content-Disposition', `attachment; filename="session-${sessionId}.json"`);
      res.json(exportPayload);

      loggerUtils.sessionEvent(sessionId, 'SESSION_EXPORTED', { exportedBy: req.user.id });
    } catch (error) {
      logger.error('Error exporting session data:', error);
      res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
  }

  /**
   * Obtener información de salas de una sesión
   */
  async getSessionRooms(req: AuthenticatedHttpRequest, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;

      const session = await ActiveSessionModel.findBySessionId(sessionId);

      if (!session) {
        res.status(404).json({
          success: false,
          message: 'Sesión no encontrada'
        });
        return;
      }

      // Asegurar que el usuario está presente (type safety)
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'No autenticado'
        });
        return;
      }

      if (!this.canUserAccessSession(req.user, session)) {
        res.status(403).json({
          success: false,
          message: 'No tienes permisos para acceder a esta sesión'
        });
        return;
      }

      // Obtener información de las salas activas
      const roomsInfo = await this.sessionService.getActiveRoomsInfo(sessionId);

      res.json({
        success: true,
        data: roomsInfo
      });

    } catch (error) {
      logger.error('Error getting session rooms:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  // MÉTODOS PRIVADOS

  private async checkDatabaseConnection(): Promise<{ status: string; latency?: number }> {
    try {
      const start = Date.now();
      await ActiveSessionModel.findOne().limit(1);
      const latency = Date.now() - start;
      
      return {
        status: 'connected',
        latency
      };
    } catch (error) {
      return {
        status: 'disconnected'
      };
    }
  }

  private async checkExternalServices(): Promise<Record<string, any>> {
    const services = {
      examService: process.env.EXAM_SERVICE_URL,
      notificationService: process.env.NOTIFICATION_SERVICE_URL,
      aiService: process.env.AI_SERVICE_URL
    };

    const results: Record<string, any> = {};

    for (const [name, url] of Object.entries(services)) {
      if (url) {
        try {
          const response = await fetch(`${url}/health`, { 
            method: 'GET',
            signal: AbortSignal.timeout(3000)
          });
          results[name] = {
            status: response.ok ? 'healthy' : 'unhealthy',
            url
          };
        } catch (error) {
          results[name] = {
            status: 'unreachable',
            url
          };
        }
      } else {
        results[name] = {
          status: 'not_configured'
        };
      }
    }

    return results;
  }

  private canUserAccessSession(user: any, session: any): boolean {
    return (
      user.role === 'admin' ||
      session.participants.registeredCandidates.includes(user.id) ||
      session.participants.proctors.includes(user.id) ||
      session.createdBy === user.id
    );
  }

  private filterSessionDataByRole(session: any, role: string): any {
    const baseData = {
      sessionId: session.sessionId,
      sessionName: session.sessionName,
      examName: session.examName,
      status: session.status,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      settings: {
        duration: session.settings.duration,
        instructions: session.settings.instructions
      }
    };

    if (role === 'admin' || role === 'proctor') {
      return {
        ...baseData,
        ...session.toObject()
      };
    }

    // Para estudiantes, solo datos básicos
    return baseData;
  }

  private calculateTimeRemaining(session: any): number {
    if (!session.startedAt || session.status !== 'active') {
      return session.settings.duration * 60;
    }

    const elapsed = (Date.now() - session.startedAt.getTime()) / 1000;
    const total = session.settings.duration * 60;
    return Math.max(0, total - elapsed);
  }

  private generateSessionAccessToken(userId: string, email: string, sessionId: string, role: string): string {
    // Firmar un JWT corto para acceso al WebSocket/session
    const secret = process.env.SESSION_JWT_SECRET || process.env.JWT_SECRET;
    if (!secret) {
      // Fallback: si no hay secreto, lanzar para evitar emitir tokens inseguros
      throw new Error('SESSION_JWT_SECRET or JWT_SECRET is not configured');
    }

    const expiresInMinutes = parseInt(process.env.SESSION_JWT_EXP_MIN || '15', 10);

    const payload = {
      id: userId,
      email,
      role,
      sessionId
    };

    const token = jwt.sign(payload, secret, { expiresIn: `${expiresInMinutes}m` });
    return token;
  }

  /**
   * Obtener sesiones disponibles para un candidato
   */
  private async getAvailableSessionsForCandidate(req: AuthenticatedHttpRequest, res: Response): Promise<Response> {
    try {
      const { candidateId } = req.params;
      
      // Obtener el servicio de lobby (necesitamos acceso a él)
      const examLobbyService = (req.app.locals?.examLobbyService || this.sessionService.examLobbyService);
      
      // Buscar sesiones activas o programadas
      const sessions = await ActiveSessionModel.find({
        status: { $in: ['scheduled', 'active'] },
        $or: [
          { 'participants.registeredCandidates': candidateId },
          { 'settings.allowOpenRegistration': true }
        ]
      }).lean();

      // Mapear sesiones a DTOs con información del lobby
      const availableSessions: AvailableSessionDTO[] = await Promise.all(
        sessions.map(async (session) => {
          const hasLobby = examLobbyService?.hasLobbyForSession(session.sessionId) || false;
          const lobbyStatus = hasLobby ? examLobbyService.getLobbyStatus(session.sessionId) : null;
          
          return {
            sessionId: session.sessionId,
            examId: session.examId,
            examName: session.examName || 'Examen',
            sessionName: session.sessionName || session.examName,
            // Asegurar que siempre es Date (fallback a createdAt o ahora)
            scheduledAt: new Date(session.scheduledAt ?? session.createdAt ?? Date.now()),
            duration: session.settings?.duration || 120,
            status: session.status,
            hasLobby,
            lobbyStatus: lobbyStatus?.status,
            maxParticipants: lobbyStatus?.maxParticipants || session.settings?.maxParticipants,
            currentParticipants: lobbyStatus?.participants?.size || session.participants?.registeredCandidates?.length || 0,
            requiresTechnicalVerification: lobbyStatus?.requiresTechnicalVerification || session.settings?.requiresTechnicalVerification,
            registrationDeadline: session.settings?.registrationDeadline,
            competencies: session.settings?.competencies || ['Listening', 'Reading', 'Writing', 'Speaking']
          };
        })
      );

      // Filtrar solo sesiones con lobby activo o que permiten registro
      const filteredSessions = availableSessions.filter(session => 
        session.hasLobby || session.status === 'scheduled'
      );

      return res.json({
        success: true,
        message: 'Sesiones disponibles obtenidas exitosamente',
        data: filteredSessions
      });

    } catch (error) {
      logger.error('Error getting available sessions for candidate:', error);
      
      return res.status(500).json({
        success: false,
        message: 'Error al obtener sesiones disponibles',
        error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      });
    }
  }

  private buildMonitoringData(session: any): any {
    const entries = Array.from(session.participants.status.entries()) as [string, any][];
    const participants = entries.map(([userId, status]) => ({
      userId,
      status: status.status,
      joinedAt: status.joinedAt,
      lastActivity: status.lastActivity,
      currentQuestionIndex: status.currentQuestionIndex,
      answeredQuestions: status.answeredQuestions.length,
      timeSpent: status.timeSpent
    }));

    return {
      session: {
        sessionId: session.sessionId,
        sessionName: session.sessionName,
        examName: session.examName,
        status: session.status,
        startedAt: session.startedAt,
        timeRemaining: this.calculateTimeRemaining(session)
      },
      participants,
      stats: session.stats,
      technical: session.technical,
      responses: session.questions.responses.length
    };
  }

  getRouter(): Router {
    return this.router;
  }
}
