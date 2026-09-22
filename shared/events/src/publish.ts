import type { Producer } from 'kafkajs';
import type { EventEnvelope } from './envelope';

function toKafkaMessage<T>(envelope: EventEnvelope<T>) {
  return {
    key: envelope.subject,
    headers: { type: envelope.type },
    value: JSON.stringify(envelope),
  };
}

/**
 * Publishes an envelope to `topic`. Never throws — logs the error and
 * returns `false` so the caller can decide whether to treat a publish
 * failure as fatal for its own flow (Kafka being down must never crash a
 * request handler).
 */
export async function publishEvent<T>(
  producer: Producer,
  topic: string,
  envelope: EventEnvelope<T>
): Promise<boolean> {
  try {
    await producer.send({ topic, messages: [toKafkaMessage(envelope)] });
    return true;
  } catch (error) {
    console.error(`[@cba/events] Failed to publish '${envelope.type}' to '${topic}':`, error);
    return false;
  }
}

/**
 * Same as publishEvent(), but rejects on failure instead of swallowing the
 * error. Use this when the caller has its own retry/DLQ handling and needs
 * to know the publish failed.
 */
export async function publishEventOrThrow<T>(
  producer: Producer,
  topic: string,
  envelope: EventEnvelope<T>
): Promise<void> {
  await producer.send({ topic, messages: [toKafkaMessage(envelope)] });
}
