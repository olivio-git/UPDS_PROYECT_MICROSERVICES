import axios from 'axios';
import { Attempt } from '../models/attempt.model';
import { ExamResult, IExamResult, IQuestionResult } from '../models/examResult.model';
import { Response } from '../models/response.model';
import { logger } from '../utils/logger';

interface AutoGradableResult {
  isCorrect: boolean;
  score: number;
  maxScore: number;
  feedback?: string;
}

export class ExamEvaluationService {
  private aiGradingServiceUrl: string;

  constructor() {
    this.aiGradingServiceUrl = process.env.AI_GRADING_SERVICE_URL || 'http://ai-grading-service:8000';
  }

  /**
   * Main method to evaluate a completed exam
   */
  async evaluateExam(attemptId: string): Promise<IExamResult> {
    logger.info(`📊 [ExamEvaluation] Starting evaluation for attempt: ${attemptId}`);

    // Get attempt and related data
    const attempt = await Attempt.findById(attemptId)
      .populate('examId')
      .populate('sessionId');

    if (!attempt) {
      throw new Error('Attempt not found');
    }

    const exam = attempt.examId as any;
    if (!exam) {
      throw new Error('Exam not found');
    }

    // Get all responses for this attempt
    const responses = await Response.find({
      sessionId: attempt.sessionId,
      candidateId: attempt.candidateId
    }).populate('questionId');

    logger.info(`📝 [ExamEvaluation] Found ${responses.length} responses to evaluate`);

    // Process each question/response
    const questionResults: IQuestionResult[] = [];
    let totalScore = 0;
    let maxScore = 0;
    const competencyMap = new Map<string, { score: number; maxScore: number; count: number; autoCount: number; aiCount: number; pendingCount: number }>();
    const aiEvaluationTasks: Array<{ questionResult: IQuestionResult; response: any; question: any }> = [];

    for (const response of responses) {
      const question = response.questionId as any;
      if (!question) {
        logger.warn(`⚠️ [ExamEvaluation] Question not found for response: ${response._id}`);
        continue;
      }

      const questionMaxScore = question.metadata?.points || 1;
      maxScore += questionMaxScore;

      // Initialize competency tracking
      if (!competencyMap.has(question.competency)) {
        competencyMap.set(question.competency, {
          score: 0,
          maxScore: 0,
          count: 0,
          autoCount: 0,
          aiCount: 0,
          pendingCount: 0
        });
      }

      const competencyData = competencyMap.get(question.competency)!;
      competencyData.maxScore += questionMaxScore;
      competencyData.count++;

      // Determine evaluation method and evaluate
      if (this.isAutoGradable(question.type)) {
        // AUTO-GRADABLE: Evaluate immediately
        logger.info(`🤖 [ExamEvaluation] Auto-evaluating ${question.type} question: ${question._id}`);
        const result = await this.evaluateAutoGradable(question, response.response);

        const questionResult: IQuestionResult = {
          questionId: question._id,
          questionType: question.type,
          competency: question.competency,
          response: response.response,
          isCorrect: result.isCorrect,
          score: result.score,
          maxScore: questionMaxScore,
          feedback: result.feedback,
          evaluationMethod: 'automatic',
          evaluatedAt: new Date()
        };

        questionResults.push(questionResult);
        totalScore += result.score;
        competencyData.score += result.score;
        competencyData.autoCount++;

      } else {
        // AI-GRADABLE: Queue for AI evaluation
        logger.info(`🧠 [ExamEvaluation] Queuing for AI evaluation ${question.type} question: ${question._id}`);

        const questionResult: IQuestionResult = {
          questionId: question._id,
          questionType: question.type,
          competency: question.competency,
          response: response.response,
          score: 0, // Will be updated after AI evaluation
          maxScore: questionMaxScore,
          evaluationMethod: 'ai_grading',
          evaluatedAt: new Date()
        };

        questionResults.push(questionResult);
        aiEvaluationTasks.push({ questionResult, response: response.response, question });
        competencyData.pendingCount++;
      }
    }

    // Build competency scores
    const competencyScores = Array.from(competencyMap.entries()).map(([competency, data]) => ({
      competency,
      totalScore: data.score,
      maxScore: data.maxScore,
      percentage: data.maxScore > 0 ? Math.round((data.score / data.maxScore) * 100) : 0,
      questionCount: data.count,
      autoEvaluatedCount: data.autoCount,
      aiEvaluatedCount: data.aiCount,
      pendingEvaluationCount: data.pendingCount
    }));

    // Calculate exam duration
    const examDuration = attempt.finishedAt && attempt.startedAt
      ? Math.floor((attempt.finishedAt.getTime() - attempt.startedAt.getTime()) / 1000)
      : 0;

    // Create exam result
    const examResult = new ExamResult({
      attemptId: attempt._id,
      candidateId: attempt.candidateId,
      examId: exam._id,
      sessionId: attempt.sessionId,
      totalScore,
      maxScore,
      percentage: maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0,
      questionResults,
      competencyScores,
      status: aiEvaluationTasks.length > 0 ? 'pending_ai_review' : 'completed',
      evaluatedAt: new Date(),
      completedAt: aiEvaluationTasks.length === 0 ? new Date() : undefined,
      examDuration,
      timeAllowed: attempt.timeAllowedSeconds,
      examName: exam.name,
      examLevel: exam.targetLevel
    });

    await examResult.save();
    logger.info(`✅ [ExamEvaluation] Exam result created with ID: ${examResult._id}`);

    // Process AI evaluations asynchronously
    if (aiEvaluationTasks.length > 0) {
      logger.info(`🧠 [ExamEvaluation] Starting ${aiEvaluationTasks.length} AI evaluations asynchronously`);
      this.processAIEvaluations(String(examResult._id), aiEvaluationTasks)
        .catch(error => logger.error('Error processing AI evaluations:', error));
    }

    return examResult;
  }

