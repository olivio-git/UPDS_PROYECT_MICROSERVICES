import { cache } from '../config/redis';
import { IQuestion, Question } from '../models/question.model';
import { CONSTANTS } from '../utils/constants';
import { logger } from '../utils/logger';
import { KafkaService } from './kafka.service';

export class QuestionService {
  private kafkaService: KafkaService;

  constructor() {
    this.kafkaService = new KafkaService();
  }

  async create(questionData: Partial<IQuestion>, hasAudioFile: boolean = false): Promise<IQuestion> {
    try {
      // Validaciones específicas por tipo de pregunta
      this.validateQuestionData(questionData, hasAudioFile);

      const question = new Question(questionData);
      await question.save();

      await this.kafkaService.publishEvent('question.created', {
        questionId: question._id,
        type: question.type,
        competency: question.competency,
        level: question.level,
        createdBy: question.createdBy,
        hasMediaFile: hasAudioFile
      });

      logger.info(`Question created: ${question._id}`);
      return question;
    } catch (error) {
      logger.error('Error creating question:', error);
      throw error;
    }
  }

  // Método específico para crear preguntas con multimedia
  async createWithMedia(questionData: Partial<IQuestion>, hasAudioFile: boolean = false, hasImageFile: boolean = false): Promise<IQuestion> {
    try {
      // Usar el método create con el flag de audio presente
      return await this.create(questionData, hasAudioFile);
    } catch (error) {
      logger.error('Error creating question with media:', error);
      throw error;
    }
  }

  private validateQuestionData(data: Partial<IQuestion>, hasAudioFile: boolean = false): void {
    if (!data.content?.question?.trim()) {
      throw new Error('La pregunta es requerida');
    }

    // Validación de combinaciones lógicas
    if (data.type === 'audio_response' && data.competency === 'listening') {
      throw new Error('No puedes combinar "Respuesta de Audio" con "Comprensión Auditiva". Usa "Expresión Oral" para audio_response.');
    }
    
    if (data.type === 'audio_response' && data.competency !== 'speaking') {
      throw new Error('"Respuesta de Audio" debe usarse con competencia "Expresión Oral"');
    }

    if (data.type === 'multiple_choice' && (!data.content?.options || data.content.options.length < 2)) {
      throw new Error('Las preguntas de opción múltiple necesitan al menos 2 opciones');
    }

    if (data.type === 'true_false' && (!data.content?.options || data.content.options.length !== 2)) {
      throw new Error('Las preguntas verdadero/falso necesitan exactamente 2 opciones');
    }

    // Validación mejorada para listening: considera si hay archivo de audio presente
    if (data.competency === 'listening' && data.type !== 'audio_response' && !data.content?.mediaUrl && !hasAudioFile) {
      throw new Error('Las preguntas de listening requieren audio para que el estudiante escuche');
    }

    if (data.type === 'fill_blanks' && !data.content?.template?.includes('___')) {
      throw new Error('Las preguntas de completar espacios necesitan al menos un espacio marcado con ___');
    }

    if (data.type === 'matching' && (!data.content?.items || data.content.items.length < 2)) {
      throw new Error('Las preguntas de emparejar necesitan al menos 2 elementos');
    }

    if (data.type === 'ordering' && (!data.content?.items || data.content.items.length < 3)) {
      throw new Error('Las preguntas de ordenar necesitan al menos 3 elementos');
    }

    if (data.type === 'drag_drop' && (!data.content?.items || data.content.items.length < 2)) {
      throw new Error('Las preguntas de arrastrar y soltar necesitan al menos 2 elementos');
    }

    if (data.type === 'audio_response' && !data.content?.expectedResponseType) {
      throw new Error('Las preguntas de respuesta de audio necesitan especificar el tipo de respuesta esperada');
    }
  }

  async findById(id: string): Promise<IQuestion | null> {
    try {
      const cacheKey = `question:${id}`;
      const cached = await cache.get(cacheKey);
      
      if (cached) {
        return cached;
      }

      // Remove populate for User model since it doesn't exist in this service
      const question = await Question.findById(id)
        .populate('metadata.rubricId');
      
      if (question) {
        await cache.set(cacheKey, question, CONSTANTS.CACHE_TTL.MEDIUM);
      }

      return question;
    } catch (error) {
      logger.error(`Error finding question ${id}:`, error);
      throw error;
    }
  }

