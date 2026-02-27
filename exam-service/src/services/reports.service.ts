import type { PipelineStage } from 'mongoose';
import { cache } from '../config/redis';
import { ExamResult } from '../models/examResult.model';
import { Session } from '../models/session.model';
import { logger } from '../utils/logger';

// Interfaces para los reportes
export interface CompetencyAnalysisReport {
  competencyBreakdown: Record<string, {
    averageScore: number;
    difficulty: 'easy' | 'medium' | 'hard';
    questionCount: number;
    studentsEvaluated: number;
    studentPerformance: {
      excellent: number;    // >85%
      good: number;         // 70-85%
      acceptable: number;   // 60-70%
      needsWork: number;    // <60%
    };
    trendsOverTime: Array<{
      period: string;
      averageScore: number;
      studentsCount: number;
    }>;
    topQuestions: Array<{
      questionId: string;
      averageScore: number;
      responseCount: number;
    }>;
    challengingQuestions: Array<{
      questionId: string;
      averageScore: number;
      responseCount: number;
    }>;
  }>;
  recommendations: string[];
  comparativeAnalysis: {
    bestPerforming: string;
    mostChallenging: string;
    improvementAreas: string[];
  };
  overallStats: {
    totalStudents: number;
    totalExams: number;
    averageOverallScore: number;
    completionRate: number;
  };
}

export interface StudentHistoryReport {
  studentId: string;
  studentInfo: {
    name: string;
    email: string;
    registrationDate: Date;
  };
  examHistory: Array<{
    examId: string;
    examTitle: string;
    sessionId: string;
    sessionName: string;
    completedAt: Date;
    finalScore: number;
    maxScore: number;
    percentage: number;
    level: string;
    status: string;
    timeSpent: number; // minutes
    competencyScores: Array<{
      competency: string;
      score: number;
      maxScore: number;
      percentage: number;
    }>;
    feedback: string;
  }>;
  summary: {
    totalExams: number;
    averageScore: number;
    bestScore: number;
    worstScore: number;
    totalTimeSpent: number; // minutes
    mostRecentExam: Date;
    oldestExam: Date;
  };
  competencyProgress: Record<string, {
    currentLevel: string;
    averageScore: number;
    examsCount: number;
    progression: Array<{
      examDate: Date;
      score: number;
      level: string;
    }>;
    trend: 'improving' | 'stable' | 'declining';
  }>;
  recommendations: string[];
}

export interface UpcomingSessionsReport {
  totalUpcomingSessions: number;
  sessionsThisWeek: number;
  sessionsNextWeek: number;
  upcomingSessions: Array<{
    sessionId: string;
    sessionName: string;
    examTitle: string;
    examId: string;
    startDate: Date;
    endDate: Date;
    status: string;
    totalSlots: number;
    registeredCandidates: number;
    maxCandidates: number;
    availableSlots: number;
    proctorsAssigned: number;
    timeSlots: Array<{
      date: Date;
      startTime: string;
      endTime: string;
      capacity: number;
      enrolled: number;
      available: number;
    }>;
    settings: {
      requireProctor: boolean;
      allowLateEntry: boolean;
      lateEntryMinutes: number;
    };
  }>;
  proctorWorkload: Array<{
    proctorId: string;
    proctorName: string;
    assignedSessions: number;
    upcomingHours: number;
  }>;
  summary: {
    totalCandidatesRegistered: number;
    averageCapacityUtilization: number;
    sessionsNeedingProctors: number;
  };
}

export interface StudentStatsReport {
  totalStudents: number;
  evaluatedStudents: number;
  averageScore: number;
  levelDistribution: Record<string, {
    count: number;
    averageScore: number;
    passRate: number;
  }>;
  competencyPerformance: Record<string, {
    average: number;
    studentsCount: number;
    passRate: number;
    improvement: number; // % de mejora respecto al período anterior
  }>;
  progressionAnalysis: {
    studentsProgressed: number;
    progressionRate: number;
    levelTransitions: Record<string, Record<string, number>>; // from -> to -> count
  };
  timeAnalysis: {
    averageDuration: number;
    timeEfficiency: number;
    fastestCompletions: Array<{
      candidateId: string;
      duration: number;
      score: number;
    }>;
    slowestCompletions: Array<{
      candidateId: string;
      duration: number;
      score: number;
    }>;
  };
  performanceDistribution: {
    excellent: number;    // >85%
    good: number;         // 70-85%
    acceptable: number;   // 60-70%
    needsImprovement: number; // <60%
  };
  topPerformers: Array<{
    candidateId: string;
    averageScore: number;
    examsCompleted: number;
    currentLevel: string;
  }>;
  strugglingStudents: Array<{
    candidateId: string;
    averageScore: number;
    examsCompleted: number;
    weakCompetencies: string[];
  }>;
}