  /**
   * Check if a question type can be auto-graded
   */
  private isAutoGradable(questionType: string): boolean {
    const autoGradableTypes = [
      'multiple_choice',
      'true_false',
      'fill_blanks',
      'matching',
      'ordering',
      'drag_drop'
    ];
    return autoGradableTypes.includes(questionType);
  }

  /**
   * Evaluate auto-gradable questions
   */
  private async evaluateAutoGradable(question: any, response: any): Promise<AutoGradableResult> {
    const maxScore = question.metadata?.points || 1;

    try {
      switch (question.type) {
        case 'multiple_choice':
          return this.evaluateMultipleChoice(question, response, maxScore);

        case 'true_false':
          return this.evaluateTrueFalse(question, response, maxScore);

        case 'fill_blanks':
          return this.evaluateFillBlanks(question, response, maxScore);

        case 'matching':
          return this.evaluateMatching(question, response, maxScore);

        case 'ordering':
          return this.evaluateOrdering(question, response, maxScore);

        default:
          logger.warn(`⚠️ [ExamEvaluation] Unknown auto-gradable type: ${question.type}`);
          return { isCorrect: false, score: 0, maxScore, feedback: 'Unknown question type' };
      }
    } catch (error) {
      logger.error(`❌ [ExamEvaluation] Error evaluating ${question.type}:`, error);
      return { isCorrect: false, score: 0, maxScore, feedback: 'Evaluation error' };
    }
  }

