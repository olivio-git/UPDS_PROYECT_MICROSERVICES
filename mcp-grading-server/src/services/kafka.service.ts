import { Kafka, Producer } from 'kafkajs';
import { createEvent, publishEvent } from '@cba/events';
import { config } from '../config.js';

let kafka: Kafka | null = null;
let producer: Producer | null = null;
let producerConnected = false;
// Guards getProducer() against concurrent callers each creating/connecting
// their own producer (leaking every one but the last) and against a failed
// connect leaking its half-open producer.
let connectingPromise: Promise<Producer | null> | null = null;

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
  if (connectingPromise) return connectingPromise;

  connectingPromise = (async () => {
    const candidate = getKafkaClient().producer();
    try {
      await candidate.connect();
      producer = candidate;
      producerConnected = true;
      console.log('[grading-service] Kafka producer conectado');
      return producer;
    } catch (err: any) {
      console.warn('[grading-service] Kafka no disponible — notificaciones solo via HTTP:', err?.message);
      try {
        await candidate.disconnect();
      } catch {
        // best-effort cleanup of a producer that never fully connected
      }
      return null;
    } finally {
      // Clear regardless of outcome so the next call retries instead of
      // reusing a stale in-flight promise.
      connectingPromise = null;
    }
  })();

  return connectingPromise;
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
