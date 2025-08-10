import { Kafka, Producer, Consumer, EachMessagePayload } from 'kafkajs'; 
import { env } from './env';
import { logger} from '../utils/logger';

let kafka: Kafka;
let producer: Producer;
let consumer: Consumer;

export const initKafka = async (): Promise<void> => {
  try {
    kafka = new Kafka({
      clientId: env.KAFKA_CLIENT_ID,
      brokers: [env.KAFKA_BROKER],
      retry: {
        initialRetryTime: 100,
        retries: 5
      }
    });

    // Initialize producer
    producer = kafka.producer();
    await producer.connect();
    logger.info('✅ Kafka producer connected');

    // Initialize consumer
    consumer = kafka.consumer({ groupId: env.KAFKA_GROUP_ID });
    await consumer.connect();
    logger.info('✅ Kafka consumer connected');

    // Subscribe to topics
    await subscribeToTopics();
    
    // Start consuming messages
    await startConsuming();
  } catch (error) {
    logger.error('Failed to initialize Kafka:', error);
    // Don't exit, Kafka is optional
  }
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