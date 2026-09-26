/**
 * Pure scoring math shared by grade-exam.ts.
 *
 * grading-service is the single source of truth for the graded facts it
 * writes to `exam_results`: the weighted final percentage and the pass/fail
 * decision. This module has no I/O so it stays easy to reason about and,
 * later, to unit-test with a runner.
 */

/** Default threshold used when an exam has no configured `structure.passingScore`. */
export const DEFAULT_PASSING_SCORE = 70;

export type ScoringMethod = 'weighted_sections' | 'raw_points';
export type ExamResultStatus = 'partial' | 'completed' | 'pending_ai_review';

export interface SectionScoreInput {
  name: string;
  competency: string;
  score: number;
  maxScore: number;
  percentage: number;
  /** Teacher-configured weight for this section (not guaranteed to sum to 100 on legacy docs). */
  weight: number;
}

export interface WeightedSectionResult extends SectionScoreInput {
  /** This section's contribution to the final weighted percentage, on a 0-100 scale. */
  weightedPercentage: number;
}

export interface WeightedScoreResult {
  percentage: number;
  sections: WeightedSectionResult[];
}

/** A section is eligible to contribute when it has points and a positive, finite weight. */
function isEligibleSection(s: SectionScoreInput): boolean {
  return s.maxScore > 0 && Number.isFinite(s.weight) && s.weight > 0;
}

/**
 * Computes the weighted final percentage: Σ(r_i·w_i)/Σw_i over sections with
 * `maxScore > 0` and a finite `weight > 0`, where r_i = score_i/maxScore_i is
 * the UNROUNDED section ratio. Sections that don't meet that gate (e.g. an
 * empty section) are excluded from both the numerator and the denominator so
 * the student isn't penalized for a section that contributed nothing.
 *
 * If the eligible weights sum to 0 (e.g. every section has weight 0, or a
 * legacy document never set weights), falls back to `fallbackPercentage`
 * (the raw sum percentage) instead of dividing by zero.
 *
 * The final percentage is rounded ONCE to 1 decimal, matching the
 * raw-percentage rounding used elsewhere. Per-section `weightedPercentage`
 * is rounded for display only and is never summed — summing rounded
 * contributions drifts (e.g. 3 equal sections at 70% would yield 69.9).
 */
export function computeWeightedPercentage(
  sections: SectionScoreInput[],
  fallbackPercentage: number
): WeightedScoreResult {
  const totalWeight = sections.reduce(
    (sum, s) => sum + (isEligibleSection(s) ? s.weight : 0),
    0
  );

  if (totalWeight <= 0) {
    return {
      percentage: fallbackPercentage,
      sections: sections.map(s => ({ ...s, weightedPercentage: 0 })),
    };
  }

  let exactWeighted = 0;
  const weightedSections: WeightedSectionResult[] = sections.map(s => {
    if (!isEligibleSection(s)) return { ...s, weightedPercentage: 0 };
    const contribution = ((s.score / s.maxScore) * 100 * s.weight) / totalWeight;
    exactWeighted += contribution;
    return { ...s, weightedPercentage: Math.round(contribution * 10) / 10 };
  });

  const percentage = Math.round(exactWeighted * 10) / 10;

  return { percentage, sections: weightedSections };
}

/**
 * Decides which scoring method applies to an attempt (design D4): sectioned
 * exams that are not `placement` use the weighted formula above; everything
 * else (adaptive/placement attempts and flat question pools) keeps the raw
 * sum it already had.
 */
export function decideScoringMethod(hasSections: boolean, examType: string): ScoringMethod {
  return hasSections && examType !== 'placement' ? 'weighted_sections' : 'raw_points';
}

/**
 * Resolves the passing threshold to store/compare against: the exam's own
 * configured value when it's a valid number, otherwise the documented
 * default. This is the only place besides the two consumer `passFail.ts`
 * helpers allowed to reference `DEFAULT_PASSING_SCORE`.
 */
export function resolvePassingScore(passingScore: unknown): number {
  return typeof passingScore === 'number' && Number.isFinite(passingScore)
    ? passingScore
    : DEFAULT_PASSING_SCORE;
}

/**
 * Decides `passed` at grading time (design D5). Undetermined
 * (`pending_ai_review`) results omit the field rather than storing a
 * provisional `false`, so a manual-review exam is never reported as
 * "not passed" before a human finishes grading it.
 */
export function decidePassed(
  percentage: number,
  passingScore: number,
  status: ExamResultStatus
): boolean | undefined {
  if (status !== 'completed') return undefined;
  return percentage >= passingScore;
}

/** Minimal per-question shape needed to derive exam-level scores. */
export interface QuestionScoreRef {
  questionId: { toString(): string };
  score: number;
  maxScore: number;
}