  async findAll(filters: any = {}, page = 1, limit = 10) {
    try {
      const skip = (page - 1) * limit;
      
      const query: any = { isActive: true };
      
      if (filters.type) query.type = filters.type;
      if (filters.competency) query.competency = filters.competency;
      if (filters.level) query.level = filters.level;
      if (filters.difficulty) query.difficulty = filters.difficulty;
      if (filters.tags) {
        query['metadata.tags'] = { $in: filters.tags.split(',') };
      }

      // Remove populate for User model
      const [questions, total] = await Promise.all([
        Question.find(query)
          .skip(skip)
          .limit(limit)
          .sort({ createdAt: -1 }),
        Question.countDocuments(query)
      ]);

      return {
        questions,
        total,
        page,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      logger.error('Error finding questions:', error);
      throw error;
    }
  }

  async update(id: string, updateData: Partial<IQuestion>): Promise<IQuestion | null> {
    try {
      const question = await Question.findByIdAndUpdate(
        id,
        { $set: updateData },
        { new: true, runValidators: true }
      );

      if (question) {
        // Clear cache
        await cache.del(`question:${id}`);
        
        await this.kafkaService.publishEvent('question.updated', {
          questionId: question._id,
          changes: Object.keys(updateData)
        });
      }

      return question;
    } catch (error) {
      logger.error(`Error updating question ${id}:`, error);
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const question = await Question.findByIdAndUpdate(
        id,
        { isActive: false },
        { new: true }
      );

      if (question) {
        await cache.del(`question:${id}`);
        
        await this.kafkaService.publishEvent('question.deleted', {
          questionId: question._id
        });
        return true;
      }

      return false;
    } catch (error) {
      logger.error(`Error deleting question ${id}:`, error);
      throw error;
    }
  }

  async findByCompetencyAndLevel(competency: string, level: string): Promise<IQuestion[]> {
    try {
      return await Question.find({
        competency,
        level,
        isActive: true
      }).sort({ difficulty: 1 });
    } catch (error) {
      logger.error('Error finding questions by competency and level:', error);
      throw error;
    }
  }

  async getQuestionStats(filters?: { level?: string; competency?: string }): Promise<any> {
    try {
      const pipeline = [
        {
          $match: {
            isActive: true,
            ...(filters?.level && { level: filters.level }),
            ...(filters?.competency && { competency: filters.competency })
          }
        },
        {
          $group: {
            _id: {
              competency: '$competency',
              level: '$level',
              type: '$type'
            },
            count: { $sum: 1 }
          }
        },
        {
          $group: {
            _id: {
              competency: '$_id.competency',
              level: '$_id.level'
            },
            totalQuestions: { $sum: '$count' },
            questionTypes: {
              $push: {
                type: '$_id.type',
                count: '$count'
              }
            }
          }
        },
        {
          $group: {
            _id: '$_id.competency',
            levels: {
              $push: {
                level: '$_id.level',
                totalQuestions: '$totalQuestions',
                questionTypes: '$questionTypes'
              }
            },
            totalByCompetency: { $sum: '$totalQuestions' }
          }
        },
        {
          $sort: { _id: 1 as 1 }
        }
      ];

      const stats = await Question.aggregate(pipeline);

      // Estructura de respuesta optimizada para el frontend
      const result = {
        byCompetency: {} as Record<string, Record<string, number>>,
        summary: stats
      };

      // Crear estructura fácil de consultar: { competency: { level: count } }
      stats.forEach((competency: any) => {
        if (competency._id) {
          const compKey = String(competency._id);
          // Asegurar que el mapa interno exista para evitar "Object is possibly 'undefined'"
          let compEntry = result.byCompetency[compKey];
          if (!compEntry) {
            compEntry = {};
            result.byCompetency[compKey] = compEntry;
          }
          competency.levels?.forEach((levelData: any) => {
            if (levelData.level) {
              const levelKey = String(levelData.level);
              compEntry[levelKey] = levelData.totalQuestions ?? 0;
            }
          });
        }
      });

      return result;
    } catch (error) {
      logger.error('Error getting question stats:', error);
      throw error;
    }
  }

  async updateStatistics(id: string, score: number, timeSpent: number): Promise<void> {
    try {
      const question = await Question.findById(id);
      if (!question) return;

      const stats = question.statistics;
      const newTimesUsed = stats.timesUsed + 1;
      const newAverageScore = ((stats.averageScore * stats.timesUsed) + score) / newTimesUsed;
      const newAverageTime = ((stats.averageTime * stats.timesUsed) + timeSpent) / newTimesUsed;

      await Question.findByIdAndUpdate(id, {
        $set: {
          'statistics.timesUsed': newTimesUsed,
          'statistics.averageScore': newAverageScore,
          'statistics.averageTime': newAverageTime,
          lastUsed: new Date()
        }
      });

      await cache.del(`question:${id}`);
    } catch (error) {
      logger.error(`Error updating question statistics ${id}:`, error);
    }
  }

  async importQuestions(questions: Partial<IQuestion>[]): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (const questionData of questions) {
      try {
        await this.create(questionData);
        success++;
      } catch (error) {
        logger.error('Error importing question:', error);
        failed++;
      }
    }

    return { success, failed };
  }
}