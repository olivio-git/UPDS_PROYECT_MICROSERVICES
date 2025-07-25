import { Consumer } from 'kafkajs';
import { NotificationService } from '../services/notification.service';
import { OtpEmailData, UserEventData, KafkaMessage } from '../types';
import { config } from '../config';

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
          config.kafka.topics.otpEvents
        ],
        fromBeginning: false
      });

      await this.consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          try {
            const messageValue = message.value?.toString();
            if (!messageValue) return;

            const kafkaMessage: KafkaMessage = JSON.parse(messageValue);
            
            console.log(`📨 Mensaje recibido del topic ${topic}:`, kafkaMessage.eventType);

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

      default:
        console.log(`⚠️ Topic no manejado: ${topic}`);
    }
  }

  private async handleUserEvent(message: KafkaMessage): Promise<void> {
    const { eventType, data } = message;
    const userData: UserEventData = data;

    try {
      switch (eventType) {
        case 'user.registered':
          console.log(`👤 Nuevo usuario registrado: ${userData.email}`);
          await this.notificationService.sendWelcomeEmail(userData);
          break;

        case 'user.logged_in':
          console.log(`🔐 Usuario inició sesión: ${userData.email}`);
          // Aquí podrías enviar notificaciones de inicio de sesión si es necesario
          break;

        case 'user.password_changed':
          console.log(`🔑 Usuario cambió contraseña: ${userData.email}`);
          // Aquí podrías enviar confirmación de cambio de contraseña
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
