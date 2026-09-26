import { Document, Schema, Types, model } from 'mongoose';

export interface IRubricCriterionScore {
  name: string;
  weight: number;
  score: number;
  feedback?: string;
}

export interface IRubricEvaluation {
  rubricId: Types.ObjectId;
  rubricName: string;
  partial?: boolean;
  criteria: IRubricCriterionScore[];
}

export interface IQuestionResult {
  questionId: Types.ObjectId;
  questionType: string;
  competency: string;
  response: any; // The user's response
  isCorrect?: boolean; // For auto-gradable questions
  score: number;
  maxScore: number;
  feedback?: string;
  evaluationMethod: 'automatic' | 'ai_grading' | 'manual';
  evaluatedAt?: Date;
  aiAnalysis?: {
    criteria: Record<string, number>; // e.g., { grammar: 8, vocabulary: 7, coherence: 9 }
    feedback: string;
    suggestions: string[];
  };
  // Rubric-driven AI grading (lockstep with mcp-grading-server/src/types/index.ts IQuestionResult)
  rubric?: IRubricEvaluation;
}

export interface ICompetencyScore {
  competency: string; // reading, writing, listening, speaking
  totalScore: number;
  maxScore: number;
  percentage: number;
  questionCount: number;
  autoEvaluatedCount: number;
  aiEvaluatedCount: number;
  pendingEvaluationCount: number;
}

/**
 * Level-mastery indicator (lockstep with mcp-grading-server/src/types/index.ts
 * ICompetencyMastery). Purely informational — never an input to `passed`.
 */
export interface IMasteryCheck {
  minScore: number;
  percentage: number;
  achieved: boolean;
}

export interface ICompetencyMasteryItem extends IMasteryCheck {
  competency: string;
}

export interface ICompetencyMastery {
  levelCode: string;
  overall: IMasteryCheck;
  competencies: ICompetencyMasteryItem[];
}

export interface IExamResult extends Document {
  attemptId: Types.ObjectId;
  candidateId: Types.ObjectId;
  examId: Types.ObjectId;
  sessionId: Types.ObjectId;

  // Overall scores
  totalScore: number;
  maxScore: number;
  percentage: number;

  // Question-level results
  questionResults: IQuestionResult[];

  // Competency breakdown
  competencyScores: ICompetencyScore[];

  // Evaluation status
  status: 'partial' | 'completed' | 'pending_ai_review';
  evaluatedAt: Date;
  completedAt?: Date; // When all AI evaluations are done

  // Timing
  examDuration: number; // seconds taken
  timeAllowed: number; // seconds allowed

  // Metadata
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

  // AI-generated feedback
  overallFeedback?: string;
  recommendations?: string[];
  competencyFeedback?: Record<string, string>; // feedback per competency

  // Placement exam fields
  recommendedLevel?: string;
  placementMode?: 'static' | 'adaptive';
  levelScores?: Array<{
    level: string;
    totalScore: number;
    maxScore: number;
    percentage: number;
    questionCount: number;
  }>;

  // Grading source of truth (lockstep with mcp-grading-server/src/types/index.ts IExamResult)
  passed?: boolean;
  passingScore?: number;
  scoringMethod?: 'weighted_sections' | 'raw_points';
  // Level mastery indicator (see ICompetencyMastery) — informational only.
  competencyMastery?: ICompetencyMastery;

  // Grading performance tracking
  gradingStartedAt?: Date;
  gradingCompletedAt?: Date;
  gradingDurationMs?: number;
  gradingBreakdown?: {
    questionsMs: number;
    autoGradingMs: number;
    aiGradingMs: number;
    audioGradingMs: number;
    perQuestionFeedbackMs: number;
    overallFeedbackMs: number;
  };
}

const rubricCriterionScoreSchema = new Schema<IRubricCriterionScore>({
  name: String,
  weight: Number,
  score: Number,
  feedback: String
}, { _id: false });

const rubricEvaluationSchema = new Schema<IRubricEvaluation>({
  rubricId: { type: Schema.Types.ObjectId, ref: 'Rubric' },
  rubricName: String,
  partial: Boolean,
  criteria: { type: [rubricCriterionScoreSchema], default: undefined }
}, { _id: false });

const questionResultSchema = new Schema<IQuestionResult>({
  questionId: { type: Schema.Types.ObjectId, ref: 'Question', required: true },
  questionType: { type: String, required: true },
  competency: { type: String, required: true },
  response: Schema.Types.Mixed,
  isCorrect: Boolean,
  score: { type: Number, required: true, min: 0 },
  maxScore: { type: Number, required: true, min: 0 },
  feedback: String,
  evaluationMethod: {
    type: String,
    enum: ['automatic', 'ai_grading', 'manual'],
    required: true
  },
  evaluatedAt: Date,
  aiAnalysis: {
    criteria: Schema.Types.Mixed,
    feedback: String,
    suggestions: [String]
  },
  // Sub-schema with `default: undefined` so results without a rubric
  // breakdown (default 4-criteria AI path, auto-graded, manual) don't
  // hydrate to `{ criteria: [] }`.
  rubric: { type: rubricEvaluationSchema, default: undefined }
});

