import { Router } from 'express';
import {
  uploadAudio,
  uploadImage,
  uploadMixed,
  uploadMultimediaAny,
  uploadSpreadsheet
} from '../config/multer';
import { QuestionController } from '../controllers/question.controller';
import { authMiddleware, requireRole } from '../middleware/auth.middleware';
import { validateParams, validateQuery, validateRequest } from '../middleware/validation.middleware';
import { questionSchema } from '../schemas/question.schema';

const router = Router();
const questionController = new QuestionController();

// All routes require authentication
router.use(authMiddleware);

// CRUD routes
router.post(
  '/',
  requireRole('admin', 'teacher'),
  validateRequest(questionSchema.create),
  questionController.create.bind(questionController)
);

// Create question with media (single request)
router.post(
  '/create-with-media',
  requireRole('admin', 'teacher'),
  uploadMixed,
  questionController.createWithMedia.bind(questionController)
);

// Create question with multiple media files (for matching, drag_drop, etc.)
router.post(
  '/create-with-multiple-media',
  requireRole('admin', 'teacher'),
  // Use any() for dynamic field names like item_audio_0, item_image_1, etc.
  uploadMultimediaAny.any(),
  questionController.createQuestionWithMultipleMedia.bind(questionController)
);

router.get(
  '/',
  validateQuery(questionSchema.query),
  questionController.findAll.bind(questionController)
);

router.get(
  '/stats',
  questionController.getQuestionStats.bind(questionController)
);

router.get(
  '/:id',
  validateParams(questionSchema.params),
  questionController.findById.bind(questionController)
);

router.put(
  '/:id',
  requireRole('admin', 'teacher'),
  validateParams(questionSchema.params),
  validateRequest(questionSchema.update),
  questionController.update.bind(questionController)
);

router.delete(
  '/:id',
  requireRole('admin'),
  validateParams(questionSchema.params),
  questionController.delete.bind(questionController)
);

// Import questions from file (Excel/CSV)
router.post(
  '/import',
  requireRole('admin', 'teacher'),
  uploadSpreadsheet.single('file'),
  questionController.importQuestions.bind(questionController)
);

// Import questions from JSON data
// router.post(
//   '/import/data',
//   requireRole('admin', 'teacher'),
//   questionController.importQuestionsFromData.bind(questionController)
// );

// // Download question template
// router.get(
//   '/template/download',
//   requireRole('admin', 'teacher'),
//   questionController.downloadTemplate.bind(questionController)
// );

// File upload routes
router.post(
  '/:id/audio',
  requireRole('admin', 'teacher'),
  validateParams(questionSchema.params),
  uploadAudio.single('audio'),
  questionController.uploadAudio.bind(questionController)
);

router.post(
  '/:id/image',
  requireRole('admin', 'teacher'),
  validateParams(questionSchema.params),
  uploadImage.single('image'),
  questionController.uploadImage.bind(questionController)
);

// Get question media files
router.get(
  '/:id/media',
  validateParams(questionSchema.params),
  questionController.getMedia.bind(questionController)
);

export default router;