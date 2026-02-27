import { Router } from 'express';
import { MediaController } from '../controllers/media.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { validateParams } from '../middleware/validation.middleware';
import { z } from 'zod';

const router = Router();
const mediaController = new MediaController();

// Validation schema (Zod)
const mediaParamsSchema = z.object({
  questionId: z.string().regex(/^[0-9a-fA-F]{24}$/)
});

// Public test endpoint (for development)
router.get(
  '/test/:questionId',
  validateParams(mediaParamsSchema),
  mediaController.testAudioPlayback
);

// Protected endpoints
router.use(authMiddleware);

// Stream audio directly
router.get(
  '/stream/:questionId',
  validateParams(mediaParamsSchema),
  mediaController.streamAudio
);

// Get fresh presigned URL
router.get(
  '/url/:questionId',
  validateParams(mediaParamsSchema),
  mediaController.getPresignedUrl
);

// Get public URL (if configured)
router.get(
  '/public/:questionId',
  validateParams(mediaParamsSchema),
  mediaController.getPublicUrl
);

export default router;