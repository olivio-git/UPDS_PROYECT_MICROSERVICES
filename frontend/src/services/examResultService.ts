import { api } from './api.service';

export interface ExamResultSummary {
  id: string;
  examName: string;
  date: string;
  score: number;
  level: string;
  status: 'partial' | 'completed' | 'pending_ai_review';
  competencies: {
    reading?: number;
    writing?: number;
    listening?: number;
    speaking?: number;
    [key: string]: number | undefined;
  };
  duration: number;
  timeAllowed: number;
  totalQuestions: number;
}

export interface DetailedExamResult {
  id: string;
  examName: string;
  date: string;
  score: number;
  level: string;
  status: string;
  competencies: Record<string, number>;
  duration: number;
  timeAllowed: number;
  totalQuestions: number;
  details: {
    totalScore: number;
    maxScore: number;
    percentage: number;
    questionResults: Array<{
      questionId: string;
      questionType: string;
      competency: string;
      response: any;
      isCorrect?: boolean;
      score: number;
      maxScore: number;
      feedback?: string;
      evaluationMethod: 'automatic' | 'ai_grading' | 'manual';
    }>;
    competencyScores: Array<{
      competency: string;
      totalScore: number;
      maxScore: number;
      percentage: number;
      questionCount: number;
      autoEvaluatedCount: number;
      aiEvaluatedCount: number;
      pendingEvaluationCount: number;
    }>;
  };
}

export interface RecentResultsResponse {
  recentResults: ExamResultSummary[];
  totalResults: number;
}

export interface EvaluationStats {
  totalEvaluations: number;
  averageScore: number;
  improvementRate: number;
  currentLevel: string;
  averageTimePerEvaluation: number; // in seconds
  competencyAverages: {
    reading?: number;
    writing?: number;
    listening?: number;
    speaking?: number;
    [key: string]: number | undefined;
  };
  lastEvaluationDate: string | null;
  evaluationFrequency: number; // evaluations per month
}

export interface StudentExamResult {
  id: string;
  examName: string;
  examType: 'placement' | 'progress' | 'final' | 'practice';
  date: string;
  duration: number; // in minutes
  level: string;
  overallScore: number;
  passed: boolean;
  competencies: {
    listening?: { score: number; feedback: string };
    reading?: { score: number; feedback: string };
    writing?: { score: number; feedback: string };
    speaking?: { score: number; feedback: string };
    [key: string]: { score: number; feedback: string } | undefined;
  };
  feedback: string;
  recommendations: string[];
  nextLevel?: string;
  status: 'partial' | 'completed' | 'pending_ai_review';
}

export interface StudentResultsListResponse {
  results: StudentExamResult[];
  totalResults: number;
  averageScore: number;
  progressTrend: number;
}

class ExamResultService {
  /**
   * Get recent exam results for the current user
   */
  async getMyRecentResults(limit: number = 10): Promise<RecentResultsResponse> {
    try {
      const response = await api.get('/api/v1/exam-results/my-recent', {
        params: { limit }
      }) as { data: RecentResultsResponse, success: boolean };

      if (response.success) {
        return response.data;
      } else {
        throw new Error('Failed to fetch results');
      }
    } catch (error: any) {
      console.error('Error fetching recent results:', error);
      throw new Error(error.response?.data?.message || 'Failed to fetch recent results');
    }
  }

  /**
   * Get detailed exam result by ID
   */
  async getResultDetails(resultId: string): Promise<DetailedExamResult> {
    try {
      const response = await api.get(`/api/v1/exam-results/${resultId}`) as { data: { success: boolean; data: DetailedExamResult; message?: string } };

      if (response.data.success) {
        return response.data.data;
      } else {
        throw new Error(response.data.message || 'Failed to fetch result details');
      }
    } catch (error: any) {
      console.error('Error fetching result details:', error);
      throw new Error(error.response?.data?.message || 'Failed to fetch result details');
    }
  }

  /**
   * Get exam result by attempt ID
   */
  async getResultByAttempt(attemptId: string): Promise<DetailedExamResult> {
    try {
      const response = await api.get(`/api/v1/exam-results/attempt/${attemptId}`) as { success: boolean; data: DetailedExamResult; message?: string };

      if (response.success) {
        return response.data;
      } else {
        throw new Error(response.message || 'Result not found. The exam may still be processing.');
      }
    } catch (error: any) {
      console.error('Error fetching result by attempt:', error);

      // Handle specific error cases
      if (error.response?.status === 404) {
        throw new Error('Los resultados aún se están procesando. Intenta de nuevo en unos minutos.');
      }

      throw new Error(error.response?.data?.message || 'Failed to fetch exam result');
    }
  }

