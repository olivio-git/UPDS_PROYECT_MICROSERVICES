import PDFDocument from 'pdfkit';
import { CompetencyAnalysisReport, StudentStatsReport, UpcomingSessionsReport, StudentHistoryReport } from './reports.service';
import { llmInterpretationService, DataInterpretation, InterpretationConfig } from './llm-interpretation.service';
import { logger } from '../utils/logger';

export interface PDFGenerationOptions {
  includeInterpretation?: boolean;
  interpretationConfig?: InterpretationConfig;
  language?: 'spanish' | 'english';
  companyName?: string;
  logoUrl?: string;
}

/**
 * Fallback PDF Service using PDFKit when Puppeteer is not available
 * This provides basic PDF generation functionality as a backup
 */
export class FallbackPDFService {
  private colors = {
    primary: '#2563eb',
    secondary: '#64748b',
    success: '#059669',
    warning: '#d97706',
    danger: '#dc2626',
    background: '#f8fafc',
    text: '#1e293b',
    textLight: '#64748b'
  };

  /**
   * Genera PDF básico de análisis de competencias
   */
  async generateCompetencyReportPDF(
    report: CompetencyAnalysisReport,
    options: PDFGenerationOptions = {}
  ): Promise<Buffer> {
    logger.info('Generando PDF básico de competencias (fallback)');

    // Obtener interpretación LLM si está habilitada
    let interpretation: DataInterpretation | null = null;
    if (options.includeInterpretation) {
      try {
        interpretation = await llmInterpretationService.interpretCompetencyData(
          report,
          options.interpretationConfig || { language: 'spanish', depth: 'detailed', focus: 'academic' }
        );
        logger.info('Interpretación LLM obtenida para competencias (fallback)');
      } catch (error) {
        const errorInfo = {
          message: error instanceof Error ? error.message : String(error),
          code: (error as any)?.code
        };
        logger.warn('Error obteniendo interpretación LLM para competencias (fallback):', errorInfo);
      }
    }

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));

    const isSpanish = options.language !== 'english';
    const companyName = options.companyName || (isSpanish ? 'Sistema de Evaluación Académica' : 'Academic Evaluation System');

    // Header simple
    doc.rect(0, 0, doc.page.width, 80)
       .fillAndStroke(this.colors.primary, this.colors.primary);

    doc.fillColor('white')
       .fontSize(20)
       .font('Helvetica-Bold')
       .text(isSpanish ? 'Reporte de Competencias' : 'Competency Report', 50, 30);

    doc.fontSize(10)
       .font('Helvetica')
       .text(`${companyName} - ${new Date().toLocaleDateString()}`, 50, 55);

    doc.y = 120;
    doc.fillColor(this.colors.text);

    // Interpretación LLM si está disponible
    if (interpretation) {
      doc.fontSize(16)
         .font('Helvetica-Bold')
         .fillColor(this.colors.primary)
         .text(isSpanish ? '🤖 Análisis Inteligente' : '🤖 AI Analysis', 50, doc.y + 20);

      doc.y += 35;

      if (interpretation.summary) {
        doc.fontSize(12)
           .font('Helvetica-Bold')
           .fillColor(this.colors.text)
           .text(isSpanish ? 'Resumen:' : 'Summary:', 50, doc.y + 10);

        doc.fontSize(10)
           .font('Helvetica')
           .fillColor(this.colors.textLight)
           .text(interpretation.summary, 50, doc.y + 5, { width: 500 });

        doc.y += 20;
      }

      if (interpretation.keyInsights && interpretation.keyInsights.length > 0) {
        doc.fontSize(11)
           .font('Helvetica-Bold')
           .fillColor(this.colors.text)
           .text(isSpanish ? 'Insights Clave:' : 'Key Insights:', 50, doc.y + 10);

        interpretation.keyInsights.forEach(insight => {
          doc.fontSize(9)
             .font('Helvetica')
             .fillColor(this.colors.textLight)
             .text(`• ${insight}`, 60, doc.y + 5, { width: 480 });
        });

        doc.y += 15;
      }

      if (interpretation.recommendations && interpretation.recommendations.length > 0) {
        doc.fontSize(11)
           .font('Helvetica-Bold')
           .fillColor(this.colors.text)
           .text(isSpanish ? 'Recomendaciones:' : 'Recommendations:', 50, doc.y + 10);

        interpretation.recommendations.forEach(rec => {
          doc.fontSize(9)
             .font('Helvetica')
             .fillColor(this.colors.textLight)
             .text(`• ${rec}`, 60, doc.y + 5, { width: 480 });
        });

        doc.y += 15;
      }

      doc.addPage();
    }

    // Resumen ejecutivo
    doc.fontSize(16)
       .font('Helvetica-Bold')
       .fillColor(this.colors.primary)
       .text(isSpanish ? 'Resumen Ejecutivo' : 'Executive Summary', 50, 80);

    doc.y += 20;

    // Métricas básicas
    const metrics = [
      [isSpanish ? 'Competencias:' : 'Competencies:', Object.keys(report.competencyBreakdown).length],
      [isSpanish ? 'Promedio:' : 'Average:', `${(Object.values(report.competencyBreakdown).reduce((sum, comp) => sum + comp.averageScore, 0) / Object.keys(report.competencyBreakdown).length).toFixed(1)}%`],
      [isSpanish ? 'Exámenes:' : 'Exams:', report.overallStats.totalExams],
      [isSpanish ? 'Completación:' : 'Completion:', `${report.overallStats.completionRate.toFixed(1)}%`]
    ];

    metrics.forEach(([label, value]) => {
      doc.fontSize(12)
         .font('Helvetica-Bold')
         .fillColor(this.colors.text)
         .text(String(label), 50, doc.y + 10);

      doc.fontSize(14)
         .font('Helvetica-Bold')
         .fillColor(this.colors.primary)
         .text(String(value), 200, doc.y);

      doc.y += 5;
    });

    // Tabla de competencias (simplificada)
    doc.y += 30;
    doc.fontSize(14)
       .font('Helvetica-Bold')
       .fillColor(this.colors.primary)
       .text(isSpanish ? 'Detalle por Competencias' : 'Competency Details', 50, doc.y);

    doc.y += 20;

    Object.entries(report.competencyBreakdown).forEach(([comp, data]) => {
      doc.fontSize(11)
         .font('Helvetica-Bold')
         .fillColor(this.colors.text)
         .text(comp, 50, doc.y + 10);

      doc.fontSize(10)
         .font('Helvetica')
         .fillColor(this.colors.textLight)
         .text(`${isSpanish ? 'Promedio:' : 'Average:'} ${data.averageScore.toFixed(1)}% | ${isSpanish ? 'Estudiantes:' : 'Students:'} ${data.studentsEvaluated} | ${isSpanish ? 'Preguntas:' : 'Questions:'} ${data.questionCount}`, 50, doc.y + 5);

      doc.y += 10;
    });

    // Footer
    doc.fontSize(8)
       .font('Helvetica')
       .fillColor(this.colors.textLight)
       .text(
         isSpanish
           ? `Generado automáticamente - ${new Date().toISOString()}`
           : `Automatically generated - ${new Date().toISOString()}`,
         50,
         doc.page.height - 50
       );

    doc.end();

    return new Promise((resolve) => {
      doc.on('end', () => {
        resolve(Buffer.concat(chunks));
      });
    });
  }

  /**
   * Genera PDF básico de estadísticas de estudiantes
   */
  async generateStudentReportPDF(
    report: StudentStatsReport,
    options: PDFGenerationOptions = {}
  ): Promise<Buffer> {
    logger.info('Generando PDF básico de estudiantes (fallback)');
    // Implementation similar to competency but simplified
    return this.generateBasicReport('Student Statistics', report, options);
  }

  /**
   * Genera PDF básico de próximas sesiones
   */
  async generateUpcomingSessionsPDF(
    report: UpcomingSessionsReport,
    options: PDFGenerationOptions = {}
  ): Promise<Buffer> {
    logger.info('Generando PDF básico de sesiones (fallback)');
    return this.generateBasicReport('Upcoming Sessions', report, options);
  }

  /**
   * Genera PDF básico de historial de estudiante
   */
  async generateStudentHistoryPDF(
    report: StudentHistoryReport,
    options: PDFGenerationOptions = {}
  ): Promise<Buffer> {
    logger.info('Generando PDF básico de historial (fallback)');
    return this.generateBasicReport('Student History', report, options);
  }

  /**
   * Genera un reporte básico genérico
   */
  async generateBasicReport(title: string, report: any, options: PDFGenerationOptions): Promise<Buffer> {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));

    const isSpanish = options.language !== 'english';
    const companyName = options.companyName || (isSpanish ? 'Sistema de Evaluación Académica' : 'Academic Evaluation System');

    // Header simple
    doc.rect(0, 0, doc.page.width, 80)
       .fillAndStroke(this.colors.primary, this.colors.primary);

    doc.fillColor('white')
       .fontSize(20)
       .font('Helvetica-Bold')
       .text(title, 50, 30);

    doc.fontSize(10)
       .font('Helvetica')
       .text(`${companyName} - ${new Date().toLocaleDateString()}`, 50, 55);

    doc.y = 120;
    doc.fillColor(this.colors.text);

    // Contenido básico
    doc.fontSize(12)
       .font('Helvetica')
       .text(isSpanish ? 'Reporte generado exitosamente.' : 'Report generated successfully.', 50, doc.y + 20);

    doc.fontSize(10)
       .font('Helvetica')
       .fillColor(this.colors.textLight)
       .text(isSpanish ? 'Este es un reporte básico generado como respaldo cuando el servicio de PDF profesional no está disponible.' : 'This is a basic report generated as fallback when the professional PDF service is not available.', 50, doc.y + 20, { width: 500 });

    // Footer
    doc.fontSize(8)
       .font('Helvetica')
       .fillColor(this.colors.textLight)
       .text(
         isSpanish
           ? `Generado automáticamente (modo básico) - ${new Date().toISOString()}`
           : `Automatically generated (basic mode) - ${new Date().toISOString()}`,
         50,
         doc.page.height - 50
       );

    doc.end();

    return new Promise((resolve) => {
      doc.on('end', () => {
        resolve(Buffer.concat(chunks));
      });
    });
  }
}

export const fallbackPDFService = new FallbackPDFService();