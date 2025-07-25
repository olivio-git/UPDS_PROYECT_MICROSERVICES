import { Producer } from 'kafkajs';
import { config } from '../config';

export class EventService {
  constructor(private kafkaProducer: Producer) {}

  async publishUserEvent(eventType: string, eventData: any): Promise<void> {
    try {
      const message = {
        timestamp: new Date().toISOString(),
        eventType,
        service: 'auth-service',
        data: eventData
      };

      await this.kafkaProducer.send({
        topic: config.kafka.topics.userEvents,
        messages: [{
          key: eventData.userId || 'anonymous',
          value: JSON.stringify(message),
          headers: {
            eventType,
            service: 'auth-service',
            timestamp: message.timestamp
          }
        }]
      });

      console.log(`✅ Evento publicado: ${eventType}`, eventData);
    } catch (error) {
      console.error(`❌ Error publicando evento ${eventType}:`, error);
      // No lanzamos el error para no interrumpir el flujo principal
    }
  }

  async publishOtpEvent(eventType: string, eventData: any): Promise<void> {
    try {
      const message = {
        timestamp: new Date().toISOString(),
        eventType,
        service: 'auth-service',
        data: eventData
      };

      await this.kafkaProducer.send({
        topic: 'otp-events',
        messages: [{
          key: eventData.email || eventData.userId || 'anonymous',
          value: JSON.stringify(message),
          headers: {
            eventType,
            service: 'auth-service',
            timestamp: message.timestamp
          }
        }]
      });

      console.log(`✅ Evento OTP publicado: ${eventType}`, eventData);
    } catch (error) {
      console.error(`❌ Error publicando evento OTP ${eventType}:`, error);
    }
  }

  async publishSecurityEvent(eventType: string, eventData: any): Promise<void> {
    try {
      const message = {
        timestamp: new Date().toISOString(),
        eventType,
        service: 'auth-service',
        severity: this.getEventSeverity(eventType),
        data: eventData
      };

      await this.kafkaProducer.send({
        topic: 'security-events',
        messages: [{
          key: eventData.userId || eventData.ipAddress || 'anonymous',
          value: JSON.stringify(message),
          headers: {
            eventType,
            service: 'auth-service',
            severity: message.severity,
            timestamp: message.timestamp
          }
        }]
      });

      console.log(`🔒 Evento de seguridad publicado: ${eventType}`, eventData);
    } catch (error) {
      console.error(`❌ Error publicando evento de seguridad ${eventType}:`, error);
    }
  }

  private getEventSeverity(eventType: string): string {
    const securityEvents: Record<string, string> = {
      'auth.failed_login': 'medium',
      'auth.multiple_failed_logins': 'high',
      'auth.suspicious_activity': 'high',
      'auth.password_changed': 'low',
      'auth.account_locked': 'medium'
    };

    return securityEvents[eventType] || 'low';
  }
}
