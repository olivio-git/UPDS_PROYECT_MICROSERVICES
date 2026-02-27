import { NextFunction, Request, Response } from 'express';
import { ExamTakingService } from '../services/examTaking.service';
import { StorageService } from '../services/storage.service';
import { Attempt } from '../models/attempt.model';
import { Question } from '../models/question.model';
import { Response as ResponseModel } from '../models/response.model';
import { logger } from '../utils/logger';

const service = new ExamTakingService();
const storageService = new StorageService();

export class ExamTakingController {
  async start(req: Request, res: Response, next: NextFunction) {
    try {
      const { sessionId } = req.params; 
      const userCandidateId = req?.userCandidateId; 
      if (!userCandidateId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }
      if (!sessionId) {
        res.status(400).json({ success: false, message: 'sessionId required' });
        return;
      }

      const result = await service.startExam(sessionId, String(userCandidateId));
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error('Error in start exam:', error);
      next(error);
    }
  }

  async answer(req: Request, res: Response, next: NextFunction) {
    try {
      const { sessionId } = req.params;
      const { questionId } = req.body;
      const authUserId = req.user && (req.user as any).id;
      if (!authUserId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }
      if (!sessionId || !questionId) {
        res.status(400).json({ success: false, message: 'sessionId and questionId required' });
        return;
      }

      // Extract only the answer, not the entire request body
      const answer = req.body.answer;
      if (!answer) {
        res.status(400).json({ success: false, message: 'answer is required' });
        return;
      }

      console.log(`🎯 [ExamTakingController] Received answer for question ${questionId}:`, JSON.stringify(answer, null, 2));

      const result = await service.submitAnswer(sessionId, String(authUserId), String(questionId), answer);
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error('Error in submit answer:', error);
      next(error);
    }
  }

  async finish(req: Request, res: Response, next: NextFunction) {
    try {
      const { sessionId } = req.params;
      const authUserId = req.user && (req.user as any).id;
      if (!authUserId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }
      if (!sessionId) {
        res.status(400).json({ success: false, message: 'sessionId required' });
        return;
      }

      const result = await service.finishExam(sessionId, String(authUserId));
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error('Error in finish exam:', error);
      next(error);
    }
  }

  async time(req: Request, res: Response, next: NextFunction) {
    try {
      const { sessionId } = req.params;
      const authUserId = req.user && (req.user as any).id;
      if (!authUserId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }
      if (!sessionId) {
        res.status(400).json({ success: false, message: 'sessionId required' });
        return;
      }

      const result = await service.getTimeRemaining(sessionId, String(authUserId));
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error('Error in time remaining:', error);
      next(error);
    }
  }

  // New endpoints for HTTP-based exam taking

  async getMyAnswers(req: Request, res: Response, next: NextFunction) {
    try {
      const { sessionId } = req.params;
      const authUserId = req.user && (req.user as any).id;
      if (!authUserId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }
      if (!sessionId) {
        res.status(400).json({ success: false, message: 'sessionId required' });
        return;
      }

      const result = await service.getMyAnswers(sessionId, String(authUserId));
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error('Error getting answers:', error);
      next(error);
    }
  }

