import { z } from 'zod';

/**
 * Published when a candidate's exam attempt finishes, regardless of why
 * (manual submit, session forcibly ended, adaptive engine stopping the exam,
 * or the time limit expiring).
 *
 * Field evidence (exam-service):
 * - attemptId/examId/candidateId/sessionId: all `required: true` on the
 *   Attempt mongoose schema (exam-service/src/models/attempt.model.ts).
 * - finishedAt: optional on the schema (set only once finished), but always
 *   present by the time this event fires — finishExam() sets it just before
 *   grading kicks off (exam-service/src/services/examTaking.service.ts:394).
 * - reason: not currently tracked as a stored field; it is derived by the
 *   producer from which code path finished the attempt (manual finish,
 *   session-manager ending the session, the adaptive engine stopping, or the
 *   time-remaining sweep marking it expired). See examTaking.service.ts and
 *   session.service.ts for the corresponding finish call sites.
 */
export const EXAM_ATTEMPT_FINISHED = 'exam.attempt.finished' as const;

export const ExamAttemptFinishedReasonSchema = z.enum([
  'submitted',
  'session_ended',
  'adaptive_completed',
  'expired',
]);
export type ExamAttemptFinishedReason = z.infer<typeof ExamAttemptFinishedReasonSchema>;

export const ExamAttemptFinishedDataSchemaV1 = z.object({
  attemptId: z.string(),
  examId: z.string(),
  candidateId: z.string(),
  sessionId: z.string(),
  finishedAt: z.string(),
  reason: ExamAttemptFinishedReasonSchema,
});
export type ExamAttemptFinishedDataV1 = z.infer<typeof ExamAttemptFinishedDataSchemaV1>;
