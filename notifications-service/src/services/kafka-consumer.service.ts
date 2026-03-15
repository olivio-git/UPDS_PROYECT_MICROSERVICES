import { Consumer } from 'kafkajs';
import { config } from '../config';
import { NotificationService } from '../services/notification.service';
import { KafkaMessage, Notification, OtpEmailData } from '../types';

export class KafkaConsumerService {
  constructor(
    private consumer: Consumer,
    private notificationService: NotificationService
  ) {}

  async startConsumers(): Promise<void> {
    try {
      console.log('🔥 Iniciando consumidores de Kafka...');

      // Suscribirse a los topics
      await this.consumer.subscribe({
        topics: [
          config.kafka.topics.userEvents,
          config.kafka.topics.otpEvents,
          config.kafka.topics.examEvents
        ],
        fromBeginning: false
      });

      await this.consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          try {
            const messageValue = message.value?.toString();
            if (!messageValue) return;

            const raw = JSON.parse(messageValue);

            // Normalize message shape: some services publish { type, data } while others use { eventType, userData }
            const kafkaMessage: any = {
              ...raw,
              eventType: raw.eventType || raw.type,
              data: raw.data || raw.userData || raw.payload || raw
            };

            console.log(`📨 Mensaje recibido del topic ${topic}:`, kafkaMessage.eventType || kafkaMessage.type);

            await this.handleMessage(topic, kafkaMessage);

          } catch (error) {
            console.error(`❌ Error procesando mensaje de ${topic}:`, error);
          }
        }
      });

      console.log('✅ Consumidores de Kafka iniciados exitosamente');

    } catch (error) {
      console.error('❌ Error iniciando consumidores de Kafka:', error);
      throw error;
    }
  }

  private async handleMessage(topic: string, message: KafkaMessage): Promise<void> {
    switch (topic) {
      case config.kafka.topics.userEvents:
        await this.handleUserEvent(message);
        break;

      case config.kafka.topics.otpEvents:
        await this.handleOtpEvent(message);
        break;

      case config.kafka.topics.examEvents:
        await this.handleExamEvent(message);
        break;

      default:
        console.log(`⚠️ Topic no manejado: ${topic}`);
    }
  }

  private async handleUserEvent(message: KafkaMessage): Promise<void> {
    const { eventType, data: userData } = message;
    console.log(userData,"🔍 [DEBUG] Datos del usuario:", userData);
    try {
      console.log(`🔍 [DEBUG] Evento recibido: ${eventType}`);
      console.log(`🔍 [DEBUG] Datos completos:`, JSON.stringify(userData, null, 2));
      
      switch (eventType) {
        case 'USER_CREATED':
        case 'user.registered':
          console.log(`👤 Nuevo usuario creado: ${userData.email}`);
          
          // Verificar si tiene contraseña temporal y requiere email de credenciales
          if (userData.temporaryPassword && userData.requiresPasswordEmail) {
            console.log(`🔐 [DEBUG] temporaryPassword: ${userData.temporaryPassword}`);
            console.log(`📧 [DEBUG] requiresPasswordEmail: ${userData.requiresPasswordEmail}`);
            console.log(`🔐 Enviando credenciales por email a: ${userData.email}`);
            
            await this.notificationService.sendNewUserCredentialsEmail({
              email: userData.email,
              firstName: userData.firstName,
              lastName: userData.lastName,
              temporaryPassword: userData.temporaryPassword,
              role: userData.role
            });
          } else {
            console.log(`📧 [DEBUG] Sin contraseña temporal - enviando email de bienvenida estándar`);
            console.log(`🔍 [DEBUG] temporaryPassword presente: ${!!userData.temporaryPassword}`);
            console.log(`🔍 [DEBUG] requiresPasswordEmail: ${userData.requiresPasswordEmail}`);
            
            // Email de bienvenida estándar
            await this.notificationService.sendWelcomeEmail(userData);
          }
          break;

        case 'USER_UPDATED':
        case 'user.logged_in':
          console.log(`🔐 Usuario actualizado/logueado: ${userData.email}`);
          // Aquí podrías enviar notificaciones de inicio de sesión si es necesario
          break;

        case 'USER_PASSWORD_CHANGED':
        case 'user.password_changed':
          console.log(`🔑 Usuario cambió contraseña: ${userData.email}`);
          
          // Si tiene contraseña temporal y requiere email
          if (userData.temporaryPassword && userData.requiresPasswordEmail) {
            console.log(`🔐 Enviando nueva contraseña temporal por email a: ${userData.email}`);
            await this.notificationService.sendPasswordResetEmail({
              email: userData.email,
              firstName: userData.firstName,
              lastName: userData.lastName,
              temporaryPassword: userData.temporaryPassword,
              isTemporaryPassword: userData.isTemporaryPassword || true
            });
          }
          break;
        case 'user.add_user_to_session':
          console.log(`➕ Usuario agregado a sesión: ${userData.email} a la sesión ${userData.sessionId}`);
          break;
        case 'user.account_locked':
          console.log(`🚫 Cuenta bloqueada: ${userData.email}`);
          // Aquí podrías enviar notificación de cuenta bloqueada
          break;

        default:
          console.log(`⚠️ Evento de usuario no manejado: ${eventType}`);
      }
    } catch (error) {
      console.error(`❌ Error manejando evento de usuario ${eventType}:`, error);
    }
  }

  private async handleOtpEvent(message: KafkaMessage): Promise<void> {
    const { eventType, data } = message;

    try {
      switch (eventType) {
        case 'otp.generated':
          console.log(`📱 OTP generado para: ${data.email}`);
          const otpData: OtpEmailData = {
            email: data.email,
            code: data.code,
            purpose: data.purpose,
            expiresAt: new Date(data.expiresAt),
            templateData: data.templateData
          };
          
          await this.notificationService.sendOtpEmail(otpData);
          break;

        case 'otp.verified':
          console.log(`✅ OTP verificado para: ${data.email}`);
          // Aquí podrías enviar confirmación de verificación exitosa
          break;

        case 'otp.expired':
          console.log(`⏰ OTP expirado para: ${data.email}`);
          // Aquí podrías enviar notificación de código expirado
          break;

        case 'otp.max_attempts_exceeded':
          console.log(`🚫 Máximo de intentos OTP excedido para: ${data.email}`);
          // Aquí podrías enviar alerta de seguridad
          break;

        default:
          console.log(`⚠️ Evento OTP no manejado: ${eventType}`);
      }
    } catch (error) {
      console.error(`❌ Error manejando evento OTP ${eventType}:`, error);
    }
  }

  private async handleExamEvent(message: KafkaMessage): Promise<void> {
    const { eventType, data } = message as any;
    if (!eventType) console.warn('⚠️ handleExamEvent: eventType is falsy, message:', JSON.stringify(message));
    try {
      switch (eventType) {
        case 'session.candidate.added': {
          // Single candidate added
          const candidateId = data.candidateId;
          if (!candidateId) {
            console.warn('No candidateId in event data');
            return;
          }
          const notifPayload: Omit<Notification, '_id' | 'createdAt' | 'updatedAt'> = {
            recipientId: candidateId,
            recipientType: 'candidate',
            type: 'session.candidate.added',
            channel: 'in-app',
            content: {
              title: 'Has sido agregado a una sesión',
              body: `Te han agregado a la sesión ${data.sessionName || data.sessionId}`,
              link: `/sessions/${data.sessionId}`
            },
            read: false,
            priority: 'normal',
            metadata: { sessionId: data.sessionId, addedBy: data.addedBy },
          };
          const created = await this.notificationService.createInAppNotification(notifPayload);
          if (created) {
            console.log(`🔔 Notificación in-app creada para candidate ${candidateId}`);
          }
          break;
        }

        case 'session.candidates.added': {
          // Multiple candidates added — notify each one
          const candidateIds: string[] = data.candidateIds || [];
          if (candidateIds.length === 0) {
            console.warn('No candidateIds in event data');
            return;
          }
          for (const candidateId of candidateIds) {
            const notifPayload: Omit<Notification, '_id' | 'createdAt' | 'updatedAt'> = {
              recipientId: candidateId,
              recipientType: 'candidate',
              type: 'session.candidate.added',
              channel: 'in-app',
              content: {
                title: 'Has sido agregado a una sesión',
                body: `Te han agregado a la sesión ${data.sessionName || data.sessionId}`,
                link: `/sessions/${data.sessionId}`
              },
              read: false,
              priority: 'normal',
              metadata: { sessionId: data.sessionId },
            };
            await this.notificationService.createInAppNotification(notifPayload);
          }
          console.log(`🔔 Notificaciones in-app creadas para ${candidateIds.length} candidatos`);
          break;
        }

        case 'session.started':
        case 'session.ended':
        case 'session.cancelled': {
          // Emit session.status.changed to all enrolled candidates and creator via socket
          const enrolledCandidateIds: string[] = data.enrolledCandidateIds || [];
          const sessionSocketPayload = {
            sessionId: String(data.sessionId),
            sessionName: data.sessionName,
            status: data.status,
            examId: data.examId ? String(data.examId) : undefined,
          };

          for (const candidateId of enrolledCandidateIds) {
            this.notificationService.emitToUser(candidateId, 'session.status.changed', sessionSocketPayload);
          }

          // Also emit to the creator/teacher so admin views update
          if (data.createdBy) {
            this.notificationService.emitToUser(String(data.createdBy), 'session.status.changed', sessionSocketPayload);
          }

          console.log(`📡 session.status.changed emitido a ${enrolledCandidateIds.length} candidatos (evento: ${eventType})`);
          break;
        }

        case 'exam.graded': {
          if (!data.candidateEmail) {
            console.warn('⚠️ exam.graded: sin candidateEmail en el evento — omitiendo email');
            break;
          }
          console.log(`📧 exam.graded → enviando email a: ${data.candidateEmail}`);
          await this.notificationService.sendExamGradedEmail({
            email: data.candidateEmail,
            firstName: data.candidateFirstName || 'Estudiante',
            lastName: data.candidateLastName || '',
            examName: data.examName || 'Examen',
            score: Number(data.score) || 0,
            maxScore: Number(data.maxScore) || 0,
            percentage: Number(data.percentage) || 0,
            status: data.status || 'completed',
            pdfBase64: data.pdfBase64 || undefined,
            pdfFilename: data.pdfFilename || undefined,
          });
          break;
        }

        default:
          console.log(`⚠️ Evento de exam no manejado: ${eventType}`);
      }
    } catch (error) {
      console.error(`❌ Error manejando evento exam ${eventType}:`, error);
    }
  }

  async stopConsumers(): Promise<void> {
    try {
      console.log('🛑 Deteniendo consumidores de Kafka...');
      await this.consumer.disconnect();
      console.log('✅ Consumidores de Kafka detenidos');
    } catch (error) {
      console.error('❌ Error deteniendo consumidores de Kafka:', error);
    }
  }
}
