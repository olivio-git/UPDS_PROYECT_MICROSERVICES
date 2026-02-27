import { Router } from 'express';
import { RubricController } from '../controllers/rubric.controller';
import { authMiddleware, requireRole } from '../middleware/auth.middleware';
import { validateRequest, validateParams, validateQuery } from '../middleware/validation.middleware';
import { rubricSchema } from '../schemas/rubric.schema';

const router = Router();
const rubricController = new RubricController();

// All routes require authentication
router.use(authMiddleware);

// CRUD routes
router.post(
  '/',
  requireRole('admin', 'teacher'),
  validateRequest(rubricSchema.create),
  rubricController.create
);

router.get(
  '/',
  validateQuery(rubricSchema.query),
  rubricController.findAll
);

router.get(
  '/:id',
  validateParams(rubricSchema.params),
  rubricController.findById
);

router.put(
  '/:id',
  requireRole('admin', 'teacher'),
  validateParams(rubricSchema.params),
  validateRequest(rubricSchema.update),
  rubricController.update
);

router.delete(
  '/:id',
  requireRole('admin'),
  validateParams(rubricSchema.params),
  rubricController.delete
);

// Get rubrics by competency and level
router.get(
  '/competency/:competency/level/:level',
  validateParams(rubricSchema.competencyLevelParams),
  rubricController.findByCompetencyAndLevel
);

// Clone rubric
router.post(
  '/:id/clone',
  requireRole('admin', 'teacher'),
  validateParams(rubricSchema.params),
  validateRequest(rubricSchema.clone),
  rubricController.clone
);

// Activate rubric
router.patch(
  '/:id/activate',
  requireRole('admin', 'teacher'),
  validateParams(rubricSchema.params),
  rubricController.activate
);

// Deactivate rubric
router.patch(
  '/:id/deactivate',
  requireRole('admin', 'teacher'),
  validateParams(rubricSchema.params),
  rubricController.deactivate
);

// Calculate score with rubric
router.post(
  '/:id/calculate-score',
  requireRole('admin', 'teacher', 'proctor'),
  validateParams(rubricSchema.params),
  rubricController.calculateScore
);

export default router;