  private evaluateMultipleChoice(question: any, response: any, maxScore: number): AutoGradableResult {
    const correctOptions = question.content?.options
      ?.filter((opt: any) => opt.isCorrect)
      .map((opt: any) => opt._id.toString()) || [];

    const selectedOptions = (response.selectedOptions || []).map((id: any) => id.toString());

    // Check if arrays match (order doesn't matter)
    const isCorrect = correctOptions.length === selectedOptions.length &&
      correctOptions.every((id: string) => selectedOptions.includes(id));

    return {
      isCorrect,
      score: isCorrect ? maxScore : 0,
      maxScore,
      feedback: isCorrect ? 'Respuesta correcta' : `Respuesta incorrecta. Las opciones correctas eran: ${correctOptions.length}`
    };
  }

  private evaluateTrueFalse(question: any, response: any, maxScore: number): AutoGradableResult {
    // Find the correct answer from the options
    const correctOption = question.content?.options?.find((opt: any) => opt.isCorrect);
    const correctAnswer = correctOption?.text?.toLowerCase() === 'true';

    // Handle both boolean and string responses
    let userAnswer: boolean;
    if (typeof response.answer === 'boolean') {
      userAnswer = response.answer;
    } else if (typeof response.answer === 'string') {
      userAnswer = response.answer.toLowerCase() === 'true';
    } else {
      return { isCorrect: false, score: 0, maxScore, feedback: 'Respuesta inválida' };
    }

    const isCorrect = userAnswer === correctAnswer;

    return {
      isCorrect,
      score: isCorrect ? maxScore : 0,
      maxScore,
      feedback: isCorrect ? 'Respuesta correcta' : `Respuesta incorrecta. La respuesta correcta era: ${correctAnswer ? 'Verdadero' : 'Falso'}`
    };
  }

  private evaluateFillBlanks(question: any, response: any, maxScore: number): AutoGradableResult {
    const correctAnswers = question.content?.blanks || [];
    const userAnswers = response.blanks || [];

    if (!Array.isArray(correctAnswers) || !Array.isArray(userAnswers)) {
      return { isCorrect: false, score: 0, maxScore, feedback: 'Formato de respuesta inválido' };
    }

    let correctCount = 0;
    for (let i = 0; i < correctAnswers.length; i++) {
      const correct = correctAnswers[i]?.toString().toLowerCase().trim();
      const user = userAnswers[i]?.toString().toLowerCase().trim();
      if (correct === user) {
        correctCount++;
      }
    }

    const percentage = correctAnswers.length > 0 ? correctCount / correctAnswers.length : 0;
    const score = Math.round(maxScore * percentage);

    return {
      isCorrect: correctCount === correctAnswers.length,
      score,
      maxScore,
      feedback: `${correctCount}/${correctAnswers.length} espacios completados correctamente`
    };
  }

  private evaluateMatching(question: any, response: any, maxScore: number): AutoGradableResult {
    // Implementation for matching questions
    const correctPairs = question.content?.correctPairs || {};
    const userPairs = response.pairs || {};

    const correctKeys = Object.keys(correctPairs);
    let correctCount = 0;

    for (const key of correctKeys) {
      if (userPairs[key] === correctPairs[key]) {
        correctCount++;
      }
    }

    const percentage = correctKeys.length > 0 ? correctCount / correctKeys.length : 0;
    const score = Math.round(maxScore * percentage);

    return {
      isCorrect: correctCount === correctKeys.length,
      score,
      maxScore,
      feedback: `${correctCount}/${correctKeys.length} parejas correctas`
    };
  }

  private evaluateOrdering(question: any, response: any, maxScore: number): AutoGradableResult {
    const correctOrder = question.content?.correctOrder || [];
    const userOrder = response.order || [];

    const isCorrect = JSON.stringify(correctOrder) === JSON.stringify(userOrder);

    return {
      isCorrect,
      score: isCorrect ? maxScore : 0,
      maxScore,
      feedback: isCorrect ? 'Orden correcto' : 'Orden incorrecto'
    };
  }

