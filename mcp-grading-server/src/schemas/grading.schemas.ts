import { z } from 'zod';

// ============================================================
// REQUEST SCHEMAS
// ============================================================

export const GradeExamRequestSchema = z.object({
  attemptId: z.string().min(24).max(24).describe('MongoDB ObjectId del attempt'),
});

export const EvaluateQuestionRequestSchema = z.object({
  questionId: z.string().min(24).max(24).optional().describe('MongoDB ObjectId de la pregunta'),
  response: z.any().describe('Respuesta del estudiante'),
  questionData: z.any().optional().describe('Datos completos de la pregunta (si no se usa questionId)'),
}).refine(
  data => data.questionId || data.questionData,
  { message: 'Debe proporcionar questionId o questionData' }
);

export const GenerateFeedbackRequestSchema = z.object({
  examResultId: z.string().min(24).max(24).describe('MongoDB ObjectId del ExamResult'),
  language: z.enum(['es', 'en']).optional().default('es'),
});

export const GetPendingExamsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export const RegradeSessionSchema = z.object({
  sessionId: z.string().min(1),
});

export const RegradeAttemptSchema = z.object({
  attemptId: z.string().min(24).max(24).describe('MongoDB ObjectId del attempt a recalcular'),
});

export const GenerateQuestionRequestSchema = z.object({
  competency: z.enum(['reading', 'writing', 'listening', 'speaking', 'grammar', 'vocabulary']),
  level: z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']),
  type: z.enum(['multiple_choice', 'true_false', 'open_text', 'essay', 'fill_blanks', 'drag_drop', 'matching', 'ordering', 'audio_response', 'file_upload']),
  difficulty: z.coerce.number().int().min(1).max(5).default(3),
  topic: z.string().max(200).optional(),
  thematicContext: z.string().max(1000).optional(),
  audioTranscript: z.string().max(5000).optional(),
  save: z.boolean().optional().default(false),
  createdBy: z.string().length(24).optional(),
  // Bulk generation: list of question texts already generated (to enforce diversity)
  avoidQuestions: z.array(z.string().max(500)).max(30).optional(),
});

export const FormatTranscriptRequestSchema = z.object({
  transcript: z.string().min(1).max(8000),
});

export const TranscribeAudioRequestSchema = z.object({
  audioUrl: z.string().url().optional(),
  audioData: z.string().min(1).optional(), // base64-encoded audio file
  mimeType: z.string().optional(),         // e.g. "audio/webm"
  ext: z.string().optional(),              // e.g. "webm", "mp3"
}).refine(
  (d) => d.audioUrl || d.audioData,
  { message: 'Se requiere audioUrl o audioData (base64)' }
);

// Schema para guardar una pregunta ya generada sin volver a llamar a GROQ
const QuestionTypeEnum = z.enum(['multiple_choice', 'true_false', 'open_text', 'essay', 'fill_blanks', 'drag_drop', 'matching', 'ordering', 'audio_response', 'file_upload']);
const CompetencyEnum = z.enum(['reading', 'writing', 'listening', 'speaking', 'grammar', 'vocabulary']);

export const SaveQuestionRequestSchema = z.object({
  question: z.object({
    type: QuestionTypeEnum,
    competency: CompetencyEnum,
    level: z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']),
    difficulty: z.coerce.number().int().min(1).max(5),
    content: z.object({
      question: z.string(),
      instructions: z.string().optional(),
      context: z.string().optional(),
      options: z.array(z.object({
        id: z.string(),
        text: z.string(),
        isCorrect: z.boolean(),
      })).optional(),
      correctAnswer: z.union([z.string(), z.array(z.string())]).optional(),
      sampleAnswer: z.string().optional(),
      keywords: z.array(z.string()).optional(),
      template: z.string().optional(),
      blanks: z.array(z.object({
        position: z.number(),
        correctAnswers: z.array(z.string()),
        caseSensitive: z.boolean().optional(),
      })).optional(),
      items: z.array(z.object({
        id: z.string(),
        content: z.string(),
        matchingPair: z.string().optional(),
        correctPosition: z.number().optional(),
      })).optional(),
    }),
    metadata: z.object({
      topic: z.string().optional(),
      subtopic: z.string().optional(),
      tags: z.array(z.string()).optional(),
      estimatedTime: z.number().optional(),
      points: z.number().optional(),
    }),
    isActive: z.boolean().optional().default(true),
  }),
  createdBy: z.string().length(24).optional(),
});

