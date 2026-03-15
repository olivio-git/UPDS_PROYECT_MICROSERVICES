import axios from 'axios';
import { logger } from '../utils/logger';

interface EvaluationResult {
  isCorrect?: boolean;
  score: number;
  maxScore: number;
  feedback?: string;
  method: 'auto' | 'ai' | 'human';
  confidence?: number;
  details?: any;
}

interface Question {
  _id: string;
  type: string;
  competency: string;
  level: string;
  content: any;
  correctAnswer?: any;
  rubric?: any;
  points: number;
}

export class EvaluationService {
  private examServiceUrl: string;
  private aiServiceUrl: string;

  constructor() {
    this.examServiceUrl = process.env.EXAM_SERVICE_URL || 'http://exam-service:3003';
    this.aiServiceUrl = process.env.AI_SERVICE_URL || 'http://ai-service:3005';
  }

  /**
   * Evaluar una respuesta según el tipo de pregunta
   */
  async evaluateResponse(questionId: string, response: any): Promise<EvaluationResult | null> {
    try {
      // Obtener información de la pregunta
      const question = await this.getQuestionDetails(questionId);
      
      if (!question) {
        throw new Error('Pregunta no encontrada para evaluación');
      }

      // Seleccionar método de evaluación según el tipo
      switch (question.type) {
        case 'multiple_choice':
          return this.evaluateMultipleChoice(question, response);
        
        case 'open_text':
          return await this.evaluateOpenText(question, response);
        
        case 'speaking':
          return await this.evaluateSpeaking(question, response);
        
        case 'listening':
          return this.evaluateListening(question, response);
        
        default:
          logger.warn(`Tipo de pregunta no soportado para evaluación automática: ${question.type}`);
          return null;
      }

    } catch (error) {
      logger.error('Error evaluating response:', error);
      return null;
    }
  }

  /**
   * Evaluar respuesta de opción múltiple
   */
  private evaluateMultipleChoice(question: Question, response: string): EvaluationResult {
    const correctAnswer = question.content.correctAnswer || question.correctAnswer;
    const isCorrect = response.trim().toLowerCase() === correctAnswer?.toLowerCase();
    
    return {
      isCorrect,
      score: isCorrect ? question.points : 0,
      maxScore: question.points,
      feedback: isCorrect ? 'Respuesta correcta' : `La respuesta correcta es: ${correctAnswer}`,
      method: 'auto',
      confidence: 1.0
    };
  }

  /**
   * Evaluar respuesta de listening (generalmente opción múltiple)
   */
  private evaluateListening(question: Question, response: string): EvaluationResult {
    // Similar a multiple choice pero puede tener lógica específica para listening
    return this.evaluateMultipleChoice(question, response);
  }

  /**
   * Evaluar texto abierto con IA
   */
  private async evaluateOpenText(question: Question, response: string): Promise<EvaluationResult> {
    try {
      // Intentar evaluación con IA primero
      const aiEvaluation = await this.callAIEvaluationService(question, response);
      
      if (aiEvaluation) {
        return aiEvaluation;
      }

      // Fallback a evaluación básica
      return this.evaluateOpenTextBasic(question, response);

    } catch (error) {
      logger.warn('AI evaluation failed, using basic evaluation:', error);
      return this.evaluateOpenTextBasic(question, response);
    }
  }

  /**
   * Evaluación básica de texto abierto
   */
  private evaluateOpenTextBasic(question: Question, response: string): EvaluationResult {
    const wordCount = response.trim().split(/\s+/).length;
    const minWords = question.content.minWords || 50;
    const maxWords = question.content.maxWords || 500;
    
    // Puntuación básica basada en longitud y presencia de contenido
    let score = 0;
    const maxScore = question.points;
    
    if (wordCount >= minWords && wordCount <= maxWords) {
      score = Math.min(maxScore, Math.round(maxScore * 0.7)); // 70% por cumplir requisitos básicos
    } else if (wordCount < minWords) {
      score = Math.round((wordCount / minWords) * maxScore * 0.5); // Penalizar por ser muy corto
    } else {
      score = Math.round(maxScore * 0.6); // Penalizar ligeramente por ser muy largo
    }

    return {
      score: Math.max(0, score),
      maxScore,
      feedback: `Respuesta recibida (${wordCount} palabras). Evaluación automática básica aplicada. Se recomienda revisión manual.`,
      method: 'auto',
      confidence: 0.5,
      details: {
        wordCount,
        expectedRange: `${minWords}-${maxWords} palabras`,
        requiresManualReview: true
      }
    };
  }

