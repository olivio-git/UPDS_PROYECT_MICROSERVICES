/**
 * Single documented fallback default passing score for notifications-service,
 * mirroring `mcp-grading-server/src/grading/scoring.ts` `DEFAULT_PASSING_SCORE`
 * (design.md D6). notifications-service cannot join the exam directly, so —
 * unlike exam-service's `resolvePassFail` — it never resolves a per-exam
 * threshold, only this shared default.
 *
 * Everything in this module is pure (no I/O, no clock, no globals) so it can
 * be reasoned about — and later unit-tested — without a service harness.
 * notifications-service intentionally has no test runner yet; the equivalent
 * exam-service helpers are covered by jest.
 */
export const DEFAULT_PASSING_SCORE = 70;

export const PLACEMENT_EXAM_TYPE = 'placement';

export interface GradingEventForPassFail {
  passed?: boolean | null;
  passingScore?: number;
  status: string;
  percentage: number;
  /** Absent on events/emails produced before the field existed. */
  examType?: string;
  recommendedLevel?: string;
}

/**
 * Placement when the event says so, or — for events/queued emails produced
 * before `examType` existed, or whose exam no longer resolves — when it
 * carries a `recommendedLevel` (grading-service only sets it for placement).
 */
export function isPlacementEvent(
  data: Pick<GradingEventForPassFail, 'examType' | 'recommendedLevel'>
): boolean {
  return data.examType === PLACEMENT_EXAM_TYPE || Boolean(data.recommendedLevel);
}

/**
 * grading-service is the single source of truth for `passed` (spec:
 * grading-pass-fail). This is the ONE compute-on-read fallback for
 * notifications-service, used only for `grading.result.published` events
 * (and stored exam_graded emails) produced before the `passed` field existed.
 *
 * Returns `null` — never `false` — when there is no final verdict: the
 * result is not completed yet (pending review) or the exam is a placement
 * exam (placement exams only produce a recommended level).
 */
export function resolvePassedFromEvent(data: GradingEventForPassFail): boolean | null {
  if (isPlacementEvent(data)) return null;
  if (typeof data.passed === 'boolean') return data.passed;
  if (data.status !== 'completed') return null;
  const threshold =
    typeof data.passingScore === 'number' && Number.isFinite(data.passingScore)
      ? data.passingScore
      : DEFAULT_PASSING_SCORE;
  return data.percentage >= threshold;
}

export const GRADING_VERDICT_KIND = {
  PASSED: 'passed',
  FAILED: 'failed',
  PENDING: 'pending',
  PLACEMENT: 'placement',
} as const;

export type GradingVerdictKind = (typeof GRADING_VERDICT_KIND)[keyof typeof GRADING_VERDICT_KIND];

export interface GradingVerdict {
  kind: GradingVerdictKind;
  /** Resolved verdict; always `null` for pending and placement. */
  passed: boolean | null;
  /** Short user-facing label (Spanish), e.g. "¡Aprobado!" or "Nivel recomendado: B1". */
  label: string;
  recommendedLevel?: string;
}

/**
 * Maps a grading event (or a stored exam_graded email's templateData) to the
 * one verdict every notification channel renders — email subject, HTML/text
 * body and in-app body — so they can never disagree. Placement exams get the
 * recommended level instead of a pass/fail verdict; pending results are
 * never presented as failed.
 */
export function describeGradingVerdict(data: GradingEventForPassFail): GradingVerdict {
  if (isPlacementEvent(data)) {
    if (data.recommendedLevel) {
      return {
        kind: GRADING_VERDICT_KIND.PLACEMENT,
        passed: null,
        label: `Nivel recomendado: ${data.recommendedLevel}`,
        recommendedLevel: data.recommendedLevel,
      };
    }
    return { kind: GRADING_VERDICT_KIND.PENDING, passed: null, label: 'En Revisión' };
  }

  const passed = resolvePassedFromEvent(data);
  if (passed === true) return { kind: GRADING_VERDICT_KIND.PASSED, passed, label: '¡Aprobado!' };
  if (passed === false) return { kind: GRADING_VERDICT_KIND.FAILED, passed, label: 'No Aprobado' };
  return { kind: GRADING_VERDICT_KIND.PENDING, passed: null, label: 'En Revisión' };
}

/** Email subject for the exam_graded template, derived from the verdict. */
export function buildExamGradedSubject(examName: string, verdict: GradingVerdict): string {
  switch (verdict.kind) {
    case GRADING_VERDICT_KIND.PASSED:
      return `✅ Resultado de tu examen: ${examName}`;
    case GRADING_VERDICT_KIND.FAILED:
      return `📋 Resultado de tu examen: ${examName}`;
    case GRADING_VERDICT_KIND.PLACEMENT:
      return `🎯 ${verdict.label} — ${examName}`;
    default:
      return `⏳ Tu examen está en revisión: ${examName}`;
  }
}
