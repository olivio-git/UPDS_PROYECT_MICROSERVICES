import { Server as SocketIOServer } from 'socket.io';
import { AuthenticatedSocket } from '../middleware/auth';
import { ActiveSessionModel, IActiveSession, ISessionResponse, ITimingConfig } from '../models/ActiveSession';
import { logger } from '../utils/logger';
import { DualTimingManager, FlexibleSessionConfig, GroupSessionConfig } from './DualTimingManager';
import { EvaluationService } from './EvaluationService';
import { KafkaService } from './KafkaService';
import { NotificationService } from './NotificationService';
import { QuestionService } from './QuestionService';

export class SessionService {
  private io: SocketIOServer;
  private questionService: QuestionService;
  private notificationService: NotificationService;
  private evaluationService: EvaluationService;
  private kafkaService: KafkaService;
  private activeConnections: Map<string, AuthenticatedSocket> = new Map();
  private sessionTimers: Map<string, NodeJS.Timeout> = new Map();
  public examLobbyService: any; // Referencia al servicio de lobby
  private dualTimingManager: DualTimingManager; // NUEVO - Manejo dual de timing

  constructor(io: SocketIOServer) {
    this.io = io;
    this.questionService = new QuestionService();
    this.notificationService = new NotificationService();
    this.evaluationService = new EvaluationService();
    this.kafkaService = new KafkaService();
    this.dualTimingManager = new DualTimingManager(); // NUEVO
    
    this.setupPeriodicTasks();
  }
  
  /**
   * Establecer referencia al ExamLobbyService
   */
  setExamLobbyService(examLobbyService: any): void {
    this.examLobbyService = examLobbyService;
  }

  /**
   * Crear una nueva sesión de examen con lobby - MEJORADO para soporte dual
   */
  async createExamSession(sessionData: {
    sessionId: string;
    examId: string;
    examName: string;
    scheduledStartTime: number;
    duration: number;
    maxParticipants?: number;
    settings?: any;
    createdBy: string;
    // NUEVOS CAMPOS
    sessionType?: 'group_synchronized' | 'individual_flexible';
    timing?: ITimingConfig;
  }) {
    try {
      const exist = await ActiveSessionModel.findOne({ sessionId: sessionData.sessionId, status: 'active' });
      if (exist) {
        throw new Error('La sesión ya no se puede volver a crear!');
      }
      // Crear la sesión en la base de datos con soporte dual
      const session = new ActiveSessionModel({
        sessionId: sessionData.sessionId,
        examId: sessionData.examId,
        sessionName: sessionData.examName,
        examName: sessionData.examName,
        sessionType: sessionData.sessionType || 'group_synchronized', // NUEVO
        status: 'scheduled',
        createdBy: sessionData.createdBy,
        timing: sessionData.timing, // NUEVO
        settings: {
          duration: sessionData.duration,
          autoEnd: true,
          allowLateJoin: sessionData.settings?.allowLateJoin || false,
          ...sessionData.settings
        },
        scheduledAt: new Date(sessionData.scheduledStartTime),
        createdAt: new Date(),
        participants: {
          registeredCandidates: [],
          status: new Map()
        },
        questions: {
          questionsPerCandidate: new Map(),
          responses: []
        },
        stats: {
          totalParticipants: 0,
          activeParticipants: 0,
          completedParticipants: 0
        },
        // Inicializar campos adicionales para sesiones individuales
        ...(sessionData.sessionType === 'individual_flexible' && {
          individualSessions: new Map(),
          memoryStats: {
            totalSubSessions: 0,
            activeSubSessions: 0,
            lastCleanup: new Date(),
            autoSaveJobs: 0
          }
        })
      });

      await session.save();

      // Programar eventos según el tipo de sesión
      await this.scheduleSessionEvents(session);

      logger.info(`📝 Sesión ${sessionData.sessionType || 'grupal'} creada: ${sessionData.sessionId}`);

      return session;
    } catch (error) {
      logger.error('Error creating exam session:', error);
      throw error;
    }
  }