  /**
   * Poll for exam result by attempt ID (useful for waiting for AI evaluation)
   */
  async pollForResult(attemptId: string, maxAttempts: number = 30, intervalMs: number = 2000): Promise<DetailedExamResult> {
    let attempts = 0;

    const poll = async (): Promise<DetailedExamResult> => {
      attempts++;

      try {
        const result = await this.getResultByAttempt(attemptId);

        // If result is found and fully evaluated, return it
        if (result.status === 'completed') {
          return result;
        }

        // If still pending AI review and we haven't reached max attempts, continue polling
        if (result.status === 'pending_ai_review' && attempts < maxAttempts) {
          console.log(`⏳ Result still pending AI evaluation, attempt ${attempts}/${maxAttempts}`);
          await new Promise(resolve => setTimeout(resolve, intervalMs));
          return poll();
        }

        // Return partial result if max attempts reached
        return result;

      } catch (error: any) {
        if (attempts < maxAttempts) {
          console.log(`⏳ Result not ready yet, attempt ${attempts}/${maxAttempts}`);
          await new Promise(resolve => setTimeout(resolve, intervalMs));
          return poll();
        } else {
          throw error;
        }
      }
    };

    return poll();
  }

  /**
   * Get evaluation statistics for the current user
   */
  async getMyEvaluationStats(): Promise<EvaluationStats> {
    try {
      const response = 
      await api.get('/api/v1/exam-results/my-stats') as 
      { data: EvaluationStats; message?: string ,success: boolean };
      console.log(response,'response');
      if (response.success) {
        return response.data;
      } else {
        throw new Error('Failed to fetch evaluation statistics');
      }
    } catch (error: any) {
      console.error('Error fetching evaluation stats:', error);
      throw new Error(error.response?.data?.message || 'Failed to fetch evaluation statistics');
    }
  }

  /**
   * Get all exam results for student results page
   */
  async getStudentResults(filters?: {
    level?: string;
    period?: string;
    limit?: number;
  }): Promise<StudentResultsListResponse> {
    try {
      const params: any = {};
      if (filters?.limit) params.limit = filters.limit;

      const response = await api.get('/api/v1/exam-results/my-recent', { params }) as
        { data: RecentResultsResponse, success: boolean };

      if (response.success) {
        const backendResults = response.data.recentResults;

        // Transform backend data to frontend format
        const results: StudentExamResult[] = backendResults
          .filter(result => {
            // Apply frontend filters
            if (filters?.level && filters.level !== 'all' && result.level !== filters.level) {
              return false;
            }
            if (filters?.period && filters.period === 'recent') {
              const resultDate = new Date(result.date);
              const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
              return resultDate > thirtyDaysAgo;
            }
            return true;
          })
          .map(result => this.transformToStudentResult(result));

        // Calculate metrics
        const averageScore = results.length > 0
          ? Math.round(results.reduce((sum, r) => sum + r.overallScore, 0) / results.length)
          : 0;

        const progressTrend = this.calculateProgressTrend(results);

        return {
          results,
          totalResults: results.length,
          averageScore,
          progressTrend
        };
      } else {
        throw new Error( 'Failed to fetch student results');
      }
    } catch (error: any) {
      console.error('Error fetching student results:', error);
      throw new Error(error.response?.data?.message || 'Failed to fetch student results');
    }
  }

  /**
   * Get detailed exam result by ID
   */
  async getStudentResultDetail(resultId: string): Promise<StudentExamResult> {
    try {
      const response = await api.get(`/api/v1/exam-results/${resultId}`) as
        { data: DetailedExamResult, success: boolean };
      console.log(response,'response in getStudentResultDetail');
      if (response.success) {
        return this.transformDetailedToStudentResult(response.data);
      } else {
        throw new Error( 'Failed to fetch result details');
      }
    } catch (error: any) {
      console.error('Error fetching result details:', error);
      throw new Error(error.response?.data?.message || 'Failed to fetch result details');
    }
  }