export interface ReportFilters {
  dateRange?: {
    start: Date;
    end: Date;
  };
  levels?: string[];
  competencies?: string[];
  examTypes?: string[];
  candidateIds?: string[];
  minScore?: number;
  maxScore?: number;
  status?: string[];
}

export class ReportsService {

  /**
   * Generar análisis detallado por competencia
   */
  async getCompetencyAnalysis(filters: ReportFilters = {}): Promise<CompetencyAnalysisReport> {
    try {
      const cacheKey = `competency_analysis:${JSON.stringify(filters)}`;
      const cached = await cache.get(cacheKey);
      if (cached) {
        return cached;
      }
      // Pipeline para obtener datos por competencia
            const competencyPipeline: PipelineStage[] = [
              {
                $match: this.buildMatchStage(filters)
              },
              {
                $unwind: '$competencyScores'
              },
              {
                $group: {
                  _id: '$competencyScores.competency',
                  totalScore: { $sum: '$competencyScores.totalScore' },
                  maxScore: { $sum: '$competencyScores.maxScore' },
                  studentsCount: { $sum: 1 },
                  scores: { $push: '$competencyScores.percentage' },
                  questionCounts: { $push: '$competencyScores.questionCount' },
                  examDates: { $push: '$evaluatedAt' },
                  examLevels: { $push: '$examLevel' }
                }
              },
              {
                $addFields: {
                  averageScore: { $divide: ['$totalScore', '$maxScore'] },
                  averagePercentage: { $avg: '$scores' }
                }
              },
              {
                $sort: { averagePercentage: -1 }
              }
            ];
      
            const competencyData = await ExamResult.aggregate(competencyPipeline);

      // Construir el reporte
      const competencyBreakdown: Record<string, any> = {};
      const competencies = ['reading', 'writing', 'listening', 'speaking', 'grammar', 'vocabulary'];

      for (const comp of competencies) {
        const data = competencyData.find(item => item._id === comp);

        if (data) {
          // Calcular distribución de performance
          const excellent = data.scores.filter((s: number) => s >= 85).length;
          const good = data.scores.filter((s: number) => s >= 70 && s < 85).length;
          const acceptable = data.scores.filter((s: number) => s >= 60 && s < 70).length;
          const needsWork = data.scores.filter((s: number) => s < 60).length;

          // Calcular dificultad basada en promedio
          let difficulty: 'easy' | 'medium' | 'hard' = 'medium';
          if (data.averagePercentage >= 80) difficulty = 'easy';
          else if (data.averagePercentage < 65) difficulty = 'hard';

          // Trends over time (agrupado por mes)
          const trendsOverTime = await this.getCompetencyTrends(comp, filters);

          // Top y challenging questions
          const questionStats = await this.getQuestionStats(comp, filters);

          competencyBreakdown[comp] = {
            averageScore: Math.round(data.averagePercentage * 100) / 100,
            difficulty,
            questionCount: Math.round(data.questionCounts.reduce((a: number, b: number) => a + b, 0) / data.questionCounts.length),
            studentsEvaluated: data.studentsCount,
            studentPerformance: {
              excellent,
              good,
              acceptable,
              needsWork
            },
            trendsOverTime,
            topQuestions: questionStats.top,
            challengingQuestions: questionStats.challenging
          };
        } else {
          // Competencia sin datos
          competencyBreakdown[comp] = {
            averageScore: 0,
            difficulty: 'medium' as const,
            questionCount: 0,
            studentsEvaluated: 0,
            studentPerformance: { excellent: 0, good: 0, acceptable: 0, needsWork: 0 },
            trendsOverTime: [],
            topQuestions: [],
            challengingQuestions: []
          };
        }
      }

      // Análisis comparativo
      const sortedCompetencies = Object.entries(competencyBreakdown)
        .sort(([,a], [,b]) => b.averageScore - a.averageScore);

      const bestPerforming = sortedCompetencies[0]?.[0] || '';
      const mostChallenging = sortedCompetencies[sortedCompetencies.length - 1]?.[0] || '';

      // Generar recomendaciones
      const recommendations = this.generateCompetencyRecommendations(competencyBreakdown);

      // Estadísticas generales
      const overallStats = await this.getOverallStats(filters);

      const report: CompetencyAnalysisReport = {
        competencyBreakdown,
        recommendations,
        comparativeAnalysis: {
          bestPerforming,
          mostChallenging,
          improvementAreas: sortedCompetencies
            .filter(([,data]) => data.averageScore < 70)
            .map(([comp]) => comp)
        },
        overallStats
      };

      // Cache por 1 hora
      await cache.set(cacheKey, report, 3600);

      return report;
    } catch (error) {
      logger.error('Error generating competency analysis:', error);
      throw error;
    }
  }