  /**
   * Evaluar respuesta de speaking
   */
  private async evaluateSpeaking(question: Question, response: any): Promise<EvaluationResult> {
    try {
      // Verificar que la respuesta incluya audio
      if (!response.audioBlob && !response.audioUrl) {
        return {
          score: 0,
          maxScore: question.points,
          feedback: 'No se recibió grabación de audio',
          method: 'auto',
          confidence: 1.0
        };
      }

      // Intentar evaluación con IA de audio
      const aiEvaluation = await this.callAISpeechEvaluation(question, response);
      
      if (aiEvaluation) {
        return aiEvaluation;
      }

      // Fallback a evaluación básica
      return this.evaluateSpeakingBasic(question, response);

    } catch (error) {
      logger.warn('AI speech evaluation failed, using basic evaluation:', error);
      return this.evaluateSpeakingBasic(question, response);
    }
  }

  /**
   * Evaluación básica de speaking
   */
  private evaluateSpeakingBasic(question: Question, response: any): EvaluationResult {
    const minDuration = question.content.minDuration || 30; // segundos
    const maxDuration = question.content.maxDuration || 120;
    const actualDuration = response.duration || 0;
    
    let score = 0;
    const maxScore = question.points;
    
    if (actualDuration >= minDuration && actualDuration <= maxDuration) {
      score = Math.round(maxScore * 0.6); // 60% por cumplir duración básica
    } else if (actualDuration < minDuration) {
      score = Math.round((actualDuration / minDuration) * maxScore * 0.4);
    } else {
      score = Math.round(maxScore * 0.5); // Penalizar ligeramente por ser muy largo
    }

    return {
      score: Math.max(0, score),
      maxScore,
      feedback: `Grabación recibida (${actualDuration}s). Evaluación automática básica aplicada. Se requiere revisión manual para calificación completa.`,
      method: 'auto',
      confidence: 0.3,
      details: {
        duration: actualDuration,
        expectedDuration: `${minDuration}-${maxDuration} segundos`,
        requiresManualReview: true
      }
    };
  }

