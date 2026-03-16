import { NextFunction, Request, Response } from 'express';
import { ReportFilters, ReportsService, UpcomingSessionsReport, StudentHistoryReport, StudentListReport } from '../services/reports.service';
import { PDFService, PDFGenerationOptions } from '../services/pdf.service';
import { User } from '../models/user.model';
import { logger } from '../utils/logger';

export class ReportsController {
  private reportsService: ReportsService;
  private pdfService: PDFService;

  constructor() {
    this.reportsService = new ReportsService();
    this.pdfService = new PDFService();
  }

  /**
   * Obtener análisis por competencia
   * GET /reports/competencies
   */
  async getCompetencyAnalysis(req: Request, res: Response, next: NextFunction) {
    try {
      const filters = this.parseFilters(req.query);

      logger.info('Generating competency analysis report', { filters, user: (req as any).user?.id });

      const report = await this.reportsService.getCompetencyAnalysis(filters);

      res.json({
        success: true,
        data: report,
        meta: {
          generatedAt: new Date().toISOString(),
          filters: filters,
          reportType: 'competency_analysis'
        }
      });
    } catch (error) {
      logger.error('Error generating competency analysis:', error);
      next(error);
    }
  }

  /**
   * Obtener estadísticas de estudiantes
   * GET /reports/students
   */
  async getStudentStats(req: Request, res: Response, next: NextFunction) {
    try {
      const filters = this.parseFilters(req.query);

      logger.info('Generating student statistics report', { filters, user: (req as any).user?.id });

      const report = await this.reportsService.getStudentStats(filters);

      res.json({
        success: true,
        data: report,
        meta: {
          generatedAt: new Date().toISOString(),
          filters: filters,
          reportType: 'student_statistics'
        }
      });
    } catch (error) {
      logger.error('Error generating student statistics:', error);
      next(error);
    }
  }

  /**
   * Lista paginada de estudiantes con métricas
   * GET /reports/students/list
   */
  async getStudentList(req: Request, res: Response, next: NextFunction) {
    try {
      const filters = this.parseFilters(req.query);
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const search = (req.query.search as string) || '';

      const report: StudentListReport = await this.reportsService.getStudentList(filters, page, limit, search);

      res.json({
        success: true,
        data: report,
        meta: { generatedAt: new Date().toISOString(), filters, reportType: 'student_list' }
      });
    } catch (error) {
      logger.error('Error generating student list:', error);
      next(error);
    }
  }

