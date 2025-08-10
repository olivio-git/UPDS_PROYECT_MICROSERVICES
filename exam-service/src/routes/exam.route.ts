import { Router } from 'express';
import { ExamController } from '../controllers/exam.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
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
  validateRequest(examSchema.params),
  examController.findById
);

router.put(
  '/:id',
  validateRequest(examSchema.params),
  validateRequest(examSchema.update),
  examController.update
);

router.delete(
  '/:id',
  validateRequest(examSchema.params),
  examController.delete
);

// Special routes
router.post(
  '/:id/clone',
  validateRequest(examSchema.params),
  examController.clone
);

router.post(
  '/:id/generate-questions',
  validateRequest(examSchema.params),
  validateRequest(examSchema.generateQuestions),
  examController.generateQuestions
);

export default router;