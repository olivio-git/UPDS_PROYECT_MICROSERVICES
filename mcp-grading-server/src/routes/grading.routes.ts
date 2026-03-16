import { Router, type Request, type Response } from 'express';
import { validateBody, validateQuery } from '../middleware/validate.js';
import {
  GradeExamRequestSchema,
  EvaluateQuestionRequestSchema,
  GenerateFeedbackRequestSchema,
  GetPendingExamsQuerySchema,
  GenerateQuestionRequestSchema,
  SaveQuestionRequestSchema,
  TranscribeAudioRequestSchema,
  FormatTranscriptRequestSchema,
  RegradeSessionSchema,
  RegradeAttemptSchema,
} from '../schemas/grading.schemas.js';
import { gradeExam } from '../tools/grade-exam.js';
import { evaluateQuestion } from '../tools/evaluate-question.js';
import { generateFeedback } from '../tools/generate-feedback.js';
import { getPendingExams } from '../tools/get-pending-exams.js';
import { generateQuestion } from '../tools/generate-question.js';
import { transcribeAudio, transcribeAudioBuffer } from '../grading/audio-delegator.js';
import { autoGrade } from '../grading/auto-grader.js';
import Groq from 'groq-sdk';
import { config } from '../config.js';
import { ObjectId } from 'mongodb';
import { getQuestions, getExamResults } from '../db/collections.js';
import { AUTO_GRADABLE_TYPES } from '../types/index.js';
import type { IQuestion } from '../types/index.js';

export const gradingRouter = Router();

/**
 * POST /api/v1/grading/exam
 * Califica un examen completo: auto-grading + GROQ AI + notificaciones
 */
gradingRouter.post(
  '/exam',
  validateBody(GradeExamRequestSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await gradeExam(req.body.attemptId);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({
        success: false,
        error: error.message || 'Error al calificar examen',
      });
    }
  }
);

/**
 * POST /api/v1/grading/question
 * Evalua una pregunta individual sin persistir
 */
gradingRouter.post(
  '/question',
  validateBody(EvaluateQuestionRequestSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await evaluateQuestion(req.body);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({
        success: false,
        error: error.message || 'Error al evaluar pregunta',
      });
    }
  }
);

/**
 * POST /api/v1/grading/feedback
 * Genera feedback educativo con GROQ AI para un examen calificado
 */
gradingRouter.post(
  '/feedback',
  validateBody(GenerateFeedbackRequestSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await generateFeedback(req.body);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({
        success: false,
        error: error.message || 'Error al generar feedback',
      });
    }
  }
);

/**
 * POST /api/v1/grading/generate-question
 * Genera una pregunta educativa via GROQ tool_use (structured output, sin parsing de texto).
 * Si save=true, persiste directamente en la coleccion questions de MongoDB.
 */
gradingRouter.post(
  '/generate-question',
  validateBody(GenerateQuestionRequestSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await generateQuestion(req.body);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({
        success: false,
        error: error.message || 'Error al generar pregunta',
      });
    }
  }
);

/**
 * POST /api/v1/grading/transcribe-audio
 * Transcribe un audio alojado en MinIO usando GROQ Whisper.
 * Usado al crear preguntas de listening: el teacher sube el audio,
 * obtenemos el transcript y lo pasamos al generador de preguntas.
 */
gradingRouter.post(
  '/transcribe-audio',
  validateBody(TranscribeAudioRequestSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { audioUrl, audioData, mimeType, ext } = req.body;
      let transcript: string;
      if (audioData) {
        const buffer = Buffer.from(audioData, 'base64');
        transcript = await transcribeAudioBuffer(buffer, mimeType || 'audio/webm', ext || 'webm');
      } else {
        transcript = await transcribeAudio(audioUrl!);
      }
      if (!transcript) {
        res.status(422).json({ success: false, error: 'No se pudo transcribir el audio. Verifica que el audio tenga voz clara.' });
        return;
      }
      res.json({ success: true, data: { transcript } });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({
        success: false,
        error: error.message || 'Error al transcribir audio',
      });
    }
  }
);

/**
 * POST /api/v1/grading/format-transcript
 * Detecta si una transcripción es un diálogo o monólogo y la formatea con
 * etiquetas de hablante (Speaker 1: / Speaker 2: / nombres reales si se detectan).
 * Si es monólogo, devuelve el texto con puntuación corregida sin modificar estructura.
 */