  /**
   * Process AI evaluations asynchronously
   */
  private async processAIEvaluations(examResultId: string, aiTasks: Array<{ questionResult: IQuestionResult; response: any; question: any }>) {
    logger.info(`🧠 [ExamEvaluation] Processing ${aiTasks.length} AI evaluations for result: ${examResultId}`);

    for (const { questionResult, response, question } of aiTasks) {
      try {
        const aiResult = await this.callAIGradingService(question, response);

        // Update the question result
        await ExamResult.updateOne(
          { _id: examResultId, 'questionResults.questionId': questionResult.questionId },
          {
            $set: {
              'questionResults.$.score': aiResult.score,
              'questionResults.$.feedback': aiResult.feedback,
              'questionResults.$.aiAnalysis': aiResult.analysis
            }
          }
        );

        logger.info(`✅ [ExamEvaluation] AI evaluation completed for question: ${questionResult.questionId}`);

      } catch (error) {
        logger.error(`❌ [ExamEvaluation] AI evaluation failed for question: ${questionResult.questionId}`, error);

        // Mark as failed
        await ExamResult.updateOne(
          { _id: examResultId, 'questionResults.questionId': questionResult.questionId },
          {
            $set: {
              'questionResults.$.feedback': 'Error en evaluación automática',
              'questionResults.$.score': 0
            }
          }
        );
      }
    }

    // Recalculate totals and mark as completed
    await this.recalculateResultTotals(examResultId);
    logger.info(`🎉 [ExamEvaluation] All AI evaluations completed for result: ${examResultId}`);
  }

  /**
   * Call the AI grading service
   */
  private async callAIGradingService(question: any, response: any) {
    const payload = {
      question_type: question.type,
      question_text: question.content?.question || question.title,
      context: question.content?.context || '',
      user_response: response,
      max_score: question.metadata?.points || 1,
      competency: question.competency,
      level: question.level
    };

    const result = await axios.post(`${this.aiGradingServiceUrl}/api/v1/grading/evaluate`, payload, {
      timeout: 30000, // 30 second timeout
      headers: {
        'Content-Type': 'application/json'
      }
    });

    return result.data;
  }

  /**
   * Recalculate exam totals after AI evaluation
   */
  private async recalculateResultTotals(examResultId: string) {
    const examResult = await ExamResult.findById(examResultId);
    if (!examResult) return;

    let totalScore = 0;
    const competencyMap = new Map<string, { score: number; maxScore: number; count: number; autoCount: number; aiCount: number; pendingCount: number }>();

    // Recalculate from question results
    for (const qr of examResult.questionResults) {
      totalScore += qr.score;

      if (!competencyMap.has(qr.competency)) {
        competencyMap.set(qr.competency, {
          score: 0,
          maxScore: 0,
          count: 0,
          autoCount: 0,
          aiCount: 0,
          pendingCount: 0
        });
      }

      const competencyData = competencyMap.get(qr.competency)!;
      competencyData.score += qr.score;
      competencyData.maxScore += qr.maxScore;
      competencyData.count++;

      if (qr.evaluationMethod === 'automatic') {
        competencyData.autoCount++;
      } else if (qr.evaluationMethod === 'ai_grading') {
        competencyData.aiCount++;
      }
    }

    // Update competency scores
    const competencyScores = Array.from(competencyMap.entries()).map(([competency, data]) => ({
      competency,
      totalScore: data.score,
      maxScore: data.maxScore,
      percentage: data.maxScore > 0 ? Math.round((data.score / data.maxScore) * 100) : 0,
      questionCount: data.count,
      autoEvaluatedCount: data.autoCount,
      aiEvaluatedCount: data.aiCount,
      pendingEvaluationCount: 0 // All should be completed now
    }));

    // Update exam result
    await ExamResult.updateOne(
      { _id: examResultId },
      {
        $set: {
          totalScore,
          percentage: examResult.maxScore > 0 ? Math.round((totalScore / examResult.maxScore) * 100) : 0,
          competencyScores,
          status: 'completed',
          completedAt: new Date()
        }
      }
    );
  }

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