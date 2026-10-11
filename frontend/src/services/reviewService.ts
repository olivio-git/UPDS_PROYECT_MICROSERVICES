import { GATEWAY_URL } from '@/lib/serviceUrls';
import { authSDK } from './sdk-simple-auth';

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

// grading-service owns graded results; the gateway routes /api/v1/grading to it.
const BASE = `${GATEWAY_URL}/api/v1/grading/review`;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = authSDK.getAccessToken();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.success === false) throw new Error(body.error || `Error ${res.status}`);
  return body.data as T;
}

export const reviewService = {
  getQueue: (status: ReviewStatus) => request<ReviewQueueItem[]>(`/queue?status=${status}`),
  getTask: (resultId: string, questionId: string) => request<ReviewTask>(`/${resultId}/questions/${questionId}`),
  submit: (resultId: string, questionId: string, input: SubmitReviewInput) =>
    request<{ score: number; status: string; percentage: number; pendingManual: number }>(`/${resultId}/questions/${questionId}`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
};

export { scoreFromRubric } from '@/modules/review/scoring';
