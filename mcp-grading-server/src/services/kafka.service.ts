import { Kafka, Producer } from 'kafkajs';
import { createEvent, publishEvent } from '@cba/events';
import { config } from '../config.js';

let kafka: Kafka | null = null;
let producer: Producer | null = null;
let producerConnected = false;

function getKafkaClient(): Kafka {
  if (!kafka) {
    kafka = new Kafka({
      clientId: config.kafka.clientId,
      brokers: [config.kafka.broker],
      retry: { initialRetryTime: 300, retries: 3 },
    });
  }
  return kafka;
}

/** Shared Kafka client, also used by the exam.attempt.finished consumer (see grading-consumer.ts). */
export function getKafkaForConsumer(): Kafka {
  return getKafkaClient();
}

async function getProducer(): Promise<Producer | null> {
  if (producerConnected && producer) return producer;
  try {
    producer = getKafkaClient().producer();
    await producer.connect();
    producerConnected = true;
    console.log('[grading-service] Kafka producer conectado');
    return producer;
  } catch (err: any) {
    console.warn('[grading-service] Kafka no disponible — notificaciones solo via HTTP:', err?.message);
    return null;
  }
}

/**
 * Publishes a `@cba/events` envelope of the given `type` on `topic`, keyed by
 * `subject`. Returns `false` (never throws) when Kafka is unavailable, so
 * callers can fall back to a synchronous alternative if one exists.
 */
export async function publishEnvelopeEvent<T>(
  topic: string,
  type: string,
  subject: string,
  data: T
): Promise<boolean> {
  const p = await getProducer();
  if (!p) return false;
  const envelope = createEvent({ type, source: 'grading-service', subject, data });
  return publishEvent(p, topic, envelope);
}

export async function disconnectKafka(): Promise<void> {
  if (producer && producerConnected) {
    try {
      await producer.disconnect();
    } catch {
      // ignore disconnect errors on shutdown
    } finally {
      producerConnected = false;
      producer = null;
    }
  }
}
