import { Kafka, Producer } from 'kafkajs';
import { config } from '../config.js';

let producer: Producer | null = null;
let connected = false;

async function getProducer(): Promise<Producer | null> {
  if (connected && producer) return producer;
  try {
    const kafka = new Kafka({
      clientId: config.kafka.clientId,
      brokers: [config.kafka.broker],
      retry: { initialRetryTime: 300, retries: 3 },
    });
    producer = kafka.producer();
    await producer.connect();
    connected = true;
    console.log('[grading-service] Kafka producer conectado');
    return producer;
  } catch (err: any) {
    console.warn('[grading-service] Kafka no disponible — notificaciones solo via HTTP:', err?.message);
    return null;
  }
}

export async function publishKafkaEvent(
  type: string,
  data: Record<string, unknown>
): Promise<void> {
  try {
    const p = await getProducer();
    if (!p) return;
    await p.send({
      topic: config.kafka.topic,
      messages: [{
        key: type,
        value: JSON.stringify({
          type,
          data,
          timestamp: new Date().toISOString(),
          service: 'grading-service',
        }),
      }],
    });
  } catch {
    // Kafka publish es best-effort — nunca bloquea el grading
  }
}

export async function disconnectKafka(): Promise<void> {
  if (producer && connected) {
    try {
      await producer.disconnect();
    } catch {
      // ignore disconnect errors on shutdown
    } finally {
      connected = false;
      producer = null;
    }
  }
}