gradingRouter.post(
  '/format-transcript',
  validateBody(FormatTranscriptRequestSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { transcript } = req.body as { transcript: string };
      const groq = new Groq({ apiKey: config.groq.apiKey });

      const completion = await groq.chat.completions.create({
        model: config.groq.model,
        messages: [
          {
            role: 'system',
            content: `You are a transcript formatter for English language audio recordings used in educational exams.
Your task: analyze a raw Whisper transcription and determine if it's a DIALOGUE or MONOLOGUE.

DIALOGUE rules (2+ speakers taking turns):
- Format each turn on its own line: "SpeakerName: text"
- Use real names if clearly mentioned in the transcript, otherwise "Speaker 1:", "Speaker 2:", etc.
- Fix punctuation and capitalization within each turn
- Do NOT add content that isn't there

MONOLOGUE rules (one person speaking, narration, instructions, story):
- Return the text with proper punctuation and paragraph breaks
- Do NOT add speaker labels

CRITICAL:
- NEVER translate — keep the exact original language
- NEVER add, remove, or change the meaning of any words
- Return ONLY valid JSON: {"formatted": "...", "isDialogue": boolean, "speakersDetected": number}
- speakersDetected = 1 for monologue, 2+ for dialogue`,
          },
          {
            role: 'user',
            content: `Format this transcript:\n\n${transcript}`,
          },
        ],
        temperature: 0.1,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) throw new Error('No response from GROQ');

      let parsed: { formatted: string; isDialogue: boolean; speakersDetected: number };
      try {
        parsed = JSON.parse(content);
      } catch {
        // Fallback: return original transcript untouched
        res.json({ success: true, data: { formatted: transcript, isDialogue: false, speakersDetected: 1 } });
        return;
      }

      res.json({ success: true, data: parsed });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({
        success: false,
        error: error.message || 'Error al formatear transcript',
      });
    }
  }
);

/**
 * POST /api/v1/grading/save-question
 * Guarda directamente en MongoDB una pregunta ya generada (sin volver a llamar a GROQ).
 */
gradingRouter.post(
  '/save-question',
  validateBody(SaveQuestionRequestSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { question, createdBy } = req.body;
      const doc: Omit<IQuestion, '_id'> = {
        type: question.type,
        competency: question.competency,
        level: question.level,
        difficulty: question.difficulty,
        content: question.content,
        metadata: {
          topic: question.metadata?.topic ?? '',
          subtopic: question.metadata?.subtopic,
          tags: question.metadata?.tags ?? [],
          estimatedTime: question.metadata?.estimatedTime,
          points: question.metadata?.points ?? 1,
        },
        statistics: {
          timesUsed: 0,
          averageScore: 0,
          averageTime: 0,
          difficulty: question.difficulty,
        },
        isActive: question.isActive ?? true,
        createdBy: createdBy ? new ObjectId(createdBy) : new ObjectId('000000000000000000000000'),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const result = await getQuestions().insertOne(doc as IQuestion);
      res.json({ success: true, data: { savedId: result.insertedId.toString() } });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Error al guardar pregunta' });
    }
  }
);

/**
 * POST /api/v1/grading/regrade-session
 * Re-califica todos los exam_results de una sesión usando solo el auto-grader.
 * Útil para corregir puntajes erróneos en preguntas de crédito parcial
 * (fill_blanks, matching, ordering, drag_drop) sin volver a llamar a GROQ.
 */
