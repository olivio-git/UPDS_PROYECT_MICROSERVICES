import { ObjectId } from 'mongodb';
import { getQuestions } from '../db/collections.js';
import { autoGrade } from '../grading/auto-grader.js';
import { evaluateWithGroq } from '../grading/groq-evaluator.js';
import { evaluateAudio } from '../grading/audio-delegator.js';
import { AUTO_GRADABLE_TYPES, AI_GRADABLE_TYPES, AUDIO_TYPES } from '../types/index.js';
import type { IQuestion, QuestionType } from '../types/index.js';
import type { EvaluateQuestionResponse } from '../schemas/grading.schemas.js';

export async function evaluateQuestion(params: {
  questionId?: string;
  response: any;
  questionData?: any;
}): Promise<EvaluateQuestionResponse> {
  let question: IQuestion | null = null;

  if (params.questionData) {
    question = params.questionData as IQuestion;
  } else if (params.questionId) {
    question = await getQuestions().findOne({ _id: new ObjectId(params.questionId) });
  }

  if (!question) {
    const error = new Error('Pregunta no encontrada. Proporciona questionId o questionData.');
    (error as any).statusCode = 404;
    throw error;
  }

  const maxScore = question.metadata?.points ?? 1;
  const qType = question.type as QuestionType;

  if (AUTO_GRADABLE_TYPES.includes(qType)) {
    const result = autoGrade(question, params.response, maxScore);
    return {
      evaluationMethod: 'automatic',
      questionType: question.type,
      competency: question.competency,
      isCorrect: result.isCorrect,
      score: result.score,
      maxScore: result.maxScore,
      feedback: result.feedback,
    };
  }

  if (AI_GRADABLE_TYPES.includes(qType)) {
    const result = await evaluateWithGroq(question, params.response, maxScore);
    return {
      evaluationMethod: 'ai_grading',
      questionType: question.type,
      competency: question.competency,
      score: result.score,
      maxScore: result.maxScore,
      feedback: result.feedback,
      criteria: result.criteria,
      suggestions: result.suggestions,
    };
  }

  if (AUDIO_TYPES.includes(qType)) {
    const result = await evaluateAudio(question, params.response, maxScore);
    return {
      evaluationMethod: 'ai_grading',
      questionType: question.type,
      competency: question.competency,
      score: result.score,
      maxScore: result.maxScore,
      feedback: result.feedback,
      criteria: result.criteria,
      suggestions: result.suggestions,
    };
  }

  return {
    evaluationMethod: 'manual',
    questionType: question.type,
    competency: question.competency,
    score: 0,
    maxScore,
    feedback: 'Este tipo de pregunta requiere revision manual',
  };
}
