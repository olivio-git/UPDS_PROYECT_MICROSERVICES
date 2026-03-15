import { Schema, model, Document, Types } from 'mongoose';

export interface IRubric extends Document {
  name: string;
  competency: 'reading' | 'writing' | 'listening' | 'speaking';
  level: string;
  criteria: Array<{
    name: string;
    description: string;
    weight: number; // percentage
    levels: Array<{
      score: number;
      description: string;
      examples?: string[];
    }>;
  }>;
  scoringType: 'holistic' | 'analytic';
  maxScore: number;
  isActive: boolean;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const rubricSchema = new Schema<IRubric>({
  name: {
    type: String,
    required: true
  },
  competency: {
    type: String,
    required: true,
    enum: ['reading', 'writing', 'listening', 'speaking']
  },
  level: {
    type: String,
    required: true,
    enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
  },
  criteria: [{
    name: String,
    description: String,
    weight: Number,
    levels: [{
      score: Number,
      description: String,
      examples: [String]
    }]
  }],
  scoringType: {
    type: String,
    required: true,
    enum: ['holistic', 'analytic']
  },
  maxScore: {
    type: Number,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true,
  collection: 'rubrics'
});

// Indexes
rubricSchema.index({ competency: 1, level: 1 });
rubricSchema.index({ isActive: 1 });

export const Rubric = model<IRubric>('Rubric', rubricSchema);