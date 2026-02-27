import { ObjectId } from 'mongodb';
import { getExamResults } from '../db/collections.js';
import { generateExamFeedback } from '../grading/groq-evaluator.js';
import type { GenerateFeedbackResponse } from '../schemas/grading.schemas.js';

export async function generateFeedback(params: {
  examResultId: string;
  language?: 'es' | 'en';
}): Promise<GenerateFeedbackResponse> {
  const result = await getExamResults().findOne({ _id: new ObjectId(params.examResultId) });
  if (!result) {
    const error = new Error(`ExamResult ${params.examResultId} no encontrado`);
    (error as any).statusCode = 404;
    throw error;
  }

  if (result.overallFeedback) {
    return {
      examResultId: params.examResultId,
      examName: result.examName,
      percentage: result.percentage,
      overallFeedback: result.overallFeedback,
      recommendations: result.recommendations || [],
      competencyFeedback: result.competencyFeedback || {},
    };
  }

  const feedback = await generateExamFeedback({
    examName: result.examName,
    examLevel: result.examLevel,
    competencyScores: result.competencyScores.map(c => ({
      competency: c.competency,
      percentage: c.percentage,
      totalScore: c.totalScore,
      maxScore: c.maxScore,
    })),
    totalPercentage: result.percentage,
    questionSummaries: result.questionResults.map(qr => ({
      type: qr.questionType,
      competency: qr.competency,
      score: qr.score,
      maxScore: qr.maxScore,
      feedback: qr.feedback,
    })),
  }, params.language || 'es');

  // Persist feedback
  await getExamResults().updateOne(
    { _id: new ObjectId(params.examResultId) },
    {
      $set: {
        overallFeedback: feedback.overallFeedback,
        recommendations: feedback.recommendations,
        competencyFeedback: feedback.competencyFeedback,
      },
    }
  );

  return {
    examResultId: params.examResultId,
    examName: result.examName,
    percentage: result.percentage,
    ...feedback,
  };
}
