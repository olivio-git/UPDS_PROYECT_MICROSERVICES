import axios from 'axios';
import {
  createEvent,
  publishEvent,
  TOPICS,
  EXAM_ATTEMPT_FINISHED,
  type ExamAttemptFinishedReason,
} from '@cba/events';
import { getProducer } from '../config/kafka';
import { env } from '../config/env';
import { logger } from '../utils/logger';

export interface ExamAttemptFinishedInput {
  attemptId: string;
  examId: string;
  candidateId: string;
  sessionId: string;
  finishedAt: Date;
  reason: ExamAttemptFinishedReason;
}

/**
 * Original synchronous HTTP call to grading-service, kept as a fallback for
 * when the Kafka publish fails (producer down / not connected). Without this,
 * a Kafka outage would silently drop grading and the student would never get
 * a result.
 */
function fallbackHttpGradeRequest(attemptId: string, logPrefix: string): void {
  axios
    .post(
      `${env.GRADING_SERVICE_URL}/api/v1/grading/exam`,
      { attemptId },
      { timeout: 120000 }
    )
    .then((result) => {
      logger.info(
        `✅ ${logPrefix} Grading completed via HTTP fallback for attempt ${attemptId}, examResultId: ${result.data?.data?.examResultId}`
      );
    })
    .catch((error: any) => {
      logger.error(`❌ ${logPrefix} Grading failed via HTTP fallback for attempt ${attemptId}:`, error.message);
    });
}

/**
 * Publishes `exam.attempt.finished` on `exam-events` so grading-service can
 * grade the attempt asynchronously. If the Kafka publish fails (e.g. the
 * producer isn't connected), falls back to the legacy synchronous HTTP call
 * to grading-service so the student still gets a result within the
 * frontend's ~60s poll window.
 */
export async function publishExamAttemptFinished(
  input: ExamAttemptFinishedInput,
  logPrefix: string
): Promise<void> {
  const envelope = createEvent({
    type: EXAM_ATTEMPT_FINISHED,
    source: 'exam-service',
    subject: input.attemptId,
    data: {
      attemptId: input.attemptId,
      examId: input.examId,
      candidateId: input.candidateId,
      sessionId: input.sessionId,
      finishedAt: input.finishedAt.toISOString(),
      reason: input.reason,
    },
  });

  let published = false;
  try {
    published = await publishEvent(getProducer(), TOPICS.EXAM_EVENTS, envelope);
  } catch (error) {
    logger.error(`${logPrefix} Failed to publish exam.attempt.finished for attempt ${input.attemptId}:`, error);
    published = false;
  }

  if (published) {
    logger.info(
      `${logPrefix} Published exam.attempt.finished (reason=${input.reason}) for attempt ${input.attemptId} via Kafka`
    );
    return;
  }

  logger.warn(`${logPrefix} Kafka publish failed for attempt ${input.attemptId}, falling back to HTTP grading call`);
  fallbackHttpGradeRequest(input.attemptId, logPrefix);
}