  /**
   * Exportar reporte a CSV o PDF
   * GET /reports/export/:type
   */
  async exportReport(req: Request, res: Response, next: NextFunction) {
    try {
      const { type } = req.params;
      const { format = 'csv' } = req.query;

      if (!['competency', 'students', 'upcoming-sessions', 'student-history'].includes(type as string)) {
        res.status(400).json({
          success: false,
          message: 'Tipo de reporte inválido. Use: competency, students, upcoming-sessions, student-history'
        });
        return;
      }

      if (!['csv', 'pdf'].includes(format as string)) {
        res.status(400).json({
          success: false,
          message: 'Formato no soportado. Use: csv, pdf'
        });
        return;
      }

      const filters = this.parseFilters(req.query);

      logger.info('Exporting report', {
        type,
        format,
        filters,
        user: (req as any).user?.id
      });

      if (format === 'csv') {
        if (!['competency', 'students', 'student-history'].includes(type as string)) {
          res.status(400).json({
            success: false,
            message: 'CSV solo disponible para: competency, students, student-history'
          });
          return;
        }

        let csvContent: string;
        if (type === 'student-history') {
          const { studentId } = req.query;
          if (!studentId || typeof studentId !== 'string') {
            res.status(400).json({ success: false, message: 'studentId requerido para exportar historial' });
            return;
          }
          csvContent = await this.reportsService.exportStudentHistoryToCSV(studentId);
        } else {
          csvContent = await this.reportsService.exportToCSV(type as 'competency' | 'students', filters);
        }

        const filename = `${type}_report_${new Date().toISOString().split('T')[0]}.csv`;
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(csvContent);

      } else if (format === 'pdf') {
        // Export PDF (new logic with LLM interpretation support)
        let pdfBuffer: Buffer;
        let filename: string;

        // Extraer opciones de PDF de query parameters
        const pdfOptions: PDFGenerationOptions = {
          includeInterpretation: req.query.includeInterpretation === 'true',
          language: (req.query.language as 'spanish' | 'english') || 'spanish',
          interpretationConfig: {
            language: (req.query.interpretationLanguage as 'spanish' | 'english') || 'spanish',
            depth: (req.query.interpretationDepth as 'brief' | 'detailed') || 'detailed',
            focus: (req.query.interpretationFocus as 'academic' | 'administrative' | 'strategic') || 'academic'
          },
          companyName: req.query.companyName as string
        };

        logger.info('Generando PDF con opciones:', {
          type,
          includeInterpretation: pdfOptions.includeInterpretation,
          language: pdfOptions.language,
          interpretationConfig: pdfOptions.interpretationConfig
        });

        switch (type) {
          case 'competency':
            const competencyReport = await this.reportsService.getCompetencyAnalysis(filters);
            pdfBuffer = await this.pdfService.generateCompetencyReportPDF(competencyReport, pdfOptions);
            filename = `competency_report_${pdfOptions.includeInterpretation ? 'ai_' : ''}${new Date().toISOString().split('T')[0]}.pdf`;
            break;

          case 'students':
            const studentReport = await this.reportsService.getStudentStats(filters);
            pdfBuffer = await this.pdfService.generateStudentReportPDF(studentReport, pdfOptions);
            filename = `students_report_${pdfOptions.includeInterpretation ? 'ai_' : ''}${new Date().toISOString().split('T')[0]}.pdf`;
            break;

          case 'upcoming-sessions':
            const sessionsReport = await this.reportsService.getUpcomingSessions(filters);
            pdfOptions.interpretationConfig!.focus = 'administrative'; // Override focus for sessions
            pdfBuffer = await this.pdfService.generateUpcomingSessionsPDF(sessionsReport, pdfOptions);
            filename = `upcoming_sessions_${pdfOptions.includeInterpretation ? 'ai_' : ''}${new Date().toISOString().split('T')[0]}.pdf`;
            break;

          case 'student-history':
            const { studentId } = req.query;
            if (!studentId || typeof studentId !== 'string') {
              res.status(400).json({
                success: false,
                message: 'studentId requerido para reporte de historial'
              });
              return;
            }
            const historyReport = await this.reportsService.getStudentHistory(studentId);
            pdfBuffer = await this.pdfService.generateStudentHistoryPDF(historyReport, pdfOptions);
            filename = `student_history_${studentId}_${pdfOptions.includeInterpretation ? 'ai_' : ''}${new Date().toISOString().split('T')[0]}.pdf`;
            break;

          default:
            res.status(400).json({
              success: false,
              message: 'Tipo de reporte PDF no soportado'
            });
            return;
        }

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(pdfBuffer);
      }

    } catch (error) {
      logger.error('Error exporting report:', error);
      next(error);
    }
  }

  /**
   * Obtener resumen ejecutivo (dashboard)
   * GET /reports/dashboard
   */
  async getDashboardSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const filters = this.parseFilters(req.query);

      logger.info('Generating dashboard summary', { filters, user: (req as any).user?.id });

      // Obtener ambos reportes en paralelo para el dashboard
      const [competencyReport, studentReport] = await Promise.all([
        this.reportsService.getCompetencyAnalysis(filters),
        this.reportsService.getStudentStats(filters)
      ]);

      // Crear resumen ejecutivo
      const dashboardData = {
        overview: {
          totalStudents: studentReport.totalStudents,
          evaluatedStudents: studentReport.evaluatedStudents,
          averageScore: studentReport.averageScore,
          totalExams: competencyReport.overallStats.totalExams,
          completionRate: competencyReport.overallStats.completionRate
        },
        performanceDistribution: studentReport.performanceDistribution,
        competencyRanking: Object.entries(competencyReport.competencyBreakdown)
          .map(([comp, data]) => ({
            competency: comp,
            averageScore: data.averageScore,
            studentsEvaluated: data.studentsEvaluated,
            difficulty: data.difficulty
          }))
          .sort((a, b) => b.averageScore - a.averageScore),
        levelDistribution: studentReport.levelDistribution,
        topPerformers: studentReport.topPerformers.slice(0, 5),
        improvementAreas: competencyReport.comparativeAnalysis.improvementAreas,
        recommendations: competencyReport.recommendations.slice(0, 3), // Top 3 recomendaciones
        trends: {
          timeEfficiency: studentReport.timeAnalysis.timeEfficiency,
          progressionRate: studentReport.progressionAnalysis.progressionRate
        }
      };