// ============================================================
// RESPONSE SCHEMAS (para documentacion y tipado)
// ============================================================

export const CompetencyScoreSchema = z.object({
  competency: z.string(),
  score: z.string(),
  percentage: z.number(),
});

export const SectionScoreSchema = z.object({
  name: z.string(),
  competency: z.string(),
  score: z.string(),
  percentage: z.number(),
});

export const LevelScoreSchema = z.object({
  level: z.string(),
  totalScore: z.number(),
  maxScore: z.number(),
  percentage: z.number(),
  questionCount: z.number(),
});

export const GradeExamResponseSchema = z.object({
  examResultId: z.string(),
  examName: z.string(),
  examLevel: z.string(),
  status: z.enum(['completed', 'partial', 'pending_ai_review']),
  totalScore: z.number(),
  maxScore: z.number(),
  percentage: z.number(),
  questionsGraded: z.number(),
  autoGraded: z.number(),
  aiGraded: z.number(),
  pendingManual: z.number(),
  competencyScores: z.array(CompetencyScoreSchema),
  sections: z.array(SectionScoreSchema).optional(),
  recommendedLevel: z.string().optional(),
  placementMode: z.enum(['static', 'adaptive']).optional(),
  levelScores: z.array(LevelScoreSchema).optional(),
});

export const EvaluateQuestionResponseSchema = z.object({
  evaluationMethod: z.enum(['automatic', 'ai_grading', 'manual']),
  questionType: z.string(),
  competency: z.string(),
  isCorrect: z.boolean().optional(),
  score: z.number(),
  maxScore: z.number(),
  feedback: z.string(),
  criteria: z.record(z.number()).optional(),
  suggestions: z.array(z.string()).optional(),
});

export const GenerateFeedbackResponseSchema = z.object({
  examResultId: z.string(),
  examName: z.string(),
  percentage: z.number(),
  overallFeedback: z.string(),
  recommendations: z.array(z.string()),
  competencyFeedback: z.record(z.string()),
});

export const PendingExamItemSchema = z.object({
  type: z.enum(['ungraded', 'partial']),
  attemptId: z.string(),
  examResultId: z.string().optional(),
  candidateId: z.string(),
  examId: z.string(),
  examName: z.string(),
  finishedAt: z.any().optional(),
  questionsCount: z.number().optional(),
  status: z.string().optional(),
  currentScore: z.string().optional(),
  percentage: z.number().optional(),
  pendingQuestions: z.number().optional(),
});

export const GetPendingExamsResponseSchema = z.object({
  total: z.number(),
  ungraded: z.number(),
  partiallyGraded: z.number(),
  exams: z.array(PendingExamItemSchema),
});

export const ErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  details: z.any().optional(),
});

// ============================================================
// TYPE EXPORTS
// ============================================================

export type GradeExamRequest = z.infer<typeof GradeExamRequestSchema>;
export type EvaluateQuestionRequest = z.infer<typeof EvaluateQuestionRequestSchema>;
export type GenerateFeedbackRequest = z.infer<typeof GenerateFeedbackRequestSchema>;
export type GetPendingExamsQuery = z.infer<typeof GetPendingExamsQuerySchema>;
export type GradeExamResponse = z.infer<typeof GradeExamResponseSchema>;
export type EvaluateQuestionResponse = z.infer<typeof EvaluateQuestionResponseSchema>;
export type GenerateFeedbackResponse = z.infer<typeof GenerateFeedbackResponseSchema>;
export type GetPendingExamsResponse = z.infer<typeof GetPendingExamsResponseSchema>;
export type RegradeSessionRequest = z.infer<typeof RegradeSessionSchema>;
export type RegradeAttemptRequest = z.infer<typeof RegradeAttemptSchema>;
