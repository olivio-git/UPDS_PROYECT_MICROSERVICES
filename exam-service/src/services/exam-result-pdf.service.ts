import { professionalPDFService } from './pdf-professional.service';
import { fallbackPDFService } from './pdf-fallback.service';
import { llmInterpretationService, DataInterpretation } from './llm-interpretation.service';
import { logger } from '../utils/logger';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { ExamResult } from '../models/examResult.model';
import { Question } from '../models/question.model';
import { Types } from 'mongoose';

export interface StudentInfo {
  candidateId: string;
  firstName: string;
  lastName: string;
  email: string;
  registrationDate?: string;
  level?: string;
}

export interface ExamResultPDFData {
  // Información del resultado del examen
  result: {
    id: string;
    examTitle: string;
    examType: 'placement' | 'progress' | 'final' | 'practice';
    sessionName: string;
    completedAt: string;
    duration: number; // in minutes
    status: string;
    level: string;
    finalScore: number;
    maxScore: number;
    percentage: number;
    passed: boolean;
    feedback?: string;
    recommendations?: string[];
  };

  // Información del estudiante/candidato
  student: StudentInfo;

  // Detalles de las competencias
  competencyScores: Array<{
    competency: string;
    score: number;
    maxScore: number;
    percentage: number;
    feedback?: string;
  }>;

  // Detalles de las preguntas (opcional)
  questionResults?: Array<{
    questionId: string;
    questionText?: string;
    questionType: string;
    competency: string;
    response: any;
    isCorrect?: boolean;
    score: number;
    maxScore: number;
    feedback?: string;
    evaluationMethod?: string;
    evaluatedAt?: string;
    questionOptions?: Array<{ id: string; text: string }>;
    aiAnalysis?: {
      feedback?: string;
      suggestions?: string[];
    };
  }>;

  // Configuraciones del examen
  examSettings: {
    timeAllowed: number;
    totalQuestions: number;
    passingScore: number;
  };

  // Interpretación LLM (opcional)
  llmInterpretation?: DataInterpretation;
}

export interface ExamResultPDFOptions {
  includeQuestionDetails?: boolean;
  includeAIAnalysis?: boolean;
  includeLLMInterpretation?: boolean;
  language?: 'spanish' | 'english';
  companyName?: string;
  llmConfig?: {
    depth?: 'brief' | 'detailed';
    focus?: 'academic' | 'administrative' | 'strategic';
  };
}

export class ExamResultPDFService {
  private userManagementUrl: string;

  constructor() {
    this.userManagementUrl = process.env.USER_MANAGEMENT_SERVICE_URL || 'http://localhost:3001/api/v1';
    logger.info('ExamResultPDFService initialized', { userManagementUrl: this.userManagementUrl });
  }

  /**
   * Genera PDF profesional del resultado de examen
   */
  async generateExamResultPDF(
    resultId: string,
    options: ExamResultPDFOptions = {},
    userInfo?: {
      firstName: string;
      lastName: string;
      email: string;
      candidateId: string;
    }
  ): Promise<Buffer> {
    logger.info('Generando PDF de resultado de examen', { resultId, options, userInfo });

    try {
      // 1. Obtener datos completos del resultado
      const pdfData = await this.getExamResultPDFData(resultId, options, userInfo);

      // 2. Generar interpretación LLM si está habilitada
      if (options.includeLLMInterpretation) {
        try {
          logger.info('Generando interpretación LLM para resultado de examen');
          const llmConfig = {
            language: options.language || 'spanish',
            depth: options.llmConfig?.depth || 'detailed',
            focus: options.llmConfig?.focus || 'academic'
          };

          // Asegurar que tenemos los datos detallados para el análisis LLM
          const examResultForLLM = await ExamResult.findById(resultId);
          if (examResultForLLM) {
            // Crear datos específicos para el análisis LLM con todos los detalles
            const llmData = {
              ...pdfData,
              // Incluir SIEMPRE los resultados de preguntas para análisis LLM
              questionResults: examResultForLLM.questionResults.map((qResult) => ({
                questionId: String(qResult.questionId),
                questionType: qResult.questionType,
                competency: qResult.competency,
                response: qResult.response,
                isCorrect: qResult.isCorrect,
                score: qResult.score || 0,
                maxScore: qResult.maxScore || 0,
                feedback: qResult.feedback,
                aiAnalysis: qResult.aiAnalysis
              }))
            };

            logger.info('Datos enviados al LLM:', {
              totalQuestions: llmData.questionResults?.length,
              competencies: llmData.competencyScores.map(c => ({
                competency: c.competency,
                percentage: c.percentage
              })),
              overallScore: llmData.result.percentage,
              passed: llmData.result.passed
            });

            pdfData.llmInterpretation = await llmInterpretationService.interpretExamResult(llmData, llmConfig);
            logger.info('Interpretación LLM generada exitosamente');
          }
        } catch (llmError) {
          logger.warn('Error generando interpretación LLM, continuando sin interpretación:', {
            message: llmError instanceof Error ? llmError.message : String(llmError)
          });
        }
      }

      // 3. Intentar generar PDF profesional con Puppeteer
      try {
        logger.info('Intentando generación profesional con Puppeteer');
        const logoDataUrl = this.getLogoDataUrl();
        const html = this.generateExamResultHTML(pdfData, options, logoDataUrl);
        return await this.generatePDFFromHTML(html, options);
      } catch (puppeteerError) {
        logger.warn('Puppeteer no disponible, usando fallback PDFKit:', {
          message: puppeteerError instanceof Error ? puppeteerError.message : String(puppeteerError)
        });

        // 4. Fallback a PDFKit básico
        return await this.generateFallbackPDF(pdfData, options);
      }
    } catch (error) {
      logger.error('Error generando PDF de resultado de examen:', {
        message: error instanceof Error ? error.message : String(error),
        resultId
      });
      throw error;
    }
  }

