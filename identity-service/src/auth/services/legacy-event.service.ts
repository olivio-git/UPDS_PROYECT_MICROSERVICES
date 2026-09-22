// src/auth/services/legacy-event.service.ts
//
// Publishes the exact same Kafka messages the old, standalone auth-service
// used to publish (same topics, same envelope shape: { timestamp, eventType,
// service, data }). notifications-service's kafka-consumer.service.ts matches
// on both the legacy 'user.registered' / 'user.logged_in' / 'user.password_changed'
// event names AND the newer 'USER_CREATED' / 'USER_PASSWORD_CHANGED' names
// produced by identity-service's own UserService — so this must keep using
// the legacy names to avoid silently losing the credentials/OTP emails.
//
// Reuses the shared Kafka producer from database/connections.ts instead of
// opening a second Kafka client, unlike the old auth-service which had its
// own.

import { getProducer } from '../../database/connections';
import config from '../../config';

async function publish(topic: string, key: string, eventType: string, data: any): Promise<void> {
  try {
    const message = {
      timestamp: new Date().toISOString(),
      eventType,
      service: 'identity-service',
      data,
    };

    await getProducer().send({
      topic,
      messages: [
        {
          key,
          value: JSON.stringify(message),
          headers: {
            eventType,
            service: 'identity-service',
            timestamp: message.timestamp,
          },
        },
      ],
    });
  } catch (error) {
    // Fire-and-forget, same as the old auth-service EventService: never let a
    // notification failure interrupt a login/register/password flow.
    console.error(`[legacy-event] Error publishing ${eventType} to ${topic}:`, error);
  }
}

export const legacyEventService = {
  publishUserEvent: (eventType: string, data: any) =>
    publish(config.kafka.topics.userEvents, data.userId || 'anonymous', eventType, data),

  publishOtpEvent: (eventType: string, data: any) =>
    publish(config.kafka.topics.otpEvents, data.email || data.userId || 'anonymous', eventType, data),

  publishSecurityEvent: (eventType: string, data: any) =>
    publish(config.kafka.topics.securityEvents, data.userId || data.ipAddress || 'anonymous', eventType, data),
};
