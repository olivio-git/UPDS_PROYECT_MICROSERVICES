import { Router, Request, Response, NextFunction } from 'express';
import { ExamTakingController } from '../controllers/examTaking.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { uploadAudioSingle, handleMulterError } from '../config/multerImproved';
import { searchRefs } from '../middleware/searchRefs';

const router = Router();
const controller = new ExamTakingController();

// Existing routes
router.post('/:sessionId/start', authMiddleware, searchRefs, (req, res, next) => controller.start(req, res, next));
router.post('/:sessionId/answer', authMiddleware, (req, res, next) => controller.answer(req, res, next));
router.post('/:sessionId/finish', authMiddleware, (req, res, next) => controller.finish(req, res, next));
router.get('/:sessionId/time', authMiddleware, (req, res, next) => controller.time(req, res, next));

// New HTTP-based routes
router.get('/:sessionId/answers', authMiddleware, (req, res, next) => controller.getMyAnswers(req, res, next));
router.get('/:sessionId/resume', authMiddleware, (req, res, next) => controller.resumeExam(req, res, next));
router.get('/:sessionId/attempts', authMiddleware, (req, res, next) => controller.attempts(req, res, next));
// Active session detection (no sessionId needed)
router.get('/active-session', authMiddleware, (req, res, next) => controller.getActiveSession(req, res, next));

// Adaptive (CAT) exam routes
router.post('/:sessionId/adaptive/start', authMiddleware, searchRefs, (req, res, next) => controller.startAdaptive(req, res, next));
router.post('/:sessionId/adaptive/answer', authMiddleware, searchRefs, (req, res, next) => controller.submitAdaptiveAnswer(req, res, next));
router.get('/:sessionId/adaptive/resume', authMiddleware, (req, res, next) => controller.resumeAdaptive(req, res, next));

// Audio response upload
router.post(
  '/:sessionId/response-audio',
  authMiddleware,
  uploadAudioSingle.single('audio'),
  handleMulterError,
  (req: Request, res: Response, next: NextFunction) => controller.uploadResponseAudio(req, res, next)
);

export default router;
