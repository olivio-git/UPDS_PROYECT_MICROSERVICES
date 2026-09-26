/**
 * Pure scoring math shared by grade-exam.ts.
 *
 * grading-service is the single source of truth for the graded facts it
 * writes to `exam_results`: the weighted final percentage and the pass/fail
 * decision. This module has no I/O so it stays easy to reason about and,
 * later, to unit-test with a runner.
 */

import type {
  ICompetencyMastery,
  ICompetencyMasteryItem,
  ILevel,
  IMasteryCheck,
  IRubricCriterionDefinition,
  IRubricCriterionScore,
  RawRubricCriterionScore,
} from '../types/index.js';

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

/** Minimal per-competency shape needed to derive mastery. */
export interface CompetencyPercentageRef {
  competency: string;
  percentage: number;
}

/**
 * Computes the level-mastery indicator (design D13, level-mastery-indicator
 * spec). Purely informational: the caller MUST NOT feed the result back into
 * `decidePassed`/`passed` above — mastery and pass/fail are two independent
 * verdicts computed from the same underlying scores.
 *
 * Omitted (returns `undefined`) when:
 *  - `examType === 'placement'` — placement exams have a `recommendedLevel`,
 *    never a mastery indicator against a `targetLevel`.
 *  - `level` did not resolve (missing/deleted `targetLevel`) or is inactive.
 *  - the level has no numeric `overallMinScore` or no usable
 *    `competencyRequirements` object — nothing to compare against.
 *
 * Per-competency (works identically for sectioned and flat-question-pool
 * exams — both derive `competencyScores` from question results, never from
 * `sections`): only competencies the exam actually evaluated
 * (`competencyScores`) are checked against the level's matching requirement.
 * A competency the level requires but the exam never evaluates is not
 * surfaced here — the frontend renders that as "no evaluado" by diffing the
 * returned list against its own fixed competency set (all Level documents
 * require exactly the same 6 keys — verified against `cba_platform.levels`).
 * A competency the exam evaluated but the level has no numeric requirement
 * for is likewise skipped: there is nothing to compare against.
 *
 * Overall: compared against the exam's final `percentage` — the weighted
 * percentage for `weighted_sections` exams (design D3), the same number
 * stored on `IExamResult.percentage` and shown to the student — never a
 * separately re-derived raw score.
 */