      res.json({
        success: true,
        data: dashboardData,
        meta: {
          generatedAt: new Date().toISOString(),
          filters: filters,
          reportType: 'dashboard_summary'
        }
      });

    } catch (error) {
      logger.error('Error generating dashboard summary:', error);
      next(error);
    }
  }

  /**
   * Obtener datos para comparación temporal
   * GET /reports/trends
   */
  async getTrends(req: Request, res: Response, next: NextFunction) {
    try {
      const { period = 'month', competency } = req.query;

      if (!['week', 'month', 'quarter'].includes(period as string)) {
        res.status(400).json({
          success: false,
          message: 'Período inválido. Use: week, month, quarter'
        });
        return;
      }

      const filters = this.parseFilters(req.query);

      logger.info('Generating trends report', {
        period,
        competency,
        filters,
        user: (req as any).user?.id
      });

      // Generar filtros para diferentes períodos
      const now = new Date();
      const periods = [];

      // week=12 semanas, month=18 meses, quarter=8 trimestres
      const periodCount = period === 'week' ? 12 : period === 'quarter' ? 8 : 18;

      for (let i = periodCount - 1; i >= 0; i--) {
        const periodStart = new Date(now);
        const periodEnd = new Date(now);

        if (period === 'week') {
          periodStart.setDate(now.getDate() - (i + 1) * 7);
          periodEnd.setDate(now.getDate() - i * 7);
        } else if (period === 'month') {
          periodStart.setMonth(now.getMonth() - (i + 1));
          periodEnd.setMonth(now.getMonth() - i);
        } else { // quarter
          periodStart.setMonth(now.getMonth() - (i + 1) * 3);
          periodEnd.setMonth(now.getMonth() - i * 3);
        }

        periods.push({
          label: `${periodStart.getFullYear()}-${String(periodStart.getMonth() + 1).padStart(2, '0')}`,
          start: periodStart,
          end: periodEnd
        });
      }

      // Obtener datos para cada período
      const trendsData = [];

      for (const periodData of periods) {
        const periodFilters = {
          ...filters,
          dateRange: {
            start: periodData.start,
            end: periodData.end
          }
        };

        if (competency && typeof competency === 'string') {
          // Trend específico por competencia
          const competencyReport = await this.reportsService.getCompetencyAnalysis(periodFilters);
          const compData = competencyReport.competencyBreakdown[competency];

          trendsData.push({
            period: periodData.label,
            averageScore: compData?.averageScore || 0,
            studentsEvaluated: compData?.studentsEvaluated || 0
          });
        } else {
          // Trend general
          const studentReport = await this.reportsService.getStudentStats(periodFilters);

          trendsData.push({
            period: periodData.label,
            averageScore: studentReport.averageScore,
            studentsEvaluated: studentReport.evaluatedStudents,
            totalStudents: studentReport.totalStudents
          });
        }
      }

      res.json({
        success: true,
        data: {
          trends: trendsData,
          period: period,
          competency: competency || 'all'
        },
        meta: {
          generatedAt: new Date().toISOString(),
          reportType: 'trends_analysis'
        }
      });

    } catch (error) {
      logger.error('Error generating trends report:', error);
      next(error);
    }
  }

  /**
   * Obtener próximas programaciones/sesiones
   * GET /reports/upcoming-sessions
   */
  async getUpcomingSessions(req: Request, res: Response, next: NextFunction) {
    try {
      const filters = this.parseFilters(req.query);
      const user = (req as any).user;

      // Teacher solo ve sus propias sesiones; admin ve todas
      // El JWT tiene el auth-service ID, pero las sesiones guardan el user-management ID
      // → buscamos por email para obtener el _id correcto
      if (user?.role === 'teacher') {
        const umUser = await User.findOne({ email: user.email }, { _id: 1 }).lean();
        if (umUser) {
          filters.createdBy = (umUser._id as any).toString();
        }
      }

      logger.info('Generating upcoming sessions report', {
        filters,
        user: user?.id,
        role: user?.role,
      });

      const report = await this.reportsService.getUpcomingSessions(filters);

      res.json({
        success: true,
        data: report,
        meta: {
          generatedAt: new Date().toISOString(),
          filters: filters,
          reportType: 'upcoming_sessions'
        }
      });

    } catch (error) {
      logger.error('Error generating upcoming sessions report:', error);
      next(error);
    }
  }

  /**
   * Obtener historial completo de un estudiante
   * GET /reports/student/:studentId/history
   */
  async getStudentHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const { studentId } = req.params;

      if (!studentId) {
        res.status(400).json({
          success: false,
          message: 'ID de estudiante requerido'
        });
        return;
      }

      logger.info('Generating student history report', {
        studentId,
        user: (req as any).user?.id
      });

      const report = await this.reportsService.getStudentHistory(studentId);

      res.json({
        success: true,
        data: report,
        meta: {
          generatedAt: new Date().toISOString(),
          studentId: studentId,
          reportType: 'student_history'
        }
      });

    } catch (error) {
      logger.error('Error generating student history report:', error);
      next(error);
    }
  }

  /**
   * Parsear filtros desde query parameters
   */
  private parseFilters(query: any): ReportFilters {
    const filters: ReportFilters = {};

    // Rango de fechas
    if (query.startDate && query.endDate &&
        typeof query.startDate === 'string' && typeof query.endDate === 'string') {
      filters.dateRange = {
        start: new Date(query.startDate),
        end: new Date(query.endDate)
      };
    }

    // Niveles
    if (query.levels) {
      filters.levels = Array.isArray(query.levels)
        ? query.levels
        : typeof query.levels === 'string' ? query.levels.split(',') : [];
    }

    // Competencias
    if (query.competencies) {
      filters.competencies = Array.isArray(query.competencies)
        ? query.competencies
        : typeof query.competencies === 'string' ? query.competencies.split(',') : [];
    }

    // Tipos de examen
    if (query.examTypes) {
      filters.examTypes = Array.isArray(query.examTypes)
        ? query.examTypes
        : typeof query.examTypes === 'string' ? query.examTypes.split(',') : [];
    }

    // IDs de candidatos
    if (query.candidateIds) {
      filters.candidateIds = Array.isArray(query.candidateIds)
        ? query.candidateIds
        : typeof query.candidateIds === 'string' ? query.candidateIds.split(',') : [];
    }

    // Rango de puntajes
    if (query.minScore && typeof query.minScore === 'string') {
      const minScore = parseFloat(query.minScore);
      if (!isNaN(minScore)) {
        filters.minScore = minScore;
      }
    }
    if (query.maxScore && typeof query.maxScore === 'string') {
      const maxScore = parseFloat(query.maxScore);
      if (!isNaN(maxScore)) {
        filters.maxScore = maxScore;
      }
    }

    // Estado
    if (query.status) {
      filters.status = Array.isArray(query.status)
        ? query.status
        : typeof query.status === 'string' ? query.status.split(',') : [];
    }

    // Sesión específica
    if (query.sessionId && typeof query.sessionId === 'string') {
      filters.sessionId = query.sessionId;
    }

    // Gestión (año)
    if (query.gestion && typeof query.gestion === 'string') {
      const gestion = parseInt(query.gestion);
      if (!isNaN(gestion)) filters.gestion = gestion;
    }

    // Semestre
    if (query.semestre === 'H1' || query.semestre === 'H2') {
      filters.semestre = query.semestre;
    }

    return filters;
  }

  /**
   * Validar parámetros de fecha
   */
  private validateDateRange(startDate?: string, endDate?: string): { isValid: boolean; error?: string } {
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return { isValid: false, error: 'Formato de fecha inválido' };
      }

      if (start >= end) {
        return { isValid: false, error: 'La fecha de inicio debe ser menor a la fecha de fin' };
      }

      const maxRange = 365 * 24 * 60 * 60 * 1000; // 1 año
      if (end.getTime() - start.getTime() > maxRange) {
        return { isValid: false, error: 'El rango de fechas no puede ser mayor a 1 año' };
      }
    }

    return { isValid: true };
  }
}