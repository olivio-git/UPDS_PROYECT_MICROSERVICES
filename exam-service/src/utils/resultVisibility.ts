/**
 * Result visibility (spec: result-visibility). Honors the exam's
 * `configuration.showResults` on every student-facing result surface.
 * Absent/undefined defaults to visible — backward compatible with exams
 * created before this field existed and with legacy results.
 *
 * `pending_ai_review` results are never shown as final (spec: Pending AI
 * Review Is Never Shown As Final): even with `showResults` true, the student
 * view strips every score field and flags the result `pending: true` — the
 * partial auto-graded score is not the final one.
 */

export interface ExamForVisibility {
  configuration?: {
    showResults?: boolean;
  };
}

export function isResultVisible(exam?: ExamForVisibility | null): boolean {
  return exam?.configuration?.showResults !== false;
}

/**
 * Fields copied over as-is (never renamed) when a result is hidden, so the
 * hidden payload keeps the exact same key names the endpoint normally uses
 * (e.g. `level`/`date` on `my-recent` and `attempt/:id`, vs `examLevel`/
 * `evaluatedAt` on the raw `IExamResult`-shaped endpoints).
 */
const CARRY_OVER_FIELDS = [
  'id', '_id', 'examName', 'examLevel', 'level', 'date', 'evaluatedAt', 'examDuration', 'duration', 'timeAllowed',
] as const;

/**
 * Student view of a result:
 * - `showResults===false` → minimal shape flagged `resultsHidden: true` (no
 *   score, `passed`, breakdown, feedback, competencies or recommended level).
 * - `status==='pending_ai_review'` → same minimal shape flagged `pending: true`
 *   (both flags when hidden AND pending).
 * - otherwise (visible and not pending) → `result` unchanged, whatever fields
 *   it already carries (e.g. `passed` from `resolvePassFail`).
 */
export function toStudentView(result: Record<string, any>, exam?: ExamForVisibility | null): Record<string, any> {
  const visible = isResultVisible(exam);
  const pending = result.status === 'pending_ai_review';
  if (visible && !pending) return result;

  const scoreless: Record<string, any> = { status: result.status };
  if (!visible) scoreless.resultsHidden = true;
  if (pending) scoreless.pending = true;
  for (const key of CARRY_OVER_FIELDS) {
    if (result[key] !== undefined) scoreless[key] = result[key];
  }
  scoreless.totalQuestions = result.totalQuestions ?? (Array.isArray(result.questionResults) ? result.questionResults.length : 0);
  return scoreless;
}

/**
 * Top-level keys of an adaptive start/submit/resume response the runner needs
 * to keep going. Everything else (`gradeResult`, `stopReason`, the full
 * `adaptiveState`) reveals correctness or the level reached.
 */
const ADAPTIVE_CARRY_OVER_FIELDS = ['finished', 'question', 'nextQuestion', 'attemptId', 'browserLockdown'] as const;

/** Adaptive progress that is safe to show while results are hidden (counts only). */
export interface HiddenAdaptiveProgress {
  questionsAnswered?: number;
  maxQuestions?: number;
  isFinished?: boolean;
}

/**
 * Adaptive exam (CAT) responses under `showResults===false`: the student gets
 * no score feedback at all — no per-answer correct/incorrect/points
 * (`gradeResult`), no current/final level, no `consecutiveWrong`, no
 * `levelHistory`, and no `stopReason` (`consecutive_wrong` would itself reveal
 * three wrong answers in a row). Only what the runner needs to continue is
 * kept (allowlist). Visible (`true`/absent) → `response` unchanged.
 *
 * Only the RESPONSE is trimmed — the adaptive algorithm keeps reading the full
 * `adaptiveState` stored on the Attempt server-side.
 */
export function toStudentAdaptiveView(response: Record<string, any>, exam?: ExamForVisibility | null): Record<string, any> {
  if (isResultVisible(exam)) return response;

  const hidden: Record<string, any> = { resultsHidden: true };
  for (const key of ADAPTIVE_CARRY_OVER_FIELDS) {
    if (response[key] !== undefined) hidden[key] = response[key];
  }

  const state = response.adaptiveState;
  if (state) {
    const progress: HiddenAdaptiveProgress = {};
    const questionsAnswered = state.questionsAnswered ?? (Array.isArray(state.levelHistory) ? state.levelHistory.length : undefined);
    if (questionsAnswered !== undefined) progress.questionsAnswered = questionsAnswered;
    if (state.maxQuestions !== undefined) progress.maxQuestions = state.maxQuestions;
    if (state.isFinished !== undefined) progress.isFinished = state.isFinished;
    hidden.adaptiveState = progress;
    if (questionsAnswered !== undefined) hidden.questionsAnswered = questionsAnswered;
  }
  return hidden;
}

/** Non-score Attempt fields a student may see about their own attempts. */
const ATTEMPT_SUMMARY_FIELDS = ['_id', 'status', 'startedAt', 'finishedAt', 'sessionId', 'examId'] as const;

/**
 * Projects an Attempt document to non-score fields — drops `adaptiveState`
 * (levelHistory scores/levels), `integrity`, answer ids, etc.
 */
export function toAttemptSummary(attempt: Record<string, any>): Record<string, any> {
  const summary: Record<string, any> = {};
  for (const key of ATTEMPT_SUMMARY_FIELDS) {
    if (attempt[key] !== undefined) summary[key] = attempt[key];
  }
  return summary;
}