export function computeMastery(
  competencyScores: ReadonlyArray<CompetencyPercentageRef>,
  overallPercentage: number,
  examType: string,
  level: Pick<ILevel, 'code' | 'isActive' | 'overallMinScore' | 'competencyRequirements'> | null | undefined
): ICompetencyMastery | undefined {
  if (examType === 'placement') return undefined;
  if (!level || !level.isActive) return undefined;

  const overallMinScore = level.overallMinScore;
  if (typeof overallMinScore !== 'number' || !Number.isFinite(overallMinScore)) return undefined;

  const requirements = level.competencyRequirements;
  if (!requirements || typeof requirements !== 'object') return undefined;

  const competencies: ICompetencyMasteryItem[] = [];
  for (const cs of competencyScores) {
    const minScore = requirements[cs.competency]?.minScore;
    if (typeof minScore !== 'number' || !Number.isFinite(minScore)) continue;
    competencies.push({
      competency: cs.competency,
      minScore,
      percentage: cs.percentage,
      achieved: cs.percentage >= minScore,
    });
  }

  const overall: IMasteryCheck = {
    minScore: overallMinScore,
    percentage: overallPercentage,
    achieved: overallPercentage >= overallMinScore,
  };

  return { levelCode: level.code, overall, competencies };
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
 * omitted for placement exams, `sections` is omitted for flat
 * (non-sectioned) attempts, and `competencyMastery` is omitted whenever
 * `computeMastery` returns `undefined` (placement, no/inactive level, or a
 * level without usable requirements).
 */
export const UNSETTABLE_GRADED_FIELDS = ['passed', 'passingScore', 'sections', 'competencyMastery'] as const;

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

/**
 * Rubric-driven AI grading (design D9-D12, rubric-ai-grading spec). The AI
 * scores each criterion 0-100 independently; the code — not the AI's own
 * total — applies the rubric's weights deterministically. This keeps the
 * formula auditable and immune to prompt-following drift.
 *
 * NOTE: rubrics with `scoringType: 'holistic'` are currently scored exactly
 * like analytic ones (per criterion, weighted in code). A dedicated holistic
 * path (one overall band) is intentionally out of scope for now.
 */

export interface RubricScoringOutcome {
  /** Matched, clamped, weight-annotated criteria. Empty when nothing matched — callers must fall back to the default-criteria grading path. */
  criteria: IRubricCriterionScore[];
  /** True when the AI response covered only a subset of the rubric's scorable criteria. */
  partial: boolean;
  /** Final question score in points, already scaled by `points`. */
  questionScore: number;
}

/**
 * The only weight a criterion can contribute: finite and > 0, otherwise 0.
 * Used for BOTH the denominator and the numerator so a bad weight (NaN,
 * Infinity, negative, missing) can never leak into the score as NaN.
 */
export function effectiveWeight(weight: unknown): number {
  return typeof weight === 'number' && Number.isFinite(weight) && weight > 0 ? weight : 0;
}

/** True when the rubric has at least one criterion with a usable (positive, finite) weight. */
export function hasScorableCriteria(definitions: ReadonlyArray<IRubricCriterionDefinition> | undefined): boolean {
  return Array.isArray(definitions) && definitions.some(d => effectiveWeight(d?.weight) > 0);
}

/**
 * Normalizes a criterion name for matching: NFD + strip combining
 * diacritics, trim, lowercase, collapse internal whitespace. So "Gramática ",
 * "gramatica" and "GRAMATICA" all compare equal.
 */
export function normalizeCriterionName(name: unknown): string {
  if (typeof name !== 'string') return '';
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * Parses an AI-returned criterion score. Only a finite `number` or a
 * non-empty numeric string are accepted; `null`, booleans, `""`, arrays,
 * objects and non-numeric strings are invalid (the criterion is then treated
 * as missing, which marks the breakdown partial). `Number(null)`/`Number([])`
 * would otherwise silently become 0.
 */
export function parseCriterionScore(raw: unknown): number | undefined {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : undefined;
  if (typeof raw === 'string' && raw.trim() !== '') {
    const n = Number(raw.trim());
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

/**
 * Applies rubric weights to already-matched criterion scores. Normalizes by
 * the ACTUAL sum of the effective weights (not an assumed 100) — this is
 * both the grading-time safety net for legacy rubrics whose weights don't
 * sum to 100, and the mechanism that makes a partial AI response
 * renormalize correctly over just the criteria it did return. Criteria with
 * an effective weight of 0 or a non-finite score contribute to neither sum.
 * Returns 0 (never NaN) when nothing is scorable.
 */
export function computeRubricQuestionScore(
  criteria: ReadonlyArray<IRubricCriterionScore>,
  points: number
): number {
  let weightSum = 0;
  let weighted = 0;
  for (const c of criteria) {
    const w = effectiveWeight(c.weight);
    if (w <= 0 || !Number.isFinite(c.score)) continue;
    weightSum += w;
    weighted += c.score * w;
  }
  if (weightSum <= 0 || !Number.isFinite(points)) return 0;

  const weightedPct = weighted / weightSum;
  return Math.round((weightedPct / 100) * points * 100) / 100;
}

/**
 * Matches the AI's raw per-criterion response against the rubric's defined
 * criteria and scores the question.
 *
 * Matching (deterministic, never assigns one criterion's score to another):
 *   1. By normalized name (see `normalizeCriterionName`). Every AI entry
 *      matched this way is consumed.
 *   2. Duplicate definition names (after normalization): the AI entries with
 *      that name are paired with the definitions positionally among
 *      themselves ONLY when their counts are equal; otherwise the whole group
 *      is ambiguous and every definition in it is treated as missing (its
 *      AI entries are still consumed so they can't leak into step 3). The
 *      same applies when the AI repeats a name that the rubric defines once.
 *   3. Positional fallback, only when the AI returned exactly
 *      `definitions.length` entries (it followed the prompt's list), the
 *      definition had no name match at all, and the entry at the same index
 *      is unconsumed and its normalized name matches NO definition (e.g. a
 *      translated or misspelled name). Anything else is "missing".
 *
 * Validity: only finite numbers / non-empty numeric strings are scores
 * (`parseCriterionScore`); valid scores are clamped to [0,100].
 *
 * Weights: criteria whose effective weight is 0 (non-finite, <= 0, missing)
 * are excluded from the score AND from the stored breakdown, and don't
 * count toward `partial` — they can't contribute anything either way.
 *
 * Returns empty `criteria` (and `questionScore: 0`) when no scorable
 * criterion has a valid score — the caller (grade-exam.ts) treats that as
 * "fall back to the default 4-criteria grading path", covering an
 * unparseable AI response, a response with only unknown names/invalid
 * scores, and a rubric with degenerate (all-zero) weights.
 */
export function scoreRubricCriteria(
  definitions: ReadonlyArray<IRubricCriterionDefinition>,
  aiScores: ReadonlyArray<RawRubricCriterionScore>,
  points: number
): RubricScoringOutcome {
  const defNames = definitions.map(d => normalizeCriterionName(d?.name));
  const aiNames = aiScores.map(a => normalizeCriterionName(a?.name));
  const definedNameSet = new Set(defNames.filter(n => n !== ''));

  const consumed = new Set<number>();
  // Index of the AI entry assigned to each definition (undefined = missing).
  const assignment: Array<number | undefined> = definitions.map(() => undefined);
  // Definitions that saw at least one same-name AI entry (matched or ambiguous).
  const hadNameMatch = definitions.map(() => false);

  // Steps 1-2: name matching, grouped by normalized definition name.
  const groups = new Map<string, number[]>();
  defNames.forEach((n, i) => {
    if (n === '') return;
    const g = groups.get(n);
    if (g) g.push(i); else groups.set(n, [i]);
  });
  for (const [name, defIdxs] of groups) {
    const aiIdxs: number[] = [];
    aiNames.forEach((n, j) => { if (n === name) aiIdxs.push(j); });
    if (aiIdxs.length === 0) continue;
    for (const j of aiIdxs) consumed.add(j);
    for (const i of defIdxs) hadNameMatch[i] = true;
    if (aiIdxs.length === defIdxs.length) {
      defIdxs.forEach((defIdx, k) => { assignment[defIdx] = aiIdxs[k]; });
    }
    // else: ambiguous → every definition in the group stays missing.
  }

  // Step 3: strict positional fallback.
  if (aiScores.length === definitions.length) {
    definitions.forEach((_, i) => {
      if (assignment[i] !== undefined || hadNameMatch[i]) return;
      if (consumed.has(i)) return;
      if (definedNameSet.has(aiNames[i]!)) return;
      assignment[i] = i;
      consumed.add(i);
    });
  }

  const matched: IRubricCriterionScore[] = [];
  let scorableCount = 0;
  definitions.forEach((def, i) => {
    const weight = effectiveWeight(def?.weight);
    if (weight <= 0) return;
    scorableCount++;

    const j = assignment[i];
    if (j === undefined) return;
    const raw = aiScores[j]!;
    const numericScore = parseCriterionScore(raw.score);
    if (numericScore === undefined) return;

    const clamped = Math.min(100, Math.max(0, numericScore));
    const entry: IRubricCriterionScore = { name: def.name, weight, score: clamped };
    // Only set `feedback` when present: the raw MongoDB driver serializes an
    // undefined nested key as `null`.
    if (typeof raw.feedback === 'string' && raw.feedback.trim() !== '') entry.feedback = raw.feedback;
    matched.push(entry);
  });

  if (matched.length === 0) {
    return { criteria: [], partial: false, questionScore: 0 };
  }

  const questionScore = computeRubricQuestionScore(matched, points);
  const partial = matched.length < scorableCount;
  return { criteria: matched, partial, questionScore };
}

/**
 * Builds the flat `aiAnalysis.criteria` map (name -> score) from a rubric
 * breakdown with UNIQUE keys: a rubric may legitimately repeat a criterion
 * name, and `Object.fromEntries` would silently keep only the last one.
 * Repeats get a deterministic " (2)", " (3)", ... suffix in breakdown order.
 */
export function buildCriteriaScoreMap(
  criteria: ReadonlyArray<IRubricCriterionScore>
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of criteria) {
    let key = c.name;
    let n = 2;
    while (Object.prototype.hasOwnProperty.call(out, key)) key = `${c.name} (${n++})`;
    out[key] = c.score;
  }
  return out;
}
