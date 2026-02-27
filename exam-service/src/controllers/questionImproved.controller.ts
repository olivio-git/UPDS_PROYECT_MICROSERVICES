import { NextFunction, Request, Response } from 'express';
import { ImportService } from '../services/import.service';
import { QuestionService } from '../services/question.service';
import { StorageService } from '../services/storage.service';
import { logger } from '../utils/logger';

export class QuestionControllerImproved {
  private questionService: QuestionService;
  private importService: ImportService;
  private storageService: StorageService;

  constructor() {
    this.questionService = new QuestionService();
    this.importService = new ImportService();
    this.storageService = new StorageService();
  }

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const questionData = {
        ...req.body,
        createdBy: req.user.id
      };

      const question = await this.questionService.create(questionData);

      res.status(201).json({
        success: true,
        message: 'Pregunta creada exitosamente',
        data: question
      });
    } catch (error) {
      logger.error('Error in question creation:', error);
      next(error);
    }
  };

  // Crear pregunta con multimedia en una sola petición MEJORADO
  createWithMedia = async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Log detallado para debug
      logger.info('Create with media request:', {
        body: Object.keys(req.body),
        files: req.files ? Object.keys(req.files) : 'No files',
        contentType: req.headers['content-type'],
        questionData: req.body.question ? 'Present' : 'Missing'
      });

      // Parsear los datos de la pregunta del campo 'question'
      let questionData;
      try {
        if (!req.body.question) {
          res.status(400).json({
            success: false,
            message: 'Los datos de la pregunta son requeridos en el campo "question"',
            debug: {
              receivedFields: Object.keys(req.body),
              expectedField: 'question'
            }
          });
          return;
        }

        questionData = JSON.parse(req.body.question);
      } catch (parseError) {
        logger.error('Error parsing question data:', parseError);
        res.status(400).json({
          success: false,
          message: 'Los datos de la pregunta deben ser un JSON válido',
          error: parseError instanceof Error ? parseError.message : 'Parse error'
        });
        return;
      }

      // Agregar el createdBy
      questionData.createdBy = req.user.id;

      // Crear la pregunta primero
      const question = await this.questionService.create(questionData);
      const questionIdStr = (question as any).id || String((question as any)._id);

      logger.info('Question created successfully:', {
        questionId: questionIdStr,
        hasFiles: !!req.files
      });

      // Procesar archivos multimedia si existen
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      
      if (files && Object.keys(files).length > 0) {
        try {
          let mediaResult;
          let mediaFile: Express.Multer.File | undefined;
          let mediaType: 'audio' | 'image' | undefined;

          // Log de archivos recibidos
          Object.entries(files).forEach(([fieldname, fileArray]) => {
            logger.info(`File field '${fieldname}':`, {
              count: fileArray.length,
              files: fileArray.map(f => ({
                originalname: f.originalname,
                mimetype: f.mimetype,
                size: f.size
              }))
            });
          });

          // Priorizar audio sobre imagen
          if (files.audio && files.audio[0]) {
            mediaFile = files.audio[0];
            mediaType = 'audio';
          } else if (files.image && files.image[0]) {
            mediaFile = files.image[0];
            mediaType = 'image';
          } else if (files.file && files.file[0]) {
            mediaFile = files.file[0];
            if (mediaFile.mimetype.startsWith('audio/')) {
              mediaType = 'audio';
            } else if (mediaFile.mimetype.startsWith('image/')) {
              mediaType = 'image';
            }
          } else if (files.media && files.media[0]) {
            mediaFile = files.media[0];
            if (mediaFile.mimetype.startsWith('audio/')) {
              mediaType = 'audio';
            } else if (mediaFile.mimetype.startsWith('image/')) {
              mediaType = 'image';
            }
          }

          if (mediaFile && mediaType) {
            logger.info('Processing media file:', {
              type: mediaType,
              originalname: mediaFile.originalname,
              mimetype: mediaFile.mimetype,
              size: mediaFile.size
            });

            if (mediaType === 'audio') {
              mediaResult = await this.storageService.uploadQuestionAudio(mediaFile, questionIdStr);
            } else {
              mediaResult = await this.storageService.uploadQuestionImage(mediaFile, questionIdStr);
            }

            // Actualizar la pregunta con la URL del media
            await this.questionService.update(questionIdStr, {
              'content.mediaUrl': mediaResult.url,
              'content.mediaType': mediaType
            } as Record<string, unknown>);

            // Obtener la pregunta actualizada
            const updatedQuestion = await this.questionService.findById(questionIdStr);

            logger.info('Media uploaded successfully:', {
              questionId: questionIdStr,
              mediaType,
              mediaUrl: mediaResult.url
            });

            res.status(201).json({
              success: true,
              message: `Pregunta creada exitosamente con ${mediaType}`,
              data: updatedQuestion
            });
            return;
          } else {
            logger.warn('No valid media file found in request');
            res.status(201).json({
              success: true,
              message: 'Pregunta creada exitosamente (sin multimedia válida)',
              data: question
            });
            return;
          }
        } catch (mediaError) {
          logger.error('Error processing media file:', mediaError);
          // Si falla la subida del archivo, eliminar la pregunta creada
          try {
            await this.questionService.delete(questionIdStr);
          } catch (deleteError) {
            logger.error('Error deleting question after media failure:', deleteError);
          }
          throw mediaError;
        }
      } else {
        // Si no hay archivos, devolver la pregunta creada
        logger.info('No files provided, returning question without media');
        res.status(201).json({
          success: true,
          message: 'Pregunta creada exitosamente',
          data: question
        });
        return; 
      }
    } catch (error) {
      logger.error('Error in question creation with media:', error);
      next(error);
    }
  };

  findAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page = 1, limit = 10, type, competency, level, difficulty, tags, isActive } = req.query;
      
      const filters = {
        type,
        competency,
        level,
        difficulty: difficulty ? Number(difficulty) : undefined,
        tags,
        isActive: isActive === 'true'
      };

      const result = await this.questionService.findAll(
        filters,
        Number(page),
        Number(limit)
      );

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Error fetching questions:', error);
      next(error);
    }
  };

  findById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const questionId = req.params.id as string;
      const question = await this.questionService.findById(questionId);

      if (!question) {
        res.status(404).json({
          success: false,
          message: 'Pregunta no encontrada'
        });
        return;
      }

      res.json({
        success: true,
        data: question
      });
    } catch (error) {
      logger.error('Error fetching question:', error);
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const updateId = req.params.id as string;
      const question = await this.questionService.update(updateId, req.body as any);

      if (!question) {
        res.status(404).json({
          success: false,
          message: 'Pregunta no encontrada'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Pregunta actualizada exitosamente',
        data: question
      });
    } catch (error) {
      logger.error('Error updating question:', error);
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const deleteId = req.params.id as string;
      const deleted = await this.questionService.delete(deleteId);

      if (!deleted) {
        res.status(404).json({
          success: false,
          message: 'Pregunta no encontrada'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Pregunta eliminada exitosamente'
      });
    } catch (error) {
      logger.error('Error deleting question:', error);
      next(error);
    }
  };

  importQuestions = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        res.status(400).json({
          success: false,
          message: 'No se proporcionó ningún archivo'
        });
        return;
      }

      const result = await this.importService.importQuestionsFromFile(
        req.file,
        req.user.id
      );

      res.json({
        success: true,
        message: `Importación completada: ${result.success} exitosas, ${result.failed} fallidas`,
        data: result
      });
    } catch (error) {
      logger.error('Error importing questions:', error);
      next(error);
    }
  };

  importQuestionsFromData = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const questions = req.body.questions || [];
      
      if (!Array.isArray(questions) || questions.length === 0) {
        res.status(400).json({
          success: false,
          message: 'No se proporcionaron preguntas para importar'
        });
        return;
      }

      const result = await this.questionService.importQuestions(questions);

      res.json({
        success: true,
        message: `Importación completada: ${result.success} exitosas, ${result.failed} fallidas`,
        data: result
      });
    } catch (error) {
      logger.error('Error importing questions from data:', error);
      next(error);
    }
  };

  downloadTemplate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const format = (req.query.format as string) || 'xlsx';

      if (format === 'csv') {
        const csvContent = this.importService.generateCSVTemplate();
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="questions_template.csv"');
        res.send(csvContent);
      } else {
        const excelBuffer = this.importService.generateExcelTemplate();
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="questions_template.xlsx"');
        res.send(excelBuffer);
      }
    } catch (error) {
      logger.error('Error generating template:', error);
      next(error);
    }
  };

  uploadAudio = async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Debug logging mejorado
      logger.info('Upload audio request received:', {
        hasFile: !!req.file,
        contentType: req.headers['content-type'],
        contentLength: req.headers['content-length'],
        questionId: req.params.id,
        file: req.file ? {
          originalname: req.file.originalname,
          mimetype: req.file.mimetype,
          size: req.file.size,
          fieldname: req.file.fieldname
        } : 'No file'
      });

      if (!req.file) {
        logger.error('No audio file received in upload request:', {
          headers: Object.keys(req.headers),
          body: Object.keys(req.body),
          params: req.params
        });

        res.status(400).json({
          success: false,
          message: 'No se proporcionó ningún archivo de audio',
          debug: {
            contentType: req.headers['content-type'],
            contentLength: req.headers['content-length'],
            bodyKeys: Object.keys(req.body),
            expectedField: 'audio'
          }
        });
        return;
      }

      const questionId = req.params.id as string;
      if (!questionId) {
        res.status(400).json({
          success: false,
          message: 'ID de pregunta no proporcionado'
        });
        return;
      }

      logger.info('Processing audio upload:', {
        questionId,
        filename: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size
      });

      const result = await this.storageService.uploadQuestionAudio(req.file, questionId);

      // Update question with audio URL and media type
      await this.questionService.update(questionId, {
        'content.mediaUrl': result.url,
        'content.mediaType': 'audio'
      } as Record<string, unknown>);

      logger.info('Audio uploaded successfully:', {
        questionId,
        url: result.url,
        key: result.key
      });

      res.json({
        success: true,
        message: 'Archivo de audio subido exitosamente',
        data: {
          url: result.url,
          key: result.key
        }
      });
    } catch (error) {
      logger.error('Error uploading question audio:', error);
      next(error);
    }
  };

  uploadImage = async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Debug logging mejorado
      logger.info('Upload image request received:', {
        hasFile: !!req.file,
        contentType: req.headers['content-type'],
        contentLength: req.headers['content-length'],
        questionId: req.params.id,
        file: req.file ? {
          originalname: req.file.originalname,
          mimetype: req.file.mimetype,
          size: req.file.size,
          fieldname: req.file.fieldname
        } : 'No file'
      });

      if (!req.file) {
        logger.error('No image file received in upload request:', {
          headers: Object.keys(req.headers),
          body: Object.keys(req.body),
          params: req.params
        });

        res.status(400).json({
          success: false,
          message: 'No se proporcionó ninguna imagen',
          debug: {
            contentType: req.headers['content-type'],
            contentLength: req.headers['content-length'],
            bodyKeys: Object.keys(req.body),
            expectedField: 'image'
          }
        });
        return;
      }

      const questionId = req.params.id as string;
      if (!questionId) {
        res.status(400).json({
          success: false,
          message: 'ID de pregunta no proporcionado'
        });
        return;
      }

      logger.info('Processing image upload:', {
        questionId,
        filename: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size
      });

      const result = await this.storageService.uploadQuestionImage(req.file, questionId);

      // Update question with image URL and media type
      await this.questionService.update(questionId, {
        'content.mediaUrl': result.url,
        'content.mediaType': 'image'
      } as Record<string, unknown>);

      logger.info('Image uploaded successfully:', {
        questionId,
        url: result.url,
        key: result.key
      });

      res.json({
        success: true,
        message: 'Imagen subida exitosamente',
        data: {
          url: result.url,
          key: result.key
        }
      });
    } catch (error) {
      logger.error('Error uploading question image:', error);
      next(error);
    }
  };

  getMedia = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const questionId = req.params.id as string;
      const media = await this.storageService.getQuestionMedia(questionId);

      res.json({
        success: true,
        data: media
      });
    } catch (error) {
      logger.error('Error fetching question media:', error);
      next(error);
    }
  };
}
