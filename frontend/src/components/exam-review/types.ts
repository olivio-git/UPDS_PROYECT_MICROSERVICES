/** Question content attached to a graded answer by the admin result endpoint. */
export interface ReviewQuestionData {
  questionText?: string;
  questionType?: string;
  competency?: string;
  instructions?: string;
  context?: string;
  options?: Array<{ id: string; text: string; isCorrect?: boolean }>;
  items?: Array<{ id: string; content: string; correctPosition?: number; matchingPair?: string }>;
  template?: string;
  blanks?: Array<{ position?: number; correctAnswers: string[]; caseSensitive?: boolean }>;
  correctAnswer?: string | string[];
  mediaUrl?: string;
  mediaType?: 'audio' | 'image' | 'video';
}

export type EvaluationMethod = 'automatic' | 'ai_grading' | 'manual';

/** One graded answer inside an exam result. */
export interface ReviewQuestionResult {
  questionId: string;
  questionType?: string;
  competency?: string;
  /** Shape depends on the question type; may also arrive as a JSON string. */
  response: unknown;
  isCorrect?: boolean | null;
  score: number;
  maxScore: number;
  feedback?: string;
  evaluationMethod?: EvaluationMethod;
  aiAnalysis?: {
    criteria?: Record<string, number>;
    feedback?: string;
    suggestions?: string[];
  };
  questionData?: ReviewQuestionData;
}

/** Full result as returned by GET /api/v1/exam-results/:id/admin. */
export interface AdminExamResultDetail {
  _id?: string;
  questionResults: ReviewQuestionResult[];
  gradingDurationMs?: number | null;
}
