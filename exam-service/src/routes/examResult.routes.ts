import { Router } from 'express';
import { ExamResultController } from '../controllers/examResult.controller';
import { authMiddleware, requireRole } from '../middleware/auth.middleware';
import { searchRefs } from '../middleware/searchRefs';

const router = Router();
const controller = new ExamResultController();

// All routes require authentication
router.use(authMiddleware);

/**
 * GET /api/exam-results/my-recent
 * Get recent exam results for the authenticated user
 * Query params:
 *   - limit: number (optional, default: 10)
 */
router.get('/my-recent', searchRefs, controller.getMyRecentResults.bind(controller));

/**
 * GET /api/exam-results/my-stats
 * Get evaluation statistics for the authenticated user
 */
router.get('/my-stats', searchRefs, controller.getMyEvaluationStats.bind(controller));

/**
 * GET /api/exam-results/:resultId/admin
 * Get detailed exam result by ID — admin/teacher access (no ownership check)
 */
router.get('/:resultId/admin', requireRole('admin', 'teacher'), controller.getResultDetailsAdmin.bind(controller));

/**
 * GET /api/exam-results/:resultId
 * Get detailed exam result by ID
 */
router.get('/:resultId', searchRefs, controller.getResultDetails.bind(controller));

/**
 * GET /api/exam-results/:resultId/detailed
 * Get detailed exam result with populated question data
 */
router.get('/:resultId/detailed', searchRefs, controller.getDetailedResultWithQuestions.bind(controller));

/**
 * GET /api/exam-results/attempt/:attemptId
 * Get exam result by attempt ID
 */
router.get('/attempt/:attemptId', searchRefs, controller.getResultByAttempt.bind(controller));

/**
 * POST /api/exam-results/reevaluate/:attemptId
 * Force re-evaluation of an exam (for debugging/admin)
 */
router.post('/reevaluate/:attemptId', controller.reevaluateExam.bind(controller));

/**
 * GET /api/exam-results/:resultId/export-pdf
 * Generate and download PDF report for exam result
 * Query params:
 *   - includeQuestions: boolean (optional, default: false)
 *   - includeAI: boolean (optional, default: false)
 *   - language: 'spanish' | 'english' (optional, default: 'spanish')
 *   - companyName: string (optional)
 */
router.get('/:resultId/export-pdf', searchRefs, controller.generateExamResultPDF.bind(controller));

export { router as examResultRoutes };
