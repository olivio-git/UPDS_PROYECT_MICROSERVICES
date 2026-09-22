import { ExamResult, IExamResult } from '../models/examResult.model';
import { logger } from '../utils/logger';

/**
 * Read access to stored exam results.
 *
 * Grading itself lives in grading-service (mcp-grading-server); this class only
 * reads what that service has already written to the exam_results collection.
 */
export class ExamEvaluationService {

  /**
   * Get results for a candidate
   */
  async getResultsForCandidate(candidateId: string, limit: number = 10): Promise<IExamResult[]> {
    return ExamResult.find({ candidateId })
      .sort({ evaluatedAt: -1 })
      .limit(limit)
      .exec();
  }

  /**
   * Get specific exam result
   */
  async getExamResult(examResultId: string): Promise<IExamResult | null> {
    return ExamResult.findById(examResultId).exec();
  }

  /**
   * Get detailed exam result with populated question data
   */
  async getDetailedExamResult(examResultId: string): Promise<any> {
    const result = await ExamResult.findById(examResultId).exec();

    if (!result) {
      return null;
    }

    // Populate question details for each question result
    const populatedQuestionResults = [];

    for (const questionResult of result.questionResults) {
      try {
        // Import Question model dynamically to avoid circular dependencies
        const { Question } = await import('../models/question.model');

        const questionData = await Question.findById(questionResult.questionId).exec();

        if (questionData) {
          const questionObj = {
            ...JSON.parse(JSON.stringify(questionResult)),
            questionData: {
              _id: questionData._id,
              questionText: questionData.content.question,
              questionType: questionData.type,
              options: questionData.content.options,
              correctAnswer: questionData.content.correctAnswer,
              items: questionData.content.items,
              template: (questionData.content as any).template,
              blanks: questionData.content.blanks,
              competency: questionData.competency,
              instructions: questionData.content.instructions,
              context: questionData.content.context,
              mediaUrl: questionData.content.mediaUrl,
              mediaType: questionData.content.mediaType ?? (questionData.metadata as any)?.mediaType,
              points: questionData.metadata.points
            }
          };
          populatedQuestionResults.push(questionObj);
        } else {
          // If question not found, include result without question data
          populatedQuestionResults.push(JSON.parse(JSON.stringify(questionResult)));
        }
      } catch (error) {
        logger.error(`Error populating question ${questionResult.questionId}:`, error);
        // Include result without question data if there's an error
        populatedQuestionResults.push(JSON.parse(JSON.stringify(questionResult)));
      }
    }

    return {
      ...result.toObject(),
      questionResults: populatedQuestionResults
    };
  }

  /**
   * Get result by attempt ID
   */
  async getResultByAttempt(attemptId: string): Promise<IExamResult | null> {
    return ExamResult.findOne({ attemptId }).exec();
  }

  /**
   * Get evaluation statistics for a candidate
   */
  async getEvaluationStats(candidateId: string) {
    logger.info(`📊 [ExamEvaluation] Calculating stats for candidate: ${candidateId}`);

    // Get all completed results for the candidate
    const results = await ExamResult.find({
      candidateId,
      status: 'completed'
    }).sort({ evaluatedAt: 1 }).exec();

    if (results.length === 0) {
      return {
        totalEvaluations: 0,
        averageScore: 0,
        improvementRate: 0,
        currentLevel: 'N/A',
        averageTimePerEvaluation: 0,
        competencyAverages: {},
        lastEvaluationDate: null,
        evaluationFrequency: 0
      };
    }

    // Calculate basic statistics
    const totalEvaluations = results.length;
    const averageScore = Math.round(results.reduce((sum, result) => sum + result.percentage, 0) / totalEvaluations);
    const averageTimePerEvaluation = Math.round(results.reduce((sum, result) => sum + result.examDuration, 0) / totalEvaluations);

    // Calculate improvement rate (compare first half vs second half)
    let improvementRate = 0;
    if (totalEvaluations >= 4) {
      const halfPoint = Math.floor(totalEvaluations / 2);
      const firstHalfAvg = results.slice(0, halfPoint).reduce((sum, result) => sum + result.percentage, 0) / halfPoint;
      const secondHalfAvg = results.slice(-halfPoint).reduce((sum, result) => sum + result.percentage, 0) / halfPoint;
      improvementRate = Math.round(((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100);
    }

    // Get current level from most recent exam
    const currentLevel = results[results.length - 1]?.examLevel || 'N/A';

    // Calculate competency averages
    const competencyMap = new Map<string, { totalScore: number, count: number }>();

    results.forEach(result => {
      result.competencyScores.forEach(comp => {
        if (!competencyMap.has(comp.competency)) {
          competencyMap.set(comp.competency, { totalScore: 0, count: 0 });
        }
        const competencyData = competencyMap.get(comp.competency)!;
        competencyData.totalScore += comp.percentage;
        competencyData.count++;
      });
    });

    const competencyAverages: Record<string, number> = {};
    competencyMap.forEach((data, competency) => {
      competencyAverages[competency] = Math.round(data.totalScore / data.count);
    });

    // Calculate evaluation frequency (evaluations per month)
    const firstEvalDate = new Date(results[0]?.evaluatedAt ?? Date.now());
    const lastEvalDate = new Date(results[results.length - 1]?.evaluatedAt ?? Date.now());
    const monthsDiff = Math.max(1, (lastEvalDate.getTime() - firstEvalDate.getTime()) / (1000 * 60 * 60 * 24 * 30));
    const evaluationFrequency = Math.round((totalEvaluations / monthsDiff) * 10) / 10;

    const stats = {
      totalEvaluations,
      averageScore,
      improvementRate,
      currentLevel,
      averageTimePerEvaluation, // in seconds
      competencyAverages,
      lastEvaluationDate: isNaN(lastEvalDate.getTime()) ? new Date().toISOString() : lastEvalDate.toISOString(),
      evaluationFrequency // evaluations per month
    };

    logger.info(`✅ [ExamEvaluation] Stats calculated: ${JSON.stringify(stats, null, 2)}`);
    return stats;
  }
}