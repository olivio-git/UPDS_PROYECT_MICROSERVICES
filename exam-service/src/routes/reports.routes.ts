import { Router } from 'express';
import { z } from 'zod';
import { ReportsController } from '../controllers/reports.controller';
import { authMiddleware, requireRole } from '../middleware/auth.middleware';
import { validateQuery } from '../middleware/validation.middleware';

const router = Router();
const reportsController = new ReportsController();

// Todas las rutas requieren autenticación
router.use(authMiddleware);

// Schema de validación para filtros de reportes
const reportFiltersSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  levels: z.union([z.string(), z.array(z.string())]).optional(),
  competencies: z.union([z.string(), z.array(z.string())]).optional(),
  examTypes: z.union([z.string(), z.array(z.string())]).optional(),
  candidateIds: z.union([z.string(), z.array(z.string())]).optional(),
  minScore: z.string().transform(val => parseFloat(val)).optional(),
  maxScore: z.string().transform(val => parseFloat(val)).optional(),
  status: z.union([z.string(), z.array(z.string())]).optional(),
  sessionId: z.string().optional(),
  gestion: z.string().optional(),
  semestre: z.enum(['H1', 'H2']).optional(),
});

const trendsQuerySchema = z.object({
  period: z.enum(['week', 'month', 'quarter']).optional(),
  competency: z.string().optional(),
  ...reportFiltersSchema.shape
});

const exportQuerySchema = z.object({
  format: z.enum(['csv', 'pdf']).optional(),
  studentId: z.string().optional(), // Para reporte de historial de estudiante
  // Nuevos parámetros para interpretación LLM
  includeInterpretation: z.enum(['true', 'false']).optional(),
  language: z.enum(['spanish', 'english']).optional(),
  interpretationLanguage: z.enum(['spanish', 'english']).optional(),
  interpretationDepth: z.enum(['brief', 'detailed']).optional(),
  interpretationFocus: z.enum(['academic', 'administrative', 'strategic']).optional(),
  companyName: z.string().optional(),
  ...reportFiltersSchema.shape
});

// ==================== RUTAS PRINCIPALES ====================

/**
 * Análisis por competencia
 * GET /reports/competencies
 * Acceso: admin, teacher
 */
router.get(
  '/competencies',
  requireRole('admin', 'teacher'),
  validateQuery(reportFiltersSchema),
  reportsController.getCompetencyAnalysis.bind(reportsController)
);

/**
 * Lista paginada de estudiantes con métricas individuales
 * GET /reports/students/list?page=1&limit=20&search=
 * Acceso: admin, teacher
 */
router.get(
  '/students/list',
  requireRole('admin', 'teacher'),
  validateQuery(reportFiltersSchema),
  reportsController.getStudentList.bind(reportsController)
);

/**
 * Estadísticas de estudiantes
 * GET /reports/students
 * Acceso: admin, teacher
 */
router.get(
  '/students',
  requireRole('admin', 'teacher'),
  validateQuery(reportFiltersSchema),
  reportsController.getStudentStats.bind(reportsController)
);

/**
 * Dashboard ejecutivo (resumen)
 * GET /reports/dashboard
 * Acceso: admin, teacher
 */
router.get(
  '/dashboard',
  requireRole('admin', 'teacher'),
  validateQuery(reportFiltersSchema),
  reportsController.getDashboardSummary.bind(reportsController)
);

/**
 * Análisis de tendencias temporales
 * GET /reports/trends
 * Acceso: admin, teacher
 */
router.get(
  '/trends',
  requireRole('admin', 'teacher'),
  validateQuery(trendsQuerySchema),
  reportsController.getTrends.bind(reportsController)
);

/**
 * Próximas programaciones/sesiones
 * GET /reports/upcoming-sessions
 * Acceso: admin, teacher, proctor
 */
router.get(
  '/upcoming-sessions',
  requireRole('admin', 'teacher', 'proctor'),
  validateQuery(reportFiltersSchema),
  reportsController.getUpcomingSessions.bind(reportsController)
);

/**
 * Historial de un estudiante específico
 * GET /reports/student/:studentId/history
 * Acceso: admin, teacher, student (solo su propio historial)
 */
router.get(
  '/student/:studentId/history',
  requireRole('admin', 'teacher', 'student'),
  reportsController.getStudentHistory.bind(reportsController)
);

// ==================== EXPORTACIÓN ====================

/**
 * Exportar análisis por competencia
 * GET /reports/export/competency
 * Acceso: admin, teacher
 */
router.get(
  '/export/:type',
  requireRole('admin', 'teacher'),
  validateQuery(exportQuerySchema),
  reportsController.exportReport.bind(reportsController)
);

/**
 * Exportar estadísticas de estudiantes
 * GET /reports/export/students
 * Acceso: admin, teacher
 */
router.get(
  '/export/:type',
  requireRole('admin', 'teacher'),
  validateQuery(exportQuerySchema),
  reportsController.exportReport.bind(reportsController)
);

/**
 * Exportar reporte genérico
 * GET /reports/export/:type
 * Acceso: admin, teacher
 */
router.get(
  '/export/:type',
  requireRole('admin', 'teacher'),
  validateQuery(exportQuerySchema),
  reportsController.exportReport.bind(reportsController)
);

export default router;