  /**
   * Transform backend ExamResultSummary to StudentExamResult
   */
  private transformToStudentResult(backendResult: ExamResultSummary): StudentExamResult {
    return {
      id: backendResult.id,
      examName: backendResult.examName,
      examType: this.inferExamType(backendResult.examName),
      date: backendResult.date,
      duration: Math.round(backendResult.duration / 60), // Convert seconds to minutes
      level: backendResult.level,
      overallScore: backendResult.score,
      passed: backendResult.score >= 60, // Assuming 60% is passing
      competencies: this.transformCompetencies(backendResult.competencies),
      feedback: 'Análisis detallado disponible en la vista completa', // Placeholder
      recommendations: [], // Will be filled in detail view
      nextLevel: this.calculateNextLevel(backendResult.level, backendResult.score),
      status: backendResult.status as 'partial' | 'completed' | 'pending_ai_review'
    };
  }

  /**
   * Transform backend DetailedExamResult to StudentExamResult
   */
  private transformDetailedToStudentResult(backendResult: any): StudentExamResult {
    return {
      id: backendResult._id,
      examName: backendResult.examName,
      examType: this.inferExamType(backendResult.examName),
      date: backendResult.evaluatedAt,
      duration: Math.round(backendResult.examDuration / 60),
      level: backendResult.examLevel,
      overallScore: backendResult.percentage,
      passed: backendResult.percentage >= 60,
      competencies: this.transformDetailedCompetencies(backendResult),
      feedback: backendResult.overallFeedback || this.generateFeedback({
        score: backendResult.percentage,
        level: backendResult.examLevel,
        status: backendResult.status
      }),
      recommendations: (backendResult.recommendations && backendResult.recommendations.length > 0)
        ? backendResult.recommendations
        : this.generateRecommendations({
            score: backendResult.percentage,
            level: backendResult.examLevel,
            status: backendResult.status
          }),
      nextLevel: this.calculateNextLevel(backendResult.examLevel, backendResult.percentage),
      status: backendResult.status as 'partial' | 'completed' | 'pending_ai_review'
    };
  }

  /**
   * Transform competencies with placeholder feedback
   */
  private transformCompetencies(competencies: Record<string, number | undefined>):
    Record<string, { score: number; feedback: string }> {
    const result: Record<string, { score: number; feedback: string }> = {};

    Object.entries(competencies).forEach(([key, score]) => {
      if (score !== undefined) {
        result[key] = {
          score,
          feedback: this.generateCompetencyFeedback(key, score)
        };
      }
    });

    return result;
  }

  /**
   * Transform detailed competencies with AI feedback
   */
  private transformDetailedCompetencies(backendResult: any):
    Record<string, { score: number; feedback: string }> {
    const result: Record<string, { score: number; feedback: string }> = {};
    const aiCompFeedback: Record<string, string> = backendResult.competencyFeedback || {};

    if (backendResult.competencyScores) {
      backendResult.competencyScores.forEach((comp: any) => {
        result[comp.competency] = {
          score: comp.percentage,
          feedback: aiCompFeedback[comp.competency] || this.generateCompetencyFeedback(comp.competency, comp.percentage)
        };
      });
    }

    return result;
  }

  /**
   * Generate competency-specific feedback
   */
  private generateCompetencyFeedback(competency: string, score: number): string {
    const competencyNames: Record<string, string> = {
      reading: 'Comprensión Lectora',
      writing: 'Expresión Escrita',
      listening: 'Comprensión Auditiva',
      speaking: 'Expresión Oral'
    };

    const competencyName = competencyNames[competency] || competency;

    if (score >= 85) {
      return `Excelente desempeño en ${competencyName}. Continúa practicando para mantener este nivel.`;
    } else if (score >= 70) {
      return `Buen nivel en ${competencyName}. Considera practicar aspectos más avanzados.`;
    } else if (score >= 60) {
      return `Nivel aceptable en ${competencyName}. Recomendamos práctica adicional para mejorar.`;
    } else {
      return `${competencyName} necesita más práctica. Considera estudiar los fundamentos.`;
    }
  }

  /**
   * Generate overall feedback based on performance
   * Uses AI feedback if available, otherwise generates standard feedback
   */
  private generateFeedback(result: {score: number; level: string; status: string}): string {
    if (result.score >= 85) {
      return `Excelente desempeño. Has demostrado un dominio sólido del nivel ${result.level}. Estás listo para avanzar al siguiente nivel.`;
    } else if (result.score >= 70) {
      return `Buen progreso en el nivel ${result.level}. Con un poco más de práctica, estarás listo para el siguiente nivel.`;
    } else if (result.score >= 60) {
      return `Has alcanzado el nivel mínimo para aprobar. Recomendamos reforzar las áreas más débiles antes de avanzar.`;
    } else {
      return `Necesitas más práctica en este nivel. Revisa las recomendaciones específicas para cada competencia.`;
    }
  }