  /**
   * Llamar al servicio de evaluación de IA para texto
   */
  private async callAIEvaluationService(question: Question, response: string): Promise<EvaluationResult | null> {
    try {
      const aiResponse = await axios.post(
        `${this.aiServiceUrl}/api/v1/evaluate/text`,
        {
          questionId: question._id,
          questionType: question.type,
          competency: question.competency,
          level: question.level,
          questionContent: question.content,
          studentResponse: response,
          rubric: question.rubric,
          maxScore: question.points
        },
        {
          timeout: 15000,
          headers: {
            'Content-Type': 'application/json',
            'X-Service': 'session-manager'
          }
        }
      );

      if (aiResponse.data.success) {
        return {
          ...aiResponse.data.evaluation,
          method: 'ai'
        };
      }

      return null;

    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNREFUSED') {
          logger.warn('AI service not available for text evaluation');
        } else {
          logger.warn('AI text evaluation failed:', error.response?.data?.message || error.message);
        }
      }
      return null;
    }
  }

  /**
   * Llamar al servicio de evaluación de IA para audio
   */
  private async callAISpeechEvaluation(question: Question, response: any): Promise<EvaluationResult | null> {
    try {
      const formData = new FormData();
      formData.append('questionId', question._id);
      formData.append('questionType', question.type);
      formData.append('competency', question.competency);
      formData.append('level', question.level);
      formData.append('questionContent', JSON.stringify(question.content));
      formData.append('rubric', JSON.stringify(question.rubric));
      formData.append('maxScore', question.points.toString());
      
      if (response.audioBlob) {
        formData.append('audio', response.audioBlob, 'response.wav');
      } else if (response.audioUrl) {
        formData.append('audioUrl', response.audioUrl);
      }

      const aiResponse = await axios.post(
        `${this.aiServiceUrl}/api/v1/evaluate/speech`,
        formData,
        {
          timeout: 30000,
          headers: {
            'Content-Type': 'multipart/form-data',
            'X-Service': 'session-manager'
          }
        }
      );

      if (aiResponse.data.success) {
        return {
          ...aiResponse.data.evaluation,
          method: 'ai'
        };
      }

      return null;

    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNREFUSED') {
          logger.warn('AI service not available for speech evaluation');
        } else {
          logger.warn('AI speech evaluation failed:', error.response?.data?.message || error.message);
        }
      }
      return null;
    }
  }

  /**
   * Obtener detalles de la pregunta para evaluación
   */
  private async getQuestionDetails(questionId: string): Promise<Question | null> {
    try {
      const response = await axios.get(
        `${this.examServiceUrl}/api/v1/questions/${questionId}/evaluation-data`,
        {
          timeout: 5000,
          headers: {
            'X-Service': 'session-manager'
          }
        }
      );

      if (response.data.success) {
        return response.data.question;
      }

      return null;

    } catch (error) {
      logger.error(`Error getting question details for evaluation: ${questionId}`, error);
      return null;
    }
  }

  /**
   * Calcular puntuación por competencia
   */
  calculateCompetencyScores(responses: any[]): Record<string, { score: number; maxScore: number; percentage: number }> {
    const competencyScores: Record<string, { score: number; maxScore: number; count: number }> = {};

    // Agrupar por competencia
    responses.forEach(response => {
      if (response.evaluation && response.competency) {
        const comp = response.competency;
        if (!competencyScores[comp]) {
          competencyScores[comp] = { score: 0, maxScore: 0, count: 0 };
        }
        
        competencyScores[comp].score += response.evaluation.score;
        competencyScores[comp].maxScore += response.evaluation.maxScore;
        competencyScores[comp].count += 1;
      }
    });

    // Calcular porcentajes
    const result: Record<string, { score: number; maxScore: number; percentage: number }> = {};
    
    Object.entries(competencyScores).forEach(([competency, data]) => {
      const percentage = data.maxScore > 0 ? (data.score / data.maxScore) * 100 : 0;
      result[competency] = {
        score: data.score,
        maxScore: data.maxScore,
        percentage: Math.round(percentage * 100) / 100
      };
    });

    return result;
  }

  /**
   * Determinar nivel MCER basado en puntuaciones
   */
  determineMCERLevel(competencyScores: Record<string, { percentage: number }>): string {
    const averagePercentage = Object.values(competencyScores)
      .reduce((sum, score) => sum + score.percentage, 0) / Object.values(competencyScores).length;

    // Umbrales configurables para niveles MCER
    if (averagePercentage >= 90) return 'C2';
    if (averagePercentage >= 80) return 'C1';
    if (averagePercentage >= 70) return 'B2';
    if (averagePercentage >= 60) return 'B1';
    if (averagePercentage >= 50) return 'A2';
    return 'A1';
  }

  /**
   * Generar retroalimentación personalizada
   */
  generateFeedback(competencyScores: Record<string, { percentage: number }>, level: string): string {
    const feedback = [];
    const competencyNames = {
      'reading': 'Comprensión Lectora',
      'writing': 'Expresión Escrita',
      'listening': 'Comprensión Auditiva',
      'speaking': 'Expresión Oral'
    };

    feedback.push(`Tu nivel determinado es: ${level}`);
    feedback.push('');
    feedback.push('Análisis por competencias:');

    Object.entries(competencyScores).forEach(([competency, score]) => {
      const name = competencyNames[competency as keyof typeof competencyNames] || competency;
      const percentage = Math.round(score.percentage);
      
      let status = '';
      if (percentage >= 80) status = 'Excelente';
      else if (percentage >= 70) status = 'Bueno';
      else if (percentage >= 60) status = 'Regular';
      else status = 'Necesita mejorar';
      
      feedback.push(`• ${name}: ${percentage}% - ${status}`);
    });

    // Recomendaciones específicas
    const weakestCompetency = Object.entries(competencyScores)
      .sort(([,a], [,b]) => a.percentage - b.percentage)[0];

    if (weakestCompetency && weakestCompetency[1].percentage < 70) {
      const competencyName = competencyNames[weakestCompetency[0] as keyof typeof competencyNames];
      feedback.push('');
      feedback.push(`Recomendación: Enfocar práctica en ${competencyName} para mejorar tu puntuación general.`);
    }

    return feedback.join('\n');
  }
}
