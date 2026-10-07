import { ObjectId } from 'mongodb';
import { getQuestions } from '../db/collections.js';

import { MIN_ANSWERS_FOR_OBSERVED_DIFFICULTY, observedDifficulty } from '../grading/item-difficulty.js';

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
