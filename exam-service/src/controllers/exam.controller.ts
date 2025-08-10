import { Request, Response, NextFunction } from 'express';
import { ExamService } from '../services/exam.service';
import { logger } from '../utils/logger';

export class ExamController {
  private examService: ExamService;

  constructor() {
    this.examService = new ExamService();
  }

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const examData = {
        ...req.body,
        createdBy: req.user.id
      };

      const exam = await this.examService.create(examData);

      res.status(201).json({
        success: true,
        message: 'Examen creado exitosamente',
        data: exam
      });
    } catch (error) {
      logger.error('Error in exam creation:', error);
      next(error);
    }
  };

  findAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page = 1, limit = 10, type, level, isTemplate } = req.query;
      
      const filters = {
        type,
        level,
        isTemplate: isTemplate === 'true'
      };

      const result = await this.examService.findAll(
        filters,
        Number(page),
        Number(limit)
      );

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Error fetching exams:', error);
      next(error);
    }
  };

  findById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const exam = await this.examService.findById(req.params.id);

      if (!exam) {
        return res.status(404).json({
          success: false,
          message: 'Examen no encontrado'
        });
      }

      res.json({
        success: true,
        data: exam
      });
    } catch (error) {
      logger.error('Error fetching exam:', error);
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const exam = await this.examService.update(req.params.id, req.body);

      if (!exam) {
        return res.status(404).json({
          success: false,
          message: 'Examen no encontrado'
        });
      }

      res.json({
        success: true,
        message: 'Examen actualizado exitosamente',
        data: exam
      });
    } catch (error) {
      logger.error('Error updating exam:', error);
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const deleted = await this.examService.delete(req.params.id);

      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: 'Examen no encontrado'
        });
      }

      res.json({
        success: true,
        message: 'Examen eliminado exitosamente'
      });
    } catch (error) {
      logger.error('Error deleting exam:', error);
      next(error);
    }
  };

  clone = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const clonedExam = await this.examService.cloneExam(
        req.params.id,
        req.user.id
      );

      res.status(201).json({
        success: true,
        message: 'Examen clonado exitosamente',
        data: clonedExam
      });
    } catch (error) {
      logger.error('Error cloning exam:', error);
      next(error);
    }
  };

  generateQuestions = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { candidateId } = req.body;
      
      const questions = await this.examService.generateQuestions(
        req.params.id,
        candidateId
      );

      res.json({
        success: true,
        data: questions
      });
    } catch (error) {
      logger.error('Error generating questions:', error);
      next(error);
    }
  };
}