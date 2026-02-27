import { Types } from 'mongoose';
import { Exam, IExam } from '../models/exam.model';
import { Question } from '../models/question.model';
import { logger } from '../utils/logger';
import { KafkaService } from './kafka.service';

export class ExamService {
  private kafkaService: KafkaService;

  constructor() {
    this.kafkaService = new KafkaService();
  }

  async create(examData: Partial<IExam>): Promise<IExam> {
    try {
      const exam = new Exam(examData);
      await exam.save();

      // Publish event
      await this.kafkaService.publishEvent('exam.created', {
        examId: exam._id,
        name: exam.name,
        type: exam.type,
        level: exam.targetLevel,
        createdBy: exam.createdBy
      });

      logger.info(`Exam created: ${exam._id}`);
      return exam;
    } catch (error) {
      logger.error('Error creating exam:', error);
      throw error;
    }
  }

  async findById(id: string): Promise<IExam | null> {
    try {
      // Mock exams para desarrollo
      const mockExams: any = {
        '507f1f77bcf86cd799439020': {
          _id: '507f1f77bcf86cd799439020',
          name: 'Evaluación de Nivelación A1-A2',
          description: 'Examen para determinar el nivel inicial del estudiante entre A1 y A2',
          type: 'placement',
          targetLevel: 'A2',
          structure: {
            sections: [
              { name: 'Listening', competency: 'listening', duration: 15, questionCount: 10, weight: 25 },
              { name: 'Reading', competency: 'reading', duration: 20, questionCount: 15, weight: 25 },
              { name: 'Writing', competency: 'writing', duration: 25, questionCount: 5, weight: 25 },
              { name: 'Speaking', competency: 'speaking', duration: 15, questionCount: 5, weight: 25 }
            ],
            totalDuration: 75,
            passingScore: 60
          },
          configuration: {
            randomizeQuestions: true,
            allowReview: false,
            showResults: true,
            attemptsAllowed: 1,
            timeBetweenAttempts: 24
          },
          questionPool: [],
          isActive: true,
          isTemplate: false
        },
        '507f1f77bcf86cd799439021': {
          _id: '507f1f77bcf86cd799439021',
          name: 'Examen de Progreso B1',
          description: 'Evaluación intermedia para estudiantes de nivel B1',
          type: 'progress',
          targetLevel: 'B1',
          structure: {
            sections: [
              { name: 'Grammar & Vocabulary', competency: 'reading', duration: 30, questionCount: 20, weight: 30 },
              { name: 'Listening', competency: 'listening', duration: 25, questionCount: 15, weight: 25 },
              { name: 'Writing', competency: 'writing', duration: 35, questionCount: 2, weight: 25 },
              { name: 'Speaking', competency: 'speaking', duration: 20, questionCount: 3, weight: 20 }
            ],
            totalDuration: 110,
            passingScore: 70
          },
          configuration: {
            randomizeQuestions: true,
            allowReview: true,
            showResults: true,
            attemptsAllowed: 2,
            timeBetweenAttempts: 48
          },
          questionPool: [],
          isActive: true,
          isTemplate: false
        },
        '507f1f77bcf86cd799439022': {
          _id: '507f1f77bcf86cd799439022',
          name: 'Examen Final B2',
          description: 'Evaluación final para certificación de nivel B2',
          type: 'final',
          targetLevel: 'B2',
          structure: {
            sections: [
              { name: 'Reading', competency: 'reading', duration: 45, questionCount: 25, weight: 25 },
              { name: 'Listening', competency: 'listening', duration: 40, questionCount: 20, weight: 25 },
              { name: 'Writing', competency: 'writing', duration: 60, questionCount: 2, weight: 25 },
              { name: 'Speaking', competency: 'speaking', duration: 25, questionCount: 4, weight: 25 }
            ],
            totalDuration: 170,
            passingScore: 75
          },
          configuration: {
            randomizeQuestions: true,
            allowReview: false,
            showResults: false,
            attemptsAllowed: 1,
            timeBetweenAttempts: 0
          },
          questionPool: [],
          isActive: true,
          isTemplate: false
        }
      };

      // Si es un ID mock, devolver el examen mock
      if (mockExams[id]) {
        return mockExams[id];
      }

      // Si no, buscar en la BD
      return await Exam.findById(id)
        .populate('questionPool');
    } catch (error) {
      logger.error(`Error finding exam ${id}:`, error);
      throw error;
    }
  }

