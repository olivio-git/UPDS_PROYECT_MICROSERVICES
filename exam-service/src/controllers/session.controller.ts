import { NextFunction, Request, Response } from 'express';
import { SessionService } from '../services/session.service';
import { ExamResult } from '../models/examResult.model';
import { logger } from '../utils/logger';

export class SessionController {
  private sessionService: SessionService;

  constructor() {
    this.sessionService = new SessionService();
  }

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sessionData = {
        ...req.body,
        createdBy: req.user.id
      }; 
      const session = await this.sessionService.create(sessionData);

      return res.status(201).json({
        success: true,
        message: 'Sesión creada exitosamente',
        data: session
      });
    } catch (error) {
      logger.error('Error in session creation:', error);
      next(error);
      return;
    }
  };

  removeProctor = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { proctorId, proctorIds } = req.body;
      
      let session;
      if (proctorIds && Array.isArray(proctorIds)) {
        // Remover múltiples proctors
        session = await this.sessionService.removeMultipleProctors(req.params.id!, proctorIds);
      } else if (proctorId) {
        // Remover un solo proctor (compatibilidad)
        session = await this.sessionService.removeProctor(req.params.id!, proctorId);
      } else {
        return res.status(400).json({
          success: false,
          message: 'Debe proporcionar proctorId o proctorIds'
        });
      }

      if (!session) {
        return res.status(404).json({
          success: false,
          message: 'Sesión no encontrada'
        });
      }

      return res.json({
        success: true,
        message: proctorIds ? 'Proctors removidos exitosamente' : 'Proctor removido exitosamente',
        data: session
      });
    } catch (error) {
      logger.error('Error removing proctor(s):', error);
      next(error);
      return;
    }
  };

  findAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page = 1, limit = 10, status, examId, startDate, endDate, q, sortBy, sortOrder } = req.query;

      // Los teachers solo pueden ver las sesiones que ellos crearon
      const createdBy = req.user?.role === 'teacher' ? req.user.id : undefined;

      const filters = {
        status,
        examId,
        startDate,
        endDate,
        q,
        ...(createdBy && { createdBy })
      };

      const sortOptions = {
        sortBy: sortBy as string,
        sortOrder: sortOrder as 'asc' | 'desc'
      };

      const result = await this.sessionService.findAll(
        filters,
        Number(page),
        Number(limit),
        sortOptions
      );

      return res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Error fetching sessions:', error);
      next(error);
      return;
    }
  };

  findById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const session = await this.sessionService.findById(req.params.id!);

      if (!session) {
        return res.status(404).json({
          success: false,
          message: 'Sesión no encontrada'
        });
      }

      return res.json({
        success: true,
        data: session
      });
    } catch (error) {
      logger.error('Error fetching session:', error);
      next(error);
      return;
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const session = await this.sessionService.update(req.params.id!, req.body);

      if (!session) {
        return res.status(404).json({
          success: false,
          message: 'Sesión no encontrada'
        });
      }

      return res.json({
        success: true,
        message: 'Sesión actualizada exitosamente',
        data: session
      });
    } catch (error) {
      logger.error('Error updating session:', error);
      next(error);
      return;
    }
  };

  addCandidate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { candidateId, candidateIds } = req.body;
      let session;
      if (candidateIds && Array.isArray(candidateIds)) {
        // Agregar múltiples candidatos
        session = await this.sessionService.addMultipleCandidates(req.params.id!, candidateIds);
      } else if (candidateId) {
        // Agregar un solo candidato (compatibilidad)
        session = await this.sessionService.addCandidate(req.params.id!, candidateId);
      } else {
        return res.status(400).json({
          success: false,
          message: 'Debe proporcionar candidateId o candidateIds'
        });
      }

      if (!session) {
        return res.status(404).json({
          success: false,
          message: 'Sesión no encontrada'
        });
      }

      return res.json({
        success: true,
        message: candidateIds ? 'Candidatos agregados exitosamente' : 'Candidato agregado exitosamente',
        data: session
      });
    } catch (error) {
      logger.error('Error adding candidate(s):', error);
      next(error);
      return;
    }
  };

  removeCandidate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { candidateId, candidateIds } = req.body;
      
      let session;
      if (candidateIds && Array.isArray(candidateIds)) {
        // Remover múltiples candidatos
        session = await this.sessionService.removeMultipleCandidates(req.params.id!, candidateIds);
      } else if (candidateId) {
        // Remover un solo candidato (compatibilidad)
        session = await this.sessionService.removeCandidate(req.params.id!, candidateId);
      } else {
        return res.status(400).json({
          success: false,
          message: 'Debe proporcionar candidateId o candidateIds'
        });
      }

      if (!session) {
        return res.status(404).json({
          success: false,
          message: 'Sesión no encontrada'
        });
      }

      return res.json({
        success: true,
        message: candidateIds ? 'Candidatos removidos exitosamente' : 'Candidato removido exitosamente',
        data: session
      });
    } catch (error) {
      logger.error('Error removing candidate(s):', error);
      next(error);
      return;
    }
  };

  addProctor = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { proctorId, proctorIds } = req.body;
      
      let session;
      if (proctorIds && Array.isArray(proctorIds)) {
        // Agregar múltiples proctors
        session = await this.sessionService.addMultipleProctors(req.params.id!, proctorIds);
      } else if (proctorId) {
        // Agregar un solo proctor (compatibilidad)
        session = await this.sessionService.addProctor(req.params.id!, proctorId);
      } else {
        return res.status(400).json({
          success: false,
          message: 'Debe proporcionar proctorId o proctorIds'
        });
      }

      if (!session) {
        return res.status(404).json({
          success: false,
          message: 'Sesión no encontrada'
        });
      }

      return res.json({
        success: true,
        message: proctorIds ? 'Proctors agregados exitosamente' : 'Proctor agregado exitosamente',
        data: session
      });
    } catch (error) {
      logger.error('Error adding proctor(s):', error);
      next(error);
      return;
    }
  };

  startSession = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const session = await this.sessionService.startSession(req.params.id!);

      if (!session) {
        return res.status(404).json({
          success: false,
          message: 'Sesión no encontrada'
        });
      }

      return res.json({
        success: true,
        message: 'Sesión iniciada exitosamente',
        data: session
      });
    } catch (error) {
      logger.error('Error starting session:', error);
      next(error);
      return;
    }
  };

  endSession = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const session = await this.sessionService.endSession(req.params.id!);

      if (!session) {
        return res.status(404).json({
          success: false,
          message: 'Sesión no encontrada'
        });
      }

      return res.json({
        success: true,
        message: 'Sesión finalizada exitosamente',
        data: session
      });
    } catch (error) {
      logger.error('Error ending session:', error);
      next(error);
      return;
    }
  };

  cancelSession = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const session = await this.sessionService.cancelSession(req.params.id!);

      if (!session) {
        return res.status(404).json({
          success: false,
          message: 'Sesión no encontrada'
        });
      }

      return res.json({
        success: true,
        message: 'Sesión cancelada exitosamente',
        data: session
      });
    } catch (error) {
      logger.error('Error cancelling session:', error);
      next(error);
      return;
    }
  };

  // New method for candidates to get their sessions
  getMySessions = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authServiceUserId = req.user.id; // Este es el ID del auth-service
      const { status, limit = 10, page = 1, justLast = true, includePast = false } = req.query;
      const authHeader = req.headers.authorization as string | undefined;
      const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;

      const filters = {
        candidateId: authServiceUserId, // Pasar el authServiceUserId
        status,
        page: Number(page),
        limit: Number(limit),
        justLast,
        includePast: includePast === 'true', // Nuevo parámetro para incluir sesiones pasadas
        authToken: token
      };

      const result = await this.sessionService.findSessionsByCandidate(filters);

      return res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Error fetching candidate sessions:', error);
      next(error);
      return;
    }
  };

  getSessionResults = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sessionId = req.params.id!;

      const results = await ExamResult.find({ sessionId })
        .select('candidateId percentage totalScore maxScore status examDuration timeAllowed competencyScores recommendedLevel evaluatedAt examName examLevel')
        .sort({ percentage: -1 })
        .lean();

      return res.json({
        success: true,
        data: {
          total: results.length,
          results: results.map(r => ({
            id: String(r._id),
            candidateId: String(r.candidateId),
            percentage: r.percentage,
            totalScore: r.totalScore,
            maxScore: r.maxScore,
            status: r.status,
            examDuration: r.examDuration,
            timeAllowed: r.timeAllowed,
            competencyScores: r.competencyScores,
            recommendedLevel: (r as any).recommendedLevel,
            evaluatedAt: r.evaluatedAt,
          })),
        },
      });
    } catch (error) {
      logger.error('Error fetching session results:', error);
      next(error);
      return;
    }
  };

  getSessionQuestions = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sessionId = req.params.id!;
      const candidateId = req.user.candidateId; // Assuming auth middleware adds candidateId

      logger.info(`Fetching questions for session ${sessionId}, candidate ${candidateId}`);

      const questions = await this.sessionService.getSessionQuestions(sessionId, candidateId);

      if (!questions) {
        return res.status(404).json({
          success: false,
          message: 'No se encontraron preguntas para esta sesión'
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Preguntas obtenidas exitosamente',
        data: questions
      });
    } catch (error) {
      logger.error('Error fetching session questions:', error);
      next(error);
      return;
    }
  };

  getSessionProgress = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const progress = await this.sessionService.getSessionProgress(req.params.id!);
      return res.json({ success: true, data: progress });
    } catch (error) {
      logger.error('Error fetching session progress:', error);
      next(error);
      return;
    }
  };

  regradeSession = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.sessionService.regradeSession(req.params.id!);
      return res.json({
        success: true,
        message: `Recalificación iniciada: ${result.queued}/${result.total} intentos procesados`,
        data: result
      });
    } catch (error) {
      logger.error('Error regrading session:', error);
      next(error);
      return;
    }
  };
}