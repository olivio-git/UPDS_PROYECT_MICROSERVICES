import type { Consumer, ConsumerConfig, EachMessagePayload, Kafka, Producer } from 'kafkajs';
import { EventEnvelopeSchema, type EventEnvelope } from './envelope';
import { dlqTopic } from './topics';

export type MessageClassification = 'envelope' | 'legacy' | 'invalid';

/**
 * Classifies a parsed Kafka message value:
 * - 'legacy': no `id` or no `version` field — an old-shape message
 *   (`{ type, data, timestamp, service }`). Must be ignored, never DLQ'd.
 * - 'envelope': has both `id` and `version` and passes EventEnvelopeSchema.
 * - 'invalid': has both `id` and `version` (so it claims to be an envelope)
 *   but fails schema validation. Must go to the DLQ.
 *
 * Pure function — no I/O, no Kafka dependency — so it can be unit tested and
 * reused by runConsumer() below.
 */
export function classifyMessage(value: unknown): MessageClassification {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return 'legacy';
  }
  const obj = value as Record<string, unknown>;
  const looksLikeEnvelope = 'id' in obj && 'version' in obj;
  if (!looksLikeEnvelope) {
    return 'legacy';
  }
  return EventEnvelopeSchema.safeParse(obj).success ? 'envelope' : 'invalid';
}

export type EventHandler = (envelope: EventEnvelope<unknown>) => Promise<void>;

export interface RunConsumerLogger {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

export interface RunConsumerOptions {
  kafka: Kafka;
  groupId: string;
  topics: string[];
  /** Map of envelope `type` -> handler. Types with no handler are ignored (debug log), not DLQ'd. */
  handlers: Record<string, EventHandler>;
  /** Number of retries before giving up and sending to the DLQ. Default 3. */
  maxRetries?: number;
  logger?: RunConsumerLogger;
  /**
   * Optional passthrough config for `kafka.consumer()`, e.g.
   * `{ sessionTimeout: 60000 }` for handlers that can run longer than
   * Kafka's default 30s session timeout (GROQ grading calls, for example).
   * `groupId` is always taken from the `groupId` option above.
   */
  consumerConfig?: Omit<ConsumerConfig, 'groupId'>;
}

export interface ConsumerHandle {
  stop: () => Promise<void>;
}

const INITIAL_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 30000;
const HEARTBEAT_INTERVAL_MS = 3000;

/**
 * Starts a periodic heartbeat call while a long-running handler executes, so
 * Kafka does not consider the consumer dead mid-handler (e.g. GROQ grading
 * calls can take well over 30s, past kafkajs's default sessionTimeout).
 * Returns a stop function that clears the interval. Heartbeat errors are
 * swallowed with a debug log — a failed heartbeat must never fail the
 * handler itself.
 */
export function startHeartbeat(
  heartbeat: () => Promise<void>,
  logger: RunConsumerLogger = console,
  intervalMs: number = HEARTBEAT_INTERVAL_MS
): () => void {
  const interval = setInterval(() => {
    heartbeat().catch((error) => {
      logger.debug('[@cba/events] Heartbeat call failed:', error);
    });
  }, intervalMs);
  interval.unref?.();
  return () => clearInterval(interval);
}

/**
 * Runs a Kafka consumer that:
 * - ignores legacy-shaped messages (no id/version) with a debug log,
 * - sends envelope-shaped-but-invalid messages to `<topic>.dlq`,
 * - runs the matching handler with up to `maxRetries` attempts (small
 *   backoff between attempts), sending to the DLQ (with error info) if all
 *   retries fail,
 * - ignores messages whose `type` has no handler (debug log, not DLQ'd),
 * - never lets a Kafka connection failure crash the process: connect() is
 *   retried in the background with exponential backoff (1s -> 30s), the
 *   same pattern already used in identity-service and session-manager-service.
 */
export async function runConsumer(options: RunConsumerOptions): Promise<ConsumerHandle> {
  const {
    kafka,
    groupId,
    topics,
    handlers,
    maxRetries = 3,
    logger = console,
    consumerConfig,
  } = options;

  const consumer: Consumer = kafka.consumer({ groupId, ...consumerConfig });
  const dlqProducer: Producer = kafka.producer();

  let stopped = false;
  let retryTimer: NodeJS.Timeout | null = null;
  let retryDelayMs = INITIAL_RETRY_DELAY_MS;

  const sendToDlq = async (topic: string, rawValue: string, error: unknown): Promise<void> => {
    try {
      await dlqProducer.send({
        topic: dlqTopic(topic),
        messages: [
          {
            value: JSON.stringify({
              originalTopic: topic,
              originalMessage: rawValue,
              error:
                error instanceof Error
                  ? { message: error.message, stack: error.stack }
                  : error,
              failedAt: new Date().toISOString(),
            }),
          },
        ],
      });
    } catch (dlqError) {
      logger.error(`[@cba/events] Failed to publish to DLQ topic '${dlqTopic(topic)}':`, dlqError);
      // Rethrow so kafkajs does not commit the offset: the message is
      // redelivered instead of being silently dropped.
      throw dlqError;
    }
  };

  const runHandlerWithRetries = async (
    topic: string,
    rawValue: string,
    envelope: EventEnvelope<unknown>,
    handler: EventHandler,
    heartbeat: () => Promise<void>
  ): Promise<void> => {
    let attempt = 0;
    for (;;) {
      const stopHeartbeat = startHeartbeat(heartbeat, logger);
      try {
        await handler(envelope);
        return;
      } catch (error) {
        attempt += 1;
        if (attempt > maxRetries) {
          logger.error(
            `[@cba/events] Handler for '${envelope.type}' failed after ${maxRetries} retries, sending to DLQ:`,
            error
          );
          await sendToDlq(topic, rawValue, error);
          return;
        }
        const backoffMs = Math.min(200 * 2 ** (attempt - 1), 5000);
        logger.warn(
          `[@cba/events] Handler for '${envelope.type}' failed (attempt ${attempt}/${maxRetries}), retrying in ${backoffMs}ms:`,
          error
        );
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      } finally {
        stopHeartbeat();
      }
    }
  };

  const eachMessage = async ({ topic, message, heartbeat }: EachMessagePayload): Promise<void> => {
    const raw = message.value?.toString();
    if (!raw) return;

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      logger.warn(`[@cba/events] Unparseable JSON on topic '${topic}', sending to DLQ:`, error);
      await sendToDlq(topic, raw, error);
      return;
    }

    const classification = classifyMessage(parsed);
    if (classification === 'legacy') {
      logger.debug(`[@cba/events] Ignoring legacy-shaped message on topic '${topic}'`);
      return;
    }
    if (classification === 'invalid') {
      const result = EventEnvelopeSchema.safeParse(parsed);
      logger.warn(`[@cba/events] Envelope-shaped message failed validation on topic '${topic}', sending to DLQ`);
      await sendToDlq(topic, raw, result.success ? undefined : result.error);
      return;
    }

    const envelope = parsed as EventEnvelope<unknown>;
    const handler = handlers[envelope.type];
    if (!handler) {
      logger.debug(`[@cba/events] No handler for type '${envelope.type}' on topic '${topic}', ignoring`);
      return;
    }

    await runHandlerWithRetries(topic, raw, envelope, handler, heartbeat);
  };

