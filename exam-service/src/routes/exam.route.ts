import { Router } from 'express';
import { ExamController } from '../controllers/exam.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { validateRequest, validateParams } from '../middleware/validation.middleware';
import { examSchema } from '../schemas/exam.schema';

const router = Router();
const examController = new ExamController();

// All routes require authentication
router.use(authMiddleware);

// CRUD routes
router.post(
  '/',
  validateRequest(examSchema.create),
  examController.create
);

router.get(
  '/',
  examController.findAll
);

router.get(
  '/:id',
  validateParams(examSchema.params),
  examController.findById
);

router.put(
  '/:id',
  validateParams(examSchema.params),
  validateRequest(examSchema.update),
  examController.update
);

router.delete(
  '/:id',
  validateParams(examSchema.params),
  examController.delete
);

// Special routes
router.post(
  '/:id/clone',
  validateParams(examSchema.params),
  examController.clone
);

router.post(
  '/:id/generate-questions',
  validateParams(examSchema.params),
  validateRequest(examSchema.generateQuestions),
  examController.generateQuestions
);

export default router;