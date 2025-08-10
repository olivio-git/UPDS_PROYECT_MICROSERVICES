import { NotificationRepository } from '../repositories/notification.repository';
import { CacheRepository } from '../repositories/cache.repository';
import { EmailService } from './email.service';
import { EventService } from './event.service';
import { EmailNotification, OtpEmailData, UserEventData } from '../types';
import { config } from '../config';

export class NotificationService {
  constructor(
    private notificationRepository: NotificationRepository,
    private cacheRepository: CacheRepository,
    private emailService: EmailService,
    private eventService: EventService
  ) {}

  async sendOtpEmail(otpData: OtpEmailData): Promise<{ success: boolean; emailId?: string }> {
    try {
      // Crear notificación en la base de datos
      const emailNotification = await this.notificationRepository.createEmailNotification({
        // from: 'no-reply@oliviodev.com',
        to: otpData.email,
        subject: `Código de verificación - CBA Platform`,
        template: 'otp_verification',
        templateData: {
          otpCode: otpData.code,
          purpose: otpData.templateData.purpose,
          expiryMinutes: otpData.templateData.expiryMinutes
        },
        status: 'pending',
        priority: 'high',
        retryCount: 0,
        maxRetries: config.email.retryAttempts
      });

      // Enviar email inmediatamente para OTP (alta prioridad)
      const result = await this.emailService.sendOtpEmail(
        otpData.email,
        otpData.code,
        otpData.templateData.purpose,
        otpData.templateData.expiryMinutes
      );

      if (result.success) {
        await this.notificationRepository.updateEmailStatus(
          emailNotification._id!,
          'sent',
          { messageId: result.messageId }
        );

        await this.eventService.publishEmailEvent('email.sent', {
          emailId: emailNotification._id!.toString(),
          to: otpData.email,
          template: 'otp_verification',
          messageId: result.messageId
        });

        console.log(`✅ OTP enviado exitosamente a ${otpData.email}`);
        return { success: true, emailId: emailNotification._id!.toString() };
      } else {
        await this.notificationRepository.updateEmailStatus(
          emailNotification._id!,
          'failed',
          { failureReason: result.error }
        );

        await this.eventService.publishEmailEvent('email.failed', {
          emailId: emailNotification._id!.toString(),
          to: otpData.email,
          template: 'otp_verification',
          error: result.error
        });

        console.error(`❌ Error enviando OTP a ${otpData.email}: ${result.error}`);
        return { success: false };
      }
    } catch (error: any) {
      console.error('❌ Error en sendOtpEmail:', error);
      return { success: false };
    }
  }

  async sendWelcomeEmail(userData: UserEventData): Promise<{ success: boolean; emailId?: string }> {
    try {
      const emailNotification = await this.notificationRepository.createEmailNotification({
        // from: 'no-reply@oliviodev.com',
        to: userData.email,
        subject: '¡Bienvenido a CBA Platform!',
        template: 'welcome',
        templateData: {
          firstName: userData.firstName || 'Usuario',
          lastName: userData.lastName || ''
        },
        status: 'pending',
        priority: 'normal',
        retryCount: 0,
        maxRetries: config.email.retryAttempts
      });

      // Agregar a la cola para procesamiento
      await this.addToEmailQueue(emailNotification._id!.toString(), 'normal');

      return { success: true, emailId: emailNotification._id!.toString() };
    } catch (error: any) {
      console.error('❌ Error en sendWelcomeEmail:', error);
      return { success: false };
    }
  }

