import { Producer } from 'kafkajs';
import { config } from '../config';

export class EventService {
  constructor(private kafkaProducer: Producer) {}

  async publishEmailEvent(eventType: string, eventData: any): Promise<void> {
    try {
      const message = {
        timestamp: new Date().toISOString(),
        eventType,
        service: 'notifications-service',
        data: eventData
      };

      await this.kafkaProducer.send({
        topic: config.kafka.topics.emailEvents,
        messages: [{
          key: eventData.emailId || eventData.to || 'anonymous',
          value: JSON.stringify(message),
          headers: {
            eventType,
            service: 'notifications-service',
            timestamp: message.timestamp
          }
        }]
      });

      console.log(`✅ Evento de email publicado: ${eventType}`, eventData);
    } catch (error) {
      console.error(`❌ Error publicando evento de email ${eventType}:`, error);
    }
  }

  async publishNotificationEvent(eventType: string, eventData: any): Promise<void> {
    try {
      const message = {
        timestamp: new Date().toISOString(),
        eventType,
        service: 'notifications-service',
        data: eventData
      };

      await this.kafkaProducer.send({
        topic: 'notification-events',
        messages: [{
          key: eventData.userId || eventData.email || 'anonymous',
          value: JSON.stringify(message),
          headers: {
            eventType,
            service: 'notifications-service',
            timestamp: message.timestamp
          }
        }]
      });

      console.log(`📢 Evento de notificación publicado: ${eventType}`, eventData);
    } catch (error) {
      console.error(`❌ Error publicando evento de notificación ${eventType}:`, error);
    }
  }

  async publishSystemEvent(eventType: string, eventData: any): Promise<void> {
    try {
      const message = {
        timestamp: new Date().toISOString(),
        eventType,
        service: 'notifications-service',
        severity: this.getEventSeverity(eventType),
        data: eventData
      };

      await this.kafkaProducer.send({
        topic: 'system-events',
        messages: [{
          key: eventData.service || 'notifications-service',
          value: JSON.stringify(message),
          headers: {
            eventType,
            service: 'notifications-service',
            severity: message.severity,
            timestamp: message.timestamp
          }
        }]
      });

      console.log(`🔧 Evento de sistema publicado: ${eventType}`, eventData);
    } catch (error) {
      console.error(`❌ Error publicando evento de sistema ${eventType}:`, error);
    }
  }

  private getEventSeverity(eventType: string): string {
    const severityMap: Record<string, string> = {
      'email.sent': 'low',
      'email.failed': 'medium',
      'email.retry_exceeded': 'high',
      'system.queue_full': 'high',
      'system.service_down': 'critical',
      'system.rate_limit_exceeded': 'medium'
    };

    return severityMap[eventType] || 'low';
  }
}
