import { professionalPDFService, PDFGenerationOptions } from './pdf-professional.service';
import { fallbackPDFService } from './pdf-fallback.service';
import { CompetencyAnalysisReport, StudentStatsReport, UpcomingSessionsReport, StudentHistoryReport } from './reports.service';
import { logger } from '../utils/logger';

// Re-export the interface for compatibility
export { PDFGenerationOptions };

/**
 * Legacy PDFService wrapper that uses the new ProfessionalPDFService
 * This maintains compatibility with existing code while providing enhanced PDF generation
 */
export class PDFService {
  /**
   * Genera PDF de análisis de competencias usando Puppeteer con fallback a PDFKit
   */
  async generateCompetencyReportPDF(
    report: CompetencyAnalysisReport,
    options: PDFGenerationOptions = {}
  ): Promise<Buffer> {
    try {
      logger.info('Intentando generación de PDF profesional de competencias');
      return await professionalPDFService.generateCompetencyReportPDF(report, options);
    } catch (error) {
      logger.warn('Servicio profesional de PDF no disponible, usando fallback:', {
        message: error instanceof Error ? error.message : String(error)
      });
      return await fallbackPDFService.generateCompetencyReportPDF(report, options);
    }
  }

  /**
   * Genera PDF de estadísticas de estudiantes usando Puppeteer con fallback a PDFKit
   */
  async generateStudentReportPDF(
    report: StudentStatsReport,
    options: PDFGenerationOptions = {}
  ): Promise<Buffer> {
    try {
      logger.info('Intentando generación de PDF profesional de estudiantes');
      return await professionalPDFService.generateStudentReportPDF(report, options);
    } catch (error) {
      logger.warn('Servicio profesional de PDF no disponible, usando fallback:', {
        message: error instanceof Error ? error.message : String(error)
      });
      return await fallbackPDFService.generateStudentReportPDF(report, options);
    }
  }

  /**
   * Genera PDF de próximas sesiones usando Puppeteer con fallback a PDFKit
   */
  async generateUpcomingSessionsPDF(
    report: UpcomingSessionsReport,
    options: PDFGenerationOptions = {}
  ): Promise<Buffer> {
    try {
      logger.info('Intentando generación de PDF profesional de sesiones');
      return await professionalPDFService.generateUpcomingSessionsPDF(report, options);
    } catch (error) {
      logger.warn('Servicio profesional de PDF no disponible, usando fallback:', {
        message: error instanceof Error ? error.message : String(error)
      });
      return await fallbackPDFService.generateUpcomingSessionsPDF(report, options);
    }
  }

  /**
   * Genera PDF de historial de estudiante usando Puppeteer con fallback a PDFKit
   */
  async generateStudentHistoryPDF(
    report: StudentHistoryReport,
    options: PDFGenerationOptions = {}
  ): Promise<Buffer> {
    try {
      logger.info('Intentando generación de PDF profesional de historial');
      return await professionalPDFService.generateStudentHistoryPDF(report, options);
    } catch (error) {
      logger.warn('Servicio profesional de PDF no disponible, usando fallback:', {
        message: error instanceof Error ? error.message : String(error)
      });
      return await fallbackPDFService.generateStudentHistoryPDF(report, options);
    }
  }
}

// Export singleton instance for backward compatibility
export const pdfService = new PDFService();