  /**
   * Enviar email con credenciales a nuevos usuarios
   */
  async sendNewUserCredentialsEmail(userData: {
    email: string;
    firstName: string;
    lastName: string;
    temporaryPassword: string;
    role: string;
  }): Promise<{ success: boolean; emailId?: string }> {
    try {
      console.log(`📝 [NOTIFICATION] Creando email de credenciales para: ${userData.email}`);
      console.log(`🔐 [NOTIFICATION] Contraseña temporal: ${userData.temporaryPassword}`);
      console.log(`👥 [NOTIFICATION] Usuario: ${userData.firstName} ${userData.lastName}`);
      console.log(`🏇 [NOTIFICATION] Rol: ${userData.role}`);
      
      const emailNotification = await this.notificationRepository.createEmailNotification({
        to: userData.email,
        subject: '🎉 Bienvenido a CBA Platform - Tus credenciales de acceso',
        template: 'new_user_credentials',
        templateData: {
          firstName: userData.firstName,
          lastName: userData.lastName,
          email: userData.email,
          temporaryPassword: userData.temporaryPassword,
          role: userData.role,
          loginUrl: 'http://localhost:3000/login' // URL del frontend
        },
        status: 'pending',
        priority: 'high', // Alta prioridad para credenciales
        retryCount: 0,
        maxRetries: config.email.retryAttempts
      });

      console.log(`📧 Creando email de credenciales para: ${userData.email}`);
      console.log(`🏷️ [NOTIFICATION] Template: new_user_credentials`);
      console.log(`📧 [NOTIFICATION] Email ID: ${emailNotification._id}`);

      // Enviar inmediatamente (alta prioridad)
      await this.processEmailNotification(emailNotification);

      return { success: true, emailId: emailNotification._id!.toString() };
    } catch (error: any) {
      console.error('❌ Error en sendNewUserCredentialsEmail:', error);
      return { success: false };
    }
  }

  async sendPasswordResetEmail(userData: {
    email: string;
    firstName: string;
    lastName: string;
    temporaryPassword: string;
    isTemporaryPassword?: boolean;
  }): Promise<{ success: boolean; emailId?: string }> {
    try {
      const emailNotification = await this.notificationRepository.createEmailNotification({
        to: userData.email,
        subject: '🔐 Nueva contraseña temporal - CBA Platform',
        template: 'password_reset_temporary',
        templateData: {
          firstName: userData.firstName,
          lastName: userData.lastName,
          email: userData.email,
          temporaryPassword: userData.temporaryPassword,
          isTemporaryPassword: userData.isTemporaryPassword || true,
          loginUrl: 'http://localhost:3000/login'
        },
        status: 'pending',
        priority: 'high',
        retryCount: 0,
        maxRetries: config.email.retryAttempts
      });

      console.log(`📧 Creando email de contraseña temporal para: ${userData.email}`);

      // Enviar inmediatamente (alta prioridad)
      await this.processEmailNotification(emailNotification);

      return { success: true, emailId: emailNotification._id!.toString() };
    } catch (error: any) {
      console.error('❌ Error en sendPasswordResetEmail:', error);
      return { success: false };
    }
  }

  async processEmailQueue(): Promise<void> {
    try {
      const pendingEmails = await this.notificationRepository.getPendingEmails(config.email.batchSize);
      
      if (pendingEmails.length === 0) {
        return;
      }

      console.log(`📧 Procesando ${pendingEmails.length} emails pendientes...`);

      for (const email of pendingEmails) {
        await this.processEmailNotification(email);
        
        // Pequeña pausa entre emails para evitar rate limiting
        await this.delay(100);
      }

    } catch (error: any) {
      console.error('❌ Error procesando cola de emails:', error);
    }
  }

  async retryFailedEmails(): Promise<void> {
    try {
      const failedEmails = await this.notificationRepository.getEmailsByStatus('failed');
      
      const retryableEmails = failedEmails.filter(email => 
        email.retryCount < email.maxRetries &&
        (!email.lastAttempt || 
         new Date().getTime() - email.lastAttempt.getTime() > config.email.retryDelay)
      );

      if (retryableEmails.length === 0) {
        return;
      }

      console.log(`🔄 Reintentando ${retryableEmails.length} emails fallidos...`);

      for (const email of retryableEmails) {
        await this.notificationRepository.updateEmailStatus(email._id!, 'retrying');
        await this.processEmailNotification(email);
        await this.delay(500); // Pausa más larga para reintentos
      }

    } catch (error: any) {
      console.error('❌ Error reintentando emails fallidos:', error);
    }
  }

