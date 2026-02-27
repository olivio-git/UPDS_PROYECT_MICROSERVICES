import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import type { StudentExamResult } from './examResultService';

export class PDFService {
  // Google Forms inspired colors - clean and professional
  private static readonly colors = {
    primary: { r: 26, g: 115, b: 232 }, // Google Blue
    accent: { r: 219, g: 68, b: 55 }, // Google Red
    success: { r: 52, g: 168, b: 83 }, // Google Green
    warning: { r: 251, g: 188, b: 4 }, // Google Yellow
    text: { r: 60, g: 64, b: 67 }, // Dark gray text
    textLight: { r: 95, g: 99, b: 104 }, // Light gray text
    border: { r: 218, g: 220, b: 224 }, // Light border
    background: { r: 248, g: 249, b: 250 }, // Very light gray
    white: { r: 255, g: 255, b: 255 },
    correct: { r: 52, g: 168, b: 83 }, // Green for correct
    incorrect: { r: 234, g: 67, b: 53 } // Red for incorrect
  };

  private static readonly fonts = {
    title: { size: 20, style: 'normal' }, // Google uses lighter titles
    subtitle: { size: 16, style: 'normal' },
    heading: { size: 14, style: 'normal' },
    subheading: { size: 12, style: 'normal' },
    body: { size: 11, style: 'normal' },
    small: { size: 9, style: 'normal' },
    caption: { size: 8, style: 'normal' }
  };

