import { ObjectId } from 'mongodb';
import { getQuestions } from '../db/collections.js';

/**
 * Item statistics from real use: how often each question was answered and what
 * share of its points students earned (classical p-value). Once a question has
 * enough answers, its observed difficulty replaces the one the author guessed,
 * so the bank learns which "easy" questions students actually find hard.
 *
 * Observed difficulty (1–5) from the share of points earned:
 *   ≥85% → 1, ≥70% → 2, ≥50% → 3, ≥30% → 4, below → 5.
 */
export const MIN_ANSWERS_FOR_OBSERVED_DIFFICULTY = 20;

export function observedDifficulty(averageShare: number): number {
  if (averageShare >= 0.85) return 1;
  if (averageShare >= 0.7) return 2;
  if (averageShare >= 0.5) return 3;
  if (averageShare >= 0.3) return 4;
  return 5;
}

interface ScoredAnswer {
  questionId: ObjectId | string;
  score: number;
  maxScore: number;
  timeSpent?: number;
}

/** Adds one graded exam's answers to each question's running statistics. */
export async function recordQuestionStatistics(answers: readonly ScoredAnswer[]): Promise<void> {
  for (const a of answers) {
    if (!(a.maxScore > 0)) continue;
    const id = typeof a.questionId === 'string' ? new ObjectId(a.questionId) : a.questionId;
    const q = await getQuestions().findOne({ _id: id }, { projection: { statistics: 1, difficulty: 1 } });
    if (!q) continue;
    const stats: any = q.statistics ?? {};
    const n = (stats.timesUsed ?? 0) + 1;
    const share = Math.max(0, Math.min(1, a.score / a.maxScore));
    const averageScore = ((stats.averageScore ?? 0) * (n - 1) + share) / n;
    const averageTime = ((stats.averageTime ?? 0) * (n - 1) + (a.timeSpent ?? 0)) / n;
    await getQuestions().updateOne(
      { _id: id },
      {
        $set: {
          'statistics.timesUsed': n,
          'statistics.averageScore': Math.round(averageScore * 1000) / 1000,
          'statistics.averageTime': Math.round(averageTime),
          'statistics.difficulty': n >= MIN_ANSWERS_FOR_OBSERVED_DIFFICULTY ? observedDifficulty(averageScore) : (stats.difficulty ?? q.difficulty),
          lastUsed: new Date(),
        },
      },
    );
  }
}