  /**
   * Generar reporte de estadísticas de estudiantes
   */
  async getStudentStats(filters: ReportFilters = {}): Promise<StudentStatsReport> {
    try {
      const cacheKey = `student_stats:${JSON.stringify(filters)}`;
      const cached = await cache.get(cacheKey);
      if (cached) {
        return cached;
      }
      // Pipeline principal para estudiantes
            const studentPipeline: PipelineStage[] = [
              {
                $match: this.buildMatchStage(filters)
              },
              {
                $group: {
                  _id: '$candidateId',
                  examCount: { $sum: 1 },
                  averageScore: { $avg: '$percentage' },
                  totalScore: { $sum: '$totalScore' },
                  maxScore: { $sum: '$maxScore' },
                  averageDuration: { $avg: '$examDuration' },
                  levels: { $addToSet: '$examLevel' },
                  competencyScores: { $push: '$competencyScores' },
                  lastExamDate: { $max: '$evaluatedAt' },
                  firstExamDate: { $min: '$evaluatedAt' }
                }
              },
              {
                $addFields: {
                  currentLevel: { $arrayElemAt: ['$levels', -1] }
                }
              }
            ];
      
            const studentData = await ExamResult.aggregate(studentPipeline); 

      // Distribución por nivel
      const levelDistribution = await this.getLevelDistribution(filters);

      // Performance por competencia
      const competencyPerformance = await this.getCompetencyPerformance(filters);

      // Análisis de progresión
      const progressionAnalysis = await this.getProgressionAnalysis(filters);

      // Análisis de tiempo
      const timeAnalysis = await this.getTimeAnalysis(filters);

      // Distribución de performance
      const performanceDistribution = {
        excellent: studentData.filter(s => s.averageScore >= 85).length,
        good: studentData.filter(s => s.averageScore >= 70 && s.averageScore < 85).length,
        acceptable: studentData.filter(s => s.averageScore >= 60 && s.averageScore < 70).length,
        needsImprovement: studentData.filter(s => s.averageScore < 60).length
      };

      // Top performers
      const topPerformers = studentData
        .sort((a, b) => b.averageScore - a.averageScore)
        .slice(0, 10)
        .map(student => ({
          candidateId: student._id.toString(),
          averageScore: Math.round(student.averageScore * 100) / 100,
          examsCompleted: student.examCount,
          currentLevel: student.currentLevel || 'N/A'
        }));

      // Estudiantes con dificultades
      const strugglingStudents = await this.getStrugglingStudents(filters);

      const report: StudentStatsReport = {
        totalStudents: await this.getTotalStudentsCount(filters),
        evaluatedStudents: studentData.length,
        averageScore: Math.round((studentData.reduce((sum, s) => sum + s.averageScore, 0) / studentData.length) * 100) / 100 || 0,
        levelDistribution,
        competencyPerformance,
        progressionAnalysis,
        timeAnalysis,
        performanceDistribution,
        topPerformers,
        strugglingStudents
      };

      // Cache por 1 hora
      await cache.set(cacheKey, report, 3600);

      return report;
    } catch (error) {
      logger.error('Error generating student stats:', error);
      throw error;
    }
  }

  /**
   * Exportar reporte a CSV
   */
  async exportToCSV(reportType: 'competency' | 'students', filters: ReportFilters = {}): Promise<string> {
    try {
      let csvContent = '';

      if (reportType === 'competency') {
        const report = await this.getCompetencyAnalysis(filters);
        csvContent = this.formatCompetencyReportToCSV(report);
      } else {
        const report = await this.getStudentStats(filters);
        csvContent = this.formatStudentReportToCSV(report);
      }

      return csvContent;
    } catch (error) {
      logger.error('Error exporting to CSV:', error);
      throw error;
    }
  }

  // ================== MÉTODOS AUXILIARES ==================

