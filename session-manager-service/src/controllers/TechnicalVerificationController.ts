import { Request, Response } from 'express';
import { technicalVerificationService } from '../services/TechnicalVerificationService';
import { logger } from '../utils/logger';

export class TechnicalVerificationController {
  
  /**
   * POST /api/v1/technical/init
   * Inicializar nueva verificación técnica
   */
  async initializeVerification(req: Request, res: Response) {
    try {
      const { sessionId, userId } = req.body;
      
      if (!sessionId || !userId) {
        return res.status(400).json({
          success: false,
          message: 'sessionId y userId son requeridos'
        });
      }

      const verificationId = await technicalVerificationService.initializeVerification(sessionId, userId);
      
      logger.info(`📋 Verificación técnica iniciada: ${verificationId}`);
      
      return res.status(200).json({
        success: true,
        message: 'Verificación técnica iniciada',
        data: {
          verificationId,
          expiresIn: 24 * 60 * 60 // 24 horas en segundos
        }
      });
    } catch (error) {
      logger.error('Error inicializando verificación técnica:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * GET /api/v1/technical/:verificationId
   * Obtener estado actual de verificación
   */
  async getVerification(req: Request, res: Response) {
    try {
      const { verificationId } = req.params;
      
      const verification = await technicalVerificationService.getVerification(verificationId);
      
      if (!verification) {
        return res.status(404).json({
          success: false,
          message: 'Verificación no encontrada'
        });
      }

      return res.status(200).json({
        success: true,
        data: verification
      });
    } catch (error) {
      logger.error('Error obteniendo verificación:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * GET /api/v1/technical/user/:userId
   * Obtener verificación activa de un usuario
   */
  async getUserVerification(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      
      const verification = await technicalVerificationService.getActiveVerificationByUser(userId);
      
      if (!verification) {
        return res.status(404).json({
          success: false,
          message: 'No se encontró verificación activa para este usuario'
        });
      }

      return res.status(200).json({
        success: true,
        data: verification
      });
    } catch (error) {
      logger.error('Error obteniendo verificación de usuario:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * POST /api/v1/technical/:verificationId/browser
   * Actualizar información del navegador y sistema
   */
  async updateBrowserInfo(req: Request, res: Response) {
    try {
      const { verificationId } = req.params;
      const { browserInfo, systemInfo } = req.body;
      
      if (!browserInfo || !systemInfo) {
        return res.status(400).json({
          success: false,
          message: 'browserInfo y systemInfo son requeridos'
        });
      }

      const result = await technicalVerificationService.updateBrowserInfo(verificationId, browserInfo, systemInfo);
      
      return res.status(200).json({
        success: result.success,
        message: result.message,
        level: result.level,
        data: result.data
      });
    } catch (error) {
      logger.error('Error actualizando info del navegador:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * POST /api/v1/technical/:verificationId/permissions
   * Actualizar permisos del dispositivo
   */
  async updatePermissions(req: Request, res: Response) {
    try {
      const { verificationId } = req.params;
      const { permissions } = req.body;
      
      if (!permissions) {
        return res.status(400).json({
          success: false,
          message: 'permissions es requerido'
        });
      }

      const result = await technicalVerificationService.updatePermissions(verificationId, permissions);
      
      return res.status(200).json({
        success: result.success,
        message: result.message,
        level: result.level,
        data: result.data
      });
    } catch (error) {
      logger.error('Error actualizando permisos:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * POST /api/v1/technical/:verificationId/devices
   * Actualizar dispositivos disponibles
   */
  async updateDevices(req: Request, res: Response) {
    try {
      const { verificationId } = req.params;
      const { devices } = req.body;
      
      if (!devices) {
        return res.status(400).json({
          success: false,
          message: 'devices es requerido'
        });
      }

      const result = await technicalVerificationService.updateDevices(verificationId, devices);
      
      return res.status(200).json({
        success: result.success,
        message: result.message,
        level: result.level,
        data: result.data
      });
    } catch (error) {
      logger.error('Error actualizando dispositivos:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * POST /api/v1/technical/:verificationId/network-test
   * Probar conexión de red
   */
  async testNetworkConnection(req: Request, res: Response) {
    try {
      const { verificationId } = req.params;
      
      const result = await technicalVerificationService.testNetworkConnection(verificationId);
      
      return res.status(200).json({
        success: result.success,
        message: result.message,
        level: result.level,
        data: result.data
      });
    } catch (error) {
      logger.error('Error probando conexión de red:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * POST /api/v1/technical/:verificationId/microphone-test
   * Verificar funcionamiento del micrófono
   */
  async verifyMicrophone(req: Request, res: Response) {
    try {
      const { verificationId } = req.params;
      const { audioLevel } = req.body;
      
      if (typeof audioLevel !== 'number') {
        return res.status(400).json({
          success: false,
          message: 'audioLevel numérico es requerido'
        });
      }

      const result = await technicalVerificationService.verifyMicrophone(verificationId, audioLevel);
      
      return res.status(200).json({
        success: result.success,
        message: result.message,
        level: result.level,
        data: result.data
      });
    } catch (error) {
      logger.error('Error verificando micrófono:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * POST /api/v1/technical/:verificationId/camera-test
   * Verificar funcionamiento de la cámara
   */
  async verifyCamera(req: Request, res: Response) {
    try {
      const { verificationId } = req.params;
      const { hasVideo, resolution } = req.body;
      
      if (typeof hasVideo !== 'boolean') {
        return res.status(400).json({
          success: false,
          message: 'hasVideo booleano es requerido'
        });
      }

      const result = await technicalVerificationService.verifyCamera(verificationId, hasVideo, resolution);
      
      return res.status(200).json({
        success: result.success,
        message: result.message,
        level: result.level,
        data: result.data
      });
    } catch (error) {
      logger.error('Error verificando cámara:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * POST /api/v1/technical/:verificationId/audio-test
   * Verificar funcionamiento del audio
   */
  async verifyAudio(req: Request, res: Response) {
    try {
      const { verificationId } = req.params;
      const { canHear } = req.body;
      
      if (typeof canHear !== 'boolean') {
        return res.status(400).json({
          success: false,
          message: 'canHear booleano es requerido'
        });
      }

      const result = await technicalVerificationService.verifyAudio(verificationId, canHear);
      
      return res.status(200).json({
        success: result.success,
        message: result.message,
        level: result.level,
        data: result.data
      });
    } catch (error) {
      logger.error('Error verificando audio:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * POST /api/v1/technical/:verificationId/finalize
   * Calcular puntuación final y finalizar verificación
   */
  async finalizeVerification(req: Request, res: Response) {
    try {
      const { verificationId } = req.params;
      
      const result = await technicalVerificationService.calculateFinalScore(verificationId);
      
      return res.status(200).json({
        success: result.success,
        message: result.message,
        level: result.level,
        data: result.data
      });
    } catch (error) {
      logger.error('Error finalizando verificación:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * GET /api/v1/technical/user/:userId/can-proceed
   * Verificar si un usuario puede proceder con el examen
   */
  async canUserProceed(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      
      const result = await technicalVerificationService.canUserProceed(userId);
      
      return res.status(200).json({
        success: true,
        data: {
          canProceed: result.canProceed,
          reason: result.reason,
          verification: result.verification
        }
      });
    } catch (error) {
      logger.error('Error verificando si puede proceder:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * POST /api/v1/technical/:verificationId/mark-used
   * Marcar verificación como utilizada
   */
  async markVerificationUsed(req: Request, res: Response) {
    try {
      const { verificationId } = req.params;
      
      await technicalVerificationService.markVerificationUsed(verificationId);
      
      return res.status(200).json({
        success: true,
        message: 'Verificación marcada como utilizada'
      });
    } catch (error) {
      logger.error('Error marcando verificación como utilizada:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * GET /api/v1/technical/stats
   * Obtener estadísticas de verificaciones
   */
  async getVerificationStats(req: Request, res: Response) {
    try {
      const stats = await technicalVerificationService.getVerificationStats();
      
      return res.status(200).json({
        success: true,
        data: stats
      });
    } catch (error) {
      logger.error('Error obteniendo estadísticas:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }
}

export const technicalVerificationController = new TechnicalVerificationController();
