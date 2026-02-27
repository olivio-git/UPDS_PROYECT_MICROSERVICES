import { Request, Response } from 'express';
import { QuestionEvaluationService } from '../services/questionEvaluation.service';
import { Question } from '../models/question.model';
import { Session } from '../models/session.model';
import { Response as ResponseModel } from '../models/response.model';
import { logger } from '../utils/logger';
import { systemMonitoringService } from '../services/systemMonitoring.service';

export class EvaluationController {
  private evaluationService: QuestionEvaluationService;

  constructor() {
    this.evaluationService = new QuestionEvaluationService();
  }

  /**
   * Evaluate a single response immediately
   */
  async evaluateResponse(req: Request, res: Response): Promise<void> {
    try {
      const { questionId, response, maxScore = 1 } = req.body;

      if (!questionId || response === undefined) {
        res.status(400).json({
          success: false,
          message: 'Question ID and response are required'
        });
        return;
      }

      // Get question from database
      const question = await Question.findById(questionId);
      if (!question) {
        res.status(404).json({
          success: false,
          message: 'Question not found'
        });
        return;
      }

      // Evaluate the response
      const evaluation = await this.evaluationService.evaluateResponse(
        question.toObject(),
        response,
        maxScore
      );

      res.json({
        success: true,
        data: {
          questionId,
          evaluation,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error:any) {
      logger.error('Error evaluating response:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to evaluate response',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Evaluate all responses for a session
   */
  async evaluateSession(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;
      const { forceReevaluate = false } = req.query;

      if (!sessionId) {
        res.status(400).json({
          success: false,
          message: 'Session ID is required'
        });
        return;
      }

      // Get session with responses
      const session = await Session.findById(sessionId).populate('exam');
      if (!session) {
        res.status(404).json({
          success: false,
          message: 'Session not found'
        });
        return;
      }

      // Get all responses for this session
      const responses = await ResponseModel.find({ session: sessionId })
        .populate('question');

      if (responses.length === 0) {
        res.json({
          success: true,
          data: {
            sessionId,
            totalResponses: 0,
            evaluatedResponses: 0,
            totalScore: 0,
            maxScore: 0,
            percentage: 0,
            evaluations: []
          }
        });
        return;
      }

      const evaluationResults = [];
      let totalScore = 0;
      let maxTotalScore = 0;

      // Process each response
      for (const response of responses) {
        try {
          // Skip if already evaluated and not forcing re-evaluation
          if (response.evaluation && !forceReevaluate) {
            totalScore += response.evaluation.score || 0;
            maxTotalScore += response.evaluation.maxScore || 1;
            evaluationResults.push({
              responseId: response._id,
              questionId: response.question._id,
              evaluation: response.evaluation
            });
            continue;
          }

          const question = response.question;
          const maxScore = question.points || question.maxScore || 1;

          // Evaluate the response
          const evaluation = await this.evaluationService.evaluateResponse(
            question.toObject(),
            response.answer,
            maxScore
          );

          // Update the response with evaluation
          response.evaluation = evaluation;
          response.isEvaluated = true;
          response.evaluatedAt = new Date();
          await response.save();

          totalScore += evaluation.score;
          maxTotalScore += evaluation.maxScore;

          evaluationResults.push({
            responseId: response._id,
            questionId: question._id,
            evaluation
          });

        } catch (error:any) {
          logger.error(`Error evaluating response ${response._id}:`, error);
          evaluationResults.push({
            responseId: response._id,
            questionId: response.question._id,
            error: error.message
          });
        }
      }

      // Update session with final score
      session.finalScore = totalScore;
      session.maxScore = maxTotalScore;
      session.isEvaluated = true;
      session.evaluatedAt = new Date();
      await session.save();

      const percentage = maxTotalScore > 0 ? (totalScore / maxTotalScore) * 100 : 0;

      res.json({
        success: true,
        data: {
          sessionId,
          totalResponses: responses.length,
          evaluatedResponses: evaluationResults.length,
          totalScore,
          maxScore: maxTotalScore,
          percentage: Math.round(percentage * 100) / 100,
          evaluations: evaluationResults,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error:any) {
      logger.error('Error evaluating session:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to evaluate session',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Get evaluation statistics for a question
   */
  async getQuestionStatistics(req: Request, res: Response): Promise<void> {
    try {
      const { questionId } = req.params;

      if (!questionId) {
        res.status(400).json({
          success: false,
          message: 'Question ID is required'
        });
        return;
      }

      // Get all responses for this question
      const responses = await ResponseModel.find({ 
        question: questionId,
        isEvaluated: true 
      }).select('answer evaluation timeSpent submittedAt');

      if (responses.length === 0) {
        res.json({
          success: true,
          data: {
            questionId,
            statistics: {
              totalResponses: 0,
              correctResponses: 0,
              accuracy: 0,
              averageScore: 0,
              averageTime: 0,
              difficultyRating: 0
            }
          }
        });
        return;
      }

      // Generate statistics
      const statistics = await this.evaluationService.generateQuestionStatistics(
        questionId,
        responses.map(r => r.toObject())
      );

      res.json({
        success: true,
        data: {
          questionId,
          statistics,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error:any) {
      logger.error('Error getting question statistics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get question statistics',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Get exam-wide statistics
   */
  async getExamStatistics(req: Request, res: Response): Promise<void> {
    try {
      const { examId } = req.params;

      if (!examId) {
        res.status(400).json({
          success: false,
          message: 'Exam ID is required'
        });
        return;
      }

      // Get all sessions for this exam
      const sessions = await Session.find({ 
        exam: examId,
        isEvaluated: true 
      }).select('finalScore maxScore user completedAt');

      if (sessions.length === 0) {
        res.json({
          success: true,
          data: {
            examId,
            statistics: {
              totalSessions: 0,
              completedSessions: 0,
              averageScore: 0,
              highestScore: 0,
              lowestScore: 0,
              passingRate: 0,
              averageCompletionTime: 0
            }
          }
        });
        return;
      }

      const scores = sessions.map(s => s.finalScore || 0);
      const maxScores = sessions.map(s => s.maxScore || 1);
      const percentages = sessions.map((s, i) => {
        const maxScore = maxScores[i] || 1;
        const score = scores[i] || 0;
        return maxScore > 0 ? (score / maxScore) * 100 : 0;
      });

      const passingThreshold = 60; // 60% to pass
      const passingSessions = percentages.filter(p => p >= passingThreshold).length;

      const statistics = {
        totalSessions: sessions.length,
        completedSessions: sessions.length,
        averageScore: scores.reduce((sum, score) => sum + score, 0) / scores.length,
        averagePercentage: percentages.reduce((sum, pct) => sum + pct, 0) / percentages.length,
        highestScore: Math.max(...scores),
        lowestScore: Math.min(...scores),
        highestPercentage: Math.max(...percentages),
        lowestPercentage: Math.min(...percentages),
        passingRate: (passingSessions / sessions.length) * 100,
        scoreDistribution: {
          excellent: percentages.filter(p => p >= 90).length,
          good: percentages.filter(p => p >= 80 && p < 90).length,
          satisfactory: percentages.filter(p => p >= 70 && p < 80).length,
          passing: percentages.filter(p => p >= 60 && p < 70).length,
          failing: percentages.filter(p => p < 60).length
        }
      };

      res.json({
        success: true,
        data: {
          examId,
          statistics,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error:any) {
      logger.error('Error getting exam statistics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get exam statistics',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Get responses that require manual review
   */
  async getManualReviewQueue(req: Request, res: Response): Promise<void> {
    try {
      const { examId, limit = 50, offset = 0 } = req.query;

      const query: any = {
        $or: [
          { 'evaluation.details.requiresManualReview': true },
          { isEvaluated: false },
          { 'evaluation.isCorrect': false, 'evaluation.details.requiresManualReview': { $exists: false } }
        ]
      };

      if (examId) {
        // Get sessions for this exam and filter responses
        const sessions = await Session.find({ exam: examId }).select('_id');
        const sessionIds = sessions.map(s => s._id);
        query.session = { $in: sessionIds };
      }

      const responses = await ResponseModel.find(query)
        .populate('question', 'title content type')
        .populate('session', 'exam user')
        .sort({ submittedAt: -1 })
        .limit(parseInt(limit as string))
        .skip(parseInt(offset as string));

      const total = await ResponseModel.countDocuments(query);

      res.json({
        success: true,
        data: {
          responses: responses.map(r => ({
            id: r._id,
            questionId: r.question._id,
            questionTitle: r.question.title,
            questionType: r.question.type,
            sessionId: r.session._id,
            userId: r.session.user,
            answer: r.answer,
            evaluation: r.evaluation,
            submittedAt: r.submittedAt,
            requiresReview: r.evaluation?.details?.requiresManualReview || !r.isEvaluated
          })),
          pagination: {
            total,
            limit: parseInt(limit as string),
            offset: parseInt(offset as string),
            hasMore: (parseInt(offset as string) + responses.length) < total
          }
        }
      });

    } catch (error:any) {
      logger.error('Error getting manual review queue:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get manual review queue',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Update manual evaluation for a response
   */
  async updateManualEvaluation(req: Request, res: Response): Promise<void> {
    try {
      const { responseId } = req.params;
      const { score, isCorrect, feedback, reviewNotes } = req.body;

      if (!responseId) {
        res.status(400).json({
          success: false,
          message: 'Response ID is required'
        });
        return;
      }

      const response = await ResponseModel.findById(responseId);
      if (!response) {
        res.status(404).json({
          success: false,
          message: 'Response not found'
        });
        return;
      }

      // Update evaluation with manual review
      response.evaluation = {
        ...response.evaluation,
        score: score !== undefined ? score : response.evaluation?.score || 0,
        maxScore: response.evaluation?.maxScore || 1,
        isCorrect: isCorrect !== undefined ? isCorrect : response.evaluation?.isCorrect || false,
        feedback: feedback || response.evaluation?.feedback,
        evaluatedBy: req.user?.id || 'manual_reviewer',
        evaluatedAt: new Date(),
        details: {
          ...response.evaluation?.details,
          manuallyReviewed: true,
          reviewNotes,
          reviewedAt: new Date(),
          reviewedBy: req.user?.id // Assume user info is in request from auth middleware
        }
      };

      response.isEvaluated = true;
      response.evaluatedAt = new Date();
      await response.save();

      res.json({
        success: true,
        data: {
          responseId,
          evaluation: response.evaluation,
          message: 'Manual evaluation updated successfully'
        }
      });

    } catch (error:any) {
      logger.error('Error updating manual evaluation:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update manual evaluation',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
}