  /**
   * Obtiene todos los datos necesarios para el PDF
   */
  private async getExamResultPDFData(
    resultId: string,
    options: ExamResultPDFOptions,
    userInfo?: {
      firstName: string;
      lastName: string;
      email: string;
      candidateId: string;
    }
  ): Promise<ExamResultPDFData> {
    // 1. Obtener resultado del examen (sin populate para evitar errores de schema)
    const examResult = await ExamResult.findById(resultId);

    if (!examResult) {
      throw new Error(`Resultado de examen no encontrado: ${resultId}`);
    }

    // 2. Obtener información del estudiante/candidato
    let studentInfo: StudentInfo;
    if (userInfo) {
      // Usar información del middleware si está disponible
      studentInfo = {
        candidateId: userInfo.candidateId,
        firstName: userInfo.firstName,
        lastName: userInfo.lastName,
        email: userInfo.email,
        registrationDate: undefined,
        level: undefined
      };
      logger.info('Usando información del usuario desde middleware:', studentInfo);
    } else {
      // Fallback al método anterior
      studentInfo = await this.getStudentInfo(examResult.candidateId.toString());
    }

    // 3. Preparar datos del resultado
    const resultData: ExamResultPDFData['result'] = {
      id: String(examResult._id),
      examTitle: examResult.examName || 'Examen',
      examType: 'practice', // Default type since we don't have exam details
      sessionName: 'Sesión de Evaluación', // Default session name
      completedAt: examResult.completedAt?.toISOString() || examResult.evaluatedAt.toISOString(),
      duration: Math.round((examResult.examDuration || 0) / 60), // Convert seconds to minutes
      status: examResult.status,
      level: examResult.examLevel || 'N/A',
      finalScore: examResult.totalScore || 0,
      maxScore: examResult.maxScore || 100,
      percentage: examResult.percentage || 0,
      passed: examResult.percentage >= 70, // Calculate from percentage
      feedback: examResult.overallFeedback,
      recommendations: examResult.recommendations || []
    };

    // 4. Preparar competencias
    const competencyScores = (examResult.competencyScores || []).map((comp) => ({
      competency: comp.competency,
      score: comp.totalScore || 0,
      maxScore: comp.maxScore || 0,
      percentage: comp.percentage || 0,
      feedback: examResult.competencyFeedback?.[comp.competency]
    }));

    // 5. Preparar detalles de preguntas (si se solicita)
    let questionResults: ExamResultPDFData['questionResults'] | undefined;
    if (options.includeQuestionDetails && examResult.questionResults) {
      // Fetch question content (text + options) from DB in a single batch query
      const questionIds = examResult.questionResults
        .map(qr => qr.questionId)
        .filter(id => id != null);

      const questionDocs = await Question.find(
        { _id: { $in: questionIds.map(id => new Types.ObjectId(String(id))) } },
        { 'content.question': 1, 'content.options': 1 }
      ).lean();

      const questionMap = new Map(
        questionDocs.map(q => [String(q._id), q])
      );

      questionResults = examResult.questionResults.map((qResult) => {
        const qDoc = questionMap.get(String(qResult.questionId));
        return {
          questionId: String(qResult.questionId),
          questionText: (qDoc as any)?.content?.question,
          questionOptions: (qDoc as any)?.content?.options?.map((o: any) => ({
            id: o.id || String(o._id),
            text: o.text,
          })),
          questionType: qResult.questionType,
          competency: qResult.competency,
          response: qResult.response,
          isCorrect: qResult.isCorrect,
          score: qResult.score || 0,
          maxScore: qResult.maxScore || 0,
          feedback: qResult.feedback,
          evaluationMethod: qResult.evaluationMethod,
          evaluatedAt: (qResult as any).evaluatedAt?.toISOString?.() ?? undefined,
          aiAnalysis: qResult.aiAnalysis,
        };
      });
    }

    // 6. Configuraciones del examen
    const examSettings = {
      timeAllowed: examResult.timeAllowed || 3600, // seconds
      totalQuestions: examResult.questionResults?.length || 0,
      passingScore: 70 // Default passing score
    };

    return {
      result: resultData,
      student: studentInfo,
      competencyScores,
      questionResults,
      examSettings
    };
  }

