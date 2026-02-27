import axios from 'axios';
import { Types } from 'mongoose';
import { Attempt } from '../models/attempt.model';
import { ISession, Session } from '../models/session.model';
import { User } from '../models/user.model';
import { env } from '../config/env';
import { CONSTANTS } from '../utils/constants';
import { logger } from '../utils/logger';
import { KafkaService } from './kafka.service';
import { SessionSchedulerService } from './session-scheduler.service';
export class SessionService {
  private kafkaService: KafkaService;
  private sessionSchedulerService: SessionSchedulerService;

  constructor() {
    this.kafkaService = new KafkaService();
    this.sessionSchedulerService = new SessionSchedulerService();
    
    // Inyectar la referencia de SessionService en SessionSchedulerService
    // para romper la dependencia circular
    this.sessionSchedulerService.setSessionService(this);
  }

  async create(sessionData: Partial<ISession>): Promise<ISession> {
    try {

      const crafterUser = await User.findOne({
        authServiceUserId: sessionData.createdBy
      });
      let crafterSetteable = null;
      if (crafterUser) {
        crafterSetteable = crafterUser._id;
      }else{
        crafterSetteable = sessionData.createdBy;
      }
      const session = new Session({
        ...sessionData,
        createdBy: crafterSetteable
      });
      await session.save();

      await this.kafkaService.publishEvent('session.created', {
        sessionId: session._id,
        examId: session.examId,
        sessionName: session.sessionName,
        startDate: session.scheduling.startDate,
        createdBy: crafterSetteable
      });
       if (session.scheduling?.startDate && session.scheduling?.endDate) {
        try {
          // Pasar los datos originales del frontend, no los de MongoDB
          await this.sessionSchedulerService.scheduleSessionEvents(
            (session._id as Types.ObjectId).toString(),
            sessionData.scheduling,
            sessionData?.settings || {},
            sessionData.sessionType || 'group_synchronized',
            sessionData?.timing || {}
          );

          logger.info(`Eventos programados para sesión: ${session._id}`);
        } catch (schedulingError) {
          logger.error(`Error programando eventos para sesión ${session._id}:`, schedulingError);
        }
      }
      // if(sessionData?.settings?.autoStart) {
      //   logger.info(`Session created and auto-started: ${session?._id}`);
      //   const redisClient = getRedisClient();
      //   await redisClient.set(`session:${session?._id}:status`, 'in_progress');
      // }
      return session;
    } catch (error) {
      logger.error('Error creating session:', error);
      throw error;
    }
  }
  
  // Métodos para múltiples candidatos
  async addMultipleCandidates(sessionId: string, candidateIds: string[]): Promise<ISession | null> {
    try {
      const session = await Session.findById(sessionId);
      if (!session) throw new Error('Session not found');

      // Filtrar candidatos que ya están registrados
      const newCandidates = candidateIds.filter(
        candidateId => !session.participants.registeredCandidates.includes(candidateId as any)
      );

      if (newCandidates.length === 0) {
        throw new Error('All candidates are already registered');
      }

      if (session.participants.registeredCandidates.length + newCandidates.length > session.participants.maxCandidates) {
        throw new Error(`Cannot add ${newCandidates.length} candidates. Max capacity: ${session.participants.maxCandidates}`);
      }

      const updatedSession = await Session.findByIdAndUpdate(
        sessionId,
        {
          $push: { 'participants.registeredCandidates': { $each: newCandidates } },
          $inc: { 'stats.totalRegistered': newCandidates.length }
        },
        { new: true }
      );

      await this.kafkaService.publishEvent('session.candidates.added', {
        sessionId,
        sessionName: session.sessionName,
        candidateIds: newCandidates,
        count: newCandidates.length,
        createdBy: session.createdBy?.toString()
      });

      return updatedSession;
    } catch (error) {
      logger.error(`Error adding multiple candidates to session ${sessionId}:`, error);
      throw error;
    }
  }