  // kafkajs restarts the consumer itself on retriable errors; on a
  // non-retriable crash it stays down, so reconnect it ourselves.
  consumer.on(consumer.events.CRASH, ({ payload }) => {
    if (payload.restart || stopped) return;
    logger.error(`[@cba/events] Consumer '${groupId}' crashed, reconnecting:`, payload.error);
    void consumer
      .disconnect()
      .catch(() => undefined)
      .finally(() => scheduleReconnect());
  });

  const scheduleReconnect = (): void => {
    if (stopped || retryTimer) return;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      void connect();
    }, retryDelayMs);
    retryTimer.unref?.();
    retryDelayMs = Math.min(retryDelayMs * 2, MAX_RETRY_DELAY_MS);
  };

  const connect = async (): Promise<void> => {
    try {
      await consumer.connect();
      await dlqProducer.connect();
      await consumer.subscribe({ topics, fromBeginning: false });
      await consumer.run({ eachMessage });
      retryDelayMs = INITIAL_RETRY_DELAY_MS;
      logger.info(`[@cba/events] Consumer '${groupId}' connected, subscribed to [${topics.join(', ')}]`);
    } catch (error) {
      logger.warn(`[@cba/events] Consumer '${groupId}' failed to connect, retrying in background:`, error);
      scheduleReconnect();
    }
  };

  await connect();

  return {
    stop: async (): Promise<void> => {
      stopped = true;
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
      await Promise.allSettled([consumer.disconnect(), dlqProducer.disconnect()]);
    },
  };
}