const masteryCheckSchema = new Schema<IMasteryCheck>({
  minScore: { type: Number, required: true },
  percentage: { type: Number, required: true },
  achieved: { type: Boolean, required: true }
}, { _id: false });

const competencyMasteryItemSchema = new Schema<ICompetencyMasteryItem>({
  competency: { type: String, required: true },
  minScore: { type: Number, required: true },
  percentage: { type: Number, required: true },
  achieved: { type: Boolean, required: true }
}, { _id: false });

const competencyMasterySchema = new Schema<ICompetencyMastery>({
  levelCode: { type: String, required: true },
  overall: { type: masteryCheckSchema, required: true },
  competencies: { type: [competencyMasteryItemSchema], default: undefined }
}, { _id: false });

const competencyScoreSchema = new Schema<ICompetencyScore>({
  competency: { type: String, required: true },
  totalScore: { type: Number, required: true, min: 0 },
  maxScore: { type: Number, required: true, min: 0 },
  percentage: { type: Number, required: true, min: 0, max: 100 },
  questionCount: { type: Number, required: true, min: 0 },
  autoEvaluatedCount: { type: Number, required: true, min: 0 },
  aiEvaluatedCount: { type: Number, required: true, min: 0 },
  pendingEvaluationCount: { type: Number, required: true, min: 0 }
});

const examResultSchema = new Schema<IExamResult>({
  attemptId: { type: Schema.Types.ObjectId, ref: 'Attempt', required: true, unique: true },
  candidateId: { type: Schema.Types.ObjectId, ref: 'Candidate', required: true },
  examId: { type: Schema.Types.ObjectId, ref: 'Exam', required: true },
  sessionId: { type: Schema.Types.ObjectId, ref: 'Session', required: true },

  totalScore: { type: Number, required: true, min: 0 },
  maxScore: { type: Number, required: true, min: 0 },
  percentage: { type: Number, required: true, min: 0, max: 100 },

  questionResults: [questionResultSchema],
  competencyScores: [competencyScoreSchema],

  status: {
    type: String,
    enum: ['partial', 'completed', 'pending_ai_review'],
    default: 'partial'
  },
  evaluatedAt: { type: Date, required: true },
  completedAt: Date,

  examDuration: { type: Number, required: true },
  timeAllowed: { type: Number, required: true },

  examName: { type: String, required: true },
  examLevel: { type: String, required: true },

  sections: [{
    name: String,
    competency: String,
    score: Number,
    maxScore: Number,
    percentage: Number,
    weight: Number,
    weightedPercentage: Number
  }],

  // AI-generated feedback fields
  overallFeedback: String,
  recommendations: [String],
  competencyFeedback: Schema.Types.Mixed,

  // Placement exam fields
  recommendedLevel: String,
  placementMode: { type: String, enum: ['static', 'adaptive'] },
  levelScores: [{
    level: String,
    totalScore: Number,
    maxScore: Number,
    percentage: Number,
    questionCount: Number
  }],

  // Grading source of truth (lockstep with mcp-grading-server/src/types/index.ts IExamResult)
  passed: Boolean,
  passingScore: Number,
  scoringMethod: { type: String, enum: ['weighted_sections', 'raw_points'] },
  // Sub-schema with `default: undefined` so results without a resolved
  // target level (placement, deleted level, no competencyRequirements)
  // don't hydrate to an empty mastery object.
  competencyMastery: { type: competencyMasterySchema, default: undefined },

  // Grading performance tracking
  gradingStartedAt: Date,
  gradingCompletedAt: Date,
  gradingDurationMs: Number,
  gradingBreakdown: {
    questionsMs: Number,
    autoGradingMs: Number,
    aiGradingMs: Number,
    audioGradingMs: Number,
    perQuestionFeedbackMs: Number,
    overallFeedbackMs: Number,
  }
}, {
  timestamps: true,
  collection: 'exam_results'
});

// Indexes for performance
examResultSchema.index({ candidateId: 1, createdAt: -1 });
examResultSchema.index({ attemptId: 1 });
examResultSchema.index({ status: 1 });
examResultSchema.index({ candidateId: 1, status: 1 });

export const ExamResult = model<IExamResult>('ExamResult', examResultSchema);