  async removeMultipleCandidates(sessionId: string, candidateIds: string[]): Promise<ISession | null> {
    try {
      const updatedSession = await Session.findByIdAndUpdate(
        sessionId,
        {
          $pull: { 'participants.registeredCandidates': { $in: candidateIds } },
          $inc: { 'stats.totalRegistered': -candidateIds.length }
        },
        { new: true }
      );

      await this.kafkaService.publishEvent('session.candidates.removed', {
        sessionId,
        candidateIds,
        count: candidateIds.length
      });

      return updatedSession;
    } catch (error) {
      logger.error(`Error removing multiple candidates from session ${sessionId}:`, error);
      throw error;
    }
  }

  // Métodos para proctors
  async removeProctor(sessionId: string, proctorId: string): Promise<ISession | null> {
    try {
      const updatedSession = await Session.findByIdAndUpdate(
        sessionId,
        { $pull: { 'participants.proctors': proctorId } },
        { new: true }
      );

      await this.kafkaService.publishEvent('session.proctor.removed', {
        sessionId,
        proctorId
      });

      return updatedSession;
    } catch (error) {
      logger.error(`Error removing proctor from session ${sessionId}:`, error);
      throw error;
    }
  }

  async addMultipleProctors(sessionId: string, proctorIds: string[]): Promise<ISession | null> {
    try {
      const session = await Session.findById(sessionId);
      if (!session) throw new Error('Session not found');

      // Filtrar proctors que ya están asignados
      const newProctors = proctorIds.filter(
        proctorId => !session.participants.proctors.includes(proctorId as any)
      );

      if (newProctors.length === 0) {
        throw new Error('All proctors are already assigned');
      }

      const updatedSession = await Session.findByIdAndUpdate(
        sessionId,
        { $push: { 'participants.proctors': { $each: newProctors } } },
        { new: true }
      );

      await this.kafkaService.publishEvent('session.proctors.added', {
        sessionId,
        proctorIds: newProctors,
        count: newProctors.length
      });

      return updatedSession;
    } catch (error) {
      logger.error(`Error adding multiple proctors to session ${sessionId}:`, error);
      throw error;
    }
  }

  async removeMultipleProctors(sessionId: string, proctorIds: string[]): Promise<ISession | null> {
    try {
      const updatedSession = await Session.findByIdAndUpdate(
        sessionId,
        { $pull: { 'participants.proctors': { $in: proctorIds } } },
        { new: true }
      );

      await this.kafkaService.publishEvent('session.proctors.removed', {
        sessionId,
        proctorIds,
        count: proctorIds.length
      });

      return updatedSession;
    } catch (error) {
      logger.error(`Error removing multiple proctors from session ${sessionId}:`, error);
      throw error;
    }
  }

  async findById(id: string): Promise<ISession | null> {
    try {
      const session = await Session.findById(id)
        .populate('examId')
        .populate({ path: 'participants.proctors', select: 'firstName lastName email', model: User })
        .populate({ path: 'createdBy', select: 'firstName lastName email', model: User })

      if (!session) {
        return null;
      }

      // Obtener información de candidatos desde user-management-service
      if (session.participants.registeredCandidates.length > 0) {
        try {
          const { UserManagementIntegration } = await import('../integrations/user-management.integration');
          const userMgmt = new UserManagementIntegration();

          // Obtener datos de candidatos por lotes
          const candidateIds = session.participants.registeredCandidates.map(id => id.toString());
          const candidatesData = await userMgmt.getCandidatesByIds(candidateIds);

          // Agregar los datos de candidatos al resultado
          (session as any).candidatesData = candidatesData;
        } catch (error) {
          logger.warn('Error fetching candidates data:', error);
          (session as any).candidatesData = [];
        }
      }

      return session;
    } catch (error) {
      logger.error(`Error finding session ${id}:`, error);
      throw error;
    }
  }