  private buildMatchStage(filters: ReportFilters): any {
    const match: any = {
      status: 'completed'
    };

    if (filters.dateRange) {
      match.evaluatedAt = {
        $gte: filters.dateRange.start,
        $lte: filters.dateRange.end
      };
    }

    if (filters.levels && filters.levels.length > 0) {
      match.examLevel = { $in: filters.levels };
    }

    if (filters.candidateIds && filters.candidateIds.length > 0) {
      match.candidateId = { $in: filters.candidateIds.map(id => id) };
    }

    if (filters.minScore !== undefined || filters.maxScore !== undefined) {
      match.percentage = {};
      if (filters.minScore !== undefined) match.percentage.$gte = filters.minScore;
      if (filters.maxScore !== undefined) match.percentage.$lte = filters.maxScore;
    }

    return match;
  }
  private async getCompetencyTrends(competency: string, filters: ReportFilters): Promise<Array<{period: string, averageScore: number, studentsCount: number}>> {
    const pipeline: PipelineStage[] = [
      {
        $match: {
          ...this.buildMatchStage(filters),
          'competencyScores.competency': competency
        }
      },
      {
        $unwind: '$competencyScores'
      },
      {
        $match: {
          'competencyScores.competency': competency
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$evaluatedAt' },
            month: { $month: '$evaluatedAt' }
          },
          averageScore: { $avg: '$competencyScores.percentage' },
          studentsCount: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
      },
      {
        $limit: 12 // Últimos 12 períodos
      }
    ];

    const trends = await ExamResult.aggregate(pipeline); 

    return trends.map(trend => ({
      period: `${trend._id.year}-${String(trend._id.month).padStart(2, '0')}`,
      averageScore: Math.round(trend.averageScore * 100) / 100,
      studentsCount: trend.studentsCount
    }));
  }
  private async getQuestionStats(competency: string, filters: ReportFilters): Promise<{
    top: Array<{questionId: string, averageScore: number, responseCount: number}>,
    challenging: Array<{questionId: string, averageScore: number, responseCount: number}>
  }> {
    const pipeline: PipelineStage[] = [
      {
        $match: this.buildMatchStage(filters)
      },
      {
        $unwind: '$questionResults'
      },
      {
        $match: {
          'questionResults.competency': competency
        }
      },
      {
        $group: {
          _id: '$questionResults.questionId',
          averageScore: { $avg: { $divide: ['$questionResults.score', '$questionResults.maxScore'] } },
          responseCount: { $sum: 1 }
        }
      },
      {
        $match: {
          responseCount: { $gte: 3 } // Mínimo 3 respuestas para ser significativo
        }
      }
    ];

    const questionStats = await ExamResult.aggregate(pipeline); 

    const sortedByScore = questionStats.sort((a, b) => b.averageScore - a.averageScore);

    return {
      top: sortedByScore.slice(0, 5).map(q => ({
        questionId: q._id.toString(),
        averageScore: Math.round(q.averageScore * 100),
        responseCount: q.responseCount
      })),
      challenging: sortedByScore.slice(-5).reverse().map(q => ({
        questionId: q._id.toString(),
        averageScore: Math.round(q.averageScore * 100),
        responseCount: q.responseCount
      }))
    };
  }

  private generateCompetencyRecommendations(competencyBreakdown: Record<string, any>): string[] {
    const recommendations: string[] = [];

    Object.entries(competencyBreakdown).forEach(([comp, data]) => {
      if (data.averageScore < 60) {
        recommendations.push(`Implementar refuerzo intensivo para ${comp} (promedio: ${data.averageScore}%)`);
      } else if (data.averageScore < 70) {
        recommendations.push(`Revisar metodología de enseñanza para ${comp} (promedio: ${data.averageScore}%)`);
      }

      if (data.studentPerformance.needsWork > data.studentsEvaluated * 0.3) {
        recommendations.push(`Más del 30% de estudiantes necesita apoyo en ${comp}`);
      }
    });

    if (recommendations.length === 0) {
      recommendations.push('El rendimiento general es satisfactorio. Mantener estándares actuales.');
    }

    return recommendations;
  }
  private async getOverallStats(filters: ReportFilters): Promise<any> {
    const totalExams = await ExamResult.countDocuments(this.buildMatchStage(filters));
    const uniqueStudents = await ExamResult.distinct('candidateId', this.buildMatchStage(filters));

    const avgScorePipeline: PipelineStage[] = [
      { $match: this.buildMatchStage(filters) },
      { $group: { _id: null, averageScore: { $avg: '$percentage' } } }
    ];

    const avgResult = await ExamResult.aggregate(avgScorePipeline); 
    const averageOverallScore = avgResult[0]?.averageScore || 0;

    return {
      totalStudents: uniqueStudents.length,
      totalExams,
      averageOverallScore: Math.round(averageOverallScore * 100) / 100,
      completionRate: totalExams > 0 ? 100 : 0 // Se puede mejorar con datos de intentos
    };
  }
  private async getLevelDistribution(filters: ReportFilters): Promise<Record<string, any>> {
    const pipeline: PipelineStage[] = [
      { $match: this.buildMatchStage(filters) },
      {
        $group: {
          _id: '$examLevel',
          count: { $sum: 1 },
          averageScore: { $avg: '$percentage' },
          passCount: {
            $sum: { $cond: [{ $gte: ['$percentage', 70] }, 1, 0] }
          }
        }
      }
    ];

    const levelData = await ExamResult.aggregate(pipeline); 
    const distribution: Record<string, any> = {};

    levelData.forEach(level => {
      distribution[level._id] = {
        count: level.count,
        averageScore: Math.round(level.averageScore * 100) / 100,
        passRate: Math.round((level.passCount / level.count) * 100)
      };
    });

    return distribution;
  }
  private async getCompetencyPerformance(filters: ReportFilters): Promise<Record<string, any>> {
    const pipeline: PipelineStage[] = [
      { $match: this.buildMatchStage(filters) },
      { $unwind: '$competencyScores' },
      {
        $group: {
          _id: '$competencyScores.competency',
          average: { $avg: '$competencyScores.percentage' },
          studentsCount: { $sum: 1 },
          passCount: {
            $sum: { $cond: [{ $gte: ['$competencyScores.percentage', 70] }, 1, 0] }
          }
        }
      }
    ];

    const competencyData = await ExamResult.aggregate(pipeline); 
    const performance: Record<string, any> = {};

    competencyData.forEach(comp => {
      performance[comp._id] = {
        average: Math.round(comp.average * 100) / 100,
        studentsCount: comp.studentsCount,
        passRate: Math.round((comp.passCount / comp.studentsCount) * 100),
        improvement: 0 // Se puede calcular comparando con período anterior
      };
    });

    return performance;
  }

  private async getProgressionAnalysis(filters: ReportFilters): Promise<any> {
    // Análisis simplificado - se puede expandir con más lógica
    return {
      studentsProgressed: 0,
      progressionRate: 0,
      levelTransitions: {}
    };
  }
  private async getTimeAnalysis(filters: ReportFilters): Promise<any> {
    const pipeline: PipelineStage[] = [
      { $match: this.buildMatchStage(filters) },
      {
        $group: {
          _id: null,
          averageDuration: { $avg: '$examDuration' },
          avgTimeAllowed: { $avg: '$timeAllowed' },
          durations: { $push: { candidateId: '$candidateId', duration: '$examDuration', score: '$percentage' } }
        }
      }
    ];

    const timeData = await ExamResult.aggregate(pipeline); 
    const data = timeData[0];

    if (!data) {
      return {
        averageDuration: 0,
        timeEfficiency: 0,
        fastestCompletions: [],
        slowestCompletions: []
      };
    }

    const sortedByTime = data.durations.sort((a: any, b: any) => a.duration - b.duration);

    return {
      averageDuration: Math.round(data.averageDuration / 60), // en minutos
      timeEfficiency: Math.round((data.averageDuration / data.avgTimeAllowed) * 100),
      fastestCompletions: sortedByTime.slice(0, 5).map((item: any) => ({
        candidateId: item.candidateId.toString(),
        duration: Math.round(item.duration / 60),
        score: Math.round(item.score * 100) / 100
      })),
      slowestCompletions: sortedByTime.slice(-5).reverse().map((item: any) => ({
        candidateId: item.candidateId.toString(),
        duration: Math.round(item.duration / 60),
        score: Math.round(item.score * 100) / 100
      }))
    };
  }
  private async getStrugglingStudents(filters: ReportFilters): Promise<any[]> {
    const pipeline: PipelineStage[] = [
      { $match: this.buildMatchStage(filters) },
      {
        $group: {
          _id: '$candidateId',
          averageScore: { $avg: '$percentage' },
          examsCompleted: { $sum: 1 },
          competencyScores: { $push: '$competencyScores' }
        }
      },
      {
        $match: {
          averageScore: { $lt: 70 } // Estudiantes con promedio menor a 70%
        }
      },
      {
        $sort: { averageScore: 1 }
      },
      {
        $limit: 10
      }
    ];

    const strugglingData = await ExamResult.aggregate(pipeline); 

    return strugglingData.map(student => {
      // Identificar competencias débiles
      const allCompetencies = student.competencyScores.flat();
      const competencyAvgs: Record<string, number[]> = {};

      allCompetencies.forEach((comp: any) => {
        const key: string | undefined = comp?.competency;
        const percentage: number | undefined = comp?.percentage;
        if (!key || typeof percentage !== 'number') return;
        const list: number[] = competencyAvgs[key] || (competencyAvgs[key] = []);
        list.push(percentage);
      });

      const weakCompetencies = Object.entries(competencyAvgs)
        .map(([comp, scores]) => ({
          competency: comp,
          average: scores.reduce((a, b) => a + b, 0) / scores.length
        }))
        .filter(comp => comp.average < 60)
        .map(comp => comp.competency);

      return {
        candidateId: student._id.toString(),
        averageScore: Math.round(student.averageScore * 100) / 100,
        examsCompleted: student.examsCompleted,
        weakCompetencies
      };
    });
  }