  /**
   * Generate professional PDF from exam result data
   */
  static async generateExamResultPDF(
    result: StudentExamResult,
    examDetailData?: any,
    studentInfo?: { firstName: string; lastName: string; email: string; candidateId: string }
  ): Promise<void> {
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');

      // UTF-8 is handled by jsPDF; removed low-level internal write calls that are not part of the public API.

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 20;
      const contentWidth = pageWidth - 2 * margin;

      let currentY = margin;

      // Helper functions
      const addPage = () => {
        pdf.addPage();
        currentY = margin;
        this.addGoogleFormsSimpleHeader(pdf, pageWidth, margin);
        currentY += 25;
      };

      const checkPageBreak = (neededHeight: number) => {
        if (currentY + neededHeight > pageHeight - 40) {
          addPage();
        }
      };

      const setColor = (color: { r: number; g: number; b: number }) => {
        pdf.setTextColor(color.r, color.g, color.b);
      };

      const setFillColor = (color: { r: number; g: number; b: number }) => {
        pdf.setFillColor(color.r, color.g, color.b);
      };

      const setFont = (font: { size: number; style: string }) => {
        pdf.setFontSize(font.size);
        pdf.setFont('helvetica', font.style as any);
      };

      // ================== PÁGINA 1: HEADER & RESUMEN ==================
      this.generateGoogleFormsHeader(pdf, result, studentInfo, pageWidth, margin);
      currentY = 75; // More space for student info

      currentY = this.generateSummarySection(pdf, result, margin, contentWidth, currentY);

      // ================== PREGUNTAS EN NUEVA PÁGINA SIEMPRE ==================
      if (examDetailData?.questionResults && examDetailData.questionResults.length > 0) {
        // Always start questions on a new page
        pdf.addPage();
        this.addGoogleFormsSimpleHeader(pdf, pageWidth, margin);
        currentY = margin + 25;
        this.generateGoogleFormsQuestions(pdf, examDetailData.questionResults, margin, contentWidth, pageWidth, pageHeight, currentY);
      }

      // ================== FOOTER SIMPLE ==================
      this.addGoogleFormsFooter(pdf);

      // ================== DESCARGAR PDF ==================
      const sanitizedExamName = this.sanitizeText(result.examName).replace(/[^a-zA-Z0-9]/g, '_');
      const fileName = `Resultado_${sanitizedExamName}.pdf`;
      pdf.save(fileName);

    } catch (error) {
      console.error('Error generating PDF:', error);
      throw new Error('Error al generar el PDF');
    }
  }

  /**
   * Generate Google Forms style header with student information
   */
  private static generateGoogleFormsHeader(
    pdf: jsPDF,
    result: StudentExamResult,
    studentInfo: { firstName: string; lastName: string; email: string; candidateId: string } | undefined,
    pageWidth: number,
    margin: number
  ): void {
    // Simple top border like Google Forms
    pdf.setDrawColor(this.colors.primary.r, this.colors.primary.g, this.colors.primary.b);
    pdf.setLineWidth(4);
    pdf.line(margin, 15, pageWidth - margin, 15);

    // Main title - simple and clean
    pdf.setTextColor(this.colors.text.r, this.colors.text.g, this.colors.text.b);
    pdf.setFontSize(this.fonts.title.size);
    pdf.setFont('helvetica', 'normal');

    // Use proper text encoding
    const examTitle = this.sanitizeText(result.examName);
    pdf.text(examTitle, margin, 30);

    // Student Information Section
    if (studentInfo) {
      pdf.setFillColor(this.colors.background.r, this.colors.background.g, this.colors.background.b);
      pdf.rect(margin, 35, pageWidth - 2 * margin, 25, 'F');

      pdf.setTextColor(this.colors.text.r, this.colors.text.g, this.colors.text.b);
      pdf.setFontSize(this.fonts.subheading.size);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Estudiante:', margin + 5, 45);

      pdf.setFont('helvetica', 'normal');
      const studentName = this.sanitizeText(`${studentInfo.firstName} ${studentInfo.lastName}`);
      pdf.text(studentName, margin + 35, 45);

      pdf.setTextColor(this.colors.textLight.r, this.colors.textLight.g, this.colors.textLight.b);
      pdf.setFontSize(this.fonts.small.size);
      pdf.text(`ID: ${studentInfo.candidateId}`, margin + 5, 52);
      pdf.text(`Email: ${this.sanitizeText(studentInfo.email)}`, margin + 5, 57);
    }

    // Exam metadata
    const examDate = new Date(result.date);
    const durationHours = Math.floor(result.duration / 60);
    const durationMinutes = result.duration % 60;
    const durationText = durationHours > 0
      ? `${durationHours}h ${durationMinutes}m`
      : `${durationMinutes}m`;

    pdf.setTextColor(this.colors.textLight.r, this.colors.textLight.g, this.colors.textLight.b);
    pdf.setFontSize(this.fonts.body.size);
    pdf.setFont('helvetica', 'normal');
    const metaText = `${result.level} • ${examDate.toLocaleDateString('es-ES')} • Duracion: ${durationText}`;
    pdf.text(this.sanitizeText(metaText), margin, 70);
  }

  /**
   * Generate Google Forms style summary section
   */
  private static generateSummarySection(
    pdf: jsPDF,
    result: StudentExamResult,
    margin: number,
    contentWidth: number,
    startY: number
  ): number {
    let currentY = startY;

    // Score section - like Google Forms results
    pdf.setFillColor(this.colors.background.r, this.colors.background.g, this.colors.background.b);
    pdf.rect(margin, currentY, contentWidth, 35, 'F');

    // Score display
    pdf.setTextColor(this.colors.text.r, this.colors.text.g, this.colors.text.b);
    pdf.setFontSize(24);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`${result.overallScore}%`, margin + 10, currentY + 20);

    pdf.setFontSize(this.fonts.body.size);
    pdf.setTextColor(this.colors.textLight.r, this.colors.textLight.g, this.colors.textLight.b);
    pdf.text('Puntuación final', margin + 10, currentY + 30);

    // Status
    const statusColor = result.passed ? this.colors.correct : this.colors.incorrect;
    pdf.setTextColor(statusColor.r, statusColor.g, statusColor.b);
    pdf.setFontSize(this.fonts.heading.size);
    pdf.text(result.passed ? 'Aprobado' : 'No Aprobado', margin + 120, currentY + 20);

    currentY += 50;

    // Competencies - professional table style
    if (Object.keys(result.competencies || {}).length > 0) {
      pdf.setTextColor(this.colors.text.r, this.colors.text.g, this.colors.text.b);
      pdf.setFontSize(this.fonts.heading.size);
      pdf.setFont('helvetica', 'bold');
      pdf.text(this.sanitizeText('Resultados por competencia'), margin, currentY);
      currentY += 15;

      // Table header
      const rowHeight = 12;
      const colWidths = [100, 40, 50]; // Competency, Score, Status

      // Header background
      pdf.setFillColor(this.colors.primary.r, this.colors.primary.g, this.colors.primary.b);
      pdf.rect(margin, currentY, contentWidth, rowHeight, 'F');

      // Header text
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(this.fonts.subheading.size);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Competencia', margin + 5, currentY + 8);
      pdf.text('Puntuacion', margin + colWidths[0] + 5, currentY + 8);
      pdf.text('Estado', margin + colWidths[0] + colWidths[1] + 5, currentY + 8);

      currentY += rowHeight;

      // Table rows
      Object.entries(result.competencies || {}).forEach(([skill, data], index) => {
        const comp = data as { score?: number; feedback?: string };
        const score = comp.score ?? 0;

        // Alternating row colors
        if (index % 2 === 0) {
          pdf.setFillColor(this.colors.background.r, this.colors.background.g, this.colors.background.b);
          pdf.rect(margin, currentY, contentWidth, rowHeight, 'F');
        }

        // Border
        pdf.setDrawColor(this.colors.border.r, this.colors.border.g, this.colors.border.b);
        pdf.setLineWidth(0.5);
        pdf.rect(margin, currentY, contentWidth, rowHeight, 'S');

        // Competency name
        pdf.setTextColor(this.colors.text.r, this.colors.text.g, this.colors.text.b);
        pdf.setFontSize(this.fonts.body.size);
        pdf.setFont('helvetica', 'normal');
        pdf.text(this.sanitizeText(this.getCompetencyName(skill)), margin + 5, currentY + 8);

        // Score
        const scoreColor = score >= 70 ? this.colors.correct : this.colors.incorrect;
        pdf.setTextColor(scoreColor.r, scoreColor.g, scoreColor.b);
        pdf.setFont('helvetica', 'bold');
        pdf.text(`${score}%`, margin + colWidths[0] + 5, currentY + 8);

        // Status
        const status = score >= 85 ? 'Excelente' : score >= 70 ? 'Bueno' : score >= 60 ? 'Aceptable' : 'Mejorar';
        pdf.text(this.sanitizeText(status), margin + colWidths[0] + colWidths[1] + 5, currentY + 8);

        currentY += rowHeight;
      });

      currentY += 15;
    }

    return currentY;
  }

  /**
   * Generate Google Forms style questions
   */
  private static generateGoogleFormsQuestions(
    pdf: jsPDF,
    questions: any[],
    margin: number,
    contentWidth: number,
    pageWidth: number,
    pageHeight: number,
    startY: number
  ): void {
    let currentY = startY;

    // Section separator
    pdf.setDrawColor(this.colors.border.r, this.colors.border.g, this.colors.border.b);
    pdf.setLineWidth(1);
    pdf.line(margin, currentY, margin + contentWidth, currentY);
    currentY += 20;

    // Section title
    pdf.setTextColor(this.colors.text.r, this.colors.text.g, this.colors.text.b);
    pdf.setFontSize(this.fonts.subtitle.size);
    pdf.setFont('helvetica', 'bold');
    pdf.text(this.sanitizeText('Detalle de respuestas'), margin, currentY);
    currentY += 25;

    questions.forEach((question: any, index: number) => {
      const questionHeight = this.calculateGoogleFormsQuestionHeight(pdf, question, contentWidth);

      // Check if we need a new page
      if (currentY + questionHeight > pageHeight - 40) {
        pdf.addPage();
        this.addGoogleFormsSimpleHeader(pdf, pageWidth, margin);
        currentY = margin + 25;
      }

      // Render question in Google Forms style
      this.renderGoogleFormsQuestion(pdf, question, index + 1, margin, currentY, contentWidth);
      currentY += questionHeight + 20;
    });
  }

  /**
   * Render Google Forms style question
   */
  private static renderGoogleFormsQuestion(
    pdf: jsPDF,
    question: any,
    questionNumber: number,
    x: number,
    y: number,
    width: number
  ): void {
    let currentY = y;

    // Question number and score
    pdf.setTextColor(this.colors.text.r, this.colors.text.g, this.colors.text.b);
    pdf.setFontSize(this.fonts.heading.size);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`${questionNumber}.`, x, currentY);

    // Score indicator
    const scoreColor = question.isCorrect ? this.colors.correct : this.colors.incorrect;
    pdf.setTextColor(scoreColor.r, scoreColor.g, scoreColor.b);
    pdf.setFontSize(this.fonts.small.size);
    pdf.text(`${question.score}/${question.maxScore} puntos`, x + width - 50, currentY);

    currentY += 8;

    // Question text - clean and simple with proper encoding
    if (question.questionData?.questionText) {
      pdf.setTextColor(this.colors.text.r, this.colors.text.g, this.colors.text.b);
      pdf.setFontSize(this.fonts.body.size);
      pdf.setFont('helvetica', 'normal');
      const sanitizedText = this.sanitizeText(question.questionData.questionText);
      const questionLines = pdf.splitTextToSize(sanitizedText, width - 20);
      pdf.text(questionLines, x, currentY);
      currentY += questionLines.length * 5 + 8;
    }

    // Answer section with light background
    pdf.setFillColor(this.colors.background.r, this.colors.background.g, this.colors.background.b);
    const answerBoxHeight = this.getAnswerBoxHeight(pdf, question, width);
    pdf.rect(x, currentY, width, answerBoxHeight, 'F');

    // "Tu respuesta" label
    pdf.setTextColor(this.colors.textLight.r, this.colors.textLight.g, this.colors.textLight.b);
    pdf.setFontSize(this.fonts.small.size);
    pdf.text(this.sanitizeText('Tu respuesta:'), x + 8, currentY + 8);

    // Render the actual answer based on question type
    this.renderGoogleFormsAnswer(pdf, question, x + 8, currentY + 15, width - 16);

    currentY += answerBoxHeight + 8;

    // Feedback if available
    if (question.feedback) {
      pdf.setTextColor(this.colors.primary.r, this.colors.primary.g, this.colors.primary.b);
      pdf.setFontSize(this.fonts.small.size);
      pdf.setFont('helvetica', 'italic');
      const sanitizedFeedback = this.sanitizeText(`Retroalimentacion: ${question.feedback}`);
      const feedbackLines = pdf.splitTextToSize(sanitizedFeedback, width - 10);
      pdf.text(feedbackLines, x, currentY);
    }
  }

  /**
   * Render answer based on question type - Google Forms style
   */
  private static renderGoogleFormsAnswer(
    pdf: jsPDF,
    question: any,
    x: number,
    y: number,
    width: number
  ): void {
    pdf.setTextColor(this.colors.text.r, this.colors.text.g, this.colors.text.b);
    pdf.setFontSize(this.fonts.body.size);

    switch (question.questionType) {
      case 'multiple_choice':
        if (question.response?.selectedOptions && question.questionData?.options) {
          question.questionData.options.forEach((option: any, index: number) => {
            const isSelected = question.response.selectedOptions.includes(option.id);
            const isCorrect = option.isCorrect;

            // Enhanced symbols for better visibility
            let symbol = '○';
            let color = this.colors.textLight;

            if (isSelected) {
              symbol = '●';
              color = isCorrect ? this.colors.correct : this.colors.incorrect;
            }

            // Show correct answer even if not selected
            if (!isSelected && isCorrect) {
              symbol = '✓';
              color = this.colors.success;
            }

            pdf.setTextColor(color.r, color.g, color.b);
            pdf.setFont('helvetica', isSelected ? 'bold' : 'normal');
            const optionText = this.sanitizeText(`${symbol} ${option.text}`);
            pdf.text(optionText, x, y + (index * 6));

            // Add selection indicator
            if (isSelected) {
              pdf.setFontSize(this.fonts.caption.size);
              pdf.setTextColor(this.colors.textLight.r, this.colors.textLight.g, this.colors.textLight.b);
              pdf.text(' (seleccionada)', x + 100, y + (index * 6));
              pdf.setFontSize(this.fonts.body.size);
            }
          });
        }
        break;

      case 'true_false':
        const userAnswer = question.response?.answer;
        const correctAnswer = question.questionData?.correctAnswer;
        const isCorrect = userAnswer === correctAnswer;
        const color = isCorrect ? this.colors.correct : this.colors.incorrect;

        pdf.setTextColor(color.r, color.g, color.b);
        pdf.setFont('helvetica', 'bold');
        const answerText = this.sanitizeText(`● ${userAnswer ? 'Verdadero' : 'Falso'}`);
        pdf.text(answerText, x, y);

        pdf.setFontSize(this.fonts.caption.size);
        pdf.text(' (tu respuesta)', x + 50, y);
        pdf.setFontSize(this.fonts.body.size);

        if (!isCorrect) {
          pdf.setTextColor(this.colors.success.r, this.colors.success.g, this.colors.success.b);
          pdf.setFont('helvetica', 'normal');
          const correctText = this.sanitizeText(`✓ Correcto: ${correctAnswer ? 'Verdadero' : 'Falso'}`);
          pdf.text(correctText, x, y + 6);
        }
        break;

      case 'essay':
      case 'open_text':
        const text = question.response?.text || 'Sin respuesta';
        const sanitizedText = this.sanitizeText(text);
        const lines = pdf.splitTextToSize(sanitizedText, width - 10);
        pdf.setFont('helvetica', 'italic');
        pdf.text(lines, x, y);
        break;

      default:
        pdf.setFont('helvetica', 'normal');
        pdf.text(this.sanitizeText('Respuesta registrada'), x, y);
    }
  }

  /**
   * Calculate height needed for answer box
   */
  private static getAnswerBoxHeight(pdf: jsPDF, question: any, width: number): number {
    let height = 20; // Base height

    switch (question.questionType) {
      case 'multiple_choice':
        if (question.questionData?.options) {
          height = Math.max(20, question.questionData.options.length * 6 + 15);
        }
        break;
      case 'essay':
      case 'open_text':
        const text = question.response?.text || 'Sin respuesta';
        const lines = pdf.splitTextToSize(text, width - 16);
        height = Math.max(20, lines.length * 4 + 15);
        break;
    }

    return height;
  }

  /**
   * Calculate height for Google Forms style question
   */
  private static calculateGoogleFormsQuestionHeight(pdf: jsPDF, question: any, width: number): number {
    let height = 25; // Base height for question number and score

    // Question text height
    if (question.questionData?.questionText) {
      const questionLines = pdf.splitTextToSize(question.questionData.questionText, width - 20);
      height += questionLines.length * 5 + 8;
    }

    // Answer box height
    height += this.getAnswerBoxHeight(pdf, question, width) + 8;

    // Feedback height
    if (question.feedback) {
      const feedbackLines = pdf.splitTextToSize(`Feedback: ${question.feedback}`, width - 10);
      height += feedbackLines.length * 4 + 5;
    }

    return height;
  }

  /**
   * Simple header for additional pages
   */
  private static addGoogleFormsSimpleHeader(pdf: jsPDF, pageWidth: number, margin: number): void {
    pdf.setDrawColor(this.colors.border.r, this.colors.border.g, this.colors.border.b);
    pdf.setLineWidth(1);
    pdf.line(margin, 15, pageWidth - margin, 15);
  }

  /**
   * Simple footer for Google Forms style
   */
  private static addGoogleFormsFooter(pdf: jsPDF): void {
    const totalPages = pdf.getNumberOfPages();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);

      // Simple page number
      pdf.setTextColor(this.colors.textLight.r, this.colors.textLight.g, this.colors.textLight.b);
      pdf.setFontSize(this.fonts.caption.size);
      pdf.text(`Página ${i} de ${totalPages}`, pageWidth / 2, pageHeight - 15, { align: 'center' });
    }
  }





  /**
   * Generate PDF by capturing HTML element
   */
  static async generateFromHTML(elementId: string, fileName: string): Promise<void> {
    try {
      const element = document.getElementById(elementId);
      if (!element) {
        throw new Error('Element not found');
      }

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#0B1422'
      });

      const imgWidth = 210; // A4 width in mm
      const pageHeight = 295; // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;

      const pdf = new jsPDF('p', 'mm', 'a4');
      let position = 0;

      // Add first page
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      // Add additional pages if needed
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(fileName);
    } catch (error) {
      console.error('Error generating PDF from HTML:', error);
      throw new Error('Error al generar el PDF');
    }
  }

  /**
   * Sanitize text to avoid encoding issues
   */
  private static sanitizeText(text: string): string {
    if (!text) return '';

    // Replace problematic characters
    return text
      .replace(/[àáâãäå]/g, 'a')
      .replace(/[èéêë]/g, 'e')
      .replace(/[ìíîï]/g, 'i')
      .replace(/[òóôõö]/g, 'o')
      .replace(/[ùúûü]/g, 'u')
      .replace(/[ñ]/g, 'n')
      .replace(/[ç]/g, 'c')
      .replace(/[ÀÁÂÃÄÅ]/g, 'A')
      .replace(/[ÈÉÊË]/g, 'E')
      .replace(/[ÌÍÎÏ]/g, 'I')
      .replace(/[ÒÓÔÕÖ]/g, 'O')
      .replace(/[ÙÚÛÜ]/g, 'U')
      .replace(/[Ñ]/g, 'N')
      .replace(/[Ç]/g, 'C')
      .replace(/[""]/g, '"')
      .replace(/['']/g, "'")
      .replace(/[–—]/g, '-')
      .replace(/[…]/g, '...')
      // Remove any remaining problematic characters
      .replace(/[^\x20-\x7E\u00A1-\u00FF]/g, '');
  }

  private static getCompetencyName(key: string): string {
    const names: Record<string, string> = {
      listening: 'Comprension Auditiva',
      reading: 'Comprension Lectora',
      writing: 'Expresion Escrita',
      speaking: 'Expresion Oral',
    };
    return names[key] || key;
  }

  private static getQuestionTypeName(type: string): string {
    const types: Record<string, string> = {
      multiple_choice: 'Selección Múltiple',
      single_choice: 'Selección Única',
      true_false: 'Verdadero/Falso',
      fill_blank: 'Completar',
      essay: 'Ensayo',
      speaking: 'Expresión Oral',
      listening: 'Comprensión Auditiva'
    };
    return types[type] || type;
  }

  private static getResponseSummary(question: any): string {
    switch (question.questionType) {
      case 'multiple_choice':
        if (question.response?.selectedOptions) {
          return `${question.response.selectedOptions.length} opción(es) seleccionada(s)`;
        }
        return 'Sin respuesta';

      case 'true_false':
        return question.response?.answer ? 'Verdadero' : 'Falso';

      case 'essay':
      case 'open_text':
        const text = question.response?.text || '';
        return text.length > 50 ? `${text.substring(0, 50)}...` : text || 'Sin respuesta';

      default:
        return 'Respuesta registrada';
    }
  }
}