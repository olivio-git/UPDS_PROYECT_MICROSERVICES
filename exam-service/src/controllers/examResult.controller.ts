import { NextFunction, Request, Response } from 'express';
import { ExamEvaluationService } from '../services/examEvaluation.service';
import { examResultPDFService } from '../services/exam-result-pdf.service';
import { logger } from '../utils/logger';

const evaluationService = new ExamEvaluationService();

export class ExamResultController {
  /**
   * Get recent results for the authenticated user
   */
  async getMyRecentResults(req: Request, res: Response, next: NextFunction) {
    try {
      const userCandidateId = req.user && (req as any).userCandidateId;
      console.log(req.user, ' <--- req.user in getMyRecentResults'); // --- IGNORE ---
      if (!userCandidateId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      const limit = parseInt(req.query.limit as string) || 10;
      const results = await evaluationService.getResultsForCandidate(String(userCandidateId), limit);

      // Transform to match frontend expectations
      const recentResults = results.map(result => ({
        id: String(result._id),
        examName: result.examName,
        date: result.evaluatedAt.toISOString(),
        score: result.percentage,
        level: result.examLevel,
        status: result.status,
        competencies: result.competencyScores.reduce((acc, comp) => {
          acc[comp.competency] = comp.percentage;
          return acc;
        }, {} as Record<string, number>),
        duration: result.examDuration,
        timeAllowed: result.timeAllowed,
        totalQuestions: result.questionResults.length
      }));

      res.json({
        success: true,
        data: {
          recentResults,
          totalResults: results.length
        }
      });

    } catch (error) {
      logger.error('Error getting recent results:', error);
      next(error);
    }
  }

  /**
   * Get detailed result by ID
   */
  async getResultDetails(req: Request, res: Response, next: NextFunction) {
    try {
      const { resultId } = req.params;
      const userCandidateId = req.user && (req as any).userCandidateId;

      if (!userCandidateId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      if (!resultId) {
        res.status(400).json({ success: false, message: 'Result ID required' });
        return;
      }

      const result = await evaluationService.getExamResult(resultId);

      if (!result) {
        res.status(404).json({ success: false, message: 'Result not found' });
        return;
      }

      // Verify ownership
      if (result.candidateId.toString() !== String(userCandidateId)) {
        res.status(403).json({ success: false, message: 'Access denied' });
        return;
      }

      res.json({
        success: true,
        data: result
      });

    } catch (error) {
      logger.error('Error getting result details:', error);
      next(error);
    }
  }

  /**
   * Get detailed result with populated question data
   */
  async getDetailedResultWithQuestions(req: Request, res: Response, next: NextFunction) {
    try {
      const { resultId } = req.params;
      const userCandidateId = req.user && (req as any).userCandidateId;

      if (!userCandidateId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      if (!resultId) {
        res.status(400).json({ success: false, message: 'Result ID required' });
        return;
      }

      const result = await evaluationService.getDetailedExamResult(resultId);

      if (!result) {
        res.status(404).json({ success: false, message: 'Result not found' });
        return;
      }

      // Verify ownership
      if (result.candidateId.toString() !== String(userCandidateId)) {
        res.status(403).json({ success: false, message: 'Access denied' });
        return;
      }

      res.json({
        success: true,
        data: result
      });

    } catch (error) {
      logger.error('Error getting detailed result with questions:', error);
      next(error);
    }
  }

  /**
   * Get result by attempt ID
   */
  async getResultByAttempt(req: Request, res: Response, next: NextFunction) {
    try {
      const { attemptId } = req.params;
      const userCandidateId = req.user && (req as any).userCandidateId;

      if (!userCandidateId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      if (!attemptId) {
        res.status(400).json({ success: false, message: 'Attempt ID required' });
        return;
      }

      const result = await evaluationService.getResultByAttempt(attemptId);

      if (!result) {
        res.status(404).json({
          success: false,
          message: 'Result not found. The exam may still be processing.'
        });
        return;
      }

      // Verify ownership
      if (result.candidateId.toString() !== String(userCandidateId)) {
        res.status(403).json({ success: false, message: 'Access denied' });
        return;
      }

      res.json({
        success: true,
        data: {
          id: String(result._id),
          examName: result.examName,
          date: result.evaluatedAt.toISOString(),
          score: result.percentage,
          level: result.examLevel,
          status: result.status,
          competencies: result.competencyScores.reduce((acc, comp) => {
            acc[comp.competency] = comp.percentage;
            return acc;
          }, {} as Record<string, number>),
          duration: result.examDuration,
          timeAllowed: result.timeAllowed,
          totalQuestions: result.questionResults.length,
          gradingDurationMs: (result as any).gradingDurationMs,
          gradingBreakdown: (result as any).gradingBreakdown,
          details: result
        }
      });

    } catch (error) {
      logger.error('Error getting result by attempt:', error);
      next(error);
    }
  }

  /**
   * Get detailed result by ID — admin/teacher view (no ownership check)
   */
  async getResultDetailsAdmin(req: Request, res: Response, next: NextFunction) {
    try {
      const { resultId } = req.params;

      if (!resultId) {
        res.status(400).json({ success: false, message: 'Result ID required' });
        return;
      }

      const result = await evaluationService.getDetailedExamResult(resultId);

      if (!result) {
        res.status(404).json({ success: false, message: 'Result not found' });
        return;
      }

      res.json({ success: true, data: result });
    } catch (error) {
      logger.error('Error getting result details (admin):', error);
      next(error);
    }
  }

  /**
   * Force re-evaluation of an exam (admin only or for debugging)
   */
  async reevaluateExam(req: Request, res: Response, next: NextFunction) {
    try {
      const { attemptId } = req.params;

      if (!attemptId) {
        res.status(400).json({ success: false, message: 'Attempt ID required' });
        return;
      }

      logger.info(`🔄 [ExamResult] Manual re-evaluation requested for attempt: ${attemptId}`);

      const result = await evaluationService.evaluateExam(attemptId);

      res.json({
        success: true,
        data: result,
        message: 'Re-evaluation completed'
      });

    } catch (error) {
      logger.error('Error re-evaluating exam:', error);
      next(error);
    }
  }

  /**
   * Get evaluation statistics for the authenticated user
   */
  async getMyEvaluationStats(req: Request, res: Response, next: NextFunction) {
    try {
      const userCandidateId = req.user && (req as any).userCandidateId;
      if (!userCandidateId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      logger.info(`📊 [ExamResult] Getting evaluation stats for candidate: ${userCandidateId}`);

      const stats = await evaluationService.getEvaluationStats(String(userCandidateId));

      res.json({
        success: true,
        data: stats
      });

    } catch (error) {
      logger.error('Error getting evaluation stats:', error);
      next(error);
    }
  }

  /**
   * Generate and download PDF report for exam result
   */
  async generateExamResultPDF(req: Request, res: Response, next: NextFunction) {
    try {
      const { resultId } = req.params;
      const userCandidateId = (req as any).userCandidateId; // Comes from searchRefs middleware

      if (!userCandidateId) {
        res.status(401).json({ success: false, message: 'Unauthorized - Candidate ID not found' });
        return;
      }

      if (!resultId) {
        res.status(400).json({ success: false, message: 'Result ID required' });
        return;
      }

      logger.info(`📄 [ExamResult] Generating PDF for result: ${resultId} (candidate: ${userCandidateId})`);

      // Verify that the result belongs to the authenticated candidate
      const examResult = await evaluationService.getExamResult(resultId);
      if (!examResult) {
        res.status(404).json({ success: false, message: 'Exam result not found' });
        return;
      }

      if (examResult.candidateId.toString() !== String(userCandidateId)) {
        res.status(403).json({ success: false, message: 'Access denied - Result does not belong to this candidate' });
        return;
      }

      // Extract options from query parameters
      const options = {
        includeQuestionDetails: req.query.includeQuestions === 'true',
        includeAIAnalysis: req.query.includeAI === 'true',
        includeLLMInterpretation: req.query.includeLLM === 'true',
        language: (req.query.language as 'spanish' | 'english') || 'spanish',
        companyName: req.query.companyName as string || undefined,
        llmConfig: {
          depth: (req.query.llmDepth as 'brief' | 'detailed') || 'detailed',
          focus: (req.query.llmFocus as 'academic' | 'administrative' | 'strategic') || 'academic'
        }
      };

      // Generate PDF with user info from middleware
      const userInfo = (req as any).userInfo;
      const pdfBuffer = await examResultPDFService.generateExamResultPDF(resultId, options, userInfo);

      // Set response headers for PDF download
      const fileName = `Resultado_Examen_${resultId}_${new Date().toISOString().split('T')[0]}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Content-Length', pdfBuffer.length);

      // Send PDF buffer
      res.send(pdfBuffer);

      logger.info(`✅ [ExamResult] PDF generated successfully for result: ${resultId}`);

    } catch (error) {
      logger.error('Error generating exam result PDF:', {
        message: error instanceof Error ? error.message : String(error),
        resultId: req.params.resultId
      });

      // Send error response if headers haven't been sent
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: 'Error generating PDF report',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }
}