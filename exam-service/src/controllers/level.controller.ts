import { NextFunction, Request, Response } from 'express';
import { auditLog } from '../services/audit-client.service';
import { Question } from '../models/question.model';
import { LevelService } from '../services/level.service';
import { logger } from '../utils/logger';

export class LevelController {
  private levelService: LevelService;

  constructor() {
    this.levelService = new LevelService();
  }

  findAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { isActive } = req.query;

      const filters: { isActive?: boolean } = {};
      if (isActive !== undefined) {
        filters.isActive = isActive === 'true';
      }

      const levels = await this.levelService.findAll(filters);

      return res.json({
        success: true,
        data: {
          levels,
          total: levels.length,
          page: 1,
          totalPages: 1
        }
      });
    } catch (error) {
      logger.error('Error fetching levels:', error);
      next(error);
      return;
    }
  };

  findByCode = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const level = await this.levelService.findByCode(req.params.code!);

      if (!level) {
        return res.status(404).json({
          success: false,
          message: 'Nivel no encontrado'
        });
      }

      return res.json({
        success: true,
        data: level
      });
    } catch (error) {
      logger.error('Error fetching level:', error);
      next(error);
      return;
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const level = await this.levelService.update(req.params.code!, req.body);

      if (!level) {
        return res.status(404).json({
          success: false,
          message: 'Nivel no encontrado'
        });
      }

      return res.json({
        success: true,
        message: 'Nivel actualizado exitosamente',
        data: level
      });
    } catch (error) {
      logger.error('Error updating level:', error);
      next(error);
      return;
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const level = await this.levelService.create({
        ...req.body,
        createdBy: req.user.id
      });

      auditLog({
        action: 'level.created',
        target: { type: 'level', id: String((level as any)._id ?? ''), name: (level as any).code },
        actor: { userId: req.user?.id, email: req.user?.email, role: req.user?.role },
      });

      return res.status(201).json({
        success: true,
        message: 'Nivel creado exitosamente',
        data: level
      });
    } catch (error) {
      logger.error('Error creating level:', error);
      next(error);
      return;
    }
  };

  findById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const level = await this.levelService.findById(req.params.id!);

      if (!level) {
        return res.status(404).json({
          success: false,
          message: 'Nivel no encontrado'
        });
      }

      return res.json({
        success: true,
        data: level
      });
    } catch (error) {
      logger.error('Error fetching level by id:', error);
      next(error);
      return;
    }
  };

  updateById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const level = await this.levelService.updateById(req.params.id!, req.body);

      if (!level) {
        return res.status(404).json({
          success: false,
          message: 'Nivel no encontrado'
        });
      }

      auditLog({
        action: 'level.updated',
        target: { type: 'level', id: req.params.id!, name: (level as any).code },
        actor: { userId: req.user?.id, email: req.user?.email, role: req.user?.role },
      });

      return res.json({
        success: true,
        message: 'Nivel actualizado exitosamente',
        data: level
      });
    } catch (error) {
      logger.error('Error updating level by id:', error);
      next(error);
      return;
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const level = await this.levelService.findById(req.params.id!);

      if (!level) {
        return res.status(404).json({
          success: false,
          message: 'Nivel no encontrado'
        });
      }

      const questionsUsingLevel = await Question.countDocuments({ level: level.code });
      if (questionsUsingLevel > 0) {
        return res.status(409).json({
          success: false,
          message: `No se puede eliminar el nivel "${level.code}" porque ${questionsUsingLevel} pregunta(s) lo usan. Desactívalo en su lugar.`
        });
      }

      await this.levelService.delete(req.params.id!);

      auditLog({
        action: 'level.deleted',
        target: { type: 'level', id: req.params.id!, name: (level as any).code },
        actor: { userId: req.user?.id, email: req.user?.email, role: req.user?.role },
      });

      return res.json({
        success: true,
        message: 'Nivel eliminado exitosamente'
      });
    } catch (error) {
      logger.error('Error deleting level:', error);
      next(error);
      return;
    }
  };

  activate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const level = await this.levelService.updateById(req.params.id!, { isActive: true });

      if (!level) {
        return res.status(404).json({
          success: false,
          message: 'Nivel no encontrado'
        });
      }

      auditLog({
        action: 'level.activated',
        target: { type: 'level', id: req.params.id!, name: (level as any).code },
        actor: { userId: req.user?.id, email: req.user?.email, role: req.user?.role },
      });

      return res.json({
        success: true,
        message: 'Nivel activado exitosamente',
        data: level
      });
    } catch (error) {
      logger.error('Error activating level:', error);
      next(error);
      return;
    }
  };

  deactivate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const level = await this.levelService.updateById(req.params.id!, { isActive: false });

      if (!level) {
        return res.status(404).json({
          success: false,
          message: 'Nivel no encontrado'
        });
      }

      auditLog({
        action: 'level.deactivated',
        target: { type: 'level', id: req.params.id!, name: (level as any).code },
        actor: { userId: req.user?.id, email: req.user?.email, role: req.user?.role },
      });

      return res.json({
        success: true,
        message: 'Nivel desactivado exitosamente',
        data: level
      });
    } catch (error) {
      logger.error('Error deactivating level:', error);
      next(error);
      return;
    }
  };

  initialize = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.levelService.initializeLevels(req.user.id);

      return res.json({
        success: true,
        message: 'Niveles inicializados exitosamente'
      });
    } catch (error) {
      logger.error('Error initializing levels:', error);
      next(error);
      return;
    }
  };
}