  /**
   * Generate recommendations based on performance
   * Uses AI recommendations if available, otherwise generates standard recommendations
   */
  private generateRecommendations(result: {score: number; level: string; status: string}): string[] {
    const recommendations: string[] = [];

    // Basic recommendations based on overall score
    if (result.score < 60) {
      recommendations.push('Dedica más tiempo al estudio y práctica diaria');
      recommendations.push('Considera tomar clases de refuerzo');
    } else if (result.score < 70) {
      recommendations.push('Repasa las áreas más débiles identificadas');
      recommendations.push('Practica ejercicios adicionales');
    } else if (result.score < 85) {
      recommendations.push('Continúa practicando para perfeccionar tus habilidades');
      recommendations.push(`Considera prepararte para evaluaciones de nivel ${this.calculateNextLevel(result.level, result.score)}`);
    } else {
      recommendations.push(`¡Excelente trabajo! Estás listo para avanzar al nivel ${this.calculateNextLevel(result.level, result.score)}`);
      recommendations.push('Mantén tu práctica regular');
    }

    return recommendations;
  }

  /**
   * Infer exam type from exam name
   */
  private inferExamType(examName: string): 'placement' | 'progress' | 'final' | 'practice' {
    const name = examName.toLowerCase();
    if (name.includes('ubicación') || name.includes('placement')) return 'placement';
    if (name.includes('final')) return 'final';
    if (name.includes('práctica') || name.includes('practice')) return 'practice';
    return 'progress';
  }

  /**
   * Calculate next level based on current performance
   */
  private calculateNextLevel(currentLevel: string, score: number): string | undefined {
    if (score < 70) return undefined;

    const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
    const currentIndex = levels.indexOf(currentLevel);

    if (currentIndex >= 0 && currentIndex < levels.length - 1) {
      return levels[currentIndex + 1];
    }

    return undefined;
  }

  /**
   * Calculate progress trend
   */
  private calculateProgressTrend(results: StudentExamResult[]): number {
    if (results.length < 2) return 0;

    // Results are ordered by date desc, so [0] is latest, [1] is previous
    const latest = results[0].overallScore;
    const previous = results[1].overallScore;

    return latest - previous;
  }

  /**
   * Format date for display
   */
  formatDate(dateString: string): string {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  }

  /**
   * Format duration in seconds to readable format
   */
  formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  }

  /**
   * Get score color based on percentage
   */
  getScoreColor(score: number): string {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    return 'text-red-500';
  }

  /**
   * Get competency display name
   */
  getCompetencyName(competency: string): string {
    const names: Record<string, string> = {
      reading: 'Comprensión Lectora',
      writing: 'Expresión Escrita',
      listening: 'Comprensión Auditiva',
      speaking: 'Expresión Oral',
      grammar: 'Gramática',
      vocabulary: 'Vocabulario',
      general: 'General'
    };

    return names[competency] || competency.charAt(0).toUpperCase() + competency.slice(1);
  }

  async downloadResultPDF(
    resultId: string,
    options: { includeQuestions?: boolean; includeAI?: boolean; language?: 'spanish' | 'english'; examName?: string } = {}
  ): Promise<void> {
    const { includeQuestions = true, includeAI = true, language = 'spanish', examName } = options;
    const resp = await api.get(`/api/v1/exam-results/${resultId}/export-pdf`, {
      params: { includeQuestions, includeAI, language },
      responseType: 'blob'
    }) as any;
    const blob = resp instanceof Blob ? resp : resp.data;
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `resultado-examen-${(examName ?? resultId).replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

  /**
   * Get status display info
   */
  getStatusInfo(status: string): { text: string; color: string; icon: string } {
    switch (status) {
      case 'completed':
        return { text: 'Completado', color: 'text-green-500', icon: '✓' };
      case 'pending_ai_review':
        return { text: 'Evaluando con IA', color: 'text-blue-500', icon: '⏳' };
      case 'partial':
        return { text: 'Evaluación Parcial', color: 'text-yellow-500', icon: '⚠️' };
      default:
        return { text: 'Desconocido', color: 'text-gray-500', icon: '?' };
    }
  }
}

export const examResultService = new ExamResultService();