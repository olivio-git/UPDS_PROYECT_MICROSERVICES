import { Schema, model, Document, Types } from 'mongoose';

export interface ILevel extends Document {
  code: string; // A1, A2, B1, B2, C1, C2
  name: string;
  description: string;
  competencyRequirements: {
    reading: {
      minScore: number;
      description: string;
      canDoStatements: string[];
    };
    writing: {
      minScore: number;
      description: string;
      canDoStatements: string[];
    };
    listening: {
      minScore: number;
      description: string;
      canDoStatements: string[];
    };
    speaking: {
      minScore: number;
      description: string;
      canDoStatements: string[];
    };
  };
  overallMinScore: number;
  isActive: boolean;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const levelSchema = new Schema<ILevel>({
  code: {
    type: String,
    required: true,
    unique: true,
    enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
  },
  name: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  competencyRequirements: {
    reading: {
      minScore: { type: Number, required: true },
      description: String,
      canDoStatements: [String]
    },
    writing: {
      minScore: { type: Number, required: true },
      description: String,
      canDoStatements: [String]
    },
    listening: {
      minScore: { type: Number, required: true },
      description: String,
      canDoStatements: [String]
    },
    speaking: {
      minScore: { type: Number, required: true },
      description: String,
      canDoStatements: [String]
    }
  },
  overallMinScore: {
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
  collection: 'levels'
});

// Index
levelSchema.index({ code: 1 });
levelSchema.index({ isActive: 1 });

export const Level = model<ILevel>('Level', levelSchema);