  /**
   * Obtiene información del estudiante desde user-management-service
   */
  private async getStudentInfo(candidateId: string): Promise<StudentInfo> {
    try {
      logger.info('Obteniendo información del estudiante', { candidateId });

      // Usar ruta interna para obtener información del candidato
      const response = await axios.post(`${this.userManagementUrl}/candidates/internal/batch`, {
        ids: [candidateId]
      }, {
        timeout: 5000,
        headers: {
          'Content-Type': 'application/json',
          'x-service': 'exam-service' // Header requerido para acceso interno
        }
      });

      logger.info('Respuesta del user-management-service:', {
        status: response.status,
        hasData: !!response.data,
        success: response.data?.success
      });

      if (response.data?.success && response.data.data && response.data.data.length > 0) {
        const candidate = response.data.data[0]; // Primer candidato del batch
        logger.info('Datos del candidato obtenidos:', {
          candidateId: candidate._id,
          firstName: candidate.firstName,
          lastName: candidate.lastName,
          email: candidate.email
        });

        return {
          candidateId: candidate._id || candidateId,
          firstName: candidate.firstName || 'Usuario',
          lastName: candidate.lastName || '',
          email: candidate.email || '',
          registrationDate: candidate.createdAt,
          level: candidate.currentLevel
        };
      } else {
        logger.warn('No se pudo obtener información del candidato desde user-management-service, usando datos por defecto', {
          responseData: response.data
        });
        return {
          candidateId,
          firstName: 'Estudiante',
          lastName: '',
          email: '',
        };
      }
    } catch (error) {
      logger.error('Error obteniendo información del estudiante, usando datos por defecto:', {
        message: error instanceof Error ? error.message : String(error),
        candidateId,
        status: (error as any)?.response?.status,
        responseData: (error as any)?.response?.data
      });

      return {
        candidateId,
        firstName: 'Estudiante',
        lastName: '',
        email: '',
      };
    }
  }

  private getLogoDataUrl(): string | null {
    try {
      const candidates = [
        path.join(process.cwd(), 'src/assets/logocba-color.webp'),
        path.join(process.cwd(), 'dist/assets/logocba-color.webp'),
        path.join(__dirname, '../assets/logocba-color.webp'),
      ];
      for (const logoPath of candidates) {
        if (fs.existsSync(logoPath)) {
          const buf = fs.readFileSync(logoPath);
          return `data:image/webp;base64,${buf.toString('base64')}`;
        }
      }
    } catch (error) {
      logger.warn('No se pudo cargar el logo:', error);
    }
    return null;
  }