  async findAll(filters: any = {}, page = 1, limit = 10) {
    try {
      const skip = (page - 1) * limit;
      const query: any = { isActive: true };

      if (filters.type) query.type = filters.type;
      if (filters.level) query.targetLevel = filters.level;
      if (filters.isTemplate !== undefined) query.isTemplate = filters.isTemplate;

      const [exams, total] = await Promise.all([
        Exam.find(query)
          .skip(skip)
          .limit(limit)
          .sort({ createdAt: -1 }),
        Exam.countDocuments(query)
      ]);

      return {
        exams,
        total,
        page,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      logger.error('Error finding exams:', error);
      throw error;
    }
  }

  async update(id: string, updateData: Partial<IExam>): Promise<IExam | null> {
    try {
      const exam = await Exam.findByIdAndUpdate(
        id,
        { $set: updateData },
        { new: true, runValidators: true }
      );

      if (exam) {
        await this.kafkaService.publishEvent('exam.updated', {
          examId: exam._id,
          changes: Object.keys(updateData)
        });
      }

      return exam;
    } catch (error) {
      logger.error(`Error updating exam ${id}:`, error);
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const exam = await Exam.findByIdAndUpdate(
        id,
        { isActive: false },
        { new: true }
      );

      if (exam) {
        await this.kafkaService.publishEvent('exam.deleted', {
          examId: exam._id
        });
        return true;
      }

      return false;
    } catch (error) {
      logger.error(`Error deleting exam ${id}:`, error);
      throw error;
    }
  }

  async generateQuestions(examId: string, candidateId: string): Promise<any[]> {
    try {
      const exam = await this.findById(examId);
      if (!exam) throw new Error('Exam not found');

      const questions = [];
      
      for (const section of exam.structure.sections) {
        const sectionQuestions = await Question.find({
          _id: { $in: exam.questionPool },
          competency: section.competency,
          level: exam.targetLevel,
          isActive: true
        }).limit(section.questionCount);

        questions.push({
          section: section.name,
          questions: sectionQuestions
        });
      }

      // Shuffle questions if configured
      if (exam.configuration.randomizeQuestions) {
        questions.forEach(section => {
          section.questions = this.shuffleArray(section.questions);
        });
      }

      await this.kafkaService.publishEvent('exam.questions.generated', {
        examId,
        candidateId,
        questionCount: questions.reduce((acc, s) => acc + s.questions.length, 0)
      });

      return questions;
    } catch (error) {
      logger.error(`Error generating questions for exam ${examId}:`, error);
      throw error;
    }
  }

  async assignQuestionsToExam(examId: string, questionIds: string[]): Promise<IExam | null> {
    try {
      const exam = await Exam.findById(examId);
      if (!exam) throw new Error('Exam not found');

      // Verificar que las preguntas existen
      const questions = await Question.find({
        _id: { $in: questionIds },
        isActive: true
      });

      if (questions.length !== questionIds.length) {
        throw new Error('Some questions were not found or are inactive');
      }

      // Agregar las preguntas al pool del examen (evitar duplicados)
      const currentPool = exam.questionPool || [];
      const newQuestionIds = questionIds.filter(
        id => !currentPool.some(poolId => poolId.toString() === id)
      );

      exam.questionPool = [...currentPool, ...newQuestionIds.map(id => new Types.ObjectId(id))];
      await exam.save();

      await this.kafkaService.publishEvent('exam.questions.assigned', {
        examId: exam._id,
        questionIds: newQuestionIds,
        totalQuestions: exam.questionPool.length
      });

      logger.info(`Assigned ${newQuestionIds.length} questions to exam ${examId}`);
      return exam;
    } catch (error) {
      logger.error(`Error assigning questions to exam ${examId}:`, error);
      throw error;
    }
  }

  async removeQuestionsFromExam(examId: string, questionIds: string[]): Promise<IExam | null> {
    try {
      const exam = await Exam.findById(examId);
      if (!exam) throw new Error('Exam not found');

      // Filtrar las preguntas que se van a remover
      exam.questionPool = exam.questionPool.filter(
        poolId => !questionIds.includes(poolId.toString())
      );
      
      await exam.save();

      await this.kafkaService.publishEvent('exam.questions.removed', {
        examId: exam._id,
        removedQuestionIds: questionIds,
        remainingQuestions: exam.questionPool.length
      });

      logger.info(`Removed ${questionIds.length} questions from exam ${examId}`);
      return exam;
    } catch (error) {
      logger.error(`Error removing questions from exam ${examId}:`, error);
      throw error;
    }
  }

  async cloneExam(examId: string, userId: string): Promise<IExam> {
    try {
      const originalExam = await this.findById(examId);
      if (!originalExam) throw new Error('Exam not found');

      const clonedData = originalExam.toObject();
      delete clonedData._id;
      delete clonedData.createdAt;
      delete clonedData.updatedAt;
      
      clonedData.name = `${clonedData.name} (Copy)`;
      clonedData.isTemplate = false;
      clonedData.createdBy = new Types.ObjectId(userId);
      delete clonedData.approvedBy;

      return await this.create(clonedData);
    } catch (error) {
      logger.error(`Error cloning exam ${examId}:`, error);
      throw error;
    }
  }

  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = shuffled[i]!;
      shuffled[i] = shuffled[j]!;
      shuffled[j] = temp;
    }
    return shuffled;
  }
}