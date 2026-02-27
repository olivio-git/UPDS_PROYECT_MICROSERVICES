import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { Question } from '../models/question.model';
import { RubricService } from '../services/rubric.service';
import { logger } from '../utils/logger';

export class RubricController {
  private rubricService: RubricService;

  constructor() {
    this.rubricService = new RubricService();
  }

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rubricData = {
        ...req.body,
        createdBy: req.user.id
      };

      const rubric = await this.rubricService.create(rubricData);

      res.status(201).json({
        success: true,
        message: 'Rúbrica creada exitosamente',
        data: rubric
      });
    } catch (error) {
      logger.error('Error in rubric creation:', error);
      next(error);
      return;
    };
  };

  findAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page = 1, limit = 10, competency, level, scoringType, isActive } = req.query;
      
      const filters = {
        competency,
        level,
        scoringType,
        isActive: isActive === 'true'
      };

      const result = await this.rubricService.findAll(
        filters,
        Number(page),
        Number(limit)
      );

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Error fetching rubrics:', error);
      next(error);
      return;
    };
  };

  findById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rubric = await this.rubricService.findById(req.params.id!);

      if (!rubric) {
        return res.status(404).json({
          success: false,
          message: 'Rúbrica no encontrada'
        });
      }

      return res.json({
        success: true,
        data: rubric
      });
    } catch (error) {
      logger.error('Error fetching rubric:', error);
      next(error);
      return;
    };
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rubric = await this.rubricService.update(req.params.id!, req.body);

      if (!rubric) {
        return res.status(404).json({
          success: false,
          message: 'Rúbrica no encontrada'
        });
      }

      return res.json({
        success: true,
        message: 'Rúbrica actualizada exitosamente',
        data: rubric
      });
    } catch (error) {
      logger.error('Error updating rubric:', error);
      next(error);
      return;
    };
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const questionsUsingRubric = await Question.countDocuments({
        'metadata.rubricId': new Types.ObjectId(req.params.id!)
      });
      if (questionsUsingRubric > 0) {
        return res.status(409).json({
          success: false,
          message: `No se puede eliminar esta rúbrica porque ${questionsUsingRubric} pregunta(s) la usan. Desactívala en su lugar.`
        });
      }

      const deleted = await this.rubricService.delete(req.params.id!);

      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: 'Rúbrica no encontrada'
        });
      }

      return res.json({
        success: true,
        message: 'Rúbrica eliminada exitosamente'
      });
    } catch (error) {
      logger.error('Error deleting rubric:', error);
      next(error);
      return;
    }
  };

  findByCompetencyAndLevel = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { competency, level } = req.params;

      if (!competency || !level) {
        return res.status(400).json({
          success: false,
          message: 'Competency and level are required'
        });
      }

      const rubrics = await this.rubricService.findByCompetencyAndLevel(competency, level);

      return res.json({
        success: true,
        data: rubrics
      });
    } catch (error) {
      logger.error('Error fetching rubrics by competency and level:', error);
      next(error);
      return;
    }
  };

  clone = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name } = req.body;
      const rubric = await this.rubricService.clone(req.params.id!, name, req.user.id);

      if (!rubric) {
        return res.status(404).json({
          success: false,
          message: 'Rúbrica no encontrada'
        });
      }

      return res.status(201).json({
        success: true,
        message: 'Rúbrica clonada exitosamente',
        data: rubric
      });
    } catch (error) {
      logger.error('Error cloning rubric:', error);
      next(error);
      return;
    }
  };

  activate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rubric = await this.rubricService.update(req.params.id!, { isActive: true });

      if (!rubric) {
        return res.status(404).json({
          success: false,
          message: 'Rúbrica no encontrada'
        });
      }

      return res.json({
        success: true,
        message: 'Rúbrica activada exitosamente',
        data: rubric
      });
    } catch (error) {
      logger.error('Error activating rubric:', error);
      next(error);
      return;
    }
  };

  deactivate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rubric = await this.rubricService.update(req.params.id!, { isActive: false });

      if (!rubric) {
        return res.status(404).json({
          success: false,
          message: 'Rúbrica no encontrada'
        });
      }

      return res.json({
        success: true,
        message: 'Rúbrica desactivada exitosamente',
        data: rubric
      });
    } catch (error) {
      logger.error('Error deactivating rubric:', error);
      next(error);
      return;
    }
  };

  calculateScore = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { responses } = req.body;
      const score = await this.rubricService.calculateScore(req.params.id!, responses);

      return res.json({
        success: true,
        data: { score }
      });
    } catch (error) {
      logger.error('Error calculating score:', error);
      next(error);
      return;
    }
  };
}