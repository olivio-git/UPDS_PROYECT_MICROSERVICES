import { IQuestion } from '../models/question.model';
import { logger } from '../utils/logger';

export interface EvaluationResult {
  isCorrect: boolean;
  score: number;
  maxScore: number;
  feedback?: string;
  evaluatedBy: string;
  evaluatorId?: any;
  evaluatedAt?: Date;
  rubricScores?: Array<{
    criterionName: string;
    score: number;
    feedback?: string;
  }>;
  details?: any;
}

export class QuestionEvaluationService {
  
  /**
   * Evalúa una respuesta basada en el tipo de pregunta
   */
  async evaluateResponse(
    question: IQuestion, 
    response: any, 
    maxScore: number = 1
  ): Promise<EvaluationResult> {
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
        
        case 'drag_drop':
          return this.evaluateDragDrop(question, response, maxScore);
        
        case 'open_text':
        case 'essay':
          return this.evaluateOpenText(question, response, maxScore);
        
        case 'audio_response':
          return this.evaluateAudioResponse(question, response, maxScore);
        
        case 'file_upload':
          return this.evaluateFileUpload(question, response, maxScore);
        
        default:
          throw new Error(`Tipo de pregunta no soportado: ${question.type}`);
      }
    } catch (error) {
      logger.error('Error evaluating response:', error);
      throw error;
    }
  }

  private evaluateMultipleChoice(
    question: IQuestion, 
    response: string | string[], 
    maxScore: number
  ): EvaluationResult {
    const correctOptions = question.content.options?.filter(opt => opt.isCorrect) || [];
    const correctIds = correctOptions.map(opt => opt.id);
    
    let isCorrect = false;
    let score = 0;
    
    if (Array.isArray(response)) {
      // Múltiples respuestas correctas
      isCorrect = response.length === correctIds.length && 
                  response.every(id => correctIds.includes(id));
    } else {
      // Una sola respuesta correcta
      isCorrect = correctIds.includes(response);
    }
    
    if (isCorrect) {
      score = maxScore;
    }
    
    return {
      isCorrect,
      score,
      maxScore,
      evaluatedBy: 'system',
      evaluatedAt: new Date(),
      feedback: isCorrect ? 'Respuesta correcta' : `Respuesta incorrecta. La respuesta correcta es: ${correctOptions.map(opt => opt.text).join(', ')}`
    };
  }

  private evaluateTrueFalse(
    question: IQuestion, 
    response: string, 
    maxScore: number
  ): EvaluationResult {
    const correctOption = question.content.options?.find(opt => opt.isCorrect);
    const isCorrect = correctOption?.id === response;
    
    return {
      isCorrect,
      score: isCorrect ? maxScore : 0,
      maxScore,
      evaluatedBy: 'system',
      evaluatedAt: new Date(),
      feedback: isCorrect ? 'Respuesta correcta' : `Respuesta incorrecta. La respuesta correcta es: ${correctOption?.text}`
    };
  }

  private evaluateFillBlanks(
    question: IQuestion, 
    response: string[], 
    maxScore: number
  ): EvaluationResult {
    const template = question.content.template || '';
    const blanksCount = (template.match(/___/g) || []).length;
    
    if (!response || response.length !== blanksCount) {
      return {
        isCorrect: false,
        score: 0,
        maxScore,
        evaluatedBy: 'system',
        evaluatedAt: new Date(),
        feedback: `Se esperaban ${blanksCount} respuestas`
      };
    }

    let correctCount = 0;
    const correctAnswers = question.content.correctAnswer as string[] || [];
    
    if (correctAnswers.length > 0) {
      // Evaluación automática con respuestas predefinidas
      response.forEach((answer, index) => {
        if (index < correctAnswers.length) {
          const expected = correctAnswers[index];
          if (typeof expected === 'string') {
            const expectedNormalized = expected.toLowerCase().trim();
            const provided = (answer || '').toLowerCase().trim();
            if (expectedNormalized === provided) {
              correctCount++;
            }
          }
        }
      });
    } else {
      // Si no hay respuestas predefinidas, marcar como correcta para revisión manual
      correctCount = blanksCount;
    }
    
    const score = (correctCount / blanksCount) * maxScore;
    const isCorrect = correctCount === blanksCount;
    
    return {
      isCorrect,
      score,
      maxScore,
      evaluatedBy: 'system',
      evaluatedAt: new Date(),
      feedback: `${correctCount} de ${blanksCount} espacios correctos`,
      details: { correctCount, totalBlanks: blanksCount }
    };
  }

  private evaluateMatching(
    question: IQuestion, 
    response: Array<{itemId: string, matchedWith: string}>, 
    maxScore: number
  ): EvaluationResult {
    const items = question.content.items || [];
    let correctCount = 0;
    
    response.forEach(match => {
      const item = items.find(i => i.id === match.itemId);
      if (item && item.matchingPair === match.matchedWith) {
        correctCount++;
      }
    });
    
    const score = (correctCount / items.length) * maxScore;
    const isCorrect = correctCount === items.length;
    
    return {
      isCorrect,
      score,
      maxScore,
      evaluatedBy: 'system',
      evaluatedAt: new Date(),
      feedback: `${correctCount} de ${items.length} emparejamientos correctos`,
      details: { correctCount, totalItems: items.length }
    };
  }

  private evaluateOrdering(
    question: IQuestion, 
    response: string[], 
    maxScore: number
  ): EvaluationResult {
    const items = question.content.items || [];
    const correctOrder = items
      .sort((a, b) => (a.correctPosition || 0) - (b.correctPosition || 0))
      .map(item => item.id);
    
    let correctCount = 0;
    response.forEach((itemId, index) => {
      if (correctOrder[index] === itemId) {
        correctCount++;
      }
    });
    
    const score = (correctCount / items.length) * maxScore;
    const isCorrect = correctCount === items.length;
    
    return {
      isCorrect,
      score,
      maxScore,
      evaluatedBy: 'system',
      evaluatedAt: new Date(),
      feedback: `${correctCount} de ${items.length} elementos en posición correcta`,
      details: { correctCount, totalItems: items.length, correctOrder }
    };
  }

  private evaluateDragDrop(
    question: IQuestion, 
    response: Array<{itemId: string, position: number}>, 
    maxScore: number
  ): EvaluationResult {
    const items = question.content.items || [];
    let correctCount = 0;
    
    response.forEach(placement => {
      const item = items.find(i => i.id === placement.itemId);
      if (item && item.correctPosition === placement.position) {
        correctCount++;
      }
    });
    
    const score = (correctCount / items.length) * maxScore;
    const isCorrect = correctCount === items.length;
    
    return {
      isCorrect,
      score,
      maxScore,
      evaluatedBy: 'system',
      evaluatedAt: new Date(),
      feedback: `${correctCount} de ${items.length} elementos posicionados correctamente`,
      details: { correctCount, totalItems: items.length }
    };
  }

  private evaluateOpenText(
    question: IQuestion, 
    response: string, 
    maxScore: number
  ): EvaluationResult {
    // Para texto abierto, requerirá evaluación manual o IA
    // Por ahora, retornamos un resultado que requiere revisión
    return {
      isCorrect: false, // Marcado para revisión manual
      score: 0,
      maxScore,
      evaluatedBy: 'system',
      evaluatedAt: new Date(),
      feedback: 'Respuesta requiere evaluación manual',
      details: { requiresManualReview: true, response }
    };
  }

  private evaluateAudioResponse(
    question: IQuestion, 
    response: { audioUrl: string, transcription?: string }, 
    maxScore: number
  ): EvaluationResult {
    // Para respuestas de audio, requerirá análisis con IA de speech
    // Por ahora, retornamos un resultado que requiere revisión
    return {
      isCorrect: false, // Marcado para revisión manual
      score: 0,
      maxScore,
      evaluatedBy: 'system',
      evaluatedAt: new Date(),
      feedback: 'Respuesta de audio requiere evaluación especializada',
      details: { 
        requiresManualReview: true, 
        audioUrl: response.audioUrl,
        transcription: response.transcription || null,
        expectedType: question.content.expectedResponseType
      }
    };
  }

  private evaluateFileUpload(
    question: IQuestion, 
    response: { fileUrl: string, fileName: string, fileType: string }, 
    maxScore: number
  ): EvaluationResult {
    // Para archivos subidos, requerirá evaluación manual
    return {
      isCorrect: false, // Marcado para revisión manual
      score: 0,
      maxScore,
      evaluatedBy: 'system',
      evaluatedAt: new Date(),
      feedback: 'Archivo subido requiere evaluación manual',
      details: { 
        requiresManualReview: true, 
        fileUrl: response.fileUrl,
        fileName: response.fileName,
        fileType: response.fileType
      }
    };
  }

  /**
   * Genera estadísticas de respuestas para una pregunta
   */
  async generateQuestionStatistics(questionId: string, responses: any[]): Promise<any> {
    try {
      const totalResponses = responses.length;
      const correctResponses = responses.filter(r => r.evaluation?.isCorrect).length;
      const averageScore = responses.reduce((sum, r) => sum + (r.evaluation?.score || 0), 0) / totalResponses;
      const averageTime = responses.reduce((sum, r) => sum + (r.timeSpent || 0), 0) / totalResponses;

      return {
        totalResponses,
        correctResponses,
        accuracy: (correctResponses / totalResponses) * 100,
        averageScore,
        averageTime,
        difficultyRating: this.calculateDifficultyRating(correctResponses, totalResponses)
      };
    } catch (error) {
      logger.error('Error generating question statistics:', error);
      throw error;
    }
  }

  private calculateDifficultyRating(correct: number, total: number): number {
    const accuracy = correct / total;
    if (accuracy >= 0.9) return 1; // Muy fácil
    if (accuracy >= 0.7) return 2; // Fácil
    if (accuracy >= 0.5) return 3; // Medio
    if (accuracy >= 0.3) return 4; // Difícil
    return 5; // Muy difícil
  }
}