  /**
   * Genera HTML profesional para el resultado del examen
   */
  private generateExamResultHTML(data: ExamResultPDFData, options: ExamResultPDFOptions, logoDataUrl: string | null = null): string {
    const isSpanish = options.language !== 'english';
    const companyName = options.companyName || (isSpanish ? 'Sistema de Evaluación Académica' : 'Academic Evaluation System');

    const competencyNames: Record<string, string> = {
      listening: isSpanish ? 'Comprensión Auditiva' : 'Listening Comprehension',
      reading: isSpanish ? 'Comprensión Lectora' : 'Reading Comprehension',
      writing: isSpanish ? 'Expresión Escrita' : 'Writing Expression',
      speaking: isSpanish ? 'Expresión Oral' : 'Speaking Expression'
    };

    const getCompetencyName = (key: string) => competencyNames[key] || key;

    const studentName = `${data.student.firstName} ${data.student.lastName}`.trim();
    const formattedDate = new Date(data.result.completedAt).toLocaleDateString(isSpanish ? 'es-ES' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Renderizar competencias
    const competencyRows = data.competencyScores.map(comp => `
      <tr>
        <td><strong>${getCompetencyName(comp.competency)}</strong></td>
        <td style="text-align: center;">${comp.score}/${comp.maxScore}</td>
        <td style="text-align: center;">${comp.percentage.toFixed(1)}%</td>
        <td style="text-align: center;">
          <span class="status-badge status-${this.getScoreStatus(comp.percentage)}">
            ${this.getScoreLabel(comp.percentage, isSpanish)}
          </span>
        </td>
      </tr>
    `).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${isSpanish ? 'Resultado de Examen' : 'Exam Result'} - ${studentName}</title>
        ${this.getExamResultCSS()}
      </head>
      <body>
        <div class="container">
          <!-- Header -->
          <div class="header">
            <div class="header-brand">
              ${logoDataUrl ? `<img src="${logoDataUrl}" alt="CBA Logo" class="brand-logo" />` : ''}
              <div class="brand-text">
                <span class="brand-company">${companyName}</span>
                <span class="brand-date">${formattedDate}</span>
              </div>
            </div>
            <h1>${isSpanish ? 'Resultado de Examen' : 'Exam Result'}</h1>
            <div class="subtitle">${isSpanish ? 'Reporte Individual de Evaluación' : 'Individual Assessment Report'}</div>
          </div>

          <!-- Student Information -->
          <div class="student-info-card">
            <h2>${isSpanish ? 'Información del Estudiante' : 'Student Information'}</h2>
            <div class="student-details">
              <div class="detail-item">
                <span class="label">${isSpanish ? 'Nombre:' : 'Name:'}</span>
                <span class="value">${studentName || 'N/A'}</span>
              </div>
              <div class="detail-item">
                <span class="label">${isSpanish ? 'Email:' : 'Email:'}</span>
                <span class="value">${data.student.email || 'N/A'}</span>
              </div>
              <div class="detail-item">
                <span class="label">${isSpanish ? 'ID Candidato:' : 'Candidate ID:'}</span>
                <span class="value">${data.student.candidateId}</span>
              </div>
              <div class="detail-item">
                <span class="label">${isSpanish ? 'Nivel:' : 'Level:'}</span>
                <span class="value">${data.result.level}</span>
              </div>
            </div>
          </div>

          <!-- Exam Information -->
          <div class="exam-info-card">
            <h2>${isSpanish ? 'Información del Examen' : 'Exam Information'}</h2>
            <div class="exam-details">
              <div class="detail-item">
                <span class="label">${isSpanish ? 'Título:' : 'Title:'}</span>
                <span class="value">${data.result.examTitle}</span>
              </div>
              <div class="detail-item">
                <span class="label">${isSpanish ? 'Tipo:' : 'Type:'}</span>
                <span class="value">${this.getExamTypeLabel(data.result.examType, isSpanish)}</span>
              </div>
              <div class="detail-item">
                <span class="label">${isSpanish ? 'Fecha:' : 'Date:'}</span>
                <span class="value">${formattedDate}</span>
              </div>
              <div class="detail-item">
                <span class="label">${isSpanish ? 'Duración:' : 'Duration:'}</span>
                <span class="value">${data.result.duration} ${isSpanish ? 'minutos' : 'minutes'}</span>
              </div>
            </div>
          </div>

          <!-- Results Summary -->
          <div class="results-summary">
            <h2>${isSpanish ? 'Resumen de Resultados' : 'Results Summary'}</h2>
            <div class="metrics-grid">
              <div class="metric-card primary">
                <div class="metric-value">${data.result.percentage.toFixed(1)}%</div>
                <div class="metric-label">${isSpanish ? 'Puntuación Final' : 'Final Score'}</div>
              </div>
              <div class="metric-card secondary">
                <div class="metric-value">${data.result.finalScore}/${data.result.maxScore}</div>
                <div class="metric-label">${isSpanish ? 'Puntos Obtenidos' : 'Points Earned'}</div>
              </div>
              <div class="metric-card info">
                <div class="metric-value">${data.examSettings.totalQuestions}</div>
                <div class="metric-label">${isSpanish ? 'Total Preguntas' : 'Total Questions'}</div>
              </div>
            </div>
          </div>

          <!-- Competency Breakdown -->
          <div class="section-header">${isSpanish ? 'Desglose por Competencias' : 'Competency Breakdown'}</div>
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>${isSpanish ? 'Competencia' : 'Competency'}</th>
                  <th style="text-align: center;">${isSpanish ? 'Puntuación' : 'Score'}</th>
                  <th style="text-align: center;">${isSpanish ? 'Porcentaje' : 'Percentage'}</th>
                  <th style="text-align: center;">${isSpanish ? 'Estado' : 'Status'}</th>
                </tr>
              </thead>
              <tbody>
                ${competencyRows}
              </tbody>
            </table>
          </div>

          <!-- LLM Interpretation Section -->
          ${data.llmInterpretation ? `
            <div class="llm-interpretation-section">
              <h2>${isSpanish ? 'Análisis de Desempeño' : 'Performance Analysis'}</h2>

              <div class="llm-summary-card">
                <h3>${isSpanish ? 'Resumen' : 'Summary'}</h3>
                <p>${data.llmInterpretation.summary}</p>
              </div>

              ${data.llmInterpretation.keyInsights && data.llmInterpretation.keyInsights.length > 0 ? `
                <div class="llm-insights-card">
                  <h3>${isSpanish ? 'Observaciones' : 'Key Observations'}</h3>
                  <ul>
                    ${data.llmInterpretation.keyInsights.map(insight => `<li>${insight}</li>`).join('')}
                  </ul>
                </div>
              ` : ''}

              ${data.llmInterpretation.recommendations && data.llmInterpretation.recommendations.length > 0 ? `
                <div class="llm-recommendations-card">
                  <h3>${isSpanish ? 'Recomendaciones' : 'Recommendations'}</h3>
                  <ul>
                    ${data.llmInterpretation.recommendations.map(rec => `<li>${rec}</li>`).join('')}
                  </ul>
                </div>
              ` : ''}

              ${data.llmInterpretation.trends && data.llmInterpretation.trends.length > 0 ? `
                <div class="llm-trends-card">
                  <h3>${isSpanish ? 'Tendencias' : 'Trends'}</h3>
                  <ul>
                    ${data.llmInterpretation.trends.map(trend => `<li>${trend}</li>`).join('')}
                  </ul>
                </div>
              ` : ''}

              ${data.llmInterpretation.concerns && data.llmInterpretation.concerns.length > 0 ? `
                <div class="llm-concerns-card">
                  <h3>${isSpanish ? 'Áreas de Atención' : 'Areas of Attention'}</h3>
                  <ul>
                    ${data.llmInterpretation.concerns.map(concern => `<li>${concern}</li>`).join('')}
                  </ul>
                </div>
              ` : ''}
            </div>
          ` : ''}

          ${options.includeQuestionDetails && data.questionResults && data.questionResults.length > 0 ? (() => {
            // Helper: render student response by question type
            const renderResponse = (q: NonNullable<typeof data.questionResults>[0]): string => {
              const r = q.response;
              if (!r) return '';
              const label = isSpanish ? 'Tu respuesta:' : 'Your answer:';
              const correctColor = '#16a34a'; const correctBg = '#f0fdf4'; const correctBorder = '#86efac';
              const wrongColor = '#dc2626'; const wrongBg = '#fef2f2'; const wrongBorder = '#fca5a5';
              const c = q.isCorrect; const color = c ? correctColor : wrongColor;
              const bg = c ? correctBg : wrongBg; const border = c ? correctBorder : wrongBorder;

              switch (q.questionType) {
                case 'multiple_choice':
                case 'single_choice': {
                  const selected: string[] = r.selectedOptions || [];
                  if (!selected.length) return '';
                  const opts = selected.map((optId, i) => {
                    const opt = q.questionOptions?.find(o => o.id === optId);
                    return `<span class="response-badge" style="background:${bg};color:${color};border:1px solid ${border};padding:2px 8px;border-radius:4px;margin:2px;display:inline-block">${opt ? opt.text : 'Opción ' + (i + 1)}</span>`;
                  }).join('');
                  return `<div class="student-response"><span class="response-label">${label}</span><div>${opts}</div></div>`;
                }
                case 'true_false': {
                  const val = r.answer;
                  if (val === undefined || val === null) return '';
                  const txt = val ? (isSpanish ? 'Verdadero' : 'True') : (isSpanish ? 'Falso' : 'False');
                  return `<div class="student-response"><span class="response-label">${label}</span><span class="response-badge" style="background:${bg};color:${color};border:1px solid ${border};padding:2px 8px;border-radius:4px">${txt}</span></div>`;
                }
                case 'fill_blank':
                case 'fill_blanks': {
                  if (r.text) {
                    return `<div class="student-response"><span class="response-label">${label}</span><div class="response-text">${r.text}</div></div>`;
                  }
                  if (Array.isArray(r.blanks) && r.blanks.length > 0) {
                    const blanksHtml = r.blanks.map((b: any, i: number) => {
                      const val = typeof b === 'string' ? b : (b?.value || b?.text || '');
                      return `<span style="display:inline-block;margin-right:12px"><span style="color:#6b7280;font-size:11px">${i+1}.</span> <span style="background:#f3f4f6;border:1px solid #d1d5db;border-radius:3px;padding:1px 6px;font-family:monospace">${val || '—'}</span></span>`;
                    }).join('');
                    return `<div class="student-response"><span class="response-label">${label}</span><div style="margin-top:2px">${blanksHtml}</div></div>`;
                  }
                  return '';
                }
                case 'essay':
                case 'open_text': {
                  const txt = r.text || r.transcription || '';
                  if (!txt) return '';
                  return `<div class="student-response"><span class="response-label">${label}</span><div class="response-essay">${txt}</div></div>`;
                }
                case 'audio_response':
                case 'speaking': {
                  const txt = r.transcription || r.audioTranscription || r.text || '';
                  if (!txt) return `<div class="student-response"><span class="response-label">${isSpanish ? 'Respuesta de audio registrada' : 'Audio response recorded'}</span></div>`;
                  return `<div class="student-response"><span class="response-label">${label}</span><div class="response-essay">${txt}</div></div>`;
                }
                case 'matching': {
                  const pairs: any[] = r.pairs || [];
                  if (!pairs.length) return '';
                  const rows = pairs.map((p: any) => `<div class="pair-row">${p.left || ''} → ${p.right || ''}</div>`).join('');
                  return `<div class="student-response"><span class="response-label">${label}</span><div class="response-pairs">${rows}</div></div>`;
                }
                case 'ordering':
                case 'drag_drop': {
                  const order: any[] = r.order || r.positions || r.items || [];
                  if (!order.length) return '';
                  const items = order.map((item: any, i: number) => `<span class="order-item">${i+1}. ${typeof item === 'string' ? item : (item?.content || JSON.stringify(item))}</span>`).join(' ');
                  return `<div class="student-response"><span class="response-label">${label}</span><div>${items}</div></div>`;
                }
                default:
                  return '';
              }
            };

            const evalMethodLabel = (m?: string) => {
              if (!m) return '';
              const map: Record<string, string> = { automatic: isSpanish ? 'Automática' : 'Automatic', ai_grading: 'IA', manual: isSpanish ? 'Manual' : 'Manual' };
              return map[m] || m;
            };

            return `
            <div class="questions-section">
              <h2>${isSpanish ? 'Detalle de Preguntas' : 'Question Details'}</h2>
              <p class="questions-note">${isSpanish ? 'Revisión detallada de respuestas y retroalimentación' : 'Detailed review of answers and feedback'}</p>

              ${data.questionResults!.map((q, index) => {
                const correctIcon = q.isCorrect === true ? '✓' : q.isCorrect === false ? '✗' : '—';
                const iconColor = q.isCorrect === true ? '#16a34a' : q.isCorrect === false ? '#dc2626' : '#6b7280';
                const evalMethod = evalMethodLabel(q.evaluationMethod);
                return `
                <div class="question-card">
                  <div class="question-header">
                    <span class="question-number">${index + 1}</span>
                    <span class="question-info">${getCompetencyName(q.competency)} • ${this.getQuestionTypeLabel(q.questionType, isSpanish)}${evalMethod ? ` • ${isSpanish ? 'Eval.' : 'Eval.'} ${evalMethod}` : ''}</span>
                    <span style="font-size:16px;font-weight:700;color:${iconColor};margin-right:6px">${correctIcon}</span>
                    <span class="question-score ${q.isCorrect === true ? 'correct' : q.isCorrect === false ? 'incorrect' : ''}">${q.score}/${q.maxScore}</span>
                  </div>

                  ${q.questionText ? `
                    <div class="question-text">
                      <strong>${isSpanish ? 'Pregunta:' : 'Question:'}</strong>
                      <p>${q.questionText}</p>
                    </div>
                  ` : ''}

                  ${renderResponse(q)}

                  ${q.feedback ? `
                    <div class="question-feedback">
                      <strong>${isSpanish ? 'Retroalimentación:' : 'Feedback:'}</strong>
                      <p>${q.feedback}</p>
                    </div>
                  ` : ''}

                  ${q.aiAnalysis?.feedback ? `
                    <div class="question-ai-analysis">
                      <p>${q.aiAnalysis.feedback}</p>
                      ${q.aiAnalysis.suggestions && q.aiAnalysis.suggestions.length > 0 ? `
                        <ul class="ai-suggestions">
                          ${q.aiAnalysis.suggestions.map(s => `<li>${s}</li>`).join('')}
                        </ul>
                      ` : ''}
                    </div>
                  ` : ''}

                  ${q.evaluatedAt ? `
                    <div class="question-meta">${isSpanish ? 'Evaluado' : 'Evaluated'}: ${new Date(q.evaluatedAt).toLocaleDateString(isSpanish ? 'es-ES' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                  ` : ''}
                </div>
              `}).join('')}
            </div>
          `})() : ''}
        </div>
      </body>
      </html>
    `;
  }

  /**
   * CSS específico para resultados de examen
   */
  private getExamResultCSS(): string {
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

        /* Header */
        .header {
          background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
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

        .header-brand {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 16px;
        }

        .brand-logo {
          height: 52px;
          width: auto;
          background: white;
          border-radius: 6px;
          padding: 5px 10px;
          box-shadow: 0 2px 6px rgba(0,0,0,0.25);
          flex-shrink: 0;
        }

        .brand-text {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .brand-company {
          font-size: 13px;
          font-weight: 600;
          color: rgba(255,255,255,0.95);
        }

        .brand-date {
          font-size: 11px;
          color: rgba(255,255,255,0.75);
        }

        /* Student Info Card */
        .student-info-card,
        .exam-info-card {
          background: linear-gradient(145deg, #f8fafc 0%, #e2e8f0 100%);
          border: 2px solid #e2e8f0;
          border-radius: 12px;
          padding: 25px;
          margin: 20px 0;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
        }

        .student-info-card h2,
        .exam-info-card h2 {
          color: #1e40af;
          font-size: 18px;
          margin-bottom: 15px;
          border-bottom: 2px solid #3b82f6;
          padding-bottom: 8px;
        }

        .student-details,
        .exam-details {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 15px;
        }

        .detail-item {
          display: flex;
          flex-direction: column;
        }

        .detail-item .label {
          font-size: 12px;
          font-weight: 600;
          color: #64748b;
          margin-bottom: 4px;
        }

        .detail-item .value {
          font-size: 14px;
          font-weight: 500;
          color: #1e293b;
        }

        /* Results Summary */
        .results-summary {
          margin: 30px 0;
        }

        .results-summary h2 {
          color: #1e40af;
          font-size: 20px;
          margin-bottom: 20px;
          text-align: center;
        }

        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 20px;
          margin: 20px 0;
        }

        .metric-card {
          background: linear-gradient(145deg, #ffffff 0%, #f8fafc 100%);
          border: 2px solid #e2e8f0;
          border-radius: 12px;
          padding: 20px;
          text-align: center;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
        }

        .metric-card.primary { border-color: #3b82f6; }
        .metric-card.success { border-color: #10b981; }
        .metric-card.danger { border-color: #ef4444; }
        .metric-card.secondary { border-color: #6b7280; }
        .metric-card.info { border-color: #8b5cf6; }

        .metric-value {
          font-size: 24px;
          font-weight: 700;
          margin-bottom: 8px;
        }

        .metric-card.primary .metric-value { color: #3b82f6; }
        .metric-card.success .metric-value { color: #10b981; }
        .metric-card.danger .metric-value { color: #ef4444; }
        .metric-card.secondary .metric-value { color: #6b7280; }
        .metric-card.info .metric-value { color: #8b5cf6; }

        .metric-label {
          font-size: 12px;
          color: #64748b;
          font-weight: 500;
        }

        /* Section Headers */
        .section-header {
          font-size: 18px;
          font-weight: 700;
          color: #1e293b;
          margin: 30px 0 15px 0;
          padding-bottom: 8px;
          border-bottom: 2px solid #3b82f6;
        }

        /* Tables */
        .table-container {
          margin: 20px 0;
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
          background: linear-gradient(135deg, #3b82f6 0%, #1e40af 100%);
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

        /* Questions Section */
        .questions-section {
          margin: 30px 0;
        }

        .questions-section h2 {
          color: #1e40af;
          font-size: 18px;
          margin-bottom: 10px;
        }

        .questions-note {
          color: #64748b;
          font-size: 12px;
          margin-bottom: 20px;
          font-style: italic;
        }

        .question-card {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          margin: 15px 0;
          overflow: hidden;
        }

        .question-header {
          display: flex;
          align-items: center;
          gap: 15px;
          padding: 15px;
          background: #f8fafc;
          border-bottom: 1px solid #e2e8f0;
        }

        .question-number {
          background: #3b82f6;
          color: white;
          padding: 5px 10px;
          border-radius: 50%;
          font-size: 12px;
          font-weight: bold;
          min-width: 30px;
          text-align: center;
        }

        .question-info {
          flex: 1;
          font-size: 12px;
          color: #64748b;
        }

        .question-score {
          font-weight: bold;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 11px;
        }

        .question-score.correct {
          background: #dcfce7;
          color: #166534;
        }

        .question-score.incorrect {
          background: #fecaca;
          color: #991b1b;
        }

        .question-text,
        .question-feedback {
          padding: 15px;
          border-bottom: 1px solid #f1f5f9;
        }

        .question-text strong,
        .question-feedback strong {
          display: block;
          margin-bottom: 8px;
          color: #374151;
          font-size: 12px;
        }

        .question-text p,
        .question-feedback p {
          color: #4b5563;
          font-size: 11px;
          line-height: 1.5;
        }

        .student-response {
          padding: 12px 15px;
          background: #f8fafc;
          border-bottom: 1px solid #f1f5f9;
        }

        .response-label {
          display: block;
          font-size: 11px;
          color: #64748b;
          font-weight: 600;
          margin-bottom: 6px;
        }

        .response-text {
          font-size: 11px;
          color: #1e293b;
          font-style: italic;
          padding: 6px 10px;
          background: #e2e8f0;
          border-radius: 4px;
          display: inline-block;
        }

        .response-essay {
          font-size: 11px;
          color: #1e293b;
          line-height: 1.6;
          padding: 8px 10px;
          background: #e2e8f0;
          border-radius: 6px;
          white-space: pre-wrap;
        }

        .response-pairs {
          font-size: 11px;
          color: #1e293b;
        }

        .pair-row {
          padding: 3px 0;
          color: #374151;
        }

        .order-item {
          display: inline-block;
          margin: 2px 4px 2px 0;
          padding: 2px 8px;
          background: #e0f2fe;
          color: #0369a1;
          border: 1px solid #bae6fd;
          border-radius: 4px;
          font-size: 11px;
        }

        .question-meta {
          padding: 8px 15px;
          font-size: 10px;
          color: #94a3b8;
          border-top: 1px solid #f1f5f9;
        }

        .question-ai-analysis {
          padding: 12px 15px;
          background: #faf5ff;
          border-top: 1px solid #e9d5ff;
        }

        .question-ai-analysis strong {
          display: block;
          margin-bottom: 6px;
          color: #6d28d9;
          font-size: 12px;
        }

        .question-ai-analysis p {
          color: #4c1d95;
          font-size: 11px;
          line-height: 1.5;
          margin-bottom: 6px;
        }

        .ai-suggestions {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .ai-suggestions li {
          padding: 3px 0 3px 18px;
          position: relative;
          color: #5b21b6;
          font-size: 11px;
        }

        .ai-suggestions li:before {
          content: "•";
          position: absolute;
          left: 0;
          font-size: 10px;
        }

        /* LLM Interpretation Section */
        .llm-interpretation-section {
          margin: 30px 0;
          background: linear-gradient(145deg, #f0f4ff 0%, #e0e7ff 100%);
          border: 2px solid #6366f1;
          border-radius: 12px;
          padding: 25px;
        }

        .llm-interpretation-section h2 {
          color: #4338ca;
          font-size: 20px;
          margin-bottom: 15px;
          text-align: center;
        }

        .llm-intro {
          text-align: center;
          color: #6b7280;
          font-size: 12px;
          margin-bottom: 20px;
          font-style: italic;
        }

        .llm-summary-card,
        .llm-insights-card,
        .llm-recommendations-card,
        .llm-trends-card,
        .llm-concerns-card {
          background: white;
          border: 1px solid #c7d2fe;
          border-radius: 8px;
          padding: 15px;
          margin: 15px 0;
        }

        .llm-summary-card h3,
        .llm-insights-card h3,
        .llm-recommendations-card h3,
        .llm-trends-card h3,
        .llm-concerns-card h3 {
          color: #4338ca;
          font-size: 14px;
          margin-bottom: 10px;
          font-weight: 600;
        }

        .llm-summary-card p {
          color: #374151;
          font-size: 12px;
          line-height: 1.5;
        }

        .llm-insights-card ul,
        .llm-recommendations-card ul,
        .llm-trends-card ul,
        .llm-concerns-card ul {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .llm-insights-card li,
        .llm-recommendations-card li,
        .llm-trends-card li,
        .llm-concerns-card li {
          padding: 5px 0;
          padding-left: 20px;
          position: relative;
          color: #374151;
          font-size: 11px;
          line-height: 1.4;
        }

        .llm-insights-card li:before,
        .llm-recommendations-card li:before,
        .llm-trends-card li:before {
          content: "•";
          position: absolute;
          left: 0;
          font-size: 10px;
        }

        .llm-concerns-card li:before {
          content: "–";
          position: absolute;
          left: 0;
          font-size: 10px;
        }

        /* Certificate Section */
        .certificate-section {
          margin: 40px 0 20px 0;
          background: linear-gradient(145deg, #fefce8 0%, #fef3c7 100%);
          border: 2px solid #f59e0b;
          border-radius: 12px;
          padding: 25px;
          text-align: center;
        }

        .certificate-section h2 {
          color: #92400e;
          font-size: 20px;
          margin-bottom: 15px;
        }

        .certificate-content p {
          color: #78350f;
          font-size: 13px;
          line-height: 1.6;
        }

        /* Print Optimization */
        @media print {
          .container {
            padding: 10px;
          }

          .header {
            margin: 0;
          }

          .metric-card:hover {
            transform: none;
          }
        }
      </style>
    `;
  }

  /**
   * Métodos auxiliares
   */
  private getScoreStatus(percentage: number): string {
    if (percentage >= 85) return 'excellent';
    if (percentage >= 70) return 'good';
    if (percentage >= 60) return 'satisfactory';
    return 'needs-improvement';
  }

  private getScoreLabel(percentage: number, isSpanish: boolean): string {
    if (percentage >= 85) return isSpanish ? 'Excelente' : 'Excellent';
    if (percentage >= 70) return isSpanish ? 'Bueno' : 'Good';
    if (percentage >= 60) return isSpanish ? 'Aceptable' : 'Satisfactory';
    return isSpanish ? 'Necesita Mejora' : 'Needs Improvement';
  }

  private getExamTypeLabel(type: string, isSpanish: boolean): string {
    const labels: Record<string, { es: string; en: string }> = {
      placement: { es: 'Ubicación', en: 'Placement' },
      progress: { es: 'Progreso', en: 'Progress' },
      final: { es: 'Final', en: 'Final' },
      practice: { es: 'Práctica', en: 'Practice' }
    };
    return labels[type] ? (isSpanish ? labels[type].es : labels[type].en) : type;
  }

  private getQuestionTypeLabel(type: string, isSpanish: boolean): string {
    const labels: Record<string, { es: string; en: string }> = {
      multiple_choice: { es: 'Selección Múltiple', en: 'Multiple Choice' },
      single_choice: { es: 'Selección Única', en: 'Single Choice' },
      true_false: { es: 'Verdadero/Falso', en: 'True/False' },
      fill_blank: { es: 'Completar', en: 'Fill in the Blank' },
      essay: { es: 'Ensayo', en: 'Essay' },
      speaking: { es: 'Expresión Oral', en: 'Speaking' },
      listening: { es: 'Comprensión Auditiva', en: 'Listening' }
    };
    return labels[type] ? (isSpanish ? labels[type].es : labels[type].en) : type;
  }

  /**
   * Genera PDF usando Puppeteer
   */
  private async generatePDFFromHTML(html: string, options: ExamResultPDFOptions): Promise<Buffer> {
    return await professionalPDFService.generatePDFFromHTML(html, {
      language: options.language,
      companyName: options.companyName
    });
  }

  /**
   * Genera PDF básico como fallback
   */
  private async generateFallbackPDF(data: ExamResultPDFData, options: ExamResultPDFOptions): Promise<Buffer> {
    // Convertir los datos a un formato compatible con el servicio de fallback
    const fallbackReport = {
      studentName: `${data.student.firstName} ${data.student.lastName}`.trim(),
      examTitle: data.result.examTitle,
      date: data.result.completedAt,
      score: data.result.percentage,
      level: data.result.level,
      passed: data.result.passed,
      competencies: data.competencyScores,
      feedback: data.result.feedback,
      recommendations: data.result.recommendations
    };

    return await fallbackPDFService.generateBasicReport('Exam Result', fallbackReport, {
      language: options.language,
      companyName: options.companyName
    });
  }
}

export const examResultPDFService = new ExamResultPDFService();