/** Minimal shape of an attempt's `sectionsStructure` entry. */
export interface SectionStructureRef {
  name: string;
  competency: string;
  weight: number;
  questionIds: ReadonlyArray<{ toString(): string }>;
}

export interface ExamScoringInput {
  questionResults: ReadonlyArray<QuestionScoreRef>;
  sectionsStructure?: ReadonlyArray<SectionStructureRef>;
  examType: string;
  /** Raw `exam.structure.passingScore` (validated via `resolvePassingScore`). */
  examPassingScore: unknown;
  status: ExamResultStatus;
}

export interface ExamSectionScore extends SectionScoreInput {
  weightedPercentage?: number;
}

export interface ExamScoringOutcome {
  totalScore: number;
  maxScore: number;
  percentage: number;
  sections?: ExamSectionScore[];
  scoringMethod: ScoringMethod;
  /** `undefined` for placement exams — they have no pass/fail threshold. */
  passingScore: number | undefined;
  passed: boolean | undefined;
}

/**
 * Placement exams produce a recommended level, never a pass/fail verdict
 * (user decision W5). Both `passed` and `passingScore` are therefore left
 * undefined for them, and `UNSETTABLE_GRADED_FIELDS` clears any stale value
 * left by an earlier grading pass.
 */
export function hasPassFailVerdict(examType: string): boolean {
  return examType !== 'placement';
}

/**
 * Derives every graded fact grading-service owns (totals, per-section scores,
 * weighted/raw percentage, scoring method, passing threshold and `passed`)
 * from already-scored question results. Shared by the full grading path
 * (grade-exam.ts) and the auto-grader-only `/regrade-session` path so both
 * write exactly the same fields with the same math.
 */
export function computeExamScoring(input: ExamScoringInput): ExamScoringOutcome {
  const { questionResults, sectionsStructure, examType, examPassingScore, status } = input;

  const totalScore = Math.round(questionResults.reduce((sum, qr) => sum + qr.score, 0) * 100) / 100;
  const maxScore = questionResults.reduce((sum, qr) => sum + qr.maxScore, 0);
  const rawPercentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100 * 10) / 10 : 0;

  const rawSections: ExamSectionScore[] | undefined = sectionsStructure?.map(sec => {
    const sectionQIds = new Set(sec.questionIds.map(id => id.toString()));
    const sectionResults = questionResults.filter(qr => sectionQIds.has(qr.questionId.toString()));
    const secTotal = sectionResults.reduce((s, qr) => s + qr.score, 0);
    const secMax = sectionResults.reduce((s, qr) => s + qr.maxScore, 0);
    return {
      name: sec.name,
      competency: sec.competency,
      score: secTotal,
      maxScore: secMax,
      percentage: secMax > 0 ? Math.round((secTotal / secMax) * 100 * 10) / 10 : 0,
      weight: sec.weight,
    };
  });

  const scoringMethod = decideScoringMethod(!!rawSections && rawSections.length > 0, examType);
  const weightedResult = rawSections && scoringMethod === 'weighted_sections'
    ? computeWeightedPercentage(rawSections, rawPercentage)
    : undefined;

  const percentage = weightedResult?.percentage ?? rawPercentage;
  const sections = weightedResult?.sections ?? rawSections;
  const passingScore = hasPassFailVerdict(examType) ? resolvePassingScore(examPassingScore) : undefined;
  const passed = passingScore === undefined ? undefined : decidePassed(percentage, passingScore, status);

  return { totalScore, maxScore, percentage, sections, scoringMethod, passingScore, passed };
}

/**
 * Graded fields that can legitimately be absent on a (re)grading pass and
 * must therefore be removed from an existing document instead of left stale:
 * `passed` is omitted for `pending_ai_review`, `passed`/`passingScore` are
 * omitted for placement exams, and `sections` is omitted for flat
 * (non-sectioned) attempts.
 */
export const UNSETTABLE_GRADED_FIELDS = ['passed', 'passingScore', 'sections'] as const;

/**
 * Builds a `$unset` stage for every listed key whose value is `undefined` in
 * `doc`. The MongoDB driver drops undefined keys from `$set`, so without this
 * an update would silently keep the previous value.
 */
export function buildUnsetForUndefined(
  doc: object,
  keys: ReadonlyArray<string>
): { $unset?: Record<string, ''> } {
  const values = doc as Record<string, unknown>;
  const unset: Record<string, ''> = {};
  for (const key of keys) {
    if (values[key] === undefined) unset[key] = '';
  }
  return Object.keys(unset).length > 0 ? { $unset: unset } : {};
}
