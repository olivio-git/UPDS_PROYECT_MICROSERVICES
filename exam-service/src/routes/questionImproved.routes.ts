import { Router } from 'express';
import {
  handleMulterError,
  uploadAudioSingle,
  uploadImageSingle,
  uploadMixed,
  uploadSpreadsheet
} from '../config/multerImproved';
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
  questionController.create
);

// Create question with media (single request) - MEJORADO
router.post(
  '/create-with-media',
  requireRole('admin', 'teacher'),
  uploadMixed,
  handleMulterError, // Middleware de manejo de errores de multer
  questionController.createWithMedia
);

router.get(
  '/',
  validateQuery(questionSchema.query),
  questionController.findAll
);

router.get(
  '/:id',
  validateParams(questionSchema.params),
  questionController.findById
);

router.put(
  '/:id',
  requireRole('admin', 'teacher'),
  validateParams(questionSchema.params),
  validateRequest(questionSchema.update),
  questionController.update
);

router.delete(
  '/:id',
  requireRole('admin'),
  validateParams(questionSchema.params),
  questionController.delete
);

// Import questions from file (Excel/CSV)
router.post(
  '/import',
  requireRole('admin', 'teacher'),
  uploadSpreadsheet.single('file'),
  handleMulterError,
  questionController.importQuestions
);

// // Import questions from JSON data
// router.post(
//   '/import/data',
//   requireRole('admin', 'teacher'),
//   questionController.importQuestionsFromData
// );

// // Download question template
// router.get(
//   '/template/download',
//   requireRole('admin', 'teacher'),
//   questionController.downloadTemplate
// );

// File upload routes MEJORADAS
router.post(
  '/:id/audio',
  requireRole('admin', 'teacher'),
  validateParams(questionSchema.params),
  uploadAudioSingle.single('audio'),
  handleMulterError,
  questionController.uploadAudio
);

router.post(
  '/:id/image',
  requireRole('admin', 'teacher'),
  validateParams(questionSchema.params),
  uploadImageSingle.single('image'),
  handleMulterError,
  questionController.uploadImage
);

// Get question media files
router.get(
  '/:id/media',
  validateParams(questionSchema.params),
  questionController.getMedia
);

export default router;
