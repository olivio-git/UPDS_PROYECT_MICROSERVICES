import { randomUUID } from 'node:crypto';
import { z } from 'zod';

/**
 * Event type naming rule: lowercase, dot-separated, past tense.
 * Examples: "exam.attempt.finished", "grading.result.published".
 */
const EVENT_TYPE_PATTERN = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/;

export const EventEnvelopeSchema = z.object({
  id: z.string().uuid(),
  type: z.string().regex(EVENT_TYPE_PATTERN, 'type must be lowercase.dot.separated, e.g. "exam.attempt.finished"'),
  version: z.number().int().min(1),
  occurredAt: z.string().min(1),
  source: z.string().min(1),
  subject: z.string().min(1),
  data: z.record(z.string(), z.unknown()),
});

export type EventEnvelopeShape = z.infer<typeof EventEnvelopeSchema>;

/**
 * Typed envelope: same shape as EventEnvelopeSchema, but with `data` narrowed
 * to the caller's payload type instead of a loose record.
 */
export type EventEnvelope<T = unknown> = Omit<EventEnvelopeShape, 'data'> & {
  data: T;
};

export interface CreateEventInput<T> {
  type: string;
  /** Defaults to 1. Bump when the `data` shape for `type` changes incompatibly. */
  version?: number;
  source: string;
  /** Used as the Kafka message key (e.g. attemptId). */
  subject: string;
  data: T;
}

/**
 * Builds a fully-formed event envelope: generates `id` (UUID v4) and
 * `occurredAt` (ISO timestamp) so producers never have to.
 */
export function createEvent<T>(input: CreateEventInput<T>): EventEnvelope<T> {
  return {
    id: randomUUID(),
    type: input.type,
    version: input.version ?? 1,
    occurredAt: new Date().toISOString(),
    source: input.source,
    subject: input.subject,
    data: input.data,
  };
}
