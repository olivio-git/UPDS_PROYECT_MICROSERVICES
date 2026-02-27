import { Router } from 'express';
import { LevelController } from '../controllers/level.controller';
import { authMiddleware, requireRole } from '../middleware/auth.middleware';
import { validateRequest, validateParams, validateQuery } from '../middleware/validation.middleware';
import { levelSchema } from '../schemas/level.schema';

const router = Router();
const levelController = new LevelController();

// All routes require authentication
router.use(authMiddleware);

// Get all levels
router.get(
  '/',
  validateQuery(levelSchema.query),
  levelController.findAll
);

// Get level by code
router.get(
  '/:code',
  validateParams(levelSchema.params),
  levelController.findByCode
);

// Create individual level
router.post(
  '/',
  requireRole('admin'),
  validateRequest(levelSchema.create),
  levelController.create
);

// Get level by ID
router.get(
  '/id/:id',
  validateParams(levelSchema.idParams),
  levelController.findById
);

// Update level by ID
router.put(
  '/id/:id',
  requireRole('admin'),
  validateParams(levelSchema.idParams),
  validateRequest(levelSchema.update),
  levelController.updateById
);

// Delete level by ID
router.delete(
  '/id/:id',
  requireRole('admin'),
  validateParams(levelSchema.idParams),
  levelController.delete
);

// Activate level
router.patch(
  '/id/:id/activate',
  requireRole('admin'),
  validateParams(levelSchema.idParams),
  levelController.activate
);

// Deactivate level
router.patch(
  '/id/:id/deactivate',
  requireRole('admin'),
  validateParams(levelSchema.idParams),
  levelController.deactivate
);

// Update level by code (existing)
router.put(
  '/:code',
  requireRole('admin'),
  validateParams(levelSchema.params),
  validateRequest(levelSchema.update),
  levelController.update
);

// Initialize levels (admin only)
router.post(
  '/initialize',
  requireRole('admin'),
  levelController.initialize
);

export default router;