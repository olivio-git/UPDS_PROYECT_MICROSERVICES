import { Router, Request, Response } from 'express';
import { examResultPDFService } from '../services/exam-result-pdf.service';
import { logger } from '../utils/logger';

const router = Router();

/**
 * Internal endpoint for generating exam result PDFs.
 * NOT exposed through nginx — only accessible from within the Docker network.
 * Used by grading-service after grading to attach the PDF to the email notification.
 *
 * GET /internal/exam-results/:resultId/pdf
 * Query params (optional, speeds up generation by skipping user-management lookup):
 *   - firstName, lastName, email, candidateId
 */
router.get('/exam-results/:resultId/pdf', async (req: Request, res: Response) => {
  const { resultId } = req.params;
  const { firstName, lastName, email, candidateId } = req.query as Record<string, string>;

  if (!resultId) {
    res.status(400).json({ success: false, message: 'resultId is required' });
    return;
  }

  try {
    logger.info(`📄 [Internal] Generating PDF for result: ${resultId}`);

    const userInfo =
      firstName && lastName && email && candidateId
        ? { firstName, lastName, email, candidateId }
        : undefined;

    const pdfBuffer = await examResultPDFService.generateExamResultPDF(
      resultId,
      { includeQuestionDetails: true, includeAIAnalysis: true, language: 'spanish' },
      userInfo
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);

    logger.info(`✅ [Internal] PDF generated for result: ${resultId} (${pdfBuffer.length} bytes)`);
  } catch (error) {
    logger.error(`❌ [Internal] Error generating PDF for result: ${resultId}`, error);
    res.status(500).json({
      success: false,
      message: 'Error generating PDF',
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

export { router as internalRoutes };