gradingRouter.post(
  '/regrade-session',
  validateBody(RegradeSessionSchema),
  async (req: Request, res: Response): Promise<void> => {
    const { sessionId } = req.body as { sessionId: string };

    let sessionObjId: ObjectId;
    try {
      sessionObjId = new ObjectId(sessionId);
    } catch {
      res.status(400).json({ success: false, error: 'sessionId inválido' });
      return;
    }

    // 1. Buscar todos los exam_results de la sesión
    const results = await getExamResults().find({ sessionId: sessionObjId }).toArray();

    if (results.length === 0) {
      res.json({ success: true, data: { total: 0, regraded: 0, unchanged: 0, errors: 0, details: [] } });
      return;
    }

    // 2. Recopilar todos los questionIds únicos de todos los resultados
    const allQuestionIds = new Set<string>();
    for (const result of results) {
      for (const qr of result.questionResults) {
        allQuestionIds.add(qr.questionId.toString());
      }
    }

    // 3. Fetch preguntas en batch
    const questionDocs = await getQuestions()
      .find({ _id: { $in: Array.from(allQuestionIds).map(id => new ObjectId(id)) } })
      .toArray();
    const questionMap = new Map(questionDocs.map(q => [q._id.toString(), q]));

    // 4. Re-calificar cada resultado
    let regraded = 0;
    let unchanged = 0;
    let errors = 0;
    const details: Array<{ examResultId: string; oldPercentage: number; newPercentage: number; changed: boolean }> = [];

    for (const result of results) {
      try {
        let changed = false;
        const newQuestionResults = result.questionResults.map(qr => {
          if (!AUTO_GRADABLE_TYPES.includes(qr.questionType as any)) {
            return qr; // skip AI/manual questions
          }
          const question = questionMap.get(qr.questionId.toString());
          if (!question) return qr;

          const gradeResult = autoGrade(question, qr.response, qr.maxScore);
          if (gradeResult.score !== qr.score) {
            changed = true;
            return {
              ...qr,
              score: gradeResult.score,
              isCorrect: gradeResult.isCorrect,
              feedback: gradeResult.feedback,
              evaluatedAt: new Date(),
            };
          }
          return qr;
        });

        if (!changed) {
          unchanged++;
          details.push({
            examResultId: result._id!.toString(),
            oldPercentage: result.percentage,
            newPercentage: result.percentage,
            changed: false,
          });
          continue;
        }

        // Recalcular totales
        const newTotalScore = Math.round(newQuestionResults.reduce((sum, qr) => sum + qr.score, 0) * 100) / 100;
        const newMaxScore = newQuestionResults.reduce((sum, qr) => sum + qr.maxScore, 0);
        const newPercentage = newMaxScore > 0 ? Math.round((newTotalScore / newMaxScore) * 100 * 10) / 10 : 0;

        // Recalcular competencyScores
        const competencyMap = new Map<string, { total: number; max: number; count: number; auto: number; ai: number; pending: number }>();
        for (const qr of newQuestionResults) {
          const c = competencyMap.get(qr.competency) || { total: 0, max: 0, count: 0, auto: 0, ai: 0, pending: 0 };
          c.total += qr.score;
          c.max += qr.maxScore;
          c.count++;
          if (qr.evaluationMethod === 'automatic') c.auto++;
          else if (qr.evaluationMethod === 'ai_grading') c.ai++;
          else c.pending++;
          competencyMap.set(qr.competency, c);
        }
        const newCompetencyScores = Array.from(competencyMap.entries()).map(([comp, data]) => ({
          competency: comp,
          totalScore: data.total,
          maxScore: data.max,
          percentage: data.max > 0 ? Math.round((data.total / data.max) * 100 * 10) / 10 : 0,
          questionCount: data.count,
          autoEvaluatedCount: data.auto,
          aiEvaluatedCount: data.ai,
          pendingEvaluationCount: data.pending,
        }));

        await getExamResults().updateOne(
          { _id: result._id },
          {
            $set: {
              questionResults: newQuestionResults,
              totalScore: newTotalScore,
              maxScore: newMaxScore,
              percentage: newPercentage,
              competencyScores: newCompetencyScores,
              evaluatedAt: new Date(),
            },
          }
        );

        regraded++;
        details.push({
          examResultId: result._id!.toString(),
          oldPercentage: result.percentage,
          newPercentage,
          changed: true,
        });
      } catch (err: any) {
        errors++;
        details.push({
          examResultId: result._id?.toString() ?? 'unknown',
          oldPercentage: result.percentage,
          newPercentage: result.percentage,
          changed: false,
        });
      }
    }

    res.json({
      success: true,
      data: { total: results.length, regraded, unchanged, errors, details },
    });
  }
);

/**
 * POST /api/v1/grading/regrade-attempt
 * Fuerza la recalificación completa de un intento específico,
 * ignorando si ya existía un resultado previo (útil para corregir
 * resultados calculados con el bug de "solo preguntas respondidas").
 */
gradingRouter.post(
  '/regrade-attempt',
  validateBody(RegradeAttemptSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { attemptId } = req.body as { attemptId: string };
      const result = await gradeExam(attemptId, { force: true });
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({
        success: false,
        error: error.message || 'Error al recalcular examen',
      });
    }
  }
);

/**
 * GET /api/v1/grading/pending
 * Lista examenes pendientes de calificacion
 */
gradingRouter.get(
  '/pending',
  validateQuery(GetPendingExamsQuerySchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const limit = (req.query as any).limit;
      const result = await getPendingExams({ limit });
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({
        success: false,
        error: error.message || 'Error al obtener examenes pendientes',
      });
    }
  }
);
