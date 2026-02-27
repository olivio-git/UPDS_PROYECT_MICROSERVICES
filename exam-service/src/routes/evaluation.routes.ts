import { Router } from 'express';
import { EvaluationController } from '../controllers/evaluation.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { authorizeRoles } from '../middleware/authorization.middleware';

const router = Router();
const evaluationController = new EvaluationController();

// Apply authentication to all routes
router.use(authMiddleware);

// Evaluate individual response (accessible to teachers, proctors, and admins)
router.post('/response', 
  authorizeRoles(['teacher', 'admin', 'proctor']),
  evaluationController.evaluateResponse
);

// Evaluate entire session (accessible to teachers, proctors, and admins)
router.post('/session/:sessionId', 
  authorizeRoles(['teacher', 'admin', 'proctor']),
  evaluationController.evaluateSession
);

// Get question statistics (accessible to teachers and admins)
router.get('/question/:questionId/statistics', 
  authorizeRoles(['teacher', 'admin']),
  evaluationController.getQuestionStatistics
);

// Get exam statistics (accessible to teachers and admins)
router.get('/exam/:examId/statistics', 
  authorizeRoles(['teacher', 'admin']),
  evaluationController.getExamStatistics
);

// Get manual review queue (accessible to teachers, proctors, and admins)
router.get('/manual-review', 
  authorizeRoles(['teacher', 'admin', 'proctor']),
  evaluationController.getManualReviewQueue
);

// Update manual evaluation (accessible to teachers and admins)
router.put('/response/:responseId/manual', 
  authorizeRoles(['teacher', 'admin']),
  evaluationController.updateManualEvaluation
);

export default router;