  async findAll(filters: any = {}, page = 1, limit = 10, sortOptions: { sortBy?: string; sortOrder?: 'asc' | 'desc' } = {}) {
    try {
      const skip = (page - 1) * limit;

      const query: any = {};
      if (filters.status) query.status = filters.status;
      if (filters.examId) query.examId = new Types.ObjectId(filters.examId);
      if (filters.startDate) {
        query['scheduling.startDate'] = { $gte: new Date(filters.startDate) };
      }
      if (filters.endDate) {
        query['scheduling.endDate'] = { $lte: new Date(filters.endDate) };
      }
      if (filters.q) {
        query.sessionName = { $regex: filters.q, $options: 'i' };
      }
      if (filters.createdBy) {
        const creatorUser = await User.findOne({ authServiceUserId: filters.createdBy });
        query.createdBy = creatorUser ? creatorUser._id : filters.createdBy;
      }

      // Configurar ordenamiento
      const { sortBy = 'scheduling.startDate', sortOrder = 'desc' } = sortOptions;
      const sortDirection = sortOrder === 'asc' ? 1 : -1;
      
      // Mapear campos de ordenamiento seguros
      const sortFieldMap: { [key: string]: string } = {
        'startDate': 'scheduling.startDate',
        'endDate': 'scheduling.endDate',
        'sessionName': 'sessionName',
        'status': 'status',
        'createdAt': 'createdAt',
        'candidatesCount': 'candidatesCount'
      };
      
      const sortField = sortFieldMap[sortBy] || 'scheduling.startDate';
      const sortObject: { [key: string]: number } = { [sortField]: sortDirection };

      const pipeline: any[] = [
        { $match: query },

        // Lookup para exam
        {
          $lookup: {
            from: 'exams',
            localField: 'examId',
            foreignField: '_id',
            as: 'exam'
          }
        },
        {
          $unwind: {
            path: '$exam',
            preserveNullAndEmptyArrays: true
          }
        },

        // Lookup para createdBy
        {
          $lookup: {
            from: 'users',
            localField: 'createdBy',
            foreignField: '_id',
            as: 'createdByUser'
          }
        },
        {
          $unwind: {
            path: '$createdByUser',
            preserveNullAndEmptyArrays: true
          }
        },

        // Mapear createdBy correctamente
        {
          $addFields: {
            createdBy: {
              $cond: {
                if: '$createdByUser',
                then: {
                  _id: '$createdByUser._id',
                  firstName: '$createdByUser.firstName',
                  lastName: '$createdByUser.lastName'
                },
                else: null
              }
            },
            // Agregar conteo de candidatos registrados
            candidatesCount: { $size: { $ifNull: ['$participants.registeredCandidates', []] } }
          }
        },

        // Limpiar campos temporales
        {
          $project: {
            createdByUser: 0
          }
        },

        // Aplicar ordenamiento
        { $sort: sortObject }
      ];

      const [sessions, total] = await Promise.all([
        Session.aggregate(pipeline)
          .skip(skip)
          .limit(limit),
        Session.countDocuments(query)
      ]);

      // Nota: Los candidatos se pueden obtener por separado si es necesario
      // usando el UserManagementIntegration cuando se necesite el detalle completo

      return {
        sessions,
        total,
        page,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      logger.error('Error finding sessions:', error);
      throw error;
    }
  }

  async update(id: string, updateData: Partial<ISession>): Promise<ISession | null> {
    try {
      const session = await Session.findByIdAndUpdate(
        id,
        { $set: updateData },
        { new: true, runValidators: true }
      );

      if (session) {
        await this.kafkaService.publishEvent('session.updated', {
          sessionId: session._id,
          changes: Object.keys(updateData)
        });
      }

      return session;
    } catch (error) {
      logger.error(`Error updating session ${id}:`, error);
      throw error;
    }
  }

  async addCandidate(sessionId: string, candidateId: string): Promise<ISession | null> {
    try {
      const session = await Session.findById(sessionId);
      if (!session) throw new Error('Session not found');

      if (session.participants.registeredCandidates.includes(candidateId as any)) {
        throw new Error('Candidate already registered');
      }

      if (session.participants.registeredCandidates.length >= session.participants.maxCandidates) {
        throw new Error('Session is full');
      }

      const updatedSession = await Session.findByIdAndUpdate(
        sessionId,
        {
          $push: { 'participants.registeredCandidates': candidateId },
          $inc: { 'stats.totalRegistered': 1 }
        },
        { new: true }
      );

      await this.kafkaService.publishEvent('session.candidate.added', {
        sessionId,
        candidateId
      });

      return updatedSession;
    } catch (error) {
      logger.error(`Error adding candidate to session ${sessionId}:`, error);
      throw error;
    }
  }

  async removeCandidate(sessionId: string, candidateId: string): Promise<ISession | null> {
    try {
      const updatedSession = await Session.findByIdAndUpdate(
        sessionId,
        {
          $pull: { 'participants.registeredCandidates': candidateId },
          $inc: { 'stats.totalRegistered': -1 }
        },
        { new: true }
      );

      await this.kafkaService.publishEvent('session.candidate.removed', {
        sessionId,
        candidateId
      });

      return updatedSession;
    } catch (error) {
      logger.error(`Error removing candidate from session ${sessionId}:`, error);
      throw error;
    }
  }

  async addProctor(sessionId: string, proctorId: string): Promise<ISession | null> {
    try {
      const session = await Session.findById(sessionId);
      if (!session) throw new Error('Session not found');

      if (session.participants.proctors.includes(proctorId as any)) {
        throw new Error('Proctor already assigned');
      }

      const updatedSession = await Session.findByIdAndUpdate(
        sessionId,
        { $push: { 'participants.proctors': proctorId } },
        { new: true }
      );

      await this.kafkaService.publishEvent('session.proctor.added', {
        sessionId,
        proctorId
      });

      return updatedSession;
    } catch (error) {
      logger.error(`Error adding proctor to session ${sessionId}:`, error);
      throw error;
    }
  }

  async startSession(sessionId: string): Promise<ISession | null> {
    try {
      const session = await Session.findByIdAndUpdate(
        sessionId,
        { status: CONSTANTS.SESSION_STATUS.IN_PROGRESS },
        { new: true }
      );

      if (session) {
        await this.kafkaService.publishEvent('session.started', {
          sessionId: session._id,
          examId: session.examId,
          sessionName: session.sessionName,
          status: CONSTANTS.SESSION_STATUS.IN_PROGRESS,
          enrolledCandidateIds: session.participants.registeredCandidates.map(String),
          createdBy: session.createdBy?.toString()
        });
      }

      return session;
    } catch (error) {
      logger.error(`Error starting session ${sessionId}:`, error);
      throw error;
    }
  }

  async endSession(sessionId: string): Promise<ISession | null> {
    try {
      const session = await Session.findByIdAndUpdate(
        sessionId,
        { status: CONSTANTS.SESSION_STATUS.COMPLETED },
        { new: true }
      );

      if (session) {
        await this.kafkaService.publishEvent('session.ended', {
          sessionId: session._id,
          examId: session.examId,
          sessionName: session.sessionName,
          status: CONSTANTS.SESSION_STATUS.COMPLETED,
          enrolledCandidateIds: session.participants.registeredCandidates.map(String),
          createdBy: session.createdBy?.toString()
        });

        // Mark all in-progress attempts for this session as completed and trigger grading
        // This ensures results are saved even if the student's frontend doesn't respond
        const activeAttempts = await Attempt.find({
          sessionId: new Types.ObjectId(sessionId),
          status: 'in_progress'
        });

        for (const attempt of activeAttempts) {
          attempt.status = 'completed';
          attempt.finishedAt = new Date();
          await attempt.save();

          // Fire-and-forget grading — same pattern as examTaking.service.ts finishExam
          axios.post(`${env.GRADING_SERVICE_URL}/api/v1/grading/exam`, {
            attemptId: String(attempt._id)
          }, { timeout: 120000 })
            .then(() => logger.info(`✅ [endSession] Grading triggered for attempt ${attempt._id}`))
            .catch((err: any) => logger.error(`❌ [endSession] Grading failed for attempt ${attempt._id}:`, err.message));
        }

        if (activeAttempts.length > 0) {
          logger.info(`[endSession] Closed and queued grading for ${activeAttempts.length} active attempt(s) in session ${sessionId}`);
        }
      }

      return session;
    } catch (error) {
      logger.error(`Error ending session ${sessionId}:`, error);
      throw error;
    }
  }

  async cancelSession(sessionId: string): Promise<ISession | null> {
    try {
      // Cancelar programación automática
      await this.sessionSchedulerService.cancelScheduledSession(sessionId);

      // Tu lógica existente
      const session = await Session.findByIdAndUpdate(
        sessionId,
        { status: CONSTANTS.SESSION_STATUS.CANCELLED },
        { new: true }
      );

      if (session) {
        await this.kafkaService.publishEvent('session.cancelled', {
          sessionId: session._id,
          examId: session.examId,
          sessionName: session.sessionName,
          status: CONSTANTS.SESSION_STATUS.CANCELLED,
          enrolledCandidateIds: session.participants.registeredCandidates.map(String),
          createdBy: session.createdBy?.toString()
        });
      }

      return session;
    } catch (error) {
      logger.error(`Error cancelling session ${sessionId}:`, error);
      throw error;
    }
  }
  async getSchedulingInfo(sessionId: string) {
    try {
      const jobs = await this.sessionSchedulerService.getScheduledJobs(sessionId);
      return {
        startJob: jobs.start ? {
          id: jobs.start.id,
          delay: jobs.start.opts.delay,
          processedOn: jobs.start.processedOn,
          finishedOn: jobs.start.finishedOn,
          failedReason: jobs.start.failedReason
        } : null,
        endJob: jobs.end ? {
          id: jobs.end.id,
          delay: jobs.end.opts.delay,
          processedOn: jobs.end.processedOn,
          finishedOn: jobs.end.finishedOn,
          failedReason: jobs.end.failedReason
        } : null
      };
    } catch (error) {
      logger.error(`Error getting scheduling info for session ${sessionId}:`, error);
      throw error;
    }
  }
  
  async findSessionsByCandidate(filters: any) {
    try {
      const { candidateId, status, page = 1, limit = 10, justLast = false, includePast = false } = filters;
      const skip = (page - 1) * limit;
      const authUserId = candidateId;
      
      const candidateIdSearched = await User.aggregate([
        {
          $match: { authServiceUserId: authUserId }
        },
        {
          $lookup: {
            from: 'candidates',
            localField: '_id',
            foreignField: 'userId',
            as: 'candidate'
          }
        }
      ]); 
      

      if (!candidateIdSearched || candidateIdSearched.length === 0) throw new Error('User not found');
      let candidate = candidateIdSearched[0]?.candidate?.[0];
      if(!candidate) throw new Error('Candidate not found');
      
      const query: any = {
        'participants.registeredCandidates': candidate._id
      };

      // Solo aplicar filtro de fecha si includePast es false
      if (!includePast) {
        const currentDate = new Date();
        query.$or = [
          // Sesiones que aún no han empezado (futuras)
          { 'scheduling.startDate': { $gt: currentDate } },
          // Sesiones que están actualmente en progreso
          { 
            $and: [
              { 'scheduling.startDate': { $lte: currentDate } },
              { 'scheduling.endDate': { $gte: currentDate } }
            ]
          }
        ];
      }

      // Puede venir un string con varios estados separados por coma: "scheduled,in_progress"
      if (status) {
        let statuses: string[] = [];
        
        if (Array.isArray(status)) {
          statuses = status;
        } else if (typeof status === 'string') {
          statuses = status.split(',').map(s => s.trim()).filter(Boolean);
        }

        if (statuses.length === 1) {
          query.status = statuses[0];
        } else if (statuses.length > 1) {
          query.status = { $in: statuses };
        }
      }

      const pipeline: any[] = [
        { $match: query },
        { $sort: { 'scheduling.startDate': 1 } },

        // Lookup para exam
        {
          $lookup: {
            from: 'exams',
            localField: 'examId',
            foreignField: '_id',
            as: 'exam'
          }
        },
        {
          $unwind: {
            path: '$exam',
            preserveNullAndEmptyArrays: true
          }
        },

        // Lookup para createdBy
        {
          $lookup: {
            from: 'users',
            localField: 'createdBy',
            foreignField: '_id',
            as: 'createdByUser'
          }
        },
        {
          $unwind: {
            path: '$createdByUser',
            preserveNullAndEmptyArrays: true
          }
        },

        // Mapear createdBy correctamente
        {
          $addFields: {
            createdBy: {
              $cond: {
                if: '$createdByUser',
                then: {
                  _id: '$createdByUser._id',
                  firstName: '$createdByUser.firstName',
                  lastName: '$createdByUser.lastName',
                  role: '$createdByUser.role',
                  email: '$createdByUser.email',
                  teacherData: '$createdByUser.teacherData',

                },
                else: null
              }
            },
            // Agregar conteo de candidatos registrados
            candidatesCount: { $size: { $ifNull: ['$participants.registeredCandidates', []] } }
          }
        },

        // Limpiar campos temporales
        {
          $project: {
            createdByUser: 0
          }
        },

        // Lookup: attempt del candidato en esta sesión
        {
          $lookup: {
            from: 'attempts',
            let: { sessionId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$sessionId', '$$sessionId'] },
                      { $eq: ['$candidateId', candidate._id] }
                    ]
                  }
                }
              },
              { $sort: { createdAt: -1 } },
              { $limit: 1 }
            ],
            as: 'myAttempt'
          }
        },

