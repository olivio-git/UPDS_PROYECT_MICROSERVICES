import type { IExamResult } from '../models/examResult.model';

/**
 * Single documented fallback default passing score for exam-service,
 * mirroring `mcp-grading-server/src/grading/scoring.ts` `DEFAULT_PASSING_SCORE`
 * (design.md D6). Used ONLY when a legacy `exam_results` document has no
 * stored `passingScore` and its exam no longer resolves a threshold either.
 */
export const DEFAULT_PASSING_SCORE = 70;

export const PLACEMENT_EXAM_TYPE = 'placement';

export interface PassFailResolution {
  /**
   * `null` when there is no final verdict: the result is not yet completed
   * (e.g. `pending_ai_review`) or the exam is a placement exam (placement
   * exams only produce a recommended level). Never a provisional `false`.
   */
  passed: boolean | null;
  /** `null` for placement exams — they have no pass/fail threshold. */
  passingScore: number | null;
}

type ResultForPassFail = Pick<IExamResult, 'percentage'> & PlacementSignal & {
  status: string;
  passed?: boolean;
  passingScore?: number;
};

/** Placement-only fields grading-service stores on a result (never set for other exam types). */
interface PlacementSignal {
  recommendedLevel?: string | null;
  placementMode?: string | null;
  levelScores?: unknown[] | null;
}

interface ExamStructureForPassFail {
  passingScore?: number;
}

interface ExamForPassFail {
  type?: string;
  structure?: ExamStructureForPassFail;
}

/** Mirrors grading-service's `resolvePassingScore` guard: only a finite number counts. */
function isValidPassingScore(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Picks the threshold: the stored value, else the exam's configured value,
 * else the single documented default — each only when it's a finite number.
 */
export function resolvePassingScore(result: { passingScore?: unknown }, exam?: ExamForPassFail | null): number {
  if (isValidPassingScore(result.passingScore)) return result.passingScore;
  if (isValidPassingScore(exam?.structure?.passingScore)) return exam!.structure!.passingScore!;
  return DEFAULT_PASSING_SCORE;
}

export function isPlacementExam(exam?: { type?: string } | null): boolean {
  return exam?.type === PLACEMENT_EXAM_TYPE;
}

/**
 * True when the stored result itself carries a placement signal. Lets callers
 * detect placement even when the exam document no longer resolves (deleted
 * exam, legacy data) — grading-service only sets these fields for placement.
 */
export function hasPlacementSignal(result?: PlacementSignal | null): boolean {
  if (!result) return false;
  return (
    Boolean(result.recommendedLevel) ||
    Boolean(result.placementMode) ||
    (Array.isArray(result.levelScores) && result.levelScores.length > 0)
  );
}

/**
 * The exam type to expose to consumers: the exam's own type, or `placement`
 * when the exam no longer resolves but the result carries a placement signal.
 */
export function resolveExamType(result: object, exam?: { type?: string } | null): string | undefined {
  if (exam?.type) return exam.type;
  return hasPlacementSignal(result as PlacementSignal) ? PLACEMENT_EXAM_TYPE : undefined;
}

/**
 * grading-service is the single source of truth for `passed`/`passingScore`
 * (spec: grading-pass-fail). This is the ONE compute-on-read fallback helper
 * for exam-service, used only for legacy results that predate those stored
 * fields. It never persists the computed value back to the document.
 */
export function resolvePassFail(result: ResultForPassFail, exam?: ExamForPassFail | null): PassFailResolution {
  // Placement exams never get a verdict (grading-service leaves both fields
  // unset for them); this also neutralizes any stale legacy `passed`.
  if (isPlacementExam(exam) || hasPlacementSignal(result)) {
    return { passed: null, passingScore: null };
  }

  const passingScore = resolvePassingScore(result, exam);

  if (typeof result.passed === 'boolean') {
    return { passed: result.passed, passingScore };
  }

  if (result.status !== 'completed') {
    return { passed: null, passingScore };
  }

  return { passed: result.percentage >= passingScore, passingScore };
}