  private async getTotalStudentsCount(filters: ReportFilters): Promise<number> {
    // Contar estudiantes únicos que han tomado al menos un examen
    const uniqueStudents = await ExamResult.distinct('candidateId', this.buildMatchStage(filters));
    return uniqueStudents.length;
  }

  private formatCompetencyReportToCSV(report: CompetencyAnalysisReport): string {
    let csv = 'Competencia,Promedio,Dificultad,Estudiantes Evaluados,Excelente,Bueno,Aceptable,Necesita Mejora\n';

    Object.entries(report.competencyBreakdown).forEach(([comp, data]) => {
      csv += `${comp},${data.averageScore},${data.difficulty},${data.studentsEvaluated},${data.studentPerformance.excellent},${data.studentPerformance.good},${data.studentPerformance.acceptable},${data.studentPerformance.needsWork}\n`;
    });

    return csv;
  }

  private formatStudentReportToCSV(report: StudentStatsReport): string {
    let csv = 'Métrica,Valor\n';
    csv += `Total Estudiantes,${report.totalStudents}\n`;
    csv += `Estudiantes Evaluados,${report.evaluatedStudents}\n`;
    csv += `Promedio General,${report.averageScore}\n`;
    csv += `Duración Promedio,${report.timeAnalysis.averageDuration} min\n`;
    csv += `Eficiencia de Tiempo,${report.timeAnalysis.timeEfficiency}%\n`;

    return csv;
  }

  /**
   * Obtener reporte de próximas programaciones/sesiones
   */
  async getUpcomingSessions(filters: ReportFilters = {}): Promise<UpcomingSessionsReport> {
    try {
      const cacheKey = `upcoming_sessions:${JSON.stringify(filters)}`;
      const cached = await cache.get(cacheKey);
      if (cached) {
        return cached;
      }

      const now = new Date();
      const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const twoWeeksFromNow = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

      // Construir query para sesiones futuras
      const matchStage: any = {
        status: { $in: ['scheduled', 'in_progress'] },
        'scheduling.startDate': { $gte: now }
      };

      // Aplicar filtros de fecha si se proporcionan
      if (filters.dateRange) {
        matchStage['scheduling.startDate'].$lte = filters.dateRange.end;
        matchStage['scheduling.startDate'].$gte = filters.dateRange.start;
      }

      // Obtener sesiones próximas con datos del examen
      const upcomingSessions = await Session.find(matchStage)
        .populate('examId', 'title description structure')
        .populate('participants.proctors', 'name email')
        .sort({ 'scheduling.startDate': 1 })
        .limit(50)
        .lean();

      // Procesar datos de sesiones
      const processedSessions = upcomingSessions.map((session: any) => {
        const timeSlots = session.scheduling.timeSlots.map((slot: any) => ({
          date: slot.date,
          startTime: slot.startTime,
          endTime: slot.endTime,
          capacity: slot.capacity,
          enrolled: slot.enrolled || 0,
          available: slot.capacity - (slot.enrolled || 0)
        }));

        return {
          sessionId: session._id.toString(),
          sessionName: session.sessionName,
          examTitle: session.examId?.title || 'Examen sin título',
          examId: session.examId?._id?.toString() || '',
          startDate: session.scheduling.startDate,
          endDate: session.scheduling.endDate,
          status: session.status,
          totalSlots: timeSlots.length,
          registeredCandidates: session.participants.registeredCandidates.length,
          maxCandidates: session.participants.maxCandidates,
          availableSlots: session.participants.maxCandidates - session.participants.registeredCandidates.length,
          proctorsAssigned: session.participants.proctors.length,
          timeSlots,
          settings: {
            requireProctor: session.settings.requireProctor,
            allowLateEntry: session.settings.allowLateEntry,
            lateEntryMinutes: session.settings.lateEntryMinutes
          }
        };
      });

      // Calcular métricas de resumen
      const sessionsThisWeek = processedSessions.filter(s =>
        new Date(s.startDate) <= oneWeekFromNow
      ).length;

      const sessionsNextWeek = processedSessions.filter(s =>
        new Date(s.startDate) > oneWeekFromNow && new Date(s.startDate) <= twoWeeksFromNow
      ).length;

      const totalCandidatesRegistered = processedSessions.reduce((sum, s) =>
        sum + s.registeredCandidates, 0
      );

      const totalCapacity = processedSessions.reduce((sum, s) =>
        sum + s.maxCandidates, 0
      );

      const averageCapacityUtilization = totalCapacity > 0
        ? Math.round((totalCandidatesRegistered / totalCapacity) * 100)
        : 0;

      const sessionsNeedingProctors = processedSessions.filter(s =>
        s.settings.requireProctor && s.proctorsAssigned === 0
      ).length;

      // Análisis de carga de trabajo de proctors
      const proctorWorkload: any[] = [];
      const proctorMap = new Map();

      processedSessions.forEach(session => {
        session.timeSlots.forEach((slot:any) => {
          // Calcular horas por slot
          const startTime = new Date(`1970-01-01T${slot.startTime}`);
          const endTime = new Date(`1970-01-01T${slot.endTime}`);
          const hours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);

          // Agregar a cada proctor asignado (simulado por ahora)
          if (session.proctorsAssigned > 0) {
            const proctorKey = `proctor_${session.sessionId}`;
            if (!proctorMap.has(proctorKey)) {
              proctorMap.set(proctorKey, {
                proctorId: proctorKey,
                proctorName: `Proctor ${session.sessionName}`,
                assignedSessions: 0,
                upcomingHours: 0
              });
            }
            const proctor = proctorMap.get(proctorKey);
            proctor.assignedSessions += 1;
            proctor.upcomingHours += hours;
          }
        });
      });

      const report: UpcomingSessionsReport = {
        totalUpcomingSessions: processedSessions.length,
        sessionsThisWeek,
        sessionsNextWeek,
        upcomingSessions: processedSessions,
        proctorWorkload: Array.from(proctorMap.values()),
        summary: {
          totalCandidatesRegistered,
          averageCapacityUtilization,
          sessionsNeedingProctors
        }
      };

      // Cache por 30 minutos (las programaciones no cambian frecuentemente)
      await cache.set(cacheKey, report, 1800);

      return report;
    } catch (error) {
      logger.error('Error generating upcoming sessions report:', error);
      throw error;
    }
  }

  /**
   * Obtener historial completo de un estudiante específico
   */
  async getStudentHistory(studentId: string): Promise<StudentHistoryReport> {
    try {
      const cacheKey = `student_history:${studentId}`;
      const cached = await cache.get(cacheKey);
      if (cached) {
        return cached;
      }

      // Obtener resultados de exámenes del estudiante
      const examResults = await ExamResult.find({
        candidateId: studentId,
        isEvaluated: true
      })
      .populate('examId', 'title description structure')
      .populate('sessionId', 'sessionName')
      .sort({ evaluatedAt: -1 })
      .lean();

      if (examResults.length === 0) {
        throw new Error('No se encontraron resultados para este estudiante');
      }

      // Información básica del estudiante (simulada - debería venir del user-management-service)
      const studentInfo = {
        name: `Estudiante ${studentId}`, // En producción: llamar al servicio de usuarios
        email: `student${studentId}@example.com`, // En producción: llamar al servicio de usuarios
        registrationDate: new Date('2024-01-01') // En producción: obtener fecha real
      };

      // Procesar historial de exámenes
      const examHistory = examResults.map((result: any) => {
        const percentage = result.maxScore > 0 ? (result.finalScore / result.maxScore) * 100 : 0;

        return {
          examId: result.examId?._id?.toString() || '',
          examTitle: result.examId?.title || 'Examen sin título',
          sessionId: result.sessionId?._id?.toString() || '',
          sessionName: result.sessionId?.sessionName || 'Sesión sin nombre',
          completedAt: result.evaluatedAt || result.completedAt,
          finalScore: result.finalScore || 0,
          maxScore: result.maxScore || 100,
          percentage: Math.round(percentage * 100) / 100,
          level: result.level || 'No determinado',
          status: result.status || 'completed',
          timeSpent: result.timeSpent || 0,
          competencyScores: result.competencyScores || [],
          feedback: result.feedback || ''
        };
      });

      // Calcular resumen
      const scores = examHistory.map(exam => exam.percentage);
      const totalTimeSpent = examHistory.reduce((sum, exam) => sum + exam.timeSpent, 0);
      const dates = examHistory.map(exam => new Date(exam.completedAt)).filter(date => !isNaN(date.getTime()));

      const summary = {
        totalExams: examHistory.length,
        averageScore: scores.length > 0 ? Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 100) / 100 : 0,
        bestScore: scores.length > 0 ? Math.max(...scores) : 0,
        worstScore: scores.length > 0 ? Math.min(...scores) : 0,
        totalTimeSpent,
        mostRecentExam: dates.length > 0 ? new Date(Math.max(...dates.map(d => d.getTime()))) : new Date(),
        oldestExam: dates.length > 0 ? new Date(Math.min(...dates.map(d => d.getTime()))) : new Date()
      };

      // Análisis de progreso por competencia
      const competencyProgress: Record<string, any> = {};
      const competencyData = new Map();

      examHistory.forEach(exam => {
        exam.competencyScores.forEach((comp: any) => {
          if (!competencyData.has(comp.competency)) {
            competencyData.set(comp.competency, []);
          }
          competencyData.get(comp.competency).push({
            examDate: exam.completedAt,
            score: comp.percentage,
            level: exam.level
          });
        });
      });

      competencyData.forEach((progression, competency) => {
        const scores = progression.map((p: any) => p.score);
        const averageScore = scores.reduce((sum: number, score: number) => sum + score, 0) / scores.length;

        // Calcular tendencia
        let trend: 'improving' | 'stable' | 'declining' = 'stable';
        if (progression.length >= 2) {
          const recentScores = progression.slice(-3).map((p: any) => p.score);
          const olderScores = progression.slice(0, -2).map((p: any) => p.score);

          if (olderScores.length > 0 && recentScores.length > 0) {
            const recentAvg = recentScores.reduce((sum: number, score: number) => sum + score, 0) / recentScores.length;
            const olderAvg = olderScores.reduce((sum: number, score: number) => sum + score, 0) / olderScores.length;

            if (recentAvg > olderAvg + 5) {
              trend = 'improving';
            } else if (recentAvg < olderAvg - 5) {
              trend = 'declining';
            }
          }
        }

        competencyProgress[competency] = {
          currentLevel: progression[0]?.level || 'No determinado',
          averageScore: Math.round(averageScore * 100) / 100,
          examsCount: progression.length,
          progression: progression.sort((a: any, b: any) => new Date(b.examDate).getTime() - new Date(a.examDate).getTime()),
          trend
        };
      });

      // Generar recomendaciones
      const recommendations = this.generateStudentRecommendations(summary, competencyProgress);

      const report: StudentHistoryReport = {
        studentId,
        studentInfo,
        examHistory,
        summary,
        competencyProgress,
        recommendations
      };

      // Cache por 1 hora
      await cache.set(cacheKey, report, 3600);

      return report;
    } catch (error) {
      logger.error('Error generating student history report:', error);
      throw error;
    }
  }

  /**
   * Generar recomendaciones personalizadas para el estudiante
   */
  private generateStudentRecommendations(
    summary: StudentHistoryReport['summary'],
    competencyProgress: StudentHistoryReport['competencyProgress']
  ): string[] {
    const recommendations: string[] = [];

    // Recomendaciones basadas en rendimiento general
    if (summary.averageScore < 60) {
      recommendations.push('Se recomienda refuerzo general en todas las competencias');
      recommendations.push('Considere tomar clases adicionales o tutorías');
    } else if (summary.averageScore < 75) {
      recommendations.push('Buen progreso, pero hay oportunidades de mejora');
    } else if (summary.averageScore >= 85) {
      recommendations.push('Excelente rendimiento, considere niveles más avanzados');
    }

    // Recomendaciones por competencia
    Object.entries(competencyProgress).forEach(([competency, data]) => {
      if (data.trend === 'declining') {
        recommendations.push(`Preste atención especial a ${competency} - se observa una tendencia a la baja`);
      } else if (data.trend === 'improving') {
        recommendations.push(`Continúe con el buen trabajo en ${competency} - muestra mejora constante`);
      }

      if (data.averageScore < 60) {
        recommendations.push(`Refuerzo necesario en ${competency} (promedio: ${data.averageScore}%)`);
      }
    });

    // Recomendaciones basadas en tiempo
    if (summary.totalTimeSpent > 0) {
      const avgTimePerExam = summary.totalTimeSpent / summary.totalExams;
      if (avgTimePerExam > 90) { // Más de 1.5 horas por examen
        recommendations.push('Considere trabajar en gestión del tiempo durante los exámenes');
      }
    }

    return recommendations.slice(0, 5); // Limitar a 5 recomendaciones principales
  }
}