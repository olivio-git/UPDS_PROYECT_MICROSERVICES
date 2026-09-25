import { Request, Response } from 'express';
import { isAdmin } from '../middleware/auth.middleware';
import { NotificationService } from '../services/notification.service';
import { ApiResponse } from '../types';

// Express's query parser (qs) turns `?recipientId[$ne]=x` into an object,
// which would reach a Mongo filter as a query operator. Any request field
// that ends up in a Mongo filter must be a plain string (or absent).
function isStringOrAbsent(value: unknown): value is string | undefined {
  return value === undefined || typeof value === 'string';
}

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
          result = await this.notificationService.sendPasswordResetEmail({
            email: to,
            firstName: data.firstName || 'Usuario',
            lastName: data.lastName || 'Test',
            temporaryPassword: data.temporaryPassword || 'TempPass123!',
            isTemporaryPassword: true
          });
          break;

        case 'new_user_credentials':
          result = await this.notificationService.sendNewUserCredentialsEmail({
            email: to,
            firstName: data.firstName || 'Usuario',
            lastName: data.lastName || 'Test',
            temporaryPassword: data.temporaryPassword || 'TempPass123!',
            role: data.role || 'student'
          });
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

        case 'exam_graded':
          result = await this.notificationService.sendExamGradedEmail({
            email: to,
            firstName: data.firstName || 'Estudiante',
            lastName: data.lastName || '',
            examName: data.examName || 'Examen de prueba',
            score: data.score ?? 75,
            maxScore: data.maxScore ?? 100,
            percentage: data.percentage ?? 75,
            status: data.status || 'completed',
            pdfBase64: data.pdfBase64,
            pdfFilename: data.pdfFilename,
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

      if (!isStringOrAbsent(email)) {
        return res.status(400).json({
          success: false,
          message: 'El parámetro email debe ser un texto',
          error: 'Invalid email parameter'
        });
      }

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

  // In-app notifications.
  // Gated by requireAuth (see notification.routes.ts), which accepts either
  // a verified end-user JWT (req.user set) or the service token
  // (req.isServiceCall set, no req.user — no caller currently exercises this
  // combination, but "privileged" below stays correct if one ever does). A
  // non-admin, non-service caller can only ever see/modify their own
  // notifications: any client-supplied recipientId is ignored for them, the
  // recipientId always comes from the verified JWT instead. An admin (or a
  // service) may pass an explicit recipientId to look up someone else's.
  listNotifications = async (req: Request, res: Response<ApiResponse>) => {
    try {
      const authUser = req.user;
      const privileged = req.isServiceCall === true || isAdmin(authUser);
      const { recipientId: requestedRecipientId, onlyUnread = 'false', page = '1', limit = '50' } = req.query;

      if (!isStringOrAbsent(requestedRecipientId)) {
        return res.status(400).json({ success: false, message: 'recipientId must be a string' });
      }

      // Admins/services default to their own list when no recipientId is
      // given (the dashboard bell never sends one); a service call with no
      // recipientId and no user still falls through to the 400 below.
      const recipientId = privileged ? (requestedRecipientId ?? authUser?.userId) : authUser?.userId;
      if (!recipientId) {
        return res.status(400).json({ success: false, message: 'recipientId is required' });
      }

      const items = await this.notificationService.listInAppNotifications(
        recipientId,
        onlyUnread === 'true',
        parseInt(limit as string, 10) || 50,
        parseInt(page as string, 10) || 1
      );

      res.status(200).json({ success: true, message: 'Notifications fetched', data: items });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message || 'Error listing notifications' });
    }
  };

  markAsRead = async (req: Request, res: Response<ApiResponse>) => {
    try {
      const { id } = req.params;
      if (!id) return res.status(400).json({ success: false, message: 'id is required' });

      const authUser = req.user;
      const privileged = req.isServiceCall === true || isAdmin(authUser);
      const existing = await this.notificationService.getInAppNotificationById(id);
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Notification not found' });
      }
      if (!privileged && existing.recipientId !== authUser?.userId) {
        return res.status(403).json({ success: false, message: 'No puedes modificar notificaciones de otro usuario' });
      }

      await this.notificationService.markNotificationAsRead(id);

      res.status(200).json({ success: true, message: 'Notification marked as read' });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message || 'Error marking as read' });
    }
  };

  deleteNotification = async (req: Request, res: Response<ApiResponse>) => {
    try {
      const { id } = req.params;
      if (!id) return res.status(400).json({ success: false, message: 'id is required' });

      const authUser = req.user;
      const privileged = req.isServiceCall === true || isAdmin(authUser);
      const existing = await this.notificationService.getInAppNotificationById(id);
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Notification not found' });
      }
      if (!privileged && existing.recipientId !== authUser?.userId) {
        return res.status(403).json({ success: false, message: 'No puedes eliminar notificaciones de otro usuario' });
      }

      const deleted = await this.notificationService.deleteInAppNotification(id);

      if (deleted) {
        res.status(200).json({ success: true, message: 'Notification deleted' });
      } else {
        res.status(404).json({ success: false, message: 'Notification not found' });
      }
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message || 'Error deleting notification' });
    }
  };

  createInApp = async (req: Request, res: Response<ApiResponse>) => {
    try {
      const { recipientId, recipientType, type, content, channel, priority, metadata } = req.body;
      if (!recipientId || !type) {
        return res.status(400).json({ success: false, message: 'recipientId y type son requeridos' });
      }
      // recipientId is later matched in listNotifications' filter; keep it a
      // plain string so no operator object gets persisted.
      if (typeof recipientId !== 'string' || typeof type !== 'string') {
        return res.status(400).json({ success: false, message: 'recipientId y type deben ser texto' });
      }
      const notification = await this.notificationService.createInAppNotification({
        recipientId,
        recipientType: recipientType || 'candidate',
        type,
        channel: channel || 'in-app',
        content: content || {},
        priority: priority || 'normal',
        metadata: metadata || {},
        read: false,
      });
      return res.status(201).json({ success: true, message: 'Notificación creada', data: notification });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message || 'Error al crear notificación' });
    }
  };
}
