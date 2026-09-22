import { Kafka, Producer, Consumer, EachMessagePayload } from 'kafkajs';
import { env } from './env';
import { logger} from '../utils/logger';

let kafka: Kafka;
let producer: Producer;
let consumer: Consumer;
let connected = false;

// Kafka must never block server startup: on connect failure we log a
// warning and retry in the background with exponential backoff (capped at
// 30s) instead of leaving the producer/consumer permanently disconnected.
// Same pattern as session-manager-service/src/services/KafkaService.ts.
let stopped = false;
let retryTimer: NodeJS.Timeout | null = null;
let retryDelayMs = 1000;
const MAX_RETRY_DELAY_MS = 30000;

export const initKafka = async (): Promise<void> => {
  kafka = new Kafka({
    clientId: env.KAFKA_CLIENT_ID,
    brokers: [env.KAFKA_BROKER],
    retry: {
      initialRetryTime: 100,
      retries: 5
    }
  });

  // Dedicated producer used both for legacy publishEvent() calls and for
  // @cba/events envelopes (exam.attempt.finished). Idempotent + single
  // in-flight request avoids duplicate/out-of-order publishes on retry.
  producer = kafka.producer({
    idempotent: true,
    maxInFlightRequests: 1
  });

  consumer = kafka.consumer({ groupId: env.KAFKA_GROUP_ID });

  await attemptConnect();
};

const attemptConnect = async (): Promise<void> => {
  try {
    await producer.connect();
    logger.info('✅ Kafka producer connected');

    await consumer.connect();
    logger.info('✅ Kafka consumer connected');

    await subscribeToTopics();
    await startConsuming();

    connected = true;
    retryDelayMs = 1000; // reset backoff once we're back up
  } catch (error) {
    connected = false;
    logger.warn(`⚠️ Kafka not available, retrying in ${retryDelayMs}ms:`, error);
    scheduleReconnect();
  }
};

const scheduleReconnect = (): void => {
  if (stopped || retryTimer) return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void attemptConnect();
  }, retryDelayMs);
  retryTimer.unref?.();
  retryDelayMs = Math.min(retryDelayMs * 2, MAX_RETRY_DELAY_MS);
};

const subscribeToTopics = async (): Promise<void> => {
  const topics = [
    'user-events',
    'candidate-events',
    'session-events'
  ];

  for (const topic of topics) {
    await consumer.subscribe({ topic, fromBeginning: false });
    logger.info(`Subscribed to topic: ${topic}`);
  }
};

const startConsuming = async (): Promise<void> => {
  await consumer.run({
    eachMessage: async ({ topic, partition, message }: EachMessagePayload) => {
      try {
        const value = message.value?.toString();
        if (!value) return;

        const event = JSON.parse(value);
        logger.info(`Received event from ${topic}:`, event.type);

        // Handle different event types
        switch (event.type) {
          case 'user.registered':
            // Handle new user registration
            break;
          case 'candidate.verified':
            // Handle candidate verification
            break;
          case 'session.started':
            // Handle session start
            break;
          default:
            logger.warn(`Unhandled event type: ${event.type}`);
        }
      } catch (error) {
        logger.error('Error processing Kafka message:', error);
      }
    }
  });
};

export const getProducer = (): Producer => {
  if (!producer) {
    throw new Error('Kafka producer not initialized');
  }
  return producer;
};

export const getKafka = (): Kafka => {
  if (!kafka) {
    throw new Error('Kafka client not initialized');
  }
  return kafka;
};

export const isKafkaConnected = (): boolean => connected;

export const disconnectKafka = async (): Promise<void> => {
  stopped = true;
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
  await Promise.allSettled([producer?.disconnect(), consumer?.disconnect()]);
};

export const publishEvent = async (type: string, data: any): Promise<void> => {
  try {
    const event = {
      type,
      data,
      timestamp: new Date().toISOString(),
      service: 'exam-service'
    };

    await producer.send({
      topic: 'exam-events',
      messages: [
        {
          key: type,
          value: JSON.stringify(event)
        }
      ]
    });

    logger.info(`Published event: ${type}`);
  } catch (error) {
    logger.error(`Error publishing event ${type}:`, error);
  }
};