  private async processEmailNotification(email: EmailNotification): Promise<void> {
    try {
      let result;

      switch (email.template) {
        case 'otp_verification':
          result = await this.emailService.sendOtpEmail(
            email.to,
            email.templateData.otpCode,
            email.templateData.purpose,
            email.templateData.expiryMinutes
          );
          break;

        case 'new_user_credentials':
          result = await this.emailService.sendNewUserCredentialsEmail(
            email.to,
            email.templateData.firstName,
            email.templateData.lastName,
            email.templateData.temporaryPassword
          );
          break;

        case 'password_reset_temporary':
          // Para passwords temporales usamos el mismo template de credenciales
          result = await this.emailService.sendNewUserCredentialsEmail(
            email.to,
            email.templateData.firstName,
            email.templateData.lastName || '',
            email.templateData.temporaryPassword
          );
          break;

        case 'welcome':
          result = await this.emailService.sendWelcomeEmail(
            email.to,
            email.templateData.firstName,
            email.templateData.lastName
          );
          break;

        case 'password_reset':
          result = await this.emailService.sendPasswordResetEmail(
            email.to,
            email.templateData.resetToken,
            email.templateData.firstName
          );
          break;

        default:
          throw new Error(`Template no soportado: ${email.template}`);
      }

      if (result.success) {
        await this.notificationRepository.updateEmailStatus(
          email._id!,
          'sent',
          { messageId: result.messageId }
        );

        await this.cacheRepository.trackEmailDelivery(email._id!.toString(), 'sent', {
          messageId: result.messageId,
          template: email.template
        });

        await this.eventService.publishEmailEvent('email.sent', {
          emailId: email._id!.toString(),
          to: email.to,
          template: email.template,
          messageId: result.messageId
        });

      } else {
        await this.notificationRepository.incrementRetryCount(email._id!);
        
        if (email.retryCount + 1 >= email.maxRetries) {
          await this.notificationRepository.updateEmailStatus(
            email._id!,
            'failed',
            { failureReason: result.error }
          );

          await this.cacheRepository.addFailedEmail(email._id!.toString(), result.error || 'Unknown error');
        }

        await this.eventService.publishEmailEvent('email.failed', {
          emailId: email._id!.toString(),
          to: email.to,
          template: email.template,
          error: result.error,
          retryCount: email.retryCount + 1
        });
      }

    } catch (error: any) {
      console.error(`❌ Error procesando email ${email._id}:`, error);
      
      await this.notificationRepository.incrementRetryCount(email._id!);
      
      if (email.retryCount + 1 >= email.maxRetries) {
        await this.notificationRepository.updateEmailStatus(
          email._id!,
          'failed',
          { failureReason: error.message }
        );
      }
    }
  }

  private async addToEmailQueue(emailId: string, priority: string): Promise<void> {
    const priorityMap: Record<string, number> = {
      'urgent': 100,
      'high': 75,
      'normal': 50,
      'low': 25
    };

    const priorityScore = priorityMap[priority] || 50;
    
    await this.notificationRepository.addToQueue(emailId, priorityScore);
    await this.cacheRepository.addToQueue('email_processing', { emailId, priority: priorityScore }, priorityScore);
  }

  async getEmailStats(): Promise<any> {
    try {
      // Intentar obtener del caché primero
      const cachedStats = await this.cacheRepository.getCachedStats();
      if (cachedStats) {
        return cachedStats;
      }

      // Calcular estadísticas
      const stats = await this.notificationRepository.getEmailStats();
      const failedEmails = await this.cacheRepository.getFailedEmails(10);

      const result = {
        ...stats,
        successRate: stats.total > 0 ? ((stats.sent / stats.total) * 100).toFixed(2) : '0.00',
        recentFailures: failedEmails,
        lastUpdated: new Date().toISOString()
      };

      // Cachear por 5 minutos
      await this.cacheRepository.cacheStats(result, 300);

      return result;
    } catch (error: any) {
      console.error('❌ Error obteniendo estadísticas:', error);
      return {
        total: 0,
        sent: 0,
        pending: 0,
        failed: 0,
        today: 0,
        successRate: '0.00',
        recentFailures: [],
        error: error.message
      };
    }
  }

  async getEmailHistory(email: string, limit: number = 20): Promise<EmailNotification[]> {
    try {
      return await this.notificationRepository.getEmailsByRecipient(email, limit);
    } catch (error: any) {
      console.error('❌ Error obteniendo historial de emails:', error);
      return [];
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
