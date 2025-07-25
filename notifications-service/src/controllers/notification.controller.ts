import { Request, Response } from 'express';
import { NotificationService } from '../services/notification.service';
import { ApiResponse } from '../types';

export class NotificationController {
  constructor(private notificationService: NotificationService) {}

  sendTestEmail = async (req: Request, res: Response<ApiResponse>) => {
    try {
      const { to, type = 'welcome', data = {} } = req.body;

      if (!to) {
        return res.status(400).json({
          success: false,
          message: 'El campo "to" es requerido',
          error: 'Missing recipient email'
        });
      }

      let result;

      switch (type) {
        case 'welcome':
          result = await this.notificationService.sendWelcomeEmail({
            userId: 'test',
            email: to,
            eventType: 'test',
            timestamp: new Date(),
            firstName: data.firstName || 'Usuario',
            lastName: data.lastName || 'Test'
          });
          break;

        case 'password_reset':
          result = await this.notificationService.sendPasswordResetEmail(
            to,
            data.resetToken || 'test-token-123',
            data.firstName || 'Usuario'
          );
          break;

        case 'otp':
          result = await this.notificationService.sendOtpEmail({
            email: to,
            code: data.code || '123456',
            purpose: data.purpose || 'test',
            expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutos
            templateData: {
              purpose: data.purpose || 'prueba',
              expiryMinutes: 10
            }
          });
          break;

        default:
          return res.status(400).json({
            success: false,
            message: 'Tipo de email no soportado',
            error: 'Unsupported email type'
          });
      }

      if (result.success) {
        res.status(200).json({
          success: true,
          message: 'Email de prueba enviado exitosamente',
          data: { emailId: result.emailId, type, to }
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Error enviando email de prueba',
          error: 'Email send failed'
        });
      }

    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Error interno del servidor',
        error: 'Internal server error'
      });
    }
  };

  getEmailStats = async (req: Request, res: Response<ApiResponse>) => {
    try {
      const stats = await this.notificationService.getEmailStats();

      res.status(200).json({
        success: true,
        message: 'Estadísticas obtenidas exitosamente',
        data: stats
      });

    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Error obteniendo estadísticas',
        error: 'Stats fetch failed'
      });
    }
  };

  getEmailHistory = async (req: Request, res: Response<ApiResponse>) => {
    try {
      const { email, limit = 20 } = req.query;

      if (!email) {
        return res.status(400).json({
          success: false,
          message: 'El parámetro email es requerido',
          error: 'Missing email parameter'
        });
      }

      const history = await this.notificationService.getEmailHistory(
        email as string,
        parseInt(limit as string) || 20
      );

      res.status(200).json({
        success: true,
        message: 'Historial obtenido exitosamente',
        data: {
          email,
          history,
          count: history.length
        }
      });

    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Error obteniendo historial',
        error: 'History fetch failed'
      });
    }
  };

  processEmailQueue = async (req: Request, res: Response<ApiResponse>) => {
    try {
      await this.notificationService.processEmailQueue();

      res.status(200).json({
        success: true,
        message: 'Cola de emails procesada exitosamente'
      });

    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Error procesando cola',
        error: 'Queue processing failed'
      });
    }
  };

  retryFailedEmails = async (req: Request, res: Response<ApiResponse>) => {
    try {
      await this.notificationService.retryFailedEmails();

      res.status(200).json({
        success: true,
        message: 'Emails fallidos reintentados exitosamente'
      });

    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Error reintentando emails',
        error: 'Retry failed'
      });
    }
  };

  getServiceHealth = async (req: Request, res: Response<ApiResponse>) => {
    try {
      const stats = await this.notificationService.getEmailStats();
      
      const health = {
        service: 'notifications-service',
        status: 'healthy',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        emailStats: {
          total: stats.total,
          sent: stats.sent,
          pending: stats.pending,
          failed: stats.failed,
          successRate: stats.successRate
        },
        dependencies: {
          mongodb: 'connected',
          redis: 'connected',
          kafka: 'connected',
          resend: 'connected'
        }
      };

      res.status(200).json({
        success: true,
        message: 'Servicio saludable',
        data: health
      });

    } catch (error: any) {
      res.status(503).json({
        success: false,
        message: 'Servicio con problemas',
        error: error.message,
        data: {
          service: 'notifications-service',
          status: 'unhealthy',
          timestamp: new Date().toISOString()
        }
      });
    }
  };
}
