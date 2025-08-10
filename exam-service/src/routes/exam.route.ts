import { Router } from 'express';
import { ExamController } from '../controllers/exam.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { zodValidateRequest } from '../middleware/zod-validation.middleware';
import { examSchema } from '../schemas/exam.schema';

const router = Router();
const examController = new ExamController();

// All routes require authentication
router.use(authMiddleware);

// CRUD routes
router.post(
  '/',
  zodValidateRequest(examSchema.create),
  examController.create
);

router.get(
  '/',
  examController.findAll
);

router.get(
  '/:id',
  zodValidateRequest(examSchema.params),
  examController.findById
);

router.put(
  '/:id',
  zodValidateRequest(examSchema.params),
  zodValidateRequest(examSchema.update),
  examController.update
);

router.delete(
  '/:id',
  zodValidateRequest(examSchema.params),
  examController.delete
);

// Special routes
router.post(
  '/:id/clone',
  zodValidateRequest(examSchema.params),
  examController.clone
);

router.post(
  '/:id/generate-questions',
  zodValidateRequest(examSchema.params),
  zodValidateRequest(examSchema.generateQuestions),
  examController.generateQuestions
);

export default router;