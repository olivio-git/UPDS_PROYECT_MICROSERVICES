import puppeteer from 'puppeteer';
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

export class ProfessionalPDFService {
  private browser: any = null;

  /**
   * Inicializa el navegador Puppeteer
   */
  private async initBrowser() {
    if (!this.browser) {
      try {
        // Try to launch Puppeteer with Docker-compatible settings
        this.browser = await puppeteer.launch({
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            '--disable-features=TranslateUI',
            '--disable-ipc-flooding-protection'
          ],
          // Try to use bundled Chrome first, then system Chrome
          executablePath: process.env.CHROME_EXECUTABLE_PATH || undefined
        });
        logger.info('Puppeteer browser launched successfully');
      } catch (error) {
        logger.error('Failed to launch Puppeteer browser:', error);
        // If Puppeteer fails, we'll need to fall back to the old PDF service
        throw new Error('PDF generation service unavailable. Chrome/Chromium not found. Please install Chrome or configure CHROME_EXECUTABLE_PATH environment variable.');
      }
    }
    return this.browser;
  }

  /**
   * Cierra el navegador
   */
  async closeBrowser() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Genera PDF de análisis de competencias con diseño profesional
   */
  async generateCompetencyReportPDF(
    report: CompetencyAnalysisReport,
    options: PDFGenerationOptions = {}
  ): Promise<Buffer> {
    logger.info('Generando PDF profesional de competencias', {
      includeInterpretation: options.includeInterpretation
    });

    // Obtener interpretación LLM si está habilitada
    let interpretation: DataInterpretation | null = null;
    if (options.includeInterpretation) {
      try {
        interpretation = await llmInterpretationService.interpretCompetencyData(
          report,
          options.interpretationConfig || { language: 'spanish', depth: 'detailed', focus: 'academic' }
        );
        logger.info('Interpretación LLM obtenida para competencias:', {
          summary: interpretation?.summary?.substring(0, 100),
          hasInsights: interpretation?.keyInsights?.length || 0,
          hasRecommendations: interpretation?.recommendations?.length || 0
        });
      } catch (error) {
        const errorInfo = {
          message: error instanceof Error ? error.message : String(error),
          code: (error as any)?.code
        };
        logger.warn('Error obteniendo interpretación LLM para competencias:', errorInfo);
      }
    }

    const html = this.generateCompetencyHTML(report, interpretation, options);
    return await this.generatePDFFromHTMLInternal(html, options);
  }

  /**
   * Genera PDF de estadísticas de estudiantes
   */
  async generateStudentReportPDF(
    report: StudentStatsReport,
    options: PDFGenerationOptions = {}
  ): Promise<Buffer> {
    logger.info('Generando PDF profesional de estudiantes', {
      includeInterpretation: options.includeInterpretation
    });

    let interpretation: DataInterpretation | null = null;
    if (options.includeInterpretation) {
      try {
        interpretation = await llmInterpretationService.interpretStudentStats(
          report,
          options.interpretationConfig || { language: 'spanish', depth: 'detailed', focus: 'academic' }
        );
        logger.info('Interpretación LLM obtenida para estudiantes:', {
          summary: interpretation?.summary?.substring(0, 100),
          hasInsights: interpretation?.keyInsights?.length || 0
        });
      } catch (error) {
        const errorInfo = {
          message: error instanceof Error ? error.message : String(error),
          code: (error as any)?.code
        };
        logger.warn('Error obteniendo interpretación LLM para estudiantes:', errorInfo);
      }
    }

    const html = this.generateStudentHTML(report, interpretation, options);
    return await this.generatePDFFromHTMLInternal(html, options);
  }

  /**
   * Genera PDF de próximas sesiones
   */
  async generateUpcomingSessionsPDF(
    report: UpcomingSessionsReport,
    options: PDFGenerationOptions = {}
  ): Promise<Buffer> {
    logger.info('Generando PDF profesional de sesiones', {
      includeInterpretation: options.includeInterpretation
    });

    let interpretation: DataInterpretation | null = null;
    if (options.includeInterpretation) {
      try {
        interpretation = await llmInterpretationService.interpretUpcomingSessions(
          report,
          options.interpretationConfig || { language: 'spanish', depth: 'detailed', focus: 'administrative' }
        );
        logger.info('Interpretación LLM obtenida para sesiones:', {
          summary: interpretation?.summary?.substring(0, 100),
          hasInsights: interpretation?.keyInsights?.length || 0
        });
      } catch (error) {
        const errorInfo = {
          message: error instanceof Error ? error.message : String(error),
          code: (error as any)?.code
        };
        logger.warn('Error obteniendo interpretación LLM para sesiones:', errorInfo);
      }
    }

    const html = this.generateUpcomingSessionsHTML(report, interpretation, options);
    return await this.generatePDFFromHTMLInternal(html, options);
  }

  /**
   * Genera PDF de historial de estudiante
   */
  async generateStudentHistoryPDF(
    report: StudentHistoryReport,
    options: PDFGenerationOptions = {}
  ): Promise<Buffer> {
    logger.info('Generando PDF profesional de historial', {
      includeInterpretation: options.includeInterpretation,
      studentId: report.studentId
    });

    let interpretation: DataInterpretation | null = null;
    if (options.includeInterpretation) {
      try {
        interpretation = await llmInterpretationService.interpretStudentHistory(
          report,
          options.interpretationConfig || { language: 'spanish', depth: 'detailed', focus: 'academic' }
        );
        logger.info('Interpretación LLM obtenida para historial:', {
          summary: interpretation?.summary?.substring(0, 100),
          hasInsights: interpretation?.keyInsights?.length || 0
        });
      } catch (error) {
        const errorInfo = {
          message: error instanceof Error ? error.message : String(error),
          code: (error as any)?.code
        };
        logger.warn('Error obteniendo interpretación LLM para historial:', errorInfo);
      }
    }

    const html = this.generateStudentHistoryHTML(report, interpretation, options);
    return await this.generatePDFFromHTMLInternal(html, options);
  }

  /**
   * Convierte HTML a PDF usando Puppeteer (método público)
   */
  async generatePDFFromHTML(html: string, options: PDFGenerationOptions = {}): Promise<Buffer> {
    return await this.generatePDFFromHTMLInternal(html, options);
  }

  /**
   * Convierte HTML a PDF usando Puppeteer (método interno)
   */
  private async generatePDFFromHTMLInternal(html: string, options: PDFGenerationOptions): Promise<Buffer> {
    const browser = await this.initBrowser();
    const page = await browser.newPage();

    try {
      await page.setContent(html, { waitUntil: 'networkidle0' });

      const pdf = await page.pdf({
        format: 'A4',
        margin: {
          top: '20mm',
          right: '15mm',
          bottom: '20mm',
          left: '15mm'
        },
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: this.generateHeaderTemplate(options),
        footerTemplate: this.generateFooterTemplate(options)
      });

      await page.close();
      return Buffer.from(pdf);
    } catch (error) {
      await page.close();
      throw error;
    }
  }

  /**
   * Genera CSS base para todos los reportes
   */
  private getBaseCSS(): string {
    return `
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #1e293b;
          background: #ffffff;
        }

        .container {
          max-width: 100%;
          margin: 0 auto;
          padding: 20px;
        }

        /* Header Styles */
        .header {
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          color: white;
          padding: 30px;
          margin: -20px -20px 30px -20px;
          border-radius: 0 0 15px 15px;
        }

        .header h1 {
          font-size: 28px;
          font-weight: 700;
          margin-bottom: 8px;
          text-align: center;
        }

        .header .subtitle {
          font-size: 14px;
          opacity: 0.9;
          text-align: center;
        }

        .header .company-info {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 20px;
          font-size: 12px;
        }

        /* AI Analysis Section */
        .ai-analysis {
          background: linear-gradient(145deg, #f8fafc 0%, #e2e8f0 100%);
          border: 2px solid #e2e8f0;
          border-radius: 12px;
          padding: 25px;
          margin: 30px 0;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
        }

        .ai-analysis h2 {
          color: #7c3aed;
          font-size: 20px;
          margin-bottom: 15px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .ai-analysis .summary {
          background: white;
          padding: 20px;
          border-radius: 8px;
          margin-bottom: 20px;
          border-left: 4px solid #7c3aed;
        }

        .ai-insights {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 20px;
          margin-top: 20px;
        }

        .insight-card {
          background: white;
          padding: 20px;
          border-radius: 8px;
          border-left: 4px solid #059669;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
        }

        .insight-card.recommendations {
          border-left-color: #2563eb;
        }

        .insight-card.concerns {
          border-left-color: #dc2626;
        }

        .insight-card.trends {
          border-left-color: #d97706;
        }

        .insight-card h3 {
          font-size: 14px;
          font-weight: 600;
          margin-bottom: 10px;
          color: #374151;
        }

        .insight-card ul {
          list-style: none;
        }

        .insight-card li {
          padding: 4px 0;
          padding-left: 20px;
          position: relative;
          font-size: 12px;
          line-height: 1.4;
        }

        .insight-card li:before {
          content: "•";
          position: absolute;
          left: 8px;
          color: #6b7280;
        }

        /* Metric Cards */
        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 20px;
          margin: 30px 0;
        }

        .metric-card {
          background: linear-gradient(145deg, #ffffff 0%, #f8fafc 100%);
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 25px;
          text-align: center;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
          transition: transform 0.2s ease;
        }

        .metric-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 12px rgba(0, 0, 0, 0.1);
        }

        .metric-value {
          font-size: 32px;
          font-weight: 700;
          color: #2563eb;
          margin-bottom: 8px;
        }

        .metric-label {
          font-size: 14px;
          color: #64748b;
          font-weight: 500;
        }

        /* Tables */
        .table-container {
          margin: 30px 0;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
        }

        table {
          width: 100%;
          border-collapse: collapse;
          background: white;
        }

        th {
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          color: white;
          font-weight: 600;
          padding: 15px 12px;
          text-align: left;
          font-size: 13px;
        }

        td {
          padding: 12px;
          border-bottom: 1px solid #e2e8f0;
          font-size: 12px;
        }

        tr:nth-child(even) {
          background-color: #f8fafc;
        }

        tr:hover {
          background-color: #e2e8f0;
        }

        /* Section Headers */
        .section-header {
          font-size: 22px;
          font-weight: 700;
          color: #1e293b;
          margin: 40px 0 20px 0;
          padding-bottom: 10px;
          border-bottom: 3px solid #2563eb;
        }

        /* Status Badges */
        .status-badge {
          padding: 4px 8px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
        }

        .status-excellent { background: #dcfce7; color: #166534; }
        .status-good { background: #dbeafe; color: #1d4ed8; }
        .status-satisfactory { background: #fef3c7; color: #92400e; }
        .status-needs-improvement { background: #fecaca; color: #991b1b; }

        /* Charts placeholder */
        .chart-placeholder {
          background: linear-gradient(145deg, #f8fafc 0%, #e2e8f0 100%);
          border: 2px dashed #cbd5e1;
          border-radius: 8px;
          padding: 40px;
          text-align: center;
          margin: 20px 0;
          color: #64748b;
        }

        /* Print specific styles */
        @media print {
          .header {
            margin: 0;
          }

          .container {
            padding: 10px;
          }

          .metric-card:hover {
            transform: none;
          }
        }

        /* Responsive design */
        @media (max-width: 768px) {
          .metrics-grid {
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          }

          .ai-insights {
            grid-template-columns: 1fr;
          }
        }
      </style>
    `;
  }

  /**
   * Genera template de header para PDF
   */
  private generateHeaderTemplate(options: PDFGenerationOptions): string {
    const isSpanish = options.language !== 'english';
    const companyName = options.companyName || (isSpanish ? 'Sistema de Evaluación Académica' : 'Academic Evaluation System');

    return `
      <div style="font-size: 10px; padding: 0 15mm; width: 100%; display: flex; justify-content: space-between; align-items: center;">
        <span style="color: #64748b;">${companyName}</span>
        <span style="color: #64748b;">${new Date().toLocaleDateString(isSpanish ? 'es-ES' : 'en-US')}</span>
      </div>
    `;
  }

  /**
   * Genera template de footer para PDF
   */
  private generateFooterTemplate(options: PDFGenerationOptions): string {
    const isSpanish = options.language !== 'english';

    return `
      <div style="font-size: 9px; padding: 0 15mm; width: 100%; display: flex; justify-content: space-between; align-items: center; color: #64748b;">
        <span>${isSpanish ? 'Generado automáticamente' : 'Automatically generated'} - ${new Date().toISOString()}</span>
        <span>${isSpanish ? 'Página' : 'Page'} <span class="pageNumber"></span> ${isSpanish ? 'de' : 'of'} <span class="totalPages"></span></span>
      </div>
    `;
  }

  /**
   * Genera HTML para reporte de competencias
   */
  private generateCompetencyHTML(
    report: CompetencyAnalysisReport,
    interpretation: DataInterpretation | null,
    options: PDFGenerationOptions
  ): string {
    const isSpanish = options.language !== 'english';
    const companyName = options.companyName || (isSpanish ? 'Sistema de Evaluación Académica' : 'Academic Evaluation System');

    const competencyRows = Object.entries(report.competencyBreakdown)
      .map(([comp, data]) => `
        <tr>
          <td><strong>${comp}</strong></td>
          <td style="text-align: center;">${data.averageScore.toFixed(1)}%</td>
          <td style="text-align: center;">${data.studentsEvaluated}</td>
          <td style="text-align: center;">
            <span class="status-badge status-${this.getDifficultyStatus(data.difficulty)}">
              ${isSpanish ? this.translateDifficulty(data.difficulty) : data.difficulty}
            </span>
          </td>
          <td style="text-align: center;">${data.questionCount}</td>
        </tr>
      `).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${isSpanish ? 'Reporte de Análisis por Competencias' : 'Competency Analysis Report'}</title>
        ${this.getBaseCSS()}
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="company-info">
              <span>${companyName}</span>
              <span>${new Date().toLocaleDateString(isSpanish ? 'es-ES' : 'en-US')}</span>
            </div>
            <h1>${isSpanish ? '📊 Análisis por Competencias' : '📊 Competency Analysis'}</h1>
            <div class="subtitle">${isSpanish ? 'Reporte detallado de rendimiento académico por competencias' : 'Detailed academic performance report by competencies'}</div>
          </div>

          ${interpretation ? this.generateInterpretationHTML(interpretation, isSpanish) : ''}

          <div class="section-header">${isSpanish ? 'Resumen Ejecutivo' : 'Executive Summary'}</div>
          <div class="metrics-grid">
            <div class="metric-card">
              <div class="metric-value">${Object.keys(report.competencyBreakdown).length}</div>
              <div class="metric-label">${isSpanish ? 'Competencias Evaluadas' : 'Competencies Evaluated'}</div>
            </div>
            <div class="metric-card">
              <div class="metric-value">${(Object.values(report.competencyBreakdown).reduce((sum, comp) => sum + comp.averageScore, 0) / Object.keys(report.competencyBreakdown).length).toFixed(1)}%</div>
              <div class="metric-label">${isSpanish ? 'Promedio General' : 'Overall Average'}</div>
            </div>
            <div class="metric-card">
              <div class="metric-value">${report.overallStats.totalExams}</div>
              <div class="metric-label">${isSpanish ? 'Total Exámenes' : 'Total Exams'}</div>
            </div>
            <div class="metric-card">
              <div class="metric-value">${report.overallStats.completionRate.toFixed(1)}%</div>
              <div class="metric-label">${isSpanish ? 'Tasa de Completación' : 'Completion Rate'}</div>
            </div>
          </div>

          <div class="section-header">${isSpanish ? 'Análisis Detallado por Competencias' : 'Detailed Competency Analysis'}</div>
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>${isSpanish ? 'Competencia' : 'Competency'}</th>
                  <th style="text-align: center;">${isSpanish ? 'Promedio' : 'Average'}</th>
                  <th style="text-align: center;">${isSpanish ? 'Estudiantes' : 'Students'}</th>
                  <th style="text-align: center;">${isSpanish ? 'Dificultad' : 'Difficulty'}</th>
                  <th style="text-align: center;">${isSpanish ? 'Preguntas' : 'Questions'}</th>
                </tr>
              </thead>
              <tbody>
                ${competencyRows}
              </tbody>
            </table>
          </div>

          ${report.recommendations && report.recommendations.length > 0 ? `
            <div class="section-header">${isSpanish ? 'Recomendaciones' : 'Recommendations'}</div>
            <div style="background: #f0f9ff; border: 1px solid #0ea5e9; border-radius: 8px; padding: 20px;">
              <ul style="list-style: none; padding: 0;">
                ${report.recommendations.map(rec => `<li style="padding: 8px 0; padding-left: 20px; position: relative;"><span style="position: absolute; left: 0;">🎯</span> ${rec}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Genera HTML para interpretación LLM
   */
  private generateInterpretationHTML(interpretation: DataInterpretation, isSpanish: boolean): string {
    return `
      <div class="ai-analysis">
        <h2>🤖 ${isSpanish ? 'Análisis Inteligente' : 'AI Analysis'}</h2>

        ${interpretation.summary ? `
          <div class="summary">
            <h3 style="margin-bottom: 10px; color: #374151;">${isSpanish ? 'Resumen Ejecutivo' : 'Executive Summary'}</h3>
            <p style="line-height: 1.6; color: #4b5563;">${interpretation.summary}</p>
          </div>
        ` : ''}

        <div class="ai-insights">
          ${interpretation.keyInsights && interpretation.keyInsights.length > 0 ? `
            <div class="insight-card">
              <h3>💡 ${isSpanish ? 'Insights Clave' : 'Key Insights'}</h3>
              <ul>
                ${interpretation.keyInsights.map(insight => `<li>${insight}</li>`).join('')}
              </ul>
            </div>
          ` : ''}

          ${interpretation.recommendations && interpretation.recommendations.length > 0 ? `
            <div class="insight-card recommendations">
              <h3>🎯 ${isSpanish ? 'Recomendaciones' : 'Recommendations'}</h3>
              <ul>
                ${interpretation.recommendations.map(rec => `<li>${rec}</li>`).join('')}
              </ul>
            </div>
          ` : ''}

          ${interpretation.concerns && interpretation.concerns.length > 0 ? `
            <div class="insight-card concerns">
              <h3>⚠️ ${isSpanish ? 'Áreas de Atención' : 'Areas of Concern'}</h3>
              <ul>
                ${interpretation.concerns.map(concern => `<li>${concern}</li>`).join('')}
              </ul>
            </div>
          ` : ''}

          ${interpretation.trends && interpretation.trends.length > 0 ? `
            <div class="insight-card trends">
              <h3>📈 ${isSpanish ? 'Tendencias' : 'Trends'}</h3>
              <ul>
                ${interpretation.trends.map(trend => `<li>${trend}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  /**
   * Genera HTML para reporte de estadísticas de estudiantes
   */
  private generateStudentHTML(report: StudentStatsReport, interpretation: DataInterpretation | null, options: PDFGenerationOptions): string {
    const isSpanish = options.language !== 'english';
    const companyName = options.companyName || (isSpanish ? 'Sistema de Evaluación Académica' : 'Academic Evaluation System');

    const performanceRows = [
      ['Excelente (>85%)', report.performanceDistribution.excellent, `${((report.performanceDistribution.excellent / report.evaluatedStudents) * 100).toFixed(1)}%`],
      ['Bueno (70-85%)', report.performanceDistribution.good, `${((report.performanceDistribution.good / report.evaluatedStudents) * 100).toFixed(1)}%`],
      ['Aceptable (60-70%)', report.performanceDistribution.acceptable, `${((report.performanceDistribution.acceptable / report.evaluatedStudents) * 100).toFixed(1)}%`],
      ['Necesita Mejora (<60%)', report.performanceDistribution.needsImprovement, `${((report.performanceDistribution.needsImprovement / report.evaluatedStudents) * 100).toFixed(1)}%`]
    ].map(([category, students, percentage]) => `
      <tr>
        <td><strong>${category}</strong></td>
        <td style="text-align: center;">${students}</td>
        <td style="text-align: center;">${percentage}</td>
      </tr>
    `).join('');

    const topPerformersRows = report.topPerformers.slice(0, 10).map((student, index) => `
      <tr>
        <td style="text-align: center;">#${index + 1}</td>
        <td>${student.candidateId}</td>
        <td style="text-align: center;">${student.averageScore.toFixed(1)}%</td>
        <td style="text-align: center;">${student.examsCompleted}</td>
        <td style="text-align: center;">${student.currentLevel}</td>
      </tr>
    `).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${isSpanish ? 'Reporte de Estadísticas de Estudiantes' : 'Student Statistics Report'}</title>
        ${this.getBaseCSS()}
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="company-info">
              <span>${companyName}</span>
              <span>${new Date().toLocaleDateString(isSpanish ? 'es-ES' : 'en-US')}</span>
            </div>
            <h1>${isSpanish ? '👥 Estadísticas de Estudiantes' : '👥 Student Statistics'}</h1>
            <div class="subtitle">${isSpanish ? 'Análisis detallado del rendimiento estudiantil' : 'Detailed student performance analysis'}</div>
          </div>

          ${interpretation ? this.generateInterpretationHTML(interpretation, isSpanish) : ''}

          <div class="section-header">${isSpanish ? 'Resumen Ejecutivo' : 'Executive Summary'}</div>
          <div class="metrics-grid">
            <div class="metric-card">
              <div class="metric-value">${report.totalStudents}</div>
              <div class="metric-label">${isSpanish ? 'Total Estudiantes' : 'Total Students'}</div>
            </div>
            <div class="metric-card">
              <div class="metric-value">${report.evaluatedStudents}</div>
              <div class="metric-label">${isSpanish ? 'Estudiantes Evaluados' : 'Evaluated Students'}</div>
            </div>
            <div class="metric-card">
              <div class="metric-value">${report.averageScore.toFixed(1)}%</div>
              <div class="metric-label">${isSpanish ? 'Promedio General' : 'Overall Average'}</div>
            </div>
            <div class="metric-card">
              <div class="metric-value">${((report.evaluatedStudents / report.totalStudents) * 100).toFixed(1)}%</div>
              <div class="metric-label">${isSpanish ? 'Tasa de Participación' : 'Participation Rate'}</div>
            </div>
          </div>

          <div class="section-header">${isSpanish ? 'Distribución de Rendimiento' : 'Performance Distribution'}</div>
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>${isSpanish ? 'Categoría' : 'Category'}</th>
                  <th style="text-align: center;">${isSpanish ? 'Estudiantes' : 'Students'}</th>
                  <th style="text-align: center;">${isSpanish ? 'Porcentaje' : 'Percentage'}</th>
                </tr>
              </thead>
              <tbody>
                ${performanceRows}
              </tbody>
            </table>
          </div>

          ${report.topPerformers.length > 0 ? `
            <div class="section-header">${isSpanish ? 'Mejores Estudiantes' : 'Top Performers'}</div>
            <div class="table-container">
              <table>
                <thead>
                  <tr>
                    <th style="text-align: center;">${isSpanish ? 'Posición' : 'Rank'}</th>
                    <th>${isSpanish ? 'ID Estudiante' : 'Student ID'}</th>
                    <th style="text-align: center;">${isSpanish ? 'Promedio' : 'Average'}</th>
                    <th style="text-align: center;">${isSpanish ? 'Exámenes' : 'Exams'}</th>
                    <th style="text-align: center;">${isSpanish ? 'Nivel' : 'Level'}</th>
                  </tr>
                </thead>
                <tbody>
                  ${topPerformersRows}
                </tbody>
              </table>
            </div>
          ` : ''}
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Genera HTML para reporte de próximas sesiones
   */
  private generateUpcomingSessionsHTML(report: UpcomingSessionsReport, interpretation: DataInterpretation | null, options: PDFGenerationOptions): string {
    const isSpanish = options.language !== 'english';
    const companyName = options.companyName || (isSpanish ? 'Sistema de Evaluación Académica' : 'Academic Evaluation System');

    const sessionRows = report.upcomingSessions.slice(0, 15).map(session => `
      <tr>
        <td><strong>${session.sessionName}</strong></td>
        <td>${session.examTitle}</td>
        <td style="text-align: center;">${new Date(session.startDate).toLocaleDateString(isSpanish ? 'es-ES' : 'en-US')}</td>
        <td style="text-align: center;">${session.registeredCandidates}/${session.maxCandidates}</td>
        <td style="text-align: center;">
          <span class="status-badge status-${this.getSessionStatus(session.status)}">
            ${isSpanish ? this.translateStatus(session.status) : session.status}
          </span>
        </td>
      </tr>
    `).join('');

    const proctorRows = report.proctorWorkload.map(proctor => `
      <tr>
        <td>${proctor.proctorName}</td>
        <td style="text-align: center;">${proctor.assignedSessions}</td>
        <td style="text-align: center;">${proctor.upcomingHours.toFixed(1)}h</td>
      </tr>
    `).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${isSpanish ? 'Reporte de Próximas Programaciones' : 'Upcoming Sessions Report'}</title>
        ${this.getBaseCSS()}
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="company-info">
              <span>${companyName}</span>
              <span>${new Date().toLocaleDateString(isSpanish ? 'es-ES' : 'en-US')}</span>
            </div>
            <h1>${isSpanish ? '📅 Próximas Programaciones' : '📅 Upcoming Sessions'}</h1>
            <div class="subtitle">${isSpanish ? 'Planificación y gestión de sesiones de examen' : 'Exam session planning and management'}</div>
          </div>

          ${interpretation ? this.generateInterpretationHTML(interpretation, isSpanish) : ''}

          <div class="section-header">${isSpanish ? 'Resumen Ejecutivo' : 'Executive Summary'}</div>
          <div class="metrics-grid">
            <div class="metric-card">
              <div class="metric-value">${report.totalUpcomingSessions}</div>
              <div class="metric-label">${isSpanish ? 'Total Sesiones' : 'Total Sessions'}</div>
            </div>
            <div class="metric-card">
              <div class="metric-value">${report.sessionsThisWeek}</div>
              <div class="metric-label">${isSpanish ? 'Esta Semana' : 'This Week'}</div>
            </div>
            <div class="metric-card">
              <div class="metric-value">${report.summary.totalCandidatesRegistered}</div>
              <div class="metric-label">${isSpanish ? 'Candidatos Registrados' : 'Registered Candidates'}</div>
            </div>
            <div class="metric-card">
              <div class="metric-value">${report.summary.averageCapacityUtilization.toFixed(1)}%</div>
              <div class="metric-label">${isSpanish ? 'Utilización de Capacidad' : 'Capacity Utilization'}</div>
            </div>
          </div>

          <div class="section-header">${isSpanish ? 'Próximas Sesiones' : 'Upcoming Sessions'}</div>
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>${isSpanish ? 'Sesión' : 'Session'}</th>
                  <th>${isSpanish ? 'Examen' : 'Exam'}</th>
                  <th style="text-align: center;">${isSpanish ? 'Fecha' : 'Date'}</th>
                  <th style="text-align: center;">${isSpanish ? 'Candidatos' : 'Candidates'}</th>
                  <th style="text-align: center;">${isSpanish ? 'Estado' : 'Status'}</th>
                </tr>
              </thead>
              <tbody>
                ${sessionRows}
              </tbody>
            </table>
          </div>

          ${report.proctorWorkload.length > 0 ? `
            <div class="section-header">${isSpanish ? 'Carga de Trabajo - Proctors' : 'Proctor Workload'}</div>
            <div class="table-container">
              <table>
                <thead>
                  <tr>
                    <th>${isSpanish ? 'Proctor' : 'Proctor'}</th>
                    <th style="text-align: center;">${isSpanish ? 'Sesiones Asignadas' : 'Assigned Sessions'}</th>
                    <th style="text-align: center;">${isSpanish ? 'Horas Próximas' : 'Upcoming Hours'}</th>
                  </tr>
                </thead>
                <tbody>
                  ${proctorRows}
                </tbody>
              </table>
            </div>
          ` : ''}
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Genera HTML para reporte de historial de estudiante
   */
  private generateStudentHistoryHTML(report: StudentHistoryReport, interpretation: DataInterpretation | null, options: PDFGenerationOptions): string {
    const isSpanish = options.language !== 'english';
    const companyName = options.companyName || (isSpanish ? 'Sistema de Evaluación Académica' : 'Academic Evaluation System');

    const examRows = report.examHistory.slice(0, 15).map(exam => `
      <tr>
        <td><strong>${exam.examTitle}</strong></td>
        <td>${exam.sessionName}</td>
        <td style="text-align: center;">${new Date(exam.completedAt).toLocaleDateString(isSpanish ? 'es-ES' : 'en-US')}</td>
        <td style="text-align: center;">${exam.percentage.toFixed(1)}%</td>
        <td style="text-align: center;">${exam.level}</td>
      </tr>
    `).join('');

    const competencyRows = Object.entries(report.competencyProgress).map(([comp, data]) => `
      <tr>
        <td><strong>${comp}</strong></td>
        <td style="text-align: center;">${data.currentLevel}</td>
        <td style="text-align: center;">${data.averageScore.toFixed(1)}%</td>
        <td style="text-align: center;">${data.examsCount}</td>
        <td style="text-align: center;">
          <span class="status-badge status-${this.getTrendStatus(data.trend)}">
            ${isSpanish ? this.translateTrend(data.trend) : data.trend}
          </span>
        </td>
      </tr>
    `).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${isSpanish ? 'Historial Académico' : 'Academic History'} - ${report.studentInfo.name}</title>
        ${this.getBaseCSS()}
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="company-info">
              <span>${companyName}</span>
              <span>${new Date().toLocaleDateString(isSpanish ? 'es-ES' : 'en-US')}</span>
            </div>
            <h1>${isSpanish ? '📚 Historial Académico' : '📚 Academic History'}</h1>
            <div class="subtitle">${report.studentInfo.name} (${report.studentId})</div>
          </div>

          ${interpretation ? this.generateInterpretationHTML(interpretation, isSpanish) : ''}

          <div class="section-header">${isSpanish ? 'Información del Estudiante' : 'Student Information'}</div>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
              <div><strong>${isSpanish ? 'Nombre:' : 'Name:'}</strong> ${report.studentInfo.name}</div>
              <div><strong>${isSpanish ? 'Email:' : 'Email:'}</strong> ${report.studentInfo.email}</div>
              <div><strong>${isSpanish ? 'ID:' : 'ID:'}</strong> ${report.studentId}</div>
              <div><strong>${isSpanish ? 'Registro:' : 'Registration:'}</strong> ${new Date(report.studentInfo.registrationDate).toLocaleDateString(isSpanish ? 'es-ES' : 'en-US')}</div>
            </div>
          </div>

          <div class="section-header">${isSpanish ? 'Resumen de Rendimiento' : 'Performance Summary'}</div>
          <div class="metrics-grid">
            <div class="metric-card">
              <div class="metric-value">${report.summary.totalExams}</div>
              <div class="metric-label">${isSpanish ? 'Total Exámenes' : 'Total Exams'}</div>
            </div>
            <div class="metric-card">
              <div class="metric-value">${report.summary.averageScore.toFixed(1)}%</div>
              <div class="metric-label">${isSpanish ? 'Promedio' : 'Average'}</div>
            </div>
            <div class="metric-card">
              <div class="metric-value">${report.summary.bestScore.toFixed(1)}%</div>
              <div class="metric-label">${isSpanish ? 'Mejor Puntaje' : 'Best Score'}</div>
            </div>
            <div class="metric-card">
              <div class="metric-value">${Math.round(report.summary.totalTimeSpent / 60)}h</div>
              <div class="metric-label">${isSpanish ? 'Tiempo Total' : 'Total Time'}</div>
            </div>
          </div>

          <div class="section-header">${isSpanish ? 'Historial de Exámenes' : 'Exam History'}</div>
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>${isSpanish ? 'Examen' : 'Exam'}</th>
                  <th>${isSpanish ? 'Sesión' : 'Session'}</th>
                  <th style="text-align: center;">${isSpanish ? 'Fecha' : 'Date'}</th>
                  <th style="text-align: center;">${isSpanish ? 'Puntaje' : 'Score'}</th>
                  <th style="text-align: center;">${isSpanish ? 'Nivel' : 'Level'}</th>
                </tr>
              </thead>
              <tbody>
                ${examRows}
              </tbody>
            </table>
          </div>

          <div class="section-header">${isSpanish ? 'Progreso por Competencias' : 'Competency Progress'}</div>
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>${isSpanish ? 'Competencia' : 'Competency'}</th>
                  <th style="text-align: center;">${isSpanish ? 'Nivel Actual' : 'Current Level'}</th>
                  <th style="text-align: center;">${isSpanish ? 'Promedio' : 'Average'}</th>
                  <th style="text-align: center;">${isSpanish ? 'Exámenes' : 'Exams'}</th>
                  <th style="text-align: center;">${isSpanish ? 'Tendencia' : 'Trend'}</th>
                </tr>
              </thead>
              <tbody>
                ${competencyRows}
              </tbody>
            </table>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Helper methods
  private getDifficultyStatus(difficulty: string): string {
    const statusMap: Record<string, string> = {
      easy: 'excellent',
      medium: 'good',
      hard: 'needs-improvement'
    };
    return statusMap[difficulty] || 'good';
  }

  private translateDifficulty(difficulty: string): string {
    const translations: Record<string, string> = {
      easy: 'Fácil',
      medium: 'Medio',
      hard: 'Difícil'
    };
    return translations[difficulty] || difficulty;
  }

  private getSessionStatus(status: string): string {
    const statusMap: Record<string, string> = {
      scheduled: 'good',
      in_progress: 'excellent',
      completed: 'satisfactory',
      cancelled: 'needs-improvement'
    };
    return statusMap[status] || 'good';
  }

  private translateStatus(status: string): string {
    const translations: Record<string, string> = {
      scheduled: 'Programada',
      in_progress: 'En Progreso',
      completed: 'Completada',
      cancelled: 'Cancelada'
    };
    return translations[status] || status;
  }

  private getTrendStatus(trend: string): string {
    const statusMap: Record<string, string> = {
      improving: 'excellent',
      stable: 'good',
      declining: 'needs-improvement'
    };
    return statusMap[trend] || 'good';
  }

  private translateTrend(trend: string): string {
    const translations: Record<string, string> = {
      improving: 'Mejorando',
      stable: 'Estable',
      declining: 'Declinando'
    };
    return translations[trend] || trend;
  }
}

export const professionalPDFService = new ProfessionalPDFService();