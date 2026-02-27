import { NextFunction, Request, Response } from 'express';
import { ImportService } from '../services/import.service';
import { QuestionService } from '../services/question.service';
import { StorageService } from '../services/storage.service';
import { logger } from '../utils/logger';

export class QuestionController {
  private questionService: QuestionService;
  private importService: ImportService;
  private storageService: StorageService;

  constructor() {
    this.questionService = new QuestionService();
    this.importService = new ImportService();
    this.storageService = new StorageService();
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const questionData = {
        ...req.body,
        createdBy: (req as any).user?.id
      };

      const question = await this.questionService.create(questionData as any);

      res.status(201).json({
        success: true,
        message: 'Pregunta creada exitosamente',
        data: question
      });
    } catch (error) {
      logger.error('Error in question creation:', error);
      next(error);
    }
  }

  // Crear pregunta con múltiples archivos multimedia (para items)
  async createQuestionWithMultipleMedia(req: Request, res: Response, next: NextFunction) {
    try {
      console.log('=== DEBUG: createQuestionWithMultipleMedia ===');
      console.log('Body received:', req.body);
      console.log('Files received:', req.files);
      console.log('Files array length:', Array.isArray(req.files) ? req.files.length : 'Not array');
      
      // Parsear los datos de la pregunta
      let questionData: any;
      try {
        const jsonData = req.body.question || JSON.stringify(req.body);
        questionData = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
        console.log('Parsed question data:', questionData);
      } catch (parseError) {
        console.error('Parse error:', parseError);
        res.status(400).json({
          success: false,
          message: 'Los datos de la pregunta deben ser un JSON válido'
        });
        return;
      }

      questionData.createdBy = (req as any).user?.id;

      // Limpiar URLs blob temporales que pueden haber sido incluidas por el cliente
      if (questionData?.content) {
        // mediaUrl principal
        if (typeof questionData.content.mediaUrl === 'string' && questionData.content.mediaUrl.startsWith('blob:')) {
          delete questionData.content.mediaUrl;
          delete questionData.content.mediaType;
        }

        // items
        if (Array.isArray(questionData.content.items)) {
          questionData.content.items = questionData.content.items.map((item: any) => {
            if (item && typeof item.mediaUrl === 'string' && item.mediaUrl.startsWith('blob:')) {
              const copy = { ...item };
              delete copy.mediaUrl;
              delete copy.mediaType;
              return copy;
            }
            return item;
          });
        }
      }

      // Verificar archivos multimedia - usar Array porque usamos uploadMultimediaAny.any()
      // ...existing code...
      const files = req.files as Express.Multer.File[];
      console.log('Files processed as array:', files);
      
      const hasMainAudio = files && files.find(f => f.fieldname === 'audio');
      const hasMainImage = files && files.find(f => f.fieldname === 'image');
      console.log('Main files detected:', { hasMainAudio: !!hasMainAudio, hasMainImage: !!hasMainImage });
      
      // Verificar si hay archivos de elementos (item_audio_0, item_image_1, etc.)
      const itemFiles: { [itemIndex: number]: { audio?: Express.Multer.File, image?: Express.Multer.File } } = {};
      
      if (files && Array.isArray(files)) {
        files.forEach(file => {
          console.log('Processing file:', { fieldname: file.fieldname, originalname: file.originalname });
          const match = file.fieldname.match(/^item_(audio|image)_(\d+)$/);
          if (match) {
            const [, type, index] = match;
            const itemIndex = parseInt(index!, 10);
            console.log(`Found item file: ${type} for item ${itemIndex}`);
            if (!itemFiles[itemIndex]) itemFiles[itemIndex] = {};
            itemFiles[itemIndex][type as 'audio' | 'image'] = file;
          }
        });
      }
      
      console.log('Item files detected:', Object.keys(itemFiles).length);
      console.log('Item files details:', itemFiles);

      // --- Fix: convertir a booleanos antes de pasar a createWithMedia ---
      const hasAnyMainOrItemMedia = !!hasMainAudio || Object.keys(itemFiles).length > 0;
      const hasMainImageBool = !!hasMainImage;

      // Crear la pregunta con información de archivos
      const question = await this.questionService.createWithMedia(
        questionData, 
        hasAnyMainOrItemMedia,
        hasMainImageBool
      ); 
      const questionIdStr = (question as any).id || String((question as any)._id);
      console.log('Question created with ID:', questionIdStr);

      try {
        // Subir archivo principal si existe
        if (hasMainAudio) {
          console.log('Uploading main audio...');
          const audioResult = await this.storageService.uploadQuestionAudio(hasMainAudio, questionIdStr);
          await this.questionService.update(questionIdStr, {
            'content.mediaUrl': audioResult.url,
            'content.mediaType': 'audio'
          } as Record<string, unknown>);
        } else if (hasMainImage) {
          console.log('Uploading main image...');
          const imageResult = await this.storageService.uploadQuestionImage(hasMainImage, questionIdStr);
          await this.questionService.update(questionIdStr, {
            'content.mediaUrl': imageResult.url,
            'content.mediaType': 'image'
          } as Record<string, unknown>);
        }

        // Subir archivos de elementos individuales
        const updatedItems = [...(questionData.content?.items || [])];
        for (const [itemIndexStr, itemFileData] of Object.entries(itemFiles)) {
          const itemIndex = parseInt(itemIndexStr);
          console.log(`Processing item ${itemIndex}:`, itemFileData);
          
          if (itemIndex < updatedItems.length) {
            let mediaUrl = '';
            
            if (itemFileData.audio) {
              console.log(`Uploading audio for item ${itemIndex}`);
              const audioResult = await this.storageService.uploadQuestionAudio(
                itemFileData.audio, 
                `${questionIdStr}_item_${itemIndex}`
              );
              mediaUrl = audioResult.url;
              console.log(`Audio uploaded for item ${itemIndex}:`, mediaUrl);
            } else if (itemFileData.image) {
              console.log(`Uploading image for item ${itemIndex}`);
              const imageResult = await this.storageService.uploadQuestionImage(
                itemFileData.image, 
                `${questionIdStr}_item_${itemIndex}`
              );
              mediaUrl = imageResult.url;
              console.log(`Image uploaded for item ${itemIndex}:`, mediaUrl);
            }

            if (mediaUrl) {
              // Determine mediaType for this item (audio preferred)
              const mediaTypeForItem = itemFileData.audio ? 'audio' : itemFileData.image ? 'image' : undefined;
              updatedItems[itemIndex] = {
                ...updatedItems[itemIndex],
                mediaUrl,
                ...(mediaTypeForItem ? { mediaType: mediaTypeForItem } : {})
              };
              console.log(`Updated item ${itemIndex} with mediaUrl:`, mediaUrl, 'mediaType:', mediaTypeForItem);
            }
          }
        }

        // Actualizar la pregunta con las URLs de los items
        if (Object.keys(itemFiles).length > 0) {
          console.log('Updating question with item URLs:', updatedItems);
          await this.questionService.update(questionIdStr, {
            'content.items': updatedItems
          } as Record<string, unknown>);
        }

        // Obtener la pregunta final actualizada
        const finalQuestion = await this.questionService.findById(questionIdStr);
        console.log('Final question created:', finalQuestion);

        res.status(201).json({
          success: true,
          message: 'Pregunta creada exitosamente con multimedia',
          data: finalQuestion
        });
      } catch (mediaError) {
        console.error('Media upload error:', mediaError);
        // Si falla la subida, eliminar la pregunta creada
        await this.questionService.delete(questionIdStr);
        throw mediaError;
      }
    } catch (error) {
      console.error('Error in question creation with multiple media:', error);
      logger.error('Error in question creation with multiple media:', error);
      next(error);
    }
  }

  // Crear pregunta con multimedia en una sola petición
  async createWithMedia(req: Request, res: Response, next: NextFunction) {
    try {
      // Parsear los datos de la pregunta
      let questionData: any;
      try {
        const jsonData = req.body.question || JSON.stringify(req.body);
        questionData = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
      } catch (parseError) {
        res.status(400).json({
          success: false,
          message: 'Los datos de la pregunta deben ser un JSON válido'
        });
        return;
      }

      questionData.createdBy = (req as any).user?.id;

      // Verificar si hay archivos
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      const hasAudio = !!(files && files.audio && files.audio[0]);
      const hasImage = !!(files && files.image && files.image[0]);

      // Crear la pregunta
      const question = await this.questionService.createWithMedia(questionData, hasAudio, hasImage);
      const questionIdStr = (question as any).id || String((question as any)._id);

      try {
        // Subir archivos
        if (hasAudio && files.audio) {
          const audioResult = await this.storageService.uploadQuestionAudio(files.audio[0]!, questionIdStr);
          await this.questionService.update(questionIdStr, {
            'content.mediaUrl': audioResult.url,
            'content.mediaType': 'audio'
          } as Record<string, unknown>);
        } else if (hasImage && files.image) {
          const imageResult = await this.storageService.uploadQuestionImage(files.image[0]!, questionIdStr);
          await this.questionService.update(questionIdStr, {
            'content.mediaUrl': imageResult.url,
            'content.mediaType': 'image'
          } as Record<string, unknown>);
        }

        // Obtener la pregunta final
        const finalQuestion = await this.questionService.findById(questionIdStr);

        res.status(201).json({
          success: true,
          message: 'Pregunta creada exitosamente con multimedia',
          data: finalQuestion
        });
      } catch (mediaError) {
        // Si falla la subida, eliminar la pregunta creada
        await this.questionService.delete(questionIdStr);
        throw mediaError;
      }
    } catch (error) {
      logger.error('Error in question creation with media:', error);
      next(error);
    }
  }

  async findAll(req: Request, res: Response, next: NextFunction) {
    try {
      // Extraer parámetros de paginación
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;

      // Crear objeto de filtros sin page y limit
      const filters = { ...req.query };
      delete filters.page;
      delete filters.limit;

      const result = await this.questionService.findAll(filters as any, page, limit);
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async findById(req: Request, res: Response, next: NextFunction) {
    try {
      const question = await this.questionService.findById(req.params.id!);
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
      next(error);
    }
  }

  async getQuestionStats(req: Request, res: Response, next: NextFunction) {
    try {
      const { level, competency } = req.query;
      const filters: any = {};

      if (level) filters.level = level as string;
      if (competency) filters.competency = competency as string;

      const stats = await this.questionService.getQuestionStats(filters);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      logger.error('Error fetching question stats:', error);
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const question = await this.questionService.update(req.params.id!, req.body);
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
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const question = await this.questionService.delete(req.params.id!);
      if (!question) {
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
      next(error);
    }
  }

  // Importación de preguntas desde archivo
  async importQuestions(req: Request, res: Response, next: NextFunction) {
    const userId = req.user?.id;
    try {
      if (!req.file) {
        res.status(400).json({
          success: false,
          message: 'No se proporcionó ningún archivo'
        });
        return;
      }

      const result = await this.importService.importQuestionsFromFile(req.file, userId!);
      
      res.json({
        success: true,
        message: `Preguntas importadas: ${result.imported} exitosas, ${result.errors} errores`,
        data: result
      });
    } catch (error) {
      logger.error('Error importing questions:', error);
      next(error);
    }
  }

  // // Importación de preguntas desde datos JSON
  // async importQuestionsFromData(req: Request, res: Response, next: NextFunction) {
  //   const userId = req.user?.id;
  //   try {
  //     const { questions } = req.body;
  //     if (!Array.isArray(questions)) {
  //       res.status(400).json({
  //         success: false,
  //         message: 'Se esperaba un array de preguntas'
  //       });
  //       return;
  //     }

  //     const result = await this.importService.importQuestionsFromData(questions, userId!);

  //     res.json({
  //       success: true,
  //       message: `Preguntas importadas: ${result.imported} exitosas, ${result.errors} errores`,
  //       data: result
  //     });
  //   } catch (error) {
  //     logger.error('Error importing questions from data:', error);
  //     next(error);
  //   }
  // }

  // // Descargar plantilla
  // async downloadTemplate(req: Request, res: Response, next: NextFunction) {
  //   try {
  //     const buffer = await this.importService.generateTemplate();
      
  //     res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  //     res.setHeader('Content-Disposition', 'attachment; filename=plantilla_preguntas.xlsx');
  //     res.send(buffer);
  //   } catch (error) {
  //     logger.error('Error generating template:', error);
  //     next(error);
  //   }
  // }

  async uploadAudio(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.file) {
        res.status(400).json({
          success: false,
          message: 'No se proporcionó ningún archivo de audio'
        });
        return;
      }

      const questionId = req.params.id as string;
      const result = await this.storageService.uploadQuestionAudio(req.file, questionId);

      // Update question with audio URL and media type
      await this.questionService.update(questionId, {
        'content.mediaUrl': result.url,
        'content.mediaType': 'audio'
      } as Record<string, unknown>);

      res.json({
        success: true,
        message: 'Audio subido exitosamente',
        data: {
          url: result.url,
          key: result.key
        }
      });
    } catch (error) {
      logger.error('Error uploading question audio:', error);
      next(error);
    }
  }

  async uploadImage(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.file) {
        res.status(400).json({
          success: false,
          message: 'No se proporcionó ninguna imagen'
        });
        return;
      }

      const questionId = req.params.id as string;
      const result = await this.storageService.uploadQuestionImage(req.file, questionId);

      // Update question with image URL and media type
      await this.questionService.update(questionId, {
        'content.mediaUrl': result.url,
        'content.mediaType': 'image'
      } as Record<string, unknown>);

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
      return;
    }
  }

  async getMedia(req: Request, res: Response, next: NextFunction) {
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
  }
}
