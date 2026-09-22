import { runConsumer, TOPICS, EXAM_ATTEMPT_FINISHED, type ExamAttemptFinishedDataV1, type ConsumerHandle } from '@cba/events';
import { getKafkaForConsumer } from './kafka.service.js';
import { gradeExam } from '../tools/grade-exam.js';

let handle: ConsumerHandle | null = null;

/**
 * Consumes `exam.attempt.finished` from `exam-events` and grades the
 * attempt. Runs alongside the existing POST /api/v1/grading/exam route and
 * the reconciliation sweeper — gradeExam() is itself idempotent (an
 * already-graded attempt just re-sends the notification), so overlapping
 * triggers are safe.
 *
 * `consumerConfig.sessionTimeout` is raised because GROQ grading calls can
 * run well past Kafka's default 30s session timeout; @cba/events' runConsumer
 * also sends a heartbeat every ~3s while the handler is in flight as a second
 * layer of protection.
 */
export async function startGradingConsumer(): Promise<void> {
  handle = await runConsumer({
    kafka: getKafkaForConsumer(),
    groupId: 'grading-service',
    topics: [TOPICS.EXAM_EVENTS],
    consumerConfig: { sessionTimeout: 60000 },
    handlers: {
      [EXAM_ATTEMPT_FINISHED]: async (envelope) => {
        const data = envelope.data as ExamAttemptFinishedDataV1;
        console.log(
          `[grading-consumer] exam.attempt.finished received: attempt=${data.attemptId} reason=${data.reason}`
        );
        await gradeExam(data.attemptId);
      },
    },
  });
}

export async function stopGradingConsumer(): Promise<void> {
  if (handle) {
    await handle.stop();
    handle = null;
  }
}
