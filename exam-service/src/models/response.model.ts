import { Schema, model, Document, Types } from 'mongoose';

export interface IResponse extends Document {
  sessionId: Types.ObjectId;
  candidateId: Types.ObjectId;
  examId: Types.ObjectId;
  questionId: Types.ObjectId;
  question?: any; // For populated question data
  session?: any; // For populated session data
  competency: string;
  response: {
    type: string;
    answer?: string;
    selectedOptions?: string[];
    audioUrl?: string;
    fileUrl?: string;
    text?: string;
  };
  answer?: any; // For direct answer access
  evaluation?: {
    isCorrect?: boolean;
    score: number;
    maxScore: number;
    feedback?: string;
    evaluatedBy: string; // 'auto', 'human', 'ai'
    evaluatorId?: Types.ObjectId;
    evaluatedAt?: Date;
    rubricScores?: Array<{
      criterionName: string;
      score: number;
      feedback?: string;
    }>;
    details?: any; // For additional evaluation details
  };
  isEvaluated?: boolean;
  evaluatedAt?: Date;
  timeSpent: number; // in seconds
  attempts: number;
  submittedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const responseSchema = new Schema<IResponse>({
  sessionId: {
    type: Schema.Types.ObjectId,
    ref: 'Session',
    required: true
  },
  candidateId: {
    type: Schema.Types.ObjectId,
    ref: 'Candidate',
    required: true
  },
  examId: {
    type: Schema.Types.ObjectId,
    ref: 'Exam',
    required: true
  },
  questionId: {
    type: Schema.Types.ObjectId,
    ref: 'Question',
    required: true
  },
  competency: {
    type: String,
    required: true,
    enum: ['reading', 'writing', 'listening', 'speaking', 'grammar', 'vocabulary', 'general']
  },
  response: {
    type: {
      type: String,
      required: true,
      enum: ['multiple_choice', 'true_false', 'open_text', 'essay', 'audio_response', 'file_upload', 'fill_blanks', 'drag_drop', 'matching', 'ordering']
    },
    answer: String,
    selectedOptions: [String],
    audioUrl: String,
    fileUrl: String,
    text: String
  },
  answer: Schema.Types.Mixed, // Direct answer access
  evaluation: {
    isCorrect: Boolean,
    score: {
      type: Number,
      default: 0,
      min: 0
    },
    maxScore: {
      type: Number,
      required: true,
      min: 0
    },
    feedback: String,
    evaluatedBy: {
      type: String,
      enum: ['auto', 'human', 'ai'],
      default: 'auto'
    },
    evaluatorId: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    evaluatedAt: Date,
    rubricScores: [{
      criterionName: String,
      score: Number,
      feedback: String
    }],
    details: Schema.Types.Mixed // Additional evaluation details
  },
  isEvaluated: {
    type: Boolean,
    default: false
  },
  evaluatedAt: Date,
  timeSpent: {
    type: Number,
    default: 0,
    min: 0
  },
  attempts: {
    type: Number,
    default: 1,
    min: 1
  },
  submittedAt: Date
}, {
  timestamps: true,
  collection: 'responses'
});

// Indexes
responseSchema.index({ sessionId: 1, candidateId: 1, questionId: 1 });
responseSchema.index({ candidateId: 1, examId: 1 });
responseSchema.index({ questionId: 1 });
responseSchema.index({ competency: 1 });

export const Response = model<IResponse>('Response', responseSchema);
