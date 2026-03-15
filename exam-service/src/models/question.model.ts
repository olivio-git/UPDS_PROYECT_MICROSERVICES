import { Document, Schema, Types, model } from 'mongoose';

export interface IQuestion extends Document {
  type: 'multiple_choice' | 'true_false' | 'open_text' | 'essay' | 'fill_blanks' | 'drag_drop' | 'matching' | 'ordering' | 'audio_response' | 'file_upload';
  competency: 'reading' | 'writing' | 'listening' | 'speaking' | 'grammar' | 'vocabulary';
  level: string; // A1, A2, B1, B2, C1, C2
  difficulty: number; // 1-5
  content: {
    question: string;
    instructions?: string;
    context?: string; // Reading passage, audio transcript, etc.
    mediaUrl?: string; // Audio file, image, etc.
    mediaType?: 'audio' | 'image' | 'video'; // Tipo de archivo multimedia
    options?: Array<{
      id: string;
      text: string;
      isCorrect?: boolean;
    }>;
    correctAnswer?: string | string[];
    sampleAnswer?: string;
    keywords?: string[];
    // Para fill_blanks
    template?: string; // "The cat is ___ the house"
    blanks?: Array<{
      position: number;
      correctAnswers: string[];
      caseSensitive?: boolean;
    }>;
    // Para drag_drop, matching, ordering
    items?: Array<{
      id: string;
      content: string;
      correctPosition?: number;
      matchingPair?: string;
      mediaUrl?: string;
    }>;
    // Para audio_response
    promptAudioUrl?: string;
    expectedResponseType?: 'word' | 'sentence' | 'paragraph';
  };
  metadata: {
    topic?: string;
    subtopic?: string;
    tags?: string[];
    estimatedTime?: number; // in seconds
    points?: number;
    rubricId?: Types.ObjectId;
  };
  statistics: {
    timesUsed: number;
    averageScore: number;
    averageTime: number;
    difficulty: number; // calculated from responses
  };
  isActive: boolean;
  createdBy: Types.ObjectId;
  reviewedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  lastUsed?: Date;
}

const questionSchema = new Schema<IQuestion>({
  type: {
    type: String,
    required: true,
    enum: ['multiple_choice', 'true_false', 'open_text', 'essay', 'fill_blanks', 'drag_drop', 'matching', 'ordering', 'audio_response', 'file_upload']
  },
  competency: {
    type: String,
    required: true,
    enum: ['reading', 'writing', 'listening', 'speaking', 'grammar', 'vocabulary']
  },
  level: {
    type: String,
    required: true,
    enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
  },
  difficulty: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  content: {
    question: { type: String, required: true },
    instructions: String,
    context: String,
    mediaUrl: String,
    mediaType: {
      type: String,
      enum: ['audio', 'image', 'video']
    },
    options: [{
      _id: false,
      id: String,
      text: String,
      isCorrect: Boolean
    }],
    correctAnswer: Schema.Types.Mixed, // Puede ser string o array
    sampleAnswer: String,
    keywords: [String],
    // Para fill_blanks
    template: String,
    blanks: [{
      position: Number,
      correctAnswers: [String],
      caseSensitive: { type: Boolean, default: false }
    }],
    // Para drag_drop, matching, ordering
    items: [{
      _id: false,
      id: String,
      content: String,
      correctPosition: Number,
      matchingPair: String,
      mediaUrl: String
    }],
    // Para audio_response
    promptAudioUrl: String,
    expectedResponseType: {
      type: String,
      enum: ['word', 'sentence', 'paragraph']
    }
  },
  metadata: {
    topic: String,
    subtopic: String,
    tags: [String],
    estimatedTime: Number,
    points: Number,
    rubricId: {
      type: Schema.Types.ObjectId,
      ref: 'Rubric'
    }
  },
  statistics: {
    timesUsed: { type: Number, default: 0 },
    averageScore: { type: Number, default: 0 },
    averageTime: { type: Number, default: 0 },
    difficulty: { type: Number, default: 0 }
  },
  isActive: { type: Boolean, default: true },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reviewedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  lastUsed: Date
}, {
  timestamps: true,
  collection: 'questions'
});

// Indexes
questionSchema.index({ type: 1, competency: 1, level: 1 });
questionSchema.index({ 'metadata.tags': 1 });
questionSchema.index({ isActive: 1 });
questionSchema.index({ createdBy: 1 });

export const Question = model<IQuestion>('Question', questionSchema);