import { Router } from 'express';
import { AuditLogRepository } from '../repositories/audit-log.repository';
import { middlewareStacks, asyncHandler } from '../middleware';

const router = Router();
const auditRepo = new AuditLogRepository();

/**
 * @route GET /api/v1/audit-logs
 * @desc Lista paginada de audit logs con filtros
 * @access Admin, o staff (teacher/proctor) cuando la consulta está acotada
 *         a un targetId. El monitor de sesión pide la actividad de UNA
 *         sesión; sin esto el docente recibía 403 y el panel quedaba vacío
 *         sin decir por qué.
 */
router.get(
  '/',
  ...middlewareStacks.basicAuth,
  (req, res, next) => {
    const user = req.user as { role?: string } | undefined;
    if (user?.role === 'admin') return next();

    const scoped = typeof req.query.targetId === 'string' && req.query.targetId.length > 0;
    if (scoped && (user?.role === 'teacher' || user?.role === 'proctor')) return next();

    res.status(403).json({
      success: false,
      message: 'Solo un administrador puede listar la auditoría completa',
      error: 'FORBIDDEN',
    });
  },
  asyncHandler(async (req, res) => {
    const {
      page = '1',
      limit = '20',
      service,
      action,
      actorEmail,
      targetType,
      targetId,
      dateFrom,
      dateTo,
    } = req.query as Record<string, string | undefined>;

    const pagination = {
      page: Math.max(1, parseInt(page, 10) || 1),
      limit: Math.min(100, parseInt(limit, 10) || 20),
    };

    const filters = {
      service: service || undefined,
      action: action || undefined,
      actorEmail: actorEmail || undefined,
      targetType: targetType || undefined,
      targetId: targetId || undefined,
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
    };

    const { logs, total } = await auditRepo.findAll(filters, pagination);

    res.status(200).json({
      success: true,
      data: {
        logs,
        total,
        page: pagination.page,
        limit: pagination.limit,
        totalPages: Math.ceil(total / pagination.limit),
      },
    });
  })
);

export default router;
