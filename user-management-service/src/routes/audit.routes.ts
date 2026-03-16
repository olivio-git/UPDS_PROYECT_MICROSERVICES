import { Router } from 'express';
import { AuditLogRepository } from '../repositories/audit-log.repository';
import { middlewareStacks, asyncHandler } from '../middleware';

const router = Router();
const auditRepo = new AuditLogRepository();

/**
 * @route GET /api/v1/audit-logs
 * @desc Lista paginada de audit logs con filtros
 * @access Admin only
 */
router.get(
  '/',
  ...middlewareStacks.adminOnly,
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