  /**
   * Programar eventos de sesión según su tipo
   */
  private async scheduleSessionEvents(session: IActiveSession): Promise<void> {
    try {
      if (session.sessionType === 'group_synchronized') {
        // Programar sesión grupal
        const config: GroupSessionConfig = {
          sessionId: session.sessionId,
          startTime: session.timing?.sessionWindow?.start || session.scheduledAt || new Date(),
          endTime: session.timing?.sessionWindow?.end || new Date(Date.now() + session.settings.duration * 60 * 1000),
          autoStart: session.settings.autoStart
        };
        
        await this.dualTimingManager.scheduleGroupSession(config);
        logger.info(`⏰ Sesión grupal programada: ${session.sessionId}`);
        
      } else if (session.sessionType === 'individual_flexible') {
        // Para sesiones flexibles, no programamos inicio automático
        // Se crearán sesiones individuales cuando los candidatos se conecten
        logger.info(`🎯 Sesión flexible preparada para conexiones individuales: ${session.sessionId}`);
      }
    } catch (error) {
      logger.error(`❌ Error programando eventos para sesión ${session.sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Activar una sesión programada (llamado desde el lobby)
   */
  async activateScheduledSession(sessionId: string, participantIds: string[]): Promise<void> {
    try {
      const session = await ActiveSessionModel.findBySessionId(sessionId);
      
      if (!session) {
        throw new Error('Sesión no encontrada');
      }

      if (session.status !== 'scheduled') {
        throw new Error('La sesión no está en estado programado');
      }

      // Comportamiento diferente según el tipo de sesión
      if (session.sessionType === 'individual_flexible') {
        // Para sesiones flexibles, solo cambiar estado - las sesiones individuales se crean al conectarse
        session.status = 'active';
        session.startedAt = new Date();
        await session.save();
        
        logger.info(`🚀 Sesión flexible activada: ${sessionId}`);
        return;
      }

      // Activar la sesión grupal
      session.status = 'active';
      session.startedAt = new Date();
      
      // Registrar participantes
      participantIds.forEach(participantId => {
        session.addParticipant(participantId, 'candidate');
      });

      await session.save();

      // Configurar auto-finalización
      this.setupSessionAutoEnd(session);

      // Publicar evento en Kafka
      await this.kafkaService.publishEvent('session-events', {
        type: 'SESSION_ACTIVATED',
        sessionId,
        participantCount: participantIds.length,
        timestamp: new Date()
      });

      logger.info(`🚀 Sesión grupal activada: ${sessionId} con ${participantIds.length} participantes`);

    } catch (error) {
      logger.error('Error activating session:', error);
      throw error;
    }
  }
  /**
   * Crear sesión individual para candidato (solo para sesiones flexibles)
   */
  async createIndividualSession(
    candidateId: string,
    sessionId: string,
    examDuration: number = 60,
    lateJoinPolicy: 'guaranteed' | 'remaining' | 'sliding' = 'remaining'
  ): Promise<string> {
    try {
      const session = await ActiveSessionModel.findBySessionId(sessionId);
      
      if (!session) {
        throw new Error('Sesión no encontrada');
      }
      
      if (session.sessionType !== 'individual_flexible') {
        throw new Error('Solo se pueden crear sesiones individuales en sesiones flexibles');
      }
      
      if (!session.timing) {
        throw new Error('Configuración de timing no encontrada');
      }
      
      const config: FlexibleSessionConfig = {
        sessionId,
        sessionWindow: session.timing.sessionWindow,
        examDuration,
        lateJoinPolicy,
        maxLateness: session.timing.maxLateness || 15,
        autoSaveInterval: session.timing.autoSaveInterval || 30
      };
      
      const subSessionId = await this.dualTimingManager.createIndividualSession(candidateId, config);
      
      logger.info(`🎯 Sesión individual creada: ${subSessionId} para candidato ${candidateId}`);
      
      return subSessionId;
      
    } catch (error) {
      logger.error(`❌ Error creando sesión individual para ${candidateId}:`, error);
      throw error;
    }
  }

  async joinSession(socket: AuthenticatedSocket, sessionId: string, role: 'student' | 'proctor') {
    try {
      const session = await ActiveSessionModel.findBySessionId(sessionId);
      
      if (!session) {
        throw new Error('Sesión no encontrada');
      }

      // Verificar estado de la sesión
      if (session.status === 'completed' || session.status === 'cancelled') {
        throw new Error('La sesión ya ha finalizado');
      }

      // Manejo diferente según el tipo de sesión
      if (session.sessionType === 'individual_flexible' && role === 'student') {
        // Para sesiones flexibles, intentar crear sesión individual
        try {
          const examDuration = session.timing?.examDuration || 60;
          const lateJoinPolicy = session.timing?.lateJoinPolicy || 'remaining';
          
          const subSessionId = await this.createIndividualSession(
            socket.userId,
            sessionId,
            examDuration,
            lateJoinPolicy
          );
          
          // Añadir información de sub-sesión al socket
          (socket as any).subSessionId = subSessionId;
          
          logger.info(`👥 Candidato ${socket.userId} conectado a sesión individual: ${subSessionId}`);
          
        } catch (error:any) {
          throw new Error(error.message || 'No se pudo unir a la sesión flexible');
        }
      } else {
        // Para sesiones grupales, verificar estado
        if (session.status === 'scheduled' && !session.settings.allowLateJoin) {
          throw new Error('La sesión no ha iniciado aún');
        }
      }

      // Verificar permisos según rol - usar candidateId si está disponible
      const candidateId = (socket as any).candidateId;
      this.validateSessionAccess(session, socket.userId, role, candidateId);

      // Unir al socket a la sala apropiada según tipo de sesión y rol
      const roomName = await this.joinAppropriateRoom(socket, sessionId, session.sessionType || 'group_synchronized', role);
      socket.sessionId = sessionId;
      (socket as any).roomName = roomName; // Guardar nombre de sala en el socket
      this.activeConnections.set(socket.id, socket);

      // Actualizar estado en la sesión
      session.addParticipant(socket.userId, role === 'student' ? 'candidate' : 'proctor');
      await session.save();

      // Configurar auto-finalización si es necesario
      this.setupSessionAutoEnd(session);

      // Enviar estado inicial según rol
      if (role === 'student') {
        await this.sendStudentInitialState(socket, session);
      } else if (role === 'proctor') {
        await this.sendProctorDashboard(socket, session);
      }

      // Notificar a otros participantes en la sala específica y la sala general
      socket.to(roomName).emit('participant-joined', {
        userId: socket.userId,
        role: role,
        roomName: roomName,
        sessionType: session.sessionType,
        timestamp: new Date()
      });

      // También notificar a la sala general para eventos globales
      socket.to(`session-${sessionId}`).emit('participant-joined', {
        userId: socket.userId,
        role: role,
        roomName: roomName,
        sessionType: session.sessionType,
        timestamp: new Date()
      });

      // Publicar evento en Kafka
      await this.kafkaService.publishEvent('session-events', {
        type: 'USER_JOINED_SESSION',
        sessionId,
        userId: socket.userId,
        role,
        timestamp: new Date()
      });

      logger.info(`Usuario ${socket.userId} se unió a la sesión ${sessionId} como ${role}`);

    } catch (error) {
      logger.error('Error joining session:', error);
      throw error;
    }
  }

  /**
   * Verifica si puede reconectar a un examen existente
   */
  async checkExamReconnection(sessionId: string, candidateId: string, forceRestart = false): Promise<{
    canReconnect: boolean;
    reason?: string;
    examState?: any;
    timeRemaining?: number;
    currentQuestion?: any;
    answeredQuestions?: any[];
    progress?: { current: number; total: number };
  }> {
    try {
      logger.info(`🔍 Verificando reconexión para candidato ${candidateId} en sesión ${sessionId}`);
      
      if (forceRestart) {
        return {
          canReconnect: false,
          reason: 'Reinicio forzado solicitado'
        };
      }

      // 1. Buscar sesión activa
      const session = await ActiveSessionModel.findBySessionId(sessionId);

      if (!session) {
        return {
          canReconnect: false,
          reason: 'No se encontró sesión activa'
        };
      }

      // 2. Verificar sub-sesión individual
      if (!session.individualSessions) {
        return {
          canReconnect: false,
          reason: 'No hay sub-sesiones individuales en esta sesión'
        };
      }

      const subSession = session.individualSessions.get(candidateId);
      if (!subSession) {
        return {
          canReconnect: false,
          reason: 'No se encontró sub-sesión individual'
        };
      }

      // 3. Verificar estado de la sub-sesión
      if (subSession.status !== 'active') {
        return {
          canReconnect: false,
          reason: `Sub-sesión en estado: ${subSession.status} (esperado: active)`
        };
      }

      // 4. Verificar tiempo de examen
      const now = new Date();
      const examEndTime = subSession.expiresAt;
      
      if (now > examEndTime) {
        return {
          canReconnect: false,
          reason: 'Tiempo de examen agotado'
        };
      }

      const timeRemaining = Math.max(0, examEndTime.getTime() - now.getTime());

      // 5. Obtener preguntas y respuestas de la sesión
      const candidateQuestions = session.questions?.questionsPerCandidate?.get(candidateId) || [];
      const candidateAnswers = session.questions?.responses?.filter((r: any) => r.candidateId === candidateId) || [];

      // 6. Obtener estado actual del examen
      logger.info(`✅ Reconexión posible para candidato ${candidateId}`);
      
      return {
        canReconnect: true,
        examState: {
          sessionId,
          candidateId,
          status: subSession.status,
          startTime: subSession.startedAt,
          expiresAt: subSession.expiresAt,
          timeAllowed: subSession.timeAllowed,
          lastActivity: subSession.lastActivity
        },
        timeRemaining: Math.floor(timeRemaining / 1000), // En segundos
        currentQuestion: null, // Esto lo manejará el frontend/controlador específico
        answeredQuestions: candidateAnswers,
        progress: {
          current: candidateAnswers.length,
          total: candidateQuestions.length
        }
      };

    } catch (error) {
      logger.error(`❌ Error verificando reconexión:`, error);
      return {
        canReconnect: false,
        reason: `Error interno: ${error instanceof Error ? error.message : 'Error desconocido'}`
      };
    }
  }

  /**
   * Reconecta a un examen existente sin perder progreso
   */
  async reconnectToExam(authenticatedSocket: AuthenticatedSocket, sessionId: string, candidateId: string): Promise<void> {
    try {
      logger.info(`🔄 Reconectando candidato ${candidateId} a sesión ${sessionId}`);

      // 1. Obtener sesión existente
      const session = await ActiveSessionModel.findBySessionId(sessionId);

      if (!session) {
        throw new Error('Sesión no encontrada para reconexión');
      }

      if (!session.individualSessions) {
        throw new Error('No hay sub-sesiones individuales en esta sesión');
      }

      const subSession = session.individualSessions.get(candidateId);
      if (!subSession || subSession.status !== 'active') {
        throw new Error('Sub-sesión no válida para reconexión');
      }

      // 2. Actualizar información de actividad (sin eliminar progreso)
      subSession.lastActivity = new Date();

      // 3. Guardar cambios SIN modificar el progreso del examen
      session.individualSessions.set(candidateId, subSession);
      await session.save();

      // 4. Unir al room de socket
      const roomName = `exam-${sessionId}-${candidateId}`;
      await authenticatedSocket.join(roomName);
      
      logger.info(`✅ Candidato ${candidateId} reconectado exitosamente a sesión ${sessionId}`);
      logger.info(`🏠 Socket unido al room: ${roomName}`);

    } catch (error) {
      logger.error(`❌ Error en reconexión:`, error);
      throw error;
    }
  }

  /**
   * Iniciar examen individual (marcar como iniciado para un estudiante específico)
   */
  async startIndividualExam(socket: AuthenticatedSocket, sessionId: string, candidateId: string, forceRestart = false): Promise<void> {
    
    try {
      const session = await ActiveSessionModel.findBySessionId(sessionId); 
      
      if (!session) {
        logger.error(`❌ [SessionService] Sesión no encontrada`);
        throw new Error('Sesión no encontrada');
      }

      logger.info(`🔍 [SessionService] Verificando estado de la sesión: ${session.status}`);

      // Verificar estado de la sesión
      if (session.status === 'completed') {
        logger.error(`❌ [SessionService] Sesión ya terminada`);
        throw new Error('Esta sesión ya ha terminado');
      }
      
      if (session.status === 'cancelled') {
        logger.error(`❌ [SessionService] Sesión cancelada`);
        throw new Error('Esta sesión ha sido cancelada');
      }
      
      if (session.status !== 'active' && session.status !== 'scheduled') {
        logger.error(`❌ [SessionService] Estado de sesión inválido: ${session.status}`);
        throw new Error('La sesión no está disponible para iniciar');
      }
 
      // Para sesiones individuales, verificar si el usuario ya tiene una sub-sesión
      if (session.sessionType === 'individual_flexible' && session.individualSessions) {
        const existingSubSession = session.individualSessions.get(candidateId);
        
        if (existingSubSession) {
          if (existingSubSession.status === 'completed') {
            console.log(`❌ [SessionService] Sub-sesión ya completada`);
            throw new Error('Ya has completado tu examen individual en esta sesión');
          }
          if (existingSubSession.status === 'active') {
            if (forceRestart) {
              logger.warn(`🔄 Sub-sesión activa eliminada por reinicio forzado para candidato ${candidateId}`);
              session.individualSessions.delete(candidateId);
              await session.save();
              console.log(`✅ [SessionService] Sub-sesión eliminada por reinicio forzado`);
            } else {
              // NUEVA LÓGICA: No eliminar automáticamente, lanzar error informativo
              console.log(`❌ [SessionService] Sub-sesión activa existente - esto debería haberse manejado con reconexión`);
              logger.error(`❌ Sub-sesión activa existente para candidato ${candidateId} - usar reconexión en su lugar`);
              throw new Error('Ya tienes un examen activo en esta sesión. La reconexión debería haberse usado.');
            }
          }
        } else {
          console.log(`✅ [SessionService] No hay sub-sesiones existentes`);
        }
      }

      console.log(`🔍 [SessionService] Procesando tipo de sesión: ${session.sessionType}`);

      // Solo permitir para sesiones individuales flexibles o iniciar una grupal
      if (session.sessionType === 'individual_flexible') {
        const flexibleConfig: FlexibleSessionConfig = {
          sessionId,
          sessionWindow: {
            start: new Date(), 
            end: new Date(Date.now() + (session.settings.duration || 120) * 60 * 1000)
          },
          examDuration: session.settings.duration || 120,
          lateJoinPolicy: 'remaining',
          maxLateness: 10, // 10 minutos máximo de retraso
          autoSaveInterval: 30 // cada 30 segundos
        };
        
        if (!session.participants.activeCandidates.includes(candidateId)) {
          session.participants.activeCandidates.push(candidateId);
        } else {
          console.log(`ℹ️ [SessionService] CandidateId ya estaba en activeCandidates`);
        }
        
        // Si es la primera vez que se activa la sesión, cambiar estado
        console.log(`🔄 [SessionService] Verificando si cambiar estado de sesión...`);
        if (session.status === 'scheduled') {
          console.log(`🔄 [SessionService] Cambiando estado de scheduled a active...`);
          session.status = 'active';
          session.startedAt = new Date();
        }
        await session.save();

        await this.dualTimingManager.createIndividualSession(candidateId, flexibleConfig);

        (socket as any).candidateId = candidateId;
        
        await this.joinSession(socket, sessionId, 'student');

        
      } else if (session.sessionType === 'group_synchronized') {
        if (session.status === 'active') {
          await this.joinSession(socket, sessionId, 'student');
          logger.info(`👥 Usuario ${socket.userId} se unió a examen grupal ${sessionId}`);
        } else {
          console.log(`❌ [SessionService] Sesión grupal no está activa: ${session.status}`);
          throw new Error('El examen grupal no ha iniciado aún');
        }
      } else {
        console.log(`❌ [SessionService] Tipo de sesión no soportado: ${session.sessionType}`);
        throw new Error(`Tipo de sesión no soportado: ${session.sessionType}`);
      }

      // Publicar evento en Kafka
      console.log(`📡 [SessionService] Publicando evento en Kafka...`);
      await this.kafkaService.publishEvent('session-events', {
        type: 'INDIVIDUAL_EXAM_STARTED',
        sessionId,
        userId: socket.userId, // auth-service user ID para logs
        candidateId: candidateId, // candidate ID para datos
        sessionType: session.sessionType,
        timestamp: new Date()
      });
      console.log(`✅ [SessionService] Evento Kafka publicado`);
      console.log(`🚀 [SessionService] === FIN startIndividualExam EXITOSO ===`);

    } catch (error) {
      console.log(`🚀 [SessionService] === FIN startIndividualExam CON ERROR ===`);
      console.error(`❌ [SessionService] Error starting individual exam:`, error);
      console.error(`❌ [SessionService] Stack trace:`, error instanceof Error ? error.stack : 'No stack');
      logger.error('Error starting individual exam:', error);
      throw error;
    }
  }

  /**
   * Enviar respuesta de una pregunta
   */
  async submitAnswer(socket: AuthenticatedSocket, answerData: any) {
    try {
      const { sessionId, questionId, response, timeSpent } = answerData;

      if (!socket.sessionId || socket.sessionId !== sessionId) {
        throw new Error('No estás conectado a esta sesión');
      }

      const session = await ActiveSessionModel.findBySessionId(sessionId);
      if (!session || !session.isActive()) {
        throw new Error('La sesión no está activa');
      }

      // Verificar que la pregunta pertenece al estudiante
      const candidateQuestions = session.questions.questionsPerCandidate.get(socket.userId);
      if (!candidateQuestions || !candidateQuestions.includes(questionId)) {
        throw new Error('Pregunta no válida para este estudiante');
      }

      // Verificar que no haya respondido ya esta pregunta
      const existingResponse = session.questions.responses.find(
        r => r.candidateId === socket.userId && r.questionId === questionId
      );

      if (existingResponse) {
        throw new Error('Ya has respondido esta pregunta');
      }

      // Crear respuesta
      const sessionResponse: ISessionResponse = {
        questionId,
        candidateId: socket.userId,
        response,
        timeSpent: timeSpent || 0,
        timestamp: new Date()
      };

      // Evaluar respuesta automáticamente si es posible
      try {
        const evaluation = await this.evaluationService.evaluateResponse(questionId, response);
        if (evaluation) {
          sessionResponse.evaluation = {
            ...evaluation,
            evaluatedBy: evaluation.method as 'auto' | 'ai' | 'human',
            evaluatedAt: new Date()
          };
        }
      } catch (evalError) {
        logger.warn('Error evaluating response:', evalError);
        // Continuar sin evaluación automática
      }

      // Agregar respuesta a la sesión
      session.addResponse(sessionResponse);
      await session.save();

      // Actualizar progreso del estudiante
      const participantStatus = session.participants.status.get(socket.userId);
      if (participantStatus) {
        participantStatus.currentQuestionIndex += 1;
        participantStatus.lastActivity = new Date();
        session.participants.status.set(socket.userId, participantStatus);
        await session.save();
      }

      // Notificar a proctors sobre el progreso
      socket.to(sessionId).emit('student-progress-update', {
        studentId: socket.userId,
        questionId,
        answered: true,
        timeSpent,
        progress: this.calculateStudentProgress(session, socket.userId)
      });

      // Responder al estudiante
      socket.emit('answer-submitted', {
        success: true,
        evaluation: sessionResponse.evaluation?.isCorrect,
        feedback: sessionResponse.evaluation?.feedback,
        score: sessionResponse.evaluation?.score
      });

      // Publicar evento en Kafka
      await this.kafkaService.publishEvent('exam-events', {
        type: 'ANSWER_SUBMITTED',
        sessionId,
        candidateId: socket.userId,
        questionId,
        score: sessionResponse.evaluation?.score || 0,
        timestamp: new Date()
      });

      logger.info(`Respuesta enviada: ${socket.userId} -> ${questionId}`);

    } catch (error) {
      logger.error('Error submitting answer:', error);
      throw error;
    }
  }

  /**
   * Obtener siguiente pregunta para el estudiante
   */
  async getNextQuestion(socket: AuthenticatedSocket, sessionId: string) {
    try {
      const session = await ActiveSessionModel.findBySessionId(sessionId);
      if (!session || !session.isActive()) {
        throw new Error('La sesión no está activa');
      }

      const nextQuestion = await this.questionService.getNextQuestionForStudent(
        session,
        socket.userId,
        socket.token
      );

      if (!nextQuestion) {
        // No hay más preguntas, finalizar examen para este estudiante
        await this.finishExamForStudent(socket, sessionId);
        return;
      }

      socket.emit('next-question', {
        question: nextQuestion,
        progress: this.calculateStudentProgress(session, socket.userId),
        timeRemaining: this.calculateTimeRemaining(session)
      });

    } catch (error) {
      logger.error('Error getting next question:', error);
      throw error;
    }
  }

  /**
   * Finalizar examen para un estudiante
   */
  async finishExamForStudent(socket: AuthenticatedSocket, sessionId: string) {
    try {
      const session = await ActiveSessionModel.findBySessionId(sessionId);
      if (!session) {
        throw new Error('Sesión no encontrada');
      }

      // Calcular puntuación final
      const finalResults = await this.calculateFinalResults(session, socket.userId);
      
      // Actualizar estado del estudiante
      const participantStatus = session.participants.status.get(socket.userId);
      if (participantStatus) {
        participantStatus.status = 'completed';
        participantStatus.lastActivity = new Date();
        session.participants.status.set(socket.userId, participantStatus);
      }

      // Actualizar estadísticas de la sesión
      session.updateStats();
      await session.save();

      // Enviar resultados al estudiante
      socket.emit('exam-completed', {
        results: finalResults,
        message: 'Examen completado exitosamente',
        timestamp: new Date()
      });

      // Notificar a proctors
      socket.to(sessionId).emit('student-completed', {
        studentId: socket.userId,
        results: finalResults,
        timestamp: new Date()
      });

      // Publicar evento en Kafka para notificaciones
      await this.kafkaService.publishEvent('notification-events', {
        type: 'EXAM_COMPLETED',
        sessionId,
        candidateId: socket.userId,
        results: finalResults,
        timestamp: new Date()
      });

      // Verificar si todos los estudiantes han terminado
      await this.checkSessionCompletion(session);

      logger.info(`Examen completado para estudiante ${socket.userId} en sesión ${sessionId}`);

    } catch (error) {
      logger.error('Error finishing exam for student:', error);
      throw error;
    }
  }

  /**
   * Habilitar monitoreo para proctors
   */
  async enableMonitoring(socket: AuthenticatedSocket, sessionId: string) {
    try {
      // Verificar que sea un proctor
      if (socket.userRole !== 'proctor' && socket.userRole !== 'admin') {
        throw new Error('No tienes permisos de monitoreo');
      }

      const session = await ActiveSessionModel.findBySessionId(sessionId);
      if (!session) {
        throw new Error('Sesión no encontrada');
      }

      // Verificar que sea proctor de esta sesión
      if (!session.participants.proctors.includes(socket.userId)) {
        throw new Error('No eres proctor de esta sesión');
      }

      await socket.join(`${sessionId}-proctors`);
      
      // Enviar dashboard de monitoreo inicial
      const monitoringData = await this.getMonitoringData(session);
      socket.emit('monitoring-dashboard', monitoringData);

      // Configurar actualizaciones en tiempo real
      this.setupProctorUpdates(socket, sessionId);

      logger.info(`Monitoreo habilitado para proctor ${socket.userId} en sesión ${sessionId}`);

    } catch (error) {
      logger.error('Error enabling monitoring:', error);
      throw error;
    }
  }

  /**
   * Manejar desconexión de usuario
   */
  async handleDisconnection(socket: AuthenticatedSocket) {
    try {
      this.activeConnections.delete(socket.id);

      if (socket.sessionId) {
        const session = await ActiveSessionModel.findBySessionId(socket.sessionId);
        
        if (session) {
          session.removeParticipant(socket.userId);
          await session.save();

          // Notificar a otros participantes en la sala específica
          const roomName = (socket as any).roomName;
          if (roomName) {
            socket.to(roomName).emit('participant-left', {
              userId: socket.userId,
              roomName: roomName,
              timestamp: new Date()
            });
          }
          
          // También notificar a la sala general
          socket.to(`session-${socket.sessionId}`).emit('participant-left', {
            userId: socket.userId,
            roomName: roomName,
            timestamp: new Date()
          });

          // Publicar evento en Kafka
          await this.kafkaService.publishEvent('session-events', {
            type: 'USER_LEFT_SESSION',
            sessionId: socket.sessionId,
            userId: socket.userId,
            timestamp: new Date()
          });
        }
      }

      logger.info(`Usuario ${socket.userId} desconectado`);

    } catch (error) {
      logger.error('Error handling disconnection:', error);
    }
  }

  // MÉTODOS PRIVADOS

  /**
   * Generar nombre de sala basado en tipo de sesión y rol
   */
  private generateRoomName(sessionId: string, sessionType: 'group_synchronized' | 'individual_flexible', role: 'student' | 'proctor', userId?: string): string {
    const baseRoom = `session-${sessionId}`;
    
    if (role === 'proctor') {
      // Los proctors siempre van a la sala principal para monitorear todo
      return `${baseRoom}-proctors`;
    }
    
    if (sessionType === 'group_synchronized') {
      // Sesiones grupales: todos los estudiantes en la misma sala
      return `${baseRoom}-group`;
    } else if (sessionType === 'individual_flexible') {
      // Sesiones individuales: cada estudiante en su propia sala
      return `${baseRoom}-individual-${userId}`;
    }
    
    // Fallback a sala base
    return baseRoom;
  }

  /**
   * Obtener todas las salas asociadas a una sesión
   */
  public getSessionRooms(sessionId: string, sessionType: 'group_synchronized' | 'individual_flexible'): string[] {
    const baseRoom = `session-${sessionId}`;
    const rooms = [`${baseRoom}-proctors`]; // Sala de proctors siempre existe
    
    if (sessionType === 'group_synchronized') {
      rooms.push(`${baseRoom}-group`);
    }
    // Para individual_flexible, las salas se crean dinámicamente por usuario
    
    return rooms;
  }

  /**
   * Obtener información de todas las salas activas de una sesión
   */
  public async getActiveRoomsInfo(sessionId: string): Promise<any> {
    try {
      const session = await ActiveSessionModel.findBySessionId(sessionId);
      if (!session) {
        throw new Error('Sesión no encontrada');
      }

      const roomsInfo = {
        sessionId,
        sessionType: session.sessionType,
        baseRooms: this.getSessionRooms(sessionId, session.sessionType || 'group_synchronized'),
        activeConnections: Array.from(this.activeConnections.values())
          .filter(socket => socket.sessionId === sessionId)
          .map(socket => ({
            userId: socket.userId,
            userRole: socket.userRole,
            roomName: (socket as any).roomName,
            socketId: socket.id
          }))
      };

      return roomsInfo;
    } catch (error) {
      logger.error('Error getting active rooms info:', error);
      throw error;
    }
  }

  /**
   * Broadcast message a una sala específica
   */
  public broadcastToRoom(roomName: string, event: string, data: any): void {
    this.io.to(roomName).emit(event, data);
    logger.info(`📢 Broadcast enviado a sala ${roomName}: evento '${event}'`);
  }

  /**
   * Broadcast message a todas las salas de una sesión
   */
  public broadcastToSessionRooms(sessionId: string, sessionType: 'group_synchronized' | 'individual_flexible', event: string, data: any): void {
    const rooms = this.getSessionRooms(sessionId, sessionType);
    rooms.forEach(room => {
      this.io.to(room).emit(event, data);
    });
    
    // También enviar a la sala general
    this.io.to(`session-${sessionId}`).emit(event, data);
    
    logger.info(`📢 Broadcast enviado a todas las salas de sesión ${sessionId}: evento '${event}'`);
  }

  /**
   * Unir usuario a la sala apropiada según tipo de sesión
   */
  private async joinAppropriateRoom(
    socket: AuthenticatedSocket, 
    sessionId: string, 
    sessionType: 'group_synchronized' | 'individual_flexible', 
    role: 'student' | 'proctor'
  ): Promise<string> {
    const roomName = `exam-${sessionId}-${socket.candidateId}`;
    await socket.join(roomName);
    
    // También unir a la sala general de la sesión para eventos globales
    await socket.join(`session-${sessionId}`);
    
    logger.info(`🏠 Usuario ${socket.userId} se unió a sala: ${roomName} (tipo: ${sessionType}, rol: ${role})`);
    
    return roomName;
  }

  private validateSessionAccess(session: IActiveSession, userId: string, role: 'student' | 'proctor', candidateId?: string) {
    if (role === 'student') {
      // Para sesiones individuales flexibles, usar candidateId si está disponible
      const idToCheck = candidateId || userId;
      
      if (session.sessionType === 'individual_flexible') {
        // Permitir si está en activeCandidates O si la sesión permite registro abierto
        const isInActiveCandidates = session.participants.activeCandidates.includes(idToCheck);
        const allowsOpenRegistration = session.settings.allowOpenRegistration !== false;
        
        if (!isInActiveCandidates && !allowsOpenRegistration) {
          // Solo verificar registeredCandidates si no permite registro abierto
          if (!session.participants.registeredCandidates.includes(idToCheck)) {
            throw new Error('No estás autorizado para esta sesión individual');
          }
        }
      } else {
        // Para sesiones grupales, verificar registro previo
        if (!session.participants.registeredCandidates.includes(idToCheck)) {
          throw new Error('No estás registrado en esta sesión');
        }
      }
    } else if (role === 'proctor') {
      if (!session.participants.proctors.includes(userId)) {
        throw new Error('No eres proctor de esta sesión');
      }
    }
  }

  private async sendStudentInitialState(socket: AuthenticatedSocket, session: IActiveSession) {
    // Generar preguntas para el estudiante si no existen
    if (!session.questions.questionsPerCandidate.has(socket.userId)) {
      const questions = await this.questionService.generateQuestionsForStudent(
        session.examId,
        socket.userId,
        session.settings,
        socket.token
      );
      // Almacenar las preguntas estructuradas por secciones con IDs planos para compatibilidad
      const allQuestionIds = questions.flatMap(section => section.questions.map(q => q._id));
      session.questions.questionsPerCandidate.set(socket.userId, allQuestionIds);
      
      // También almacenar la estructura completa por secciones para el frontend
      if (!session.questions.sectionedQuestionsPerCandidate) {
        session.questions.sectionedQuestionsPerCandidate = new Map();
      }
      session.questions.sectionedQuestionsPerCandidate.set(socket.userId, questions);
      await session.save();
    }

    // Obtener primera pregunta
    const firstQuestion = await this.questionService.getNextQuestionForStudent(
      session,
      socket.userId,
      socket.token
    );

    const roomName = (socket as any).roomName || `session-${session.sessionId}`;
    
    // Obtener preguntas estructuradas por secciones
    const sectionedQuestions = session.questions.sectionedQuestionsPerCandidate?.get(socket.userId);
    
    socket.emit('session-started', {
      session: {
        name: session.sessionName,
        examName: session.examName,
        duration: session.settings.duration,
        instructions: session.settings.instructions,
        totalQuestions: session.questions.questionsPerCandidate.get(socket.userId)?.length || 0,
        sessionType: session.sessionType,
        roomName: roomName
      },
      firstQuestion,
      sections: sectionedQuestions || [], // Preguntas estructuradas por secciones
      timeRemaining: this.calculateTimeRemaining(session),
      progress: this.calculateStudentProgress(session, socket.userId)
    });
  }

  private async sendProctorDashboard(socket: AuthenticatedSocket, session: IActiveSession) {
    const dashboardData = await this.getMonitoringData(session);
    socket.emit('proctor-dashboard', dashboardData);
  }

  private async getMonitoringData(session: IActiveSession) {
    const participants = Array.from(session.participants.status.entries()).map(([userId, status]) => ({
      userId,
      status: status.status,
      progress: this.calculateStudentProgress(session, userId),
      timeSpent: status.timeSpent,
      lastActivity: status.lastActivity,
      currentQuestion: status.currentQuestionIndex
    }));

    return {
      session: {
        id: session.sessionId,
        name: session.sessionName,
        examName: session.examName,
        status: session.status,
        startedAt: session.startedAt,
        timeRemaining: this.calculateTimeRemaining(session)
      },
      participants,
      stats: session.stats,
      totalResponses: session.questions.responses.length
    };
  }

  private calculateStudentProgress(session: IActiveSession, userId: string): number {
    const participantStatus = session.participants.status.get(userId);
    const totalQuestions = session.questions.questionsPerCandidate.get(userId)?.length || 0;
    
    if (!participantStatus || totalQuestions === 0) return 0;
    
    return (participantStatus.answeredQuestions.length / totalQuestions) * 100;
  }

  private calculateTimeRemaining(session: IActiveSession): number {
    if (!session.startedAt || session.status !== 'active') {
      return session.settings.duration * 60; // Convertir minutos a segundos
    }

    const elapsed = (Date.now() - session.startedAt.getTime()) / 1000;
    const total = session.settings.duration * 60;
    return Math.max(0, total - elapsed);
  }

  private async calculateFinalResults(session: IActiveSession, userId: string) {
    const userResponses = session.questions.responses.filter(r => r.candidateId === userId);
    const totalQuestions = session.questions.questionsPerCandidate.get(userId)?.length || 0;
    
    let totalScore = 0;
    let maxPossibleScore = 0;
    const competencyScores: Record<string, { score: number; maxScore: number; count: number }> = {};

    for (const response of userResponses) {
      if (response.evaluation) {
        totalScore += response.evaluation.score;
        maxPossibleScore += response.evaluation.maxScore;

        // Obtener competencia de la pregunta
        const question = await this.questionService.getQuestionById(response.questionId);
        if (question) {
          const competency = question.competency;
          if (!competencyScores[competency]) {
            competencyScores[competency] = { score: 0, maxScore: 0, count: 0 };
          }
          competencyScores[competency].score += response.evaluation.score;
          competencyScores[competency].maxScore += response.evaluation.maxScore;
          competencyScores[competency].count += 1;
        }
      }
    }

    const percentage = maxPossibleScore > 0 ? (totalScore / maxPossibleScore) * 100 : 0;
    
    return {
      userId,
      sessionId: session.sessionId,
      totalScore,
      maxPossibleScore,
      percentage: Math.round(percentage * 100) / 100,
      competencyScores,
      answeredQuestions: userResponses.length,
      totalQuestions,
      isPassed: percentage >= 70, // Criterio configurable
      completedAt: new Date()
    };
  }

  private setupSessionAutoEnd(session: IActiveSession) {
    if (!session.settings.autoEnd || this.sessionTimers.has(session.sessionId)) {
      return;
    }

    const timeRemaining = this.calculateTimeRemaining(session);
    
    if (timeRemaining > 0) {
      const timer = setTimeout(async () => {
        await this.endSession(session.sessionId);
      }, timeRemaining * 1000);

      this.sessionTimers.set(session.sessionId, timer);
    }
  }

  private async endSession(sessionId: string) {
    try {
      const session = await ActiveSessionModel.findBySessionId(sessionId);
      if (!session || session.status !== 'active') return;

      session.status = 'completed';
      session.endedAt = new Date();
      await session.save();

      // Notificar a todos los participantes
      this.io.to(sessionId).emit('session-ended', {
        sessionId,
        message: 'La sesión ha finalizado',
        timestamp: new Date()
      });

      // Limpiar timer
      const timer = this.sessionTimers.get(sessionId);
      if (timer) {
        clearTimeout(timer);
        this.sessionTimers.delete(sessionId);
      }

      // Publicar evento en Kafka
      await this.kafkaService.publishEvent('session-events', {
        type: 'SESSION_ENDED',
        sessionId,
        timestamp: new Date()
      });

      logger.info(`Sesión ${sessionId} finalizada automáticamente`);

    } catch (error) {
      logger.error('Error ending session:', error);
    }
  }

  private async checkSessionCompletion(session: IActiveSession) {
    const allCompleted = Array.from(session.participants.status.values())
      .filter(status => session.participants.registeredCandidates.includes(status as any))
      .every(status => status.status === 'completed');

    if (allCompleted && session.status === 'active') {
      await this.endSession(session.sessionId);
    }
  }

  private setupProctorUpdates(socket: AuthenticatedSocket, sessionId: string) {
    // Configurar actualizaciones periódicas para proctors
    const interval = setInterval(async () => {
      try {
        const session = await ActiveSessionModel.findBySessionId(sessionId);
        if (!session || session.status !== 'active') {
          clearInterval(interval);
          return;
        }

        const monitoringData = await this.getMonitoringData(session);
        socket.emit('monitoring-update', monitoringData);
      } catch (error) {
        logger.error('Error in proctor update:', error);
        clearInterval(interval);
      }
    }, 10000); // Actualizar cada 10 segundos

    // Limpiar interval cuando el socket se desconecte
    socket.on('disconnect', () => {
      clearInterval(interval);
    });
  }

  private setupPeriodicTasks() {
    // Limpiar sesiones inactivas cada hora
    setInterval(async () => {
      try {
        const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 horas
        await ActiveSessionModel.deleteMany({
          status: { $in: ['completed', 'cancelled'] },
          updatedAt: { $lt: cutoffTime }
        });
        
        logger.info('Sesiones antiguas limpiadas');
      } catch (error) {
        logger.error('Error cleaning old sessions:', error);
      }
    }, 60 * 60 * 1000); // Cada hora

    // Actualizar heartbeat cada 30 segundos
    setInterval(async () => {
      try {
        await ActiveSessionModel.updateMany(
          { status: 'active' },
          { 'technical.lastHeartbeat': new Date() }
        );
      } catch (error) {
        logger.error('Error updating heartbeat:', error);
      }
    }, 30 * 1000); // Cada 30 segundos
  }
}
