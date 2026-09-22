export {
  EventEnvelopeSchema,
  createEvent,
  type EventEnvelope,
  type EventEnvelopeShape,
  type CreateEventInput,
} from './envelope';

export { TOPICS, dlqTopic, type Topic } from './topics';

export {
  EXAM_ATTEMPT_FINISHED,
  ExamAttemptFinishedReasonSchema,
  ExamAttemptFinishedDataSchemaV1,
  type ExamAttemptFinishedReason,
  type ExamAttemptFinishedDataV1,
} from './events/exam';

export {
  GRADING_RESULT_PUBLISHED,
  GradingResultPublishedDataSchemaV1,
  type GradingResultPublishedDataV1,
} from './events/grading';

export { publishEvent, publishEventOrThrow } from './publish';

export {
  runConsumer,
  classifyMessage,
  startHeartbeat,
  type MessageClassification,
  type EventHandler,
  type RunConsumerOptions,
  type RunConsumerLogger,
  type ConsumerHandle,
} from './consumer';
