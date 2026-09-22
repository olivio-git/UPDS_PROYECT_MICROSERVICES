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
  isAdaptive?: boolean;
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
  // Browser-lockdown infraction tracking (soft lockdown — deterrence +
  // proctor visibility, not hard prevention). Populated only when the
  // session has settings.browserLockdown enabled. `events` is capped at
  // ~200 entries (oldest dropped) to keep the attempt document bounded.
  integrity?: {
    infractionCount: number;
    lastInfractionAt?: Date;
    events: Array<{
      type: 'fullscreen_exit' | 'tab_hidden' | 'window_blur' | 'blocked_shortcut' | 'context_menu' | 'paste_blocked';
      at: Date;
    }>;
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
  // Explicit marker for the adaptive (CAT) path. adaptiveState cannot be used
  // for this: its subfields have defaults, so Mongoose materializes the object
  // on every attempt, including linear ones.
  isAdaptive: { type: Boolean, default: false },
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
  },
  integrity: {
    infractionCount: { type: Number, default: 0 },
    lastInfractionAt: Date,
    events: [{
      type: {
        type: String,
        enum: ['fullscreen_exit', 'tab_hidden', 'window_blur', 'blocked_shortcut', 'context_menu', 'paste_blocked']
      },
      at: Date
    }]
  }
}, {
  timestamps: true,
  collection: 'attempts'
});

attemptSchema.index({ sessionId: 1, candidateId: 1 });

export const Attempt = model<IAttempt>('Attempt', attemptSchema);
