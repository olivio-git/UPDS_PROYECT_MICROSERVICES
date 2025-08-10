import { Schema, model, Document, Types } from 'mongoose';

export interface IExam extends Document {
  name: string;
  description: string;
  type: 'placement' | 'progress' | 'final' | 'mock';
  targetLevel: string; // A1, A2, B1, B2, C1, C2
  structure: {
    sections: Array<{
      name: string;
      competency: 'reading' | 'writing' | 'listening' | 'speaking';
      duration: number; // in minutes
      questionCount: number;
      weight: number; // percentage
    }>;
    totalDuration: number;
    passingScore: number;
  };
  configuration: {
    randomizeQuestions: boolean;
    allowReview: boolean;
    showResults: boolean;
    attemptsAllowed: number;
    timeBetweenAttempts: number; // in hours
  };
  questionPool: Types.ObjectId[];
  isActive: boolean;
  isTemplate: boolean;
  createdBy: Types.ObjectId;
  approvedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const examSchema = new Schema<IExam>({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    required: true,
    maxlength: 1000
  },
  type: {
    type: String,
    required: true,
    enum: ['placement', 'progress', 'final', 'mock']
  },
  targetLevel: {
    type: String,
    required: true,
    enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
  },
  structure: {
    sections: [{
      name: String,
      competency: {
        type: String,
        enum: ['reading', 'writing', 'listening', 'speaking']
      },
      duration: Number,
      questionCount: Number,
      weight: Number
    }],
    totalDuration: Number,
    passingScore: Number
  },
  configuration: {
    randomizeQuestions: { type: Boolean, default: true },
    allowReview: { type: Boolean, default: false },
    showResults: { type: Boolean, default: true },
    attemptsAllowed: { type: Number, default: 1 },
    timeBetweenAttempts: { type: Number, default: 24 }
  },
  questionPool: [{
    type: Schema.Types.ObjectId,
    ref: 'Question'
  }],
  isActive: { type: Boolean, default: true },
  isTemplate: { type: Boolean, default: false },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  approvedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  collection: 'exams'
});

// Indexes
examSchema.index({ name: 1 });
examSchema.index({ type: 1, targetLevel: 1 });
examSchema.index({ isActive: 1, isTemplate: 1 });
examSchema.index({ createdBy: 1 });

export const Exam = model<IExam>('Exam', examSchema);