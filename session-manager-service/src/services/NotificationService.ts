import axios from 'axios';
import { logger } from '../utils/logger';

interface NotificationData {
  recipientId: string;
  type: 'exam_assigned' | 'exam_reminder' | 'exam_completed' | 'session_started' | 'session_ended';
  title: string;
  message: string;
  data?: any;
  actions?: Array<{
    label: string;
    action: string;
    variant?: 'default' | 'destructive';
  }>;
  expiresAt?: Date;
}

export class NotificationService {
  private notificationServiceUrl: string;

  constructor() {
    this.notificationServiceUrl = process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service:3001';
  }

  /**
   * Enviar notificación de examen completado
   */
  async sendExamCompletedNotification(candidateId: string, sessionId: string, results: any): Promise<void> {
    try {
      const notification: NotificationData = {
        recipientId: candidateId,
        type: 'exam_completed',
        title: 'Examen Completado',
        message: `Has completado el examen exitosamente. Puntuación: ${results.percentage}%`,
        data: {
          sessionId,
          score: results.totalScore,
          maxScore: results.maxPossibleScore,
          percentage: results.percentage,
          isPassed: results.isPassed
        },
        actions: [
          {
            label: 'Ver Resultados',
            action: 'view_results',
            variant: 'default'
          }
        ],
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 días
      };

      await this.sendNotification(notification);
      logger.info(`Exam completed notification sent to ${candidateId}`);

    } catch (error) {
      logger.error('Error sending exam completed notification:', error);
    }
  }

  /**
   * Enviar notificación de sesión iniciada
   */
  async sendSessionStartedNotification(participantIds: string[], sessionData: any): Promise<void> {
    try {
      const notifications = participantIds.map(participantId => ({
        recipientId: participantId,
        type: 'session_started' as const,
        title: 'Sesión de Examen Iniciada',
        message: `La sesión "${sessionData.sessionName}" ha comenzado. ¡Únete ahora!`,
        data: {
          sessionId: sessionData.sessionId,
          examName: sessionData.examName,
          duration: sessionData.duration
        },
        actions: [
          {
            label: 'Unirse al Examen',
            action: 'join_exam',
            variant: 'default' as const
          }
        ],
        expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000) // 2 horas
      }));

      await Promise.all(notifications.map(notification => this.sendNotification(notification)));
      logger.info(`Session started notifications sent to ${participantIds.length} participants`);

    } catch (error) {
      logger.error('Error sending session started notifications:', error);
    }
  }

  /**
   * Enviar notificación de sesión finalizada
   */
  async sendSessionEndedNotification(participantIds: string[], sessionData: any): Promise<void> {
    try {
      const notifications = participantIds.map(participantId => ({
        recipientId: participantId,
        type: 'session_ended' as const,
        title: 'Sesión de Examen Finalizada',
        message: `La sesión "${sessionData.sessionName}" ha finalizado. Los resultados estarán disponibles pronto.`,
        data: {
          sessionId: sessionData.sessionId,
          examName: sessionData.examName,
          endedAt: new Date()
        },
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 días
      }));

      await Promise.all(notifications.map(notification => this.sendNotification(notification)));
      logger.info(`Session ended notifications sent to ${participantIds.length} participants`);

    } catch (error) {
      logger.error('Error sending session ended notifications:', error);
    }
  }

  /**
   * Enviar recordatorio de examen próximo
   */
  async sendExamReminderNotification(candidateId: string, examData: any): Promise<void> {
    try {
      const notification: NotificationData = {
        recipientId: candidateId,
        type: 'exam_reminder',
        title: 'Recordatorio de Examen',
        message: `Recuerda que tienes el examen "${examData.examName}" programado para hoy a las ${examData.scheduledTime}.`,
        data: {
          sessionId: examData.sessionId,
          examId: examData.examId,
          scheduledTime: examData.scheduledTime
        },
        actions: [
          {
            label: 'Prepararse',
            action: 'prepare_exam',
            variant: 'default'
          }
        ],
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 horas
      };

      await this.sendNotification(notification);
      logger.info(`Exam reminder notification sent to ${candidateId}`);

    } catch (error) {
      logger.error('Error sending exam reminder notification:', error);
    }
  }

  /**
   * Enviar notificación personalizada
   */
  async sendCustomNotification(
    recipientId: string,
    title: string,
    message: string,
    data?: any
  ): Promise<void> {
    try {
      const notification: NotificationData = {
        recipientId,
        type: 'session_started', // Tipo genérico
        title,
        message,
        data,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 horas por defecto
      };

      await this.sendNotification(notification);
      logger.info(`Custom notification sent to ${recipientId}`);

    } catch (error) {
      logger.error('Error sending custom notification:', error);
    }
  }

  /**
   * Enviar notificación al servicio de notificaciones
   */
  private async sendNotification(notification: NotificationData): Promise<void> {
    try {
      const response = await axios.post(
        `${this.notificationServiceUrl}/api/v1/notifications/send`,
        notification,
        {
          timeout: 10000,
          headers: {
            'Content-Type': 'application/json',
            'X-Service': 'session-manager'
          }
        }
      );

      if (!response.data.success) {
        throw new Error(response.data.message || 'Error sending notification');
      }

    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNREFUSED') {
          logger.error('Notification service not available');
        } else if (error.response) {
          logger.error(`Notification service error: ${error.response.status} - ${error.response.data?.message || error.message}`);
        } else {
          logger.error(`Network error sending notification: ${error.message}`);
        }
      } else {
        logger.error('Unexpected error sending notification:', error);
      }

      // No re-lanzar el error para evitar que falle la operación principal
    }
  }

  /**
   * Enviar notificación por email directamente
   */
  async sendEmailNotification(
    recipientEmail: string,
    subject: string,
    content: string,
    templateData?: any
  ): Promise<void> {
    try {
      const response = await axios.post(
        `${this.notificationServiceUrl}/api/v1/notifications/send-email`,
        {
          to: recipientEmail,
          subject,
          content,
          templateData
        },
        {
          timeout: 10000,
          headers: {
            'Content-Type': 'application/json',
            'X-Service': 'session-manager'
          }
        }
      );

      if (!response.data.success) {
        throw new Error(response.data.message || 'Error sending email');
      }

      logger.info(`Email notification sent to ${recipientEmail}`);

    } catch (error) {
      logger.error('Error sending email notification:', error);
    }
  }

  /**
   * Obtener estadísticas del servicio de notificaciones
   */
  async getNotificationStats(): Promise<any> {
    try {
      const response = await axios.get(
        `${this.notificationServiceUrl}/api/v1/notifications/stats`,
        {
          timeout: 5000,
          headers: {
            'X-Service': 'session-manager'
          }
        }
      );

      return response.data.data || {};

    } catch (error) {
      logger.error('Error getting notification stats:', error);
      return {};
    }
  }

  /**
   * Verificar estado del servicio de notificaciones
   */
  async checkServiceHealth(): Promise<boolean> {
    try {
      const response = await axios.get(
        `${this.notificationServiceUrl}/health`,
        { timeout: 3000 }
      );

      return response.status === 200;

    } catch (error: any) {
      logger.warn('Notification service health check failed:', error.message);
      return false;
    }
  }
}
