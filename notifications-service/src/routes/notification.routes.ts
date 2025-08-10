import { Router } from 'express';
import { NotificationController } from '../controllers/notification.controller';
import { asyncHandler } from '../middleware/error.middleware';

export const createNotificationRoutes = (
  notificationController: NotificationController
): Router => {
  const router = Router();

  // Rutas públicas para testing
  router.post(
    '/send-test',
    asyncHandler(notificationController.sendTestEmail)
  );

  // Rutas de administración
  router.get(
    '/stats',
    asyncHandler(notificationController.getEmailStats)
  );

  router.get(
    '/history',
    asyncHandler(notificationController.getEmailHistory)
  );

  // Rutas de procesamiento
  router.post(
    '/process-queue',
    asyncHandler(notificationController.processEmailQueue)
  );

  router.post(
    '/retry-failed',
    asyncHandler(notificationController.retryFailedEmails)
  );

  // Health check
  router.get(
    '/health',
    asyncHandler(notificationController.getServiceHealth)
  );

  return router;
};