  async getActiveSession(req: Request, res: Response, next: NextFunction) {
    try {
      const authUserId = req.user && (req.user as any).id;
      if (!authUserId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      const result = await service.getActiveSession(String(authUserId));
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error('Error getting active session:', error);
      next(error);
    }
  }

  async resumeExam(req: Request, res: Response, next: NextFunction) {
    try {
      const { sessionId } = req.params;
      const authUserId = req.user && (req.user as any).id;
      if (!authUserId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }
      if (!sessionId) {
        res.status(400).json({ success: false, message: 'sessionId required' });
        return;
      }

      const result = await service.resumeExam(sessionId, String(authUserId));
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error('Error resuming exam:', error);
      next(error);
    }
  }

  async attempts(req: Request, res: Response, next: NextFunction) {
    try {
      const { sessionId } = req.params;
      const [ countPermitted ] = req.body;

      const authUserId = req.user && (req.user as any).id;
      if (!authUserId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }
      if (!sessionId) {
        res.status(400).json({ success: false, message: 'sessionId required' });
        return;
      }

      const result = await service.attempts(sessionId, String(authUserId),countPermitted);
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error('Error getting attempts:', error);
      next(error);
    }
  }

  async startAdaptive(req: Request, res: Response, next: NextFunction) {
    try {
      const { sessionId } = req.params;
      const userCandidateId = req?.userCandidateId;
      if (!userCandidateId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }
      if (!sessionId) {
        res.status(400).json({ success: false, message: 'sessionId required' });
        return;
      }
      const result = await service.startAdaptiveExam(sessionId, String(userCandidateId));
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error('Error starting adaptive exam:', error);
      next(error);
    }
  }

  async submitAdaptiveAnswer(req: Request, res: Response, next: NextFunction) {
    try {
      const { sessionId } = req.params;
      const { questionId, answer } = req.body;
      const userCandidateId = req?.userCandidateId || (req.user && (req.user as any).id);
      if (!userCandidateId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }
      if (!sessionId || !questionId || !answer) {
        res.status(400).json({ success: false, message: 'sessionId, questionId and answer required' });
        return;
      }
      const result = await service.submitAdaptiveAnswer(sessionId, String(userCandidateId), String(questionId), answer);
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error('Error submitting adaptive answer:', error);
      next(error);
    }
  }

  async resumeAdaptive(req: Request, res: Response, next: NextFunction) {
    try {
      const { sessionId } = req.params;
      const authUserId = req.user && (req.user as any).id;
      if (!authUserId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }
      if (!sessionId) {
        res.status(400).json({ success: false, message: 'sessionId required' });
        return;
      }
      const result = await service.resumeAdaptiveExam(sessionId, String(authUserId));
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error('Error resuming adaptive exam:', error);
      next(error);
    }
  }

  async uploadResponseAudio(req: Request, res: Response, next: NextFunction) {
    try {
      const { sessionId } = req.params;
      const { questionId } = req.body;
      const authUserId = req.user && (req.user as any).id;

      if (!authUserId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }
      if (!sessionId || !questionId) {
        res.status(400).json({ success: false, message: 'sessionId and questionId required' });
        return;
      }
      if (!req.file) {
        res.status(400).json({ success: false, message: 'Audio file required' });
        return;
      }

      const folder = `responses/${sessionId}/${questionId}/audio`;
      const result = await storageService.uploadFile(req.file, folder);

      // URL pública para que el navegador pueda hacer preview
      const publicUrl = result.publicUrl || result.url;
      // URL interna Docker-to-Docker para que grading-service pueda descargar el audio
      const internalUrl = storageService.getInternalUrl(result.key);

      logger.info(`🎙️ [UploadResponseAudio] Uploaded audio for session ${sessionId}, question ${questionId}: ${internalUrl}`);

      // Persistir inmediatamente en MongoDB para evitar race condition con auto-save
      try {
        const attempt = await Attempt.findOne({ sessionId });
        const question = await Question.findById(questionId);
        if (attempt && question) {
          await ResponseModel.findOneAndUpdate(
            { sessionId: attempt.sessionId, candidateId: attempt.candidateId, questionId },
            {
              $set: {
                response: { type: 'audio_response', audioUrl: internalUrl },
                answer: { type: 'audio_response', audioUrl: internalUrl },
                examId: attempt.examId,
                competency: (question as any).competency || 'speaking'
              }
            },
            { upsert: true, new: true }
          );
          logger.info(`✅ [UploadResponseAudio] Persisted audioUrl to MongoDB immediately`);
        }
      } catch (persistError) {
        // No bloquear la respuesta si falla la persistencia inmediata; el auto-save es el fallback
        logger.warn(`⚠️ [UploadResponseAudio] Immediate persistence failed (auto-save will retry):`, persistError);
      }

      res.json({ success: true, data: { audioUrl: publicUrl } });
    } catch (error) {
      logger.error('Error uploading response audio:', error);
      next(error);
    }
  }
}
