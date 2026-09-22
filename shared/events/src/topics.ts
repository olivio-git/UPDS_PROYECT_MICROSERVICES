/**
 * Kafka topics, grouped by domain. Every topic here also has a matching
 * dead-letter topic named "<topic>.dlq" (see dlqTopic()).
 */
export const TOPICS = {
  USER_EVENTS: 'user-events',
  EXAM_EVENTS: 'exam-events',
  SESSION_EVENTS: 'session-events',
  GRADING_EVENTS: 'grading-events',
} as const;

export type Topic = (typeof TOPICS)[keyof typeof TOPICS];

/** Returns the dead-letter topic name for a given topic, e.g. "exam-events" -> "exam-events.dlq". */
export function dlqTopic(topic: string): string {
  return `${topic}.dlq`;
}
