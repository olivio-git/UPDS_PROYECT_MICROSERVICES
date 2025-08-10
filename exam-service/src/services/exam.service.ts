import { Exam, IExam } from '../models/exam.model';
import { Question } from '../models/question.model';
import { KafkaService } from './kafka.service';
import { logger } from '../utils/logger';
import { Types } from 'mongoose';

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
      return await Exam.findById(id)
        .populate('questionPool')
        .populate('createdBy', 'firstName lastName email')
        .populate('approvedBy', 'firstName lastName email');
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
          .populate('createdBy', 'firstName lastName')
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
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
}