import { Document, Schema, Types, model } from 'mongoose';

export interface ISession extends Document {
  examId: Types.ObjectId;
  exam?: any; // For populated exam data
  user?: Types.ObjectId; // User reference
  sessionName: string;
  scheduling: {
    startDate: Date;
    endDate: Date;
    timeSlots: Array<{
      date: Date;
      startTime: string;
      endTime: string;
      capacity: number;
      enrolled: number;
    }>;
  };
  participants: {
    maxCandidates: number;
    registeredCandidates: Types.ObjectId[];
    proctors: Types.ObjectId[];
    currentActive: number;
  };
  settings: {
    requireProctor: boolean;
    recordSession: boolean;
    browserLockdown: boolean;
    allowLateEntry: boolean;
    autoStart: boolean;
    lateEntryMinutes: number;
  };
  status: string;
  stats: {
    totalRegistered: number;
    totalCompleted: number;
    totalAbandoned: number;
    averageScore: number;
  };
  // Additional fields for evaluation
  sessionType?: string;
  timing?: any;
  
  finalScore?: number;
  maxScore?: number;
  isEvaluated?: boolean;
  evaluatedAt?: Date;
  completedAt?: Date;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const sessionSchema = new Schema<ISession>({
  examId: {
    type: Schema.Types.ObjectId,
    ref: 'Exam',
    required: true
  },
  sessionName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  scheduling: {
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date,
      required: true
    },
    timeSlots: [{
      date: Date,
      startTime: String,
      endTime: String,
      capacity: Number,
      enrolled: { type: Number, default: 0 }
    }]
  },
  participants: {
    maxCandidates: {
      type: Number,
      required: true,
      min: 1
    },
    registeredCandidates: [{
      type: Schema.Types.ObjectId
      // Nota: No usar ref: 'Candidate' porque ese modelo está en user-management-service
      // Los datos de candidatos se obtienen via integración cuando es necesario
    }],
    proctors: [{
      type: Schema.Types.ObjectId,
      ref: 'User'
    }],
    currentActive: {
      type: Number,
      default: 0
    }
  },
  settings: {
    requireProctor: { type: Boolean, default: true },
    recordSession: { type: Boolean, default: false },
    browserLockdown: { type: Boolean, default: false },
    allowLateEntry: { type: Boolean, default: false },
    autoStart: { type: Boolean, default: true },
    lateEntryMinutes: { type: Number, default: 0 }
  },
  status: {
    type: String,
    required: true,
    enum: ['scheduled', 'in_progress', 'completed', 'cancelled', 'expired'],
    default: 'scheduled'
  },
  stats: {
    totalRegistered: { type: Number, default: 0 },
    totalCompleted: { type: Number, default: 0 },
    totalAbandoned: { type: Number, default: 0 },
    averageScore: { type: Number, default: 0 }
  },
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  finalScore: Number,
  maxScore: Number,
  isEvaluated: {
    type: Boolean,
    default: false
  },
  evaluatedAt: Date,
  completedAt: Date,
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true,
  collection: 'sessions'
});

// Indexes
sessionSchema.index({ examId: 1, status: 1 });
sessionSchema.index({ 'scheduling.startDate': 1, 'scheduling.endDate': 1 });
sessionSchema.index({ 'participants.registeredCandidates': 1 });
sessionSchema.index({ status: 1 });
sessionSchema.index({ createdBy: 1 });

export const Session = model<ISession>('Session', sessionSchema);
