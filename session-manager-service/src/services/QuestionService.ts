import axios from 'axios';
import { IActiveSession } from '../models/ActiveSession';
import { logger } from '../utils/logger';

interface Question {
  _id: string;
  type: string;
  competency: string;
  level: string;
  difficulty: number;
  content: any;
  points: number;
  timeLimit?: number;
}

interface QuestionSection {
  section: string;
  competency: string;
  duration: number;
  questionCount: number;
  weight: number;
  questions: Question[];
}

interface QuestionGenerationSettings {
  randomizeQuestions: boolean;
  randomizeOptions: boolean;
  maxAttempts: number;
}

export class QuestionService {
  private examServiceUrl: string;

  constructor() {
    this.examServiceUrl = process.env.EXAM_SERVICE_URL || 'http://exam-service:3003';
  }

  /**
   * Generar preguntas para un estudiante específico
   */
  async generateQuestionsForStudent(
    examId: string,
    studentId: string,
    settings: QuestionGenerationSettings,
    authToken?: string
  ): Promise<QuestionSection[]> {
    try {
      const response = await axios.post(
        `${this.examServiceUrl}/api/v1/exams/${examId}/generate-questions`,
        {
          candidateId: studentId,
          randomize: settings.randomizeQuestions,
          randomizeOptions: settings.randomizeOptions
        },
        {
          timeout: 10000,
          headers: {
            'Content-Type': 'application/json',
            'X-Service': 'session-manager',
            ...(authToken && { 'Authorization': `Bearer ${authToken}` })
          }
        }
      );

      if (!response.data.success) {
        throw new Error(response.data.message || 'Error generando preguntas');
      }

      // Mantener la estructura por secciones para el frontend
      const sections = response.data.data;
      if (!sections || !Array.isArray(sections)) {
        throw new Error('Formato de respuesta inválido: no se encontraron secciones');
      }
      
      // Validar cada sección
      const validSections = sections.filter((section: any) => {
        if (!section.questions || !Array.isArray(section.questions)) {
          logger.warn(`Sección ${section.section || 'unknown'} no tiene preguntas válidas`);
          return false;
        }
        return true;
      });
      
      const totalQuestions = validSections.reduce((acc, section) => acc + section.questions.length, 0);
      logger.info(`Generadas ${totalQuestions} preguntas para estudiante ${studentId} en ${validSections.length} secciones`);
      
      return validSections;

    } catch (error) {
      logger.error('Error generating questions for student:', error);
      
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNREFUSED') {
          throw new Error('Servicio de exámenes no disponible');
        }
        if (error.response?.status === 404) {
          throw new Error('Examen no encontrado');
        }
        if (error.response?.status === 400) {
          throw new Error(error.response.data?.message || 'Datos inválidos');
        }
      }
      
      throw new Error('Error interno generando preguntas');
    }
  }

  /**
   * Obtener siguiente pregunta para un estudiante
   */
  async getNextQuestionForStudent(session: IActiveSession, studentId: string, authToken?: string): Promise<Question | null> {
    try {
      const participantStatus = session.participants.status.get(studentId);
      const candidateQuestions = session.questions.questionsPerCandidate.get(studentId);

      if (!participantStatus || !candidateQuestions) {
        return null;
      }

      // Encontrar la siguiente pregunta no respondida
      const answeredQuestions = participantStatus.answeredQuestions;
      const nextQuestionId = candidateQuestions.find(qId => !answeredQuestions.includes(qId));

      if (!nextQuestionId) {
        return null; // No hay más preguntas
      }

      // Obtener datos completos de la pregunta
      const question = await this.getQuestionById(nextQuestionId, authToken);
      return question;

    } catch (error) {
      logger.error('Error getting next question for student:', error);
      return null;
    }
  }

  /**
   * Obtener pregunta por ID
   */
  async getQuestionById(questionId: string, authToken?: string): Promise<Question | null> {
    try {
      const response = await axios.get(
        `${this.examServiceUrl}/api/v1/questions/${questionId}`,
        {
          timeout: 5000,
          headers: {
            'X-Service': 'session-manager',
            ...(authToken && { 'Authorization': `Bearer ${authToken}` })
          }
        }
      );

      if (!response.data.success) {
        throw new Error(response.data.message || 'Error obteniendo pregunta');
      }

      return response.data.question;

    } catch (error) {
      logger.error(`Error getting question ${questionId}:`, error);
      
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          logger.warn(`Pregunta ${questionId} no encontrada`);
          return null;
        }
      }
      
      throw error;
    }
  }

  /**
   * Verificar si una pregunta requiere procesamiento especial
   */
  requiresSpecialProcessing(question: Question): boolean {
    return question.type === 'speaking' || question.type === 'open_text';
  }

  /**
   * Obtener tiempo límite para una pregunta
   */
  getQuestionTimeLimit(question: Question): number {
    // Tiempo por defecto según tipo de pregunta (en segundos)
    const defaultTimes = {
      'multiple_choice': 60,
      'listening': 180,
      'speaking': 120,
      'open_text': 300,
      'reading': 180
    };

    return question.timeLimit || defaultTimes[question.type as keyof typeof defaultTimes] || 120;
  }

  /**
   * Obtener estadísticas de preguntas de una sesión
   */
  getQuestionStats(session: IActiveSession): any {
    const responses = session.questions.responses;
    const questionStats: Record<string, {
      questionId: string;
      totalResponses: number;
      correctResponses: number;
      averageTime: number;
      difficulty: number;
    }> = {};

    // Agrupar respuestas por pregunta
    responses.forEach(response => {
      if (!questionStats[response.questionId]) {
        questionStats[response.questionId] = {
          questionId: response.questionId,
          totalResponses: 0,
          correctResponses: 0,
          averageTime: 0,
          difficulty: 0
        };
      }

      const stats = questionStats[response.questionId];
      stats.totalResponses += 1;
      stats.averageTime += response.timeSpent;
      
      if (response.evaluation?.isCorrect) {
        stats.correctResponses += 1;
      }
    });

    // Calcular promedios y dificultad
    Object.values(questionStats).forEach(stats => {
      if (stats.totalResponses > 0) {
        stats.averageTime = Math.round(stats.averageTime / stats.totalResponses);
        const successRate = stats.correctResponses / stats.totalResponses;
        stats.difficulty = Math.round((1 - successRate) * 100); // 0-100, mayor número = más difícil
      }
    });

    return questionStats;
  }
}
