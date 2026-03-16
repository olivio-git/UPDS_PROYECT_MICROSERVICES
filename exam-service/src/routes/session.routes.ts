import { Router } from 'express';
import { SessionController } from '../controllers/session.controller';
import { authMiddleware, requireRole } from '../middleware/auth.middleware';
import { validateRequest, validateParams } from '../middleware/validation.middleware';
import { sessionSchema } from '../schemas/session.schema';

const router = Router();
const sessionController = new SessionController();

// All routes require authentication
router.use(authMiddleware);

// Routes for candidates to access their sessions
router.get(
  '/my-sessions',
  requireRole('student'),
  sessionController.getMySessions
);

// Get questions for a specific session (for students)
router.get(
  '/:id/questions',
  requireRole('student'),
  validateParams(sessionSchema.params),
  sessionController.getSessionQuestions
);

// CRUD routes
router.post(
  '/',
  requireRole('admin', 'teacher'),
  validateRequest(sessionSchema.create),
  sessionController.create
);

router.get(
  '/',
  sessionController.findAll
);

router.get(
  '/:id',
  validateParams(sessionSchema.params),
  sessionController.findById
);

router.put(
  '/:id',
  requireRole('admin', 'teacher'),
  validateParams(sessionSchema.params),
  validateRequest(sessionSchema.update),
  sessionController.update
);

// Candidate management
router.post(
  '/:id/candidates',
  requireRole('admin', 'teacher'),
  validateParams(sessionSchema.params),
  validateRequest(sessionSchema.addCandidate),
  sessionController.addCandidate
);

router.delete(
  '/:id/candidates',
  requireRole('admin', 'teacher'),
  validateParams(sessionSchema.params),
  validateRequest(sessionSchema.addCandidate),
  sessionController.removeCandidate
);

// Proctor management
router.post(
  '/:id/proctors',
  requireRole('admin'),
  validateParams(sessionSchema.params),
  validateRequest(sessionSchema.addProctor),
  sessionController.addProctor
);

router.delete(
  '/:id/proctors',
  requireRole('admin'),
  validateParams(sessionSchema.params),
  validateRequest(sessionSchema.addProctor),
  sessionController.removeProctor
);

// Session results (admin/teacher)
router.get(
  '/:id/results',
  requireRole('admin', 'teacher'),
  validateParams(sessionSchema.params),
  sessionController.getSessionResults
);

// Session real-time progress (admin/teacher/proctor)
router.get(
  '/:id/progress',
  requireRole('admin', 'teacher', 'proctor'),
  validateParams(sessionSchema.params),
  sessionController.getSessionProgress
);

// Session control
router.post(
  '/:id/start',
  requireRole('admin', 'teacher', 'proctor'),
  validateParams(sessionSchema.params),
  sessionController.startSession
);

router.post(
  '/:id/end',
  requireRole('admin', 'teacher', 'proctor'),
  validateParams(sessionSchema.params),
  sessionController.endSession
);

router.post(
  '/:id/cancel',
  requireRole('admin'),
  validateParams(sessionSchema.params),
  sessionController.cancelSession
);

// Kick candidate from active session (cancels their attempt)
router.post(
  '/:id/candidates/:candidateId/kick',
  requireRole('admin', 'teacher', 'proctor'),
  validateParams(sessionSchema.params),
  sessionController.kickCandidate
);

// Extend session time
router.post(
  '/:id/extend',
  requireRole('admin', 'teacher', 'proctor'),
  validateParams(sessionSchema.params),
  sessionController.extendSession
);

// Recalculate grades for all completed attempts in a session
router.post(
  '/:id/regrade',
  requireRole('admin', 'teacher'),
  validateParams(sessionSchema.params),
  sessionController.regradeSession
);

export default router;