        // Exponer el estado del attempt del candidato y excluir sesiones ya completadas
        {
          $addFields: {
            myAttemptStatus: {
              $cond: {
                if: { $gt: [{ $size: '$myAttempt' }, 0] },
                then: { $arrayElemAt: ['$myAttempt.status', 0] },
                else: null
              }
            }
          }
        },
        { $project: { myAttempt: 0 } },

        // Excluir sesiones donde el candidato ya finalizó su examen
        {
          $match: {
            myAttemptStatus: { $ne: 'completed' }
          }
        }
      ];
      // Si justLast es true, solo queremos 1 sesión (la más próxima)
      if (justLast) {
        const sessions = await Session.aggregate([
          ...pipeline,
          { $limit: 1 }
        ]);
        
        return {
          sessions,
          total: sessions.length,
          page: 1,
          totalPages: 1
        };
      }

      // Si justLast es false, aplicamos paginación normal
      const [sessions, totalResult] = await Promise.all([
        Session.aggregate(pipeline)
          .skip(skip)
          .limit(limit),
        Session.aggregate([
          { $match: query },
          { $count: "total" }
        ])
      ]);

      const total = totalResult[0]?.total || 0;

      // const prevSearch = await Session.aggregate([
      //   {
      //     $match: { _id: sessions[0]._id }
      //   }
      // ]);

      // let userCrafter = null;
      // if(prevSearch.length){
      //   const createdBySearched = await User.aggregate([
      //     {
      //       $match: { authServiceUserId: prevSearch[0].createdBy }
      //     },
      //     {
      //       $lookup:{
      //         from: 'users',
      //         localField: 'createdBy',
      //         foreignField: '_id',
      //         as: 'createdBy'
      //       }
      //     }
      //   ]);
      //   console.log(createdBySearched[0],'<-- createdBySearched')
      //   //Lo que tendria que hacer ahora es buscar cada creador y setearlo a cada sesion pero nose si hacerlo aqui o
      //   // Esto afectaria el rendimiento?
      // }
      
      return {
        sessions,
        total,
        page,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      logger.error('Error finding sessions by candidate:', error);
      throw error;
    }
  }

  async getSessionQuestions(sessionId: string, candidateId: string) {
    try {
      logger.info(`Getting questions for session ${sessionId}, candidate ${candidateId}`);

      // Buscar la sesión
      const session = await Session.findById(sessionId).exec();
      if (!session) {
        throw new Error('Sesión no encontrada');
      }

      // Verificar que el candidato esté en la sesión
      const candidateObjectId = new Types.ObjectId(candidateId);
      if (!session.participants.registeredCandidates.some((c: Types.ObjectId) => c.equals(candidateObjectId))) {
        throw new Error('El candidato no está registrado en esta sesión');
      }

      // Verificar que la sesión esté activa o completada (para permitir revisión)
      if (!['active', 'completed'].includes(session.status)) {
        throw new Error('La sesión no está disponible para obtener preguntas');
      }

      // Obtener las preguntas del examen
      const { Exam } = await import('../models/exam.model');
      const exam = await Exam.findById(session.examId).populate('questionPool').exec();
      
      if (!exam) {
        throw new Error('Examen no encontrado');
      }

      if (!exam.questionPool || exam.questionPool.length === 0) {
        throw new Error('El examen no tiene preguntas asignadas');
      }

      // Aplicar randomización si está habilitada en la configuración del examen
            let questions = exam.questionPool.filter((q): q is Types.ObjectId => q != null);
            
            if (exam.configuration.randomizeQuestions) {
              // Randomizar el orden de las preguntas usando Fisher-Yates shuffle
              for (let i = questions.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                const temp = questions[i]!;
                questions[i] = questions[j]!;
                questions[j] = temp;
              }
            }

      // Organizar preguntas por secciones si el examen tiene estructura
      if (exam.structure && exam.structure.sections) {
        const sectionsData = exam.structure.sections.map(section => ({
          id: section.competency,
          section: section.name,
          competency: section.competency,
          duration: section.duration,
          questionCount: section.questionCount,
          weight: section.weight,
          questions: questions
            .filter((q: any) => q.competency === section.competency)
            .slice(0, section.questionCount)
        }));

        return sectionsData;
      }

      // Si no hay estructura definida, retornar como una sola sección
      return [{
        id: 'general',
        section: 'General',
        competency: 'general',
        duration: exam.structure?.totalDuration || 120,
        questionCount: questions.length,
        weight: 100,
        questions
      }];
    } catch (error) {
      logger.error('Error getting session questions:', error);
      throw error;
    }
  }

  async regradeSession(sessionId: string): Promise<{ total: number; queued: number; errors: string[] }> {
    try {
      const attempts = await Attempt.find({
        sessionId: new Types.ObjectId(sessionId),
        status: 'completed'
      }).lean();

      if (attempts.length === 0) {
        return { total: 0, queued: 0, errors: [] };
      }

      const errors: string[] = [];
      let queued = 0;

      for (const attempt of attempts) {
        try {
          await axios.post(`${env.GRADING_SERVICE_URL}/api/v1/grading/regrade-attempt`, {
            attemptId: String(attempt._id)
          }, { timeout: 120000 });
          queued++;
          logger.info(`✅ [regradeSession] Regrade triggered for attempt ${attempt._id}`);
        } catch (err: any) {
          const msg = `Attempt ${attempt._id}: ${err.message}`;
          errors.push(msg);
          logger.error(`❌ [regradeSession] Regrade failed for attempt ${attempt._id}:`, err.message);
        }
      }

      return { total: attempts.length, queued, errors };
    } catch (error) {
      logger.error(`Error regrading session ${sessionId}:`, error);
      throw error;
    }
  }

  async getSessionProgress(sessionId: string) {
    try {
      const { Candidate } = await import('../models/candidate.model');
      const { Response: ResponseModel } = await import('../models/response.model');

      const session = await Session.findById(sessionId).lean();
      if (!session) throw new Error('Sesión no encontrada');

      const enrolledIds: Types.ObjectId[] = session.participants.registeredCandidates as Types.ObjectId[];

      // Get all attempts for this session
      const attempts = await Attempt.find({ sessionId: new Types.ObjectId(sessionId) }).lean();

      // Count answers and last activity per candidate
      const responseSummary = await ResponseModel.aggregate([
        { $match: { sessionId: new Types.ObjectId(sessionId) } },
        {
          $group: {
            _id: '$candidateId',
            answeredCount: { $sum: 1 },
            lastActivity: { $max: '$updatedAt' }
          }
        }
      ]);
      const responseMap = new Map(responseSummary.map((r: any) => [String(r._id), r]));

      // Get exam info for fallback totalQuestions calculation
      const exam = await (await import('../models/exam.model')).Exam.findById(session.examId).lean() as any;
      // Fallback: sum questionCount from exam structure sections (used when candidate has no attempt yet)
      const examTotalQuestions: number = (exam?.structure?.sections ?? [])
        .reduce((sum: number, s: any) => sum + (s.questionCount ?? 0), 0);

      // Resolve candidate names
      const candidateIds = enrolledIds.map(id => new Types.ObjectId(String(id)));
      const candidates = await Candidate.find({ _id: { $in: candidateIds } })
        .select('personalInfo.firstName personalInfo.lastName')
        .lean();
      const candidateNameMap = new Map(
        candidates.map((c: any) => [
          String(c._id),
          `${c.personalInfo?.firstName ?? ''} ${c.personalInfo?.lastName ?? ''}`.trim() || 'Sin nombre'
        ])
      );

      const result = enrolledIds.map(candidateId => {
        const idStr = String(candidateId);
        const attempt = attempts.find(a => String(a.candidateId) === idStr);
        const responses = responseMap.get(idStr) as any;

        const status: string = attempt?.status ?? 'not_started';
        const startedAt: Date | null = attempt?.startedAt ?? null;
        const finishedAt: Date | null = attempt?.finishedAt ?? null;
        const lastActivity: Date | null = responses?.lastActivity ?? startedAt;

        // Compute totalQuestions from the candidate's own attempt (most accurate)
        // since questions may be randomized per-candidate
        let totalQuestions = 0;
        if (attempt?.sectionsStructure && attempt.sectionsStructure.length > 0) {
          totalQuestions = attempt.sectionsStructure.reduce(
            (sum, s) => sum + (s.questionIds?.length ?? s.questionCount ?? 0), 0
          );
        } else if (attempt?.questionIds && attempt.questionIds.length > 0) {
          totalQuestions = attempt.questionIds.length;
        } else {
          totalQuestions = examTotalQuestions;
        }

        // Tiempo activo en segundos desde que inició
        const activeSeconds = startedAt
          ? Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)
          : 0;

        return {
          candidateId: idStr,
          name: candidateNameMap.get(idStr) ?? idStr,
          status,
          answeredCount: responses?.answeredCount ?? 0,
          totalQuestions,
          startedAt,
          finishedAt,
          lastActivity,
          activeSeconds
        };
      });

      return {
        sessionId,
        sessionName: session.sessionName,
        sessionStatus: session.status,
        totalEnrolled: enrolledIds.length,
        inProgress: result.filter(r => r.status === 'in_progress').length,
        completed: result.filter(r => r.status === 'completed').length,
        notStarted: result.filter(r => r.status === 'not_started').length,
        candidates: result
      };
    } catch (error) {
      logger.error(`Error getting session progress ${sessionId}:`, error);
      throw error;
    }
  }

  async kickCandidate(sessionId: string, candidateId: string): Promise<void> {
    try {
      const attempt = await Attempt.findOne({
        sessionId: new Types.ObjectId(sessionId),
        candidateId: new Types.ObjectId(candidateId),
        status: 'in_progress',
      });
      if (attempt) {
        attempt.status = 'cancelled';
        attempt.finishedAt = new Date();
        await attempt.save();
      }
      logger.info(`Candidate ${candidateId} kicked from session ${sessionId}`);
    } catch (error) {
      logger.error(`Error kicking candidate ${candidateId} from session ${sessionId}:`, error);
      throw error;
    }
  }
}