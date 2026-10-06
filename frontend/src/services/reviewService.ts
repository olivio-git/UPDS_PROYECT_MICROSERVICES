import { api } from './api.service';

/**
 * Manual review of open answers (writing, speaking, picture tasks) that a
 * teacher grades, optionally starting from an AI suggestion.
 */

export type ReviewMode = 'manual' | 'assisted';
export type ReviewStatus = 'pending' | 'reviewed';

export interface ReviewQueueItem {
  resultId: string;
  questionId: string;
  studentName: string;
  examTitle: string;
  sessionName: string;
  questionNumber: number;
  questionType: string;
  competency: string;
  level: string;
  submittedAt: string;
  mode: ReviewMode;
  status: ReviewStatus;
  /** Score given, once reviewed. */
  score?: number;
  maxScore: number;
}

export interface ReviewRubricLevel {
  score: number;
  description: string;
}

export interface ReviewRubricCriterion {
  name: string;
  description?: string;
  /** Percentage weight; criteria without weights count equally. */
  weight?: number;
  levels: ReviewRubricLevel[];
}

export interface ReviewTask extends ReviewQueueItem {
  question: {
    question: string;
    instructions?: string;
    context?: string;
    mediaUrl?: string;
    mediaType?: 'image' | 'audio' | 'video';
    /** What the image shows, written by the teacher (accessibility + AI). */
    mediaAlt?: string;
    /** Expected length, e.g. { min: 60, max: 80 } words. */
    wordTarget?: { min: number; max: number };
  };
  response: {
    text?: string;
    audioUrl?: string;
    audioDuration?: number;
  };
  rubric?: { name: string; criteria: ReviewRubricCriterion[] };
  aiSuggestion?: {
    score: number;
    criteria: Array<{ name: string; score: number }>;
    rationale: string;
  };
  /** Present when the answer was already reviewed. */
  review?: {
    score: number;
    criteria?: Record<string, number>;
    feedback: string;
    reviewedBy: string;
    reviewedAt: string;
  };
}

export interface SubmitReviewInput {
  score: number;
  criteria?: Record<string, number>;
  feedback: string;
}

const BASE = '/api/v1/exam-results/review';

export const reviewService = {
  async getQueue(status: ReviewStatus): Promise<ReviewQueueItem[]> {
    const body = await api.get<{ success: boolean; data: ReviewQueueItem[] }>(`${BASE}/queue`, { params: { status } });
    return body.data ?? [];
  },

  async getTask(resultId: string, questionId: string): Promise<ReviewTask> {
    const body = await api.get<{ success: boolean; data: ReviewTask }>(`${BASE}/${resultId}/questions/${questionId}`);
    return body.data;
  },

  async submit(resultId: string, questionId: string, input: SubmitReviewInput): Promise<void> {
    await api.post(`${BASE}/${resultId}/questions/${questionId}`, input);
  },
};

/** Score from rubric picks, scaled to the question's points (half-point steps). */
export function scoreFromRubric(
  criteria: ReviewRubricCriterion[],
  picks: Record<string, number>,
  maxScore: number,
): number | null {
  if (!criteria.length || criteria.some((c) => picks[c.name] === undefined)) return null;
  const weights = criteria.map((c) => (c.weight && c.weight > 0 ? c.weight : 1));
  const total = weights.reduce((a, b) => a + b, 0);
  const fraction = criteria.reduce((acc, c, i) => {
    const top = Math.max(...c.levels.map((l) => l.score), 1);
    return acc + (picks[c.name] / top) * (weights[i] / total);
  }, 0);
  return Math.round(fraction * maxScore * 2) / 2;
}
