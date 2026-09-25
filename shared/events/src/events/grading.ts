import { z } from 'zod';

/**
 * Published when grading-service finishes evaluating an attempt (auto grade,
 * AI grade, or a re-send of an already-graded result). This event carries
 * everything notifications-service needs to send the "exam graded" email and
 * in-app notification, replacing the legacy `exam.graded` message shape
 * currently produced by mcp-grading-server/src/services/kafka.service.ts.
 *
 * Field evidence (mcp-grading-server/src/tools/grade-exam.ts):
 * - examResultId: `resultId` / `existingResult._id` — always present.
 * - attemptId: `attempt._id` — always present.
 * - candidateId: `attempt.candidateId` — always present.
 * - examId: `attempt.examId` is in scope at both call sites but is not
 *   currently forwarded to sendGradingNotification(); kept optional here
 *   until the producer is updated to pass it through.
 * - examName: `exam.name` / `existingResult.examName` — always present.
 * - status/totalScore/maxScore/percentage: always present (grading result).
 * - candidateEmail/candidateFirstName/candidateLastName: looked up
 *   best-effort from the candidates collection (grade-exam.ts:28-40) and can
 *   be undefined if the lookup fails or the candidate record lacks them —
 *   kept optional, matching current notification.service.ts params.
 */
export const GRADING_RESULT_PUBLISHED = 'grading.result.published' as const;

export const GradingResultPublishedDataSchemaV1 = z.object({
  examResultId: z.string(),
  attemptId: z.string(),
  candidateId: z.string(),
  examId: z.string().optional(),
  examName: z.string(),
  status: z.string(),
  totalScore: z.number(),
  maxScore: z.number(),
  percentage: z.number(),
  candidateEmail: z.string().optional(),
  candidateFirstName: z.string().optional(),
  candidateLastName: z.string().optional(),
  /**
   * Grading source of truth (design.md D5/D6): the pass/fail verdict and the
   * threshold used to compute it, as decided by grading-service. Omitted for
   * `pending_ai_review` (undetermined) and for events published before this
   * field existed — consumers must fall back via their own documented
   * `resolvePassFail`/`resolvePassedFromEvent` helper, never a local literal.
   */
  passed: z.boolean().optional(),
  passingScore: z.number().optional(),
  /**
   * The exam's type (`placement` | `progress` | `final` | `mock` | ...).
   * Placement exams never carry a pass/fail verdict — consumers render
   * `recommendedLevel` instead. Optional: absent on events published before
   * this field existed.
   */
  examType: z.string().optional(),
  /** Level recommended by a placement exam (e.g. `B1`); only set for placement. */
  recommendedLevel: z.string().optional(),
});
export type GradingResultPublishedDataV1 = z.infer<typeof GradingResultPublishedDataSchemaV1>;
