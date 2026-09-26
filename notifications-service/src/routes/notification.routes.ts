import { Router } from 'express';
import { NotificationController } from '../controllers/notification.controller';
import { asyncHandler } from '../middleware/error.middleware';
import { requireAdminOrService, requireAuth, requireService } from '../middleware/auth.middleware';

export const createNotificationRoutes = (
  notificationController: NotificationController
): Router => {
  const router = Router();

  // Admin-only: sends real emails / exposes stats and history. Only the
  // admin-gated /testing screen in the frontend calls these today; no other
  // service depends on them, so no service-token bypass is needed here.
  router.post(
    '/send-test',
    requireAdminOrService,
    asyncHandler(notificationController.sendTestEmail)
  );

  router.get(
    '/stats',
    requireAdminOrService,
    asyncHandler(notificationController.getEmailStats)
  );

  router.get(
    '/history',
    requireAdminOrService,
    asyncHandler(notificationController.getEmailHistory)
  );

  router.post(
    '/process-queue',
    requireAdminOrService,
    asyncHandler(notificationController.processEmailQueue)
  );

  router.post(
    '/retry-failed',
    requireAdminOrService,
    asyncHandler(notificationController.retryFailedEmails)
  );

  // Exposes internal email stats — same sensitivity as /stats above. The
  // process-level /health (see index.ts) stays public for the Docker
  // healthcheck; this one does not need to be.
  router.get(
    '/health',
    requireAdminOrService,
    asyncHandler(notificationController.getServiceHealth)
  );

  // In-app notifications.
  // POST is service-only: today the sole caller is grading-service's HTTP
  // fallback (sendInAppFallback) for when its Kafka publish fails. The
  // normal path (grading.result.published -> notifications-grading
  // consumer) never goes through HTTP at all.
  router.post(
    '/inapp',
    requireService,
    asyncHandler(notificationController.createInApp)
  );

  // GET/PATCH/DELETE require a real end-user (or service) token; ownership
  // (recipientId must match the caller, unless admin) is enforced in the
  // controller since it depends on the specific notification/recipient.
  router.get(
    '/inapp',
    requireAuth,
    asyncHandler(notificationController.listNotifications)
  );

  router.patch(
    '/inapp/:id/read',
    requireAuth,
    asyncHandler(notificationController.markAsRead)
  );

  router.delete(
    '/inapp/:id',
    requireAuth,
    asyncHandler(notificationController.deleteNotification)
  );

  return router;
};
