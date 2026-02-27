import { Document, Schema, Types, model } from 'mongoose';

export interface IAttempt extends Document {
  sessionId: Types.ObjectId;
  candidateId: Types.ObjectId;
  examId: Types.ObjectId;
  startedAt?: Date;
  finishedAt?: Date;
  status: 'in_progress' | 'completed' | 'cancelled' | 'expired';
  timeAllowedSeconds: number;
  lastHeartbeat?: Date;
  questionIds?: Types.ObjectId[];
  sectionsStructure?: Array<{
    id: string;
    name: string;
    competency: string;
    duration: number;
    weight: number;
    questionCount: number;
    questionIds: Types.ObjectId[];
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
}

const attemptSchema = new Schema<IAttempt>({
  sessionId: { type: Schema.Types.ObjectId, ref: 'Session', required: true },
  candidateId: { type: Schema.Types.ObjectId, ref: 'Candidate', required: true },
  examId: { type: Schema.Types.ObjectId, ref: 'Exam', required: true },
  startedAt: Date,
  finishedAt: Date,
  status: { type: String, enum: ['in_progress', 'completed', 'cancelled', 'expired'], default: 'in_progress' },
  timeAllowedSeconds: { type: Number, required: true },
  lastHeartbeat: Date,
  questionIds: [{ type: Schema.Types.ObjectId, ref: 'Question' }],
  sectionsStructure: [{
    id: String,
    name: String,
    competency: String,
    duration: Number,
    weight: Number,
    questionCount: Number,
    questionIds: [{ type: Schema.Types.ObjectId, ref: 'Question' }]
  }],
  adaptiveState: {
    currentLevel: String,
    consecutiveWrong: { type: Number, default: 0 },
    askedQuestionIds: [String],
    levelHistory: [{
      questionId: String,
      level: String,
      isCorrect: Boolean,
      score: Number,
      maxScore: Number
    }],
    isFinished: { type: Boolean, default: false },
    stopReason: { type: String, enum: ['max_questions', 'consecutive_wrong', 'manual'] }
  }
}, {
  timestamps: true,
  collection: 'attempts'
});

attemptSchema.index({ sessionId: 1, candidateId: 1 });

export const Attempt = model<IAttempt>('Attempt', attemptSchema);
