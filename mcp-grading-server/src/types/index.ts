import { ObjectId } from 'mongodb';

// Question types
export type QuestionType =
  | 'multiple_choice' | 'true_false' | 'open_text' | 'essay'
  | 'fill_blanks' | 'drag_drop' | 'matching' | 'ordering'
  | 'audio_response' | 'file_upload';

export type Competency = 'reading' | 'writing' | 'listening' | 'speaking' | 'grammar' | 'vocabulary';
export type Level = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export const AUTO_GRADABLE_TYPES: QuestionType[] = [
  'multiple_choice', 'true_false', 'fill_blanks', 'matching', 'ordering', 'drag_drop',
];

export const AI_GRADABLE_TYPES: QuestionType[] = ['open_text', 'essay'];
export const AUDIO_TYPES: QuestionType[] = ['audio_response'];
export const MANUAL_TYPES: QuestionType[] = ['file_upload'];

// MongoDB document interfaces (match exam-service schemas exactly)

export interface IQuestion {
  _id: ObjectId;
  type: QuestionType;
  competency: Competency;
  level: string;
  difficulty: number;
  content: {
    question: string;
    instructions?: string;
    context?: string;
    mediaUrl?: string;
    mediaType?: 'audio' | 'image' | 'video';
    options?: Array<{ id: string; text: string; isCorrect?: boolean }>;
    correctAnswer?: string | string[];
    sampleAnswer?: string;
    keywords?: string[];
    template?: string;
    blanks?: Array<{ position: number; correctAnswers: string[]; caseSensitive?: boolean }>;
    items?: Array<{ id: string; content: string; correctPosition?: number; matchingPair?: string; mediaUrl?: string }>;
    promptAudioUrl?: string;
    expectedResponseType?: 'word' | 'sentence' | 'paragraph';
  };
  metadata: {
    topic?: string;
    subtopic?: string;
    tags?: string[];
    estimatedTime?: number;
    points?: number;
    rubricId?: ObjectId;
  };
  statistics: {
    timesUsed: number;
    averageScore: number;
    averageTime: number;
    difficulty: number;
  };
  isActive: boolean;
  createdBy: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface IResponse {
  _id: ObjectId;
  sessionId: ObjectId;
  candidateId: ObjectId;
  examId: ObjectId;
  questionId: ObjectId;
  competency: string;
  response: {
    type: string;
    answer?: string;
    selectedOptions?: string[];
    audioUrl?: string;
    fileUrl?: string;
    text?: string;
    // Frontend also sends these directly in the response object:
    blanks?: string[];
    pairs?: Record<string, string>;
    order?: string[];
    positions?: Record<string, number>;
  };
  answer?: any;
  evaluation?: {
    isCorrect?: boolean;
    score: number;
    maxScore: number;
    feedback?: string;
    evaluatedBy: string;
    evaluatorId?: ObjectId;
    evaluatedAt?: Date;
    rubricScores?: Array<{ criterionName: string; score: number; feedback?: string }>;
    details?: any;
  };
  isEvaluated?: boolean;
  evaluatedAt?: Date;
  timeSpent: number;
  attempts: number;
  submittedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAttempt {
  _id: ObjectId;
  sessionId: ObjectId;
  candidateId: ObjectId;
  examId: ObjectId;
  startedAt?: Date;
  finishedAt?: Date;
  status: 'in_progress' | 'completed' | 'cancelled' | 'expired';
  timeAllowedSeconds: number;
  lastHeartbeat?: Date;
  questionIds?: ObjectId[];
  sectionsStructure?: Array<{
    id: string;
    name: string;
    competency: string;
    duration: number;
    weight: number;
    questionCount: number;
    questionIds: ObjectId[];
  }>;
  adaptiveState?: {
    currentLevel: string;
    consecutiveWrong: number;
    askedQuestionIds: string[];
    levelHistory: Array<{
      questionId: string;
      level: string;
      isCorrect: boolean;
      score: number;
      maxScore: number;
    }>;
    isFinished: boolean;
    stopReason?: 'max_questions' | 'consecutive_wrong' | 'manual';
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface IExam {
  _id: ObjectId;
  name: string;
  description: string;
  type: 'placement' | 'progress' | 'final' | 'mock' | 'practice';
  targetLevel: string;
  placementConfig?: {
    mode: 'static' | 'adaptive';
    startingLevel?: string;
    maxQuestions?: number;
    consecutiveWrongThreshold?: number;
    levelPassingThreshold?: number;
  };
  structure: {
    sections: Array<{
      name: string;
      competency: Competency;
      duration: number;
      questionCount: number;
      weight: number;
    }>;
    totalDuration: number;
    passingScore: number;
  };
  configuration: {
    randomizeQuestions: boolean;
    allowReview: boolean;
    showResults: boolean;
    attemptsAllowed: number;
    timeBetweenAttempts: number;
  };
  questionPool: ObjectId[];
  isActive: boolean;
  createdBy: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface IQuestionResult {
  questionId: ObjectId;
  questionType: string;
  competency: string;
  response: any;
  isCorrect?: boolean;
  score: number;
  maxScore: number;
  feedback?: string;
  evaluationMethod: 'automatic' | 'ai_grading' | 'manual';
  evaluatedAt?: Date;
  aiAnalysis?: {
    criteria: Record<string, number>;
    feedback: string;
    suggestions: string[];
  };
  // Rubric-driven AI grading (essay/open_text only — see rubric-ai-grading spec).
  rubric?: IRubricEvaluation;
}

/** Per-criterion score as stored on a graded question result. */
export interface IRubricCriterionScore {
  name: string;
  weight: number;
  score: number;
  feedback?: string;
}

/** Stored breakdown of a rubric-driven AI grading pass on one question. */
export interface IRubricEvaluation {
  rubricId: ObjectId;
  rubricName: string;
  /** True when the AI response only covered a subset of the rubric's criteria. */
  partial?: boolean;
  criteria: IRubricCriterionScore[];
}

/** Rubric criterion definition, as read from exam-service's `rubrics` collection. */
export interface IRubricCriterionDefinition {
  name: string;
  description: string;
  weight: number;
  levels: Array<{ score: number; description: string; examples?: string[] }>;
}

/** Minimal shape grading-service reads from the `rubrics` collection (owned by exam-service). */
export interface IRubric {
  _id: ObjectId;
  name: string;
  competency: string;
  level: string;
  criteria: IRubricCriterionDefinition[];
  scoringType: 'holistic' | 'analytic';
  maxScore: number;
  isActive: boolean;
}

/** One criterion score as returned raw by the AI, before matching/clamping/renormalizing. */
export interface RawRubricCriterionScore {
  name: string;
  score: unknown;
  feedback?: string;
}

/** Raw, unmatched GROQ response for a rubric-driven evaluation. */
export interface RubricAIResponse {
  criteria: RawRubricCriterionScore[];
  feedback: string;
  suggestions: string[];
}

export interface ICompetencyScore {
  competency: string;
  totalScore: number;
  maxScore: number;
  percentage: number;
  questionCount: number;
  autoEvaluatedCount: number;
  aiEvaluatedCount: number;
  pendingEvaluationCount: number;
}

export interface IGradingBreakdown {
  questionsMs: number;       // Total time grading all questions (auto + AI + audio)
  autoGradingMs: number;     // Time on auto-gradable questions
  aiGradingMs: number;       // Time on essay/open_text GROQ calls
  audioGradingMs: number;    // Time on audio (Whisper + GROQ)
  perQuestionFeedbackMs: number; // Batch feedback call for auto-graded
  overallFeedbackMs: number; // Overall exam feedback GROQ call
}

export interface IExamResult {
  _id?: ObjectId;
  attemptId: ObjectId;
  candidateId: ObjectId;
  examId: ObjectId;
  sessionId: ObjectId;
  totalScore: number;
  maxScore: number;
  percentage: number;
  questionResults: IQuestionResult[];
  competencyScores: ICompetencyScore[];
  status: 'partial' | 'completed' | 'pending_ai_review';
  evaluatedAt: Date;
  completedAt?: Date;
  examDuration: number;
  timeAllowed: number;
  examName: string;
  examLevel: string;
  sections?: Array<{
    name: string;
    competency: string;
    score: number;
    maxScore: number;
    percentage: number;
    weight?: number;
    weightedPercentage?: number;
  }>;
  overallFeedback?: string;
  recommendations?: string[];
  competencyFeedback?: Record<string, string>;
  recommendedLevel?: string;
  placementMode?: 'static' | 'adaptive';
  levelScores?: Array<{ level: string; totalScore: number; maxScore: number; percentage: number; questionCount: number }>;
  // Grading source of truth (see mcp-grading-server/src/grading/scoring.ts)
  passed?: boolean;
  passingScore?: number;
  scoringMethod?: 'weighted_sections' | 'raw_points';
  // Grading performance tracking
  gradingStartedAt?: Date;
  gradingCompletedAt?: Date;
  gradingDurationMs?: number;
  gradingBreakdown?: IGradingBreakdown;
}

// Grading result types

export interface AutoGradeResult {
  isCorrect: boolean;
  score: number;
  maxScore: number;
  feedback: string;
}

export interface AIGradeResult {
  score: number;
  maxScore: number;
  feedback: string;
  criteria: Record<string, number>;
  suggestions: string[];
}
