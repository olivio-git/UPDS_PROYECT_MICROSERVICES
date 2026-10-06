import { computeRubricQuestionScore, effectiveWeight } from './scoring.js';
import type { IRubricCriterionDefinition } from '../types/index.js';

/** Pure parts of manual review (no DB, no config), unit-tested in tests/manual-review.test.ts. */

export class ReviewError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export type ReviewStatus = 'pending' | 'reviewed';

/** A rubric level as a 0–100 criterion score (the scale the AI grader uses). */
export function levelPercent(criterion: Pick<IRubricCriterionDefinition, 'levels'>, pick: number): number {
  const top = Math.max(0, ...criterion.levels.map((l) => l.score));
  return top > 0 ? (pick / top) * 100 : 0;
}

/** The rubric level closest to a 0–100 AI score, so the reviewer sees the AI's pick as a level. */
export function percentToLevel(criterion: Pick<IRubricCriterionDefinition, 'levels'>, percent: number): number {
  const top = Math.max(0, ...criterion.levels.map((l) => l.score));
  const target = (percent / 100) * top;
  return criterion.levels.reduce((best, l) => (Math.abs(l.score - target) < Math.abs(best - target) ? l.score : best), criterion.levels[0]?.score ?? 0);
}

/**
 * Teacher's rubric score: same math as AI rubric grading
 * (computeRubricQuestionScore) so equal work gets an equal grade whoever
 * marks it. A rubric without usable weights counts criteria equally.
 * Throws when a pick is missing or is not one of the criterion's levels.
 */
export function manualRubricScore(
  criteria: ReadonlyArray<IRubricCriterionDefinition>,
  picks: Record<string, number>,
  points: number,
): number {
  const anyWeight = criteria.some((c) => effectiveWeight(c.weight) > 0);
  const scored = criteria.map((c) => {
    const pick = picks[c.name];
    if (typeof pick !== 'number' || !c.levels.some((l) => l.score === pick)) {
      throw new ReviewError(`Nivel inválido o faltante para "${c.name}"`, 400);
    }
    return { name: c.name, weight: anyWeight ? c.weight : 1, score: levelPercent(c, pick) };
  });
  return computeRubricQuestionScore(scored, points);
}

/** Plain (no rubric) score: within 0..max, at most 2 decimals. */
export function validatePlainScore(score: unknown, max: number): number {
  if (typeof score !== 'number' || !Number.isFinite(score) || score < 0 || score > max) {
    throw new ReviewError(`El puntaje debe estar entre 0 y ${max}`, 400);
  }
  return Math.round(score * 100) / 100;
}

/** What the student answered, as the reviewer reads it. */
export function readResponse(response: any): { text?: string; audioUrl?: string; audioDuration?: number } {
  if (response == null) return { text: '' };
  if (typeof response === 'string') return { text: response };
  const out: { text?: string; audioUrl?: string; audioDuration?: number } = {};
  const text = response.text ?? response.essay ?? response.answer;
  if (typeof text === 'string') out.text = text;
  if (typeof response.audioUrl === 'string') out.audioUrl = response.audioUrl;
  if (typeof response.audioDuration === 'number') out.audioDuration = response.audioDuration;
  if (!out.text && !out.audioUrl) out.text = '';
  return out;
}
