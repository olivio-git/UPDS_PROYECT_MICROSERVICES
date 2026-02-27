import { Router } from 'express';
import { SystemMonitoringController } from '../controllers/systemMonitoring.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();
const systemMonitoringController = new SystemMonitoringController();

// Public health check (no auth required)
router.get('/health', systemMonitoringController.getHealthStatus);

// Protected monitoring endpoints (require authentication)
router.use(authMiddleware); // Apply authentication to all routes below

// System statistics
router.get('/stats', systemMonitoringController.getSystemStats);
router.get('/memory', systemMonitoringController.getMemoryStats);
router.get('/connections', systemMonitoringController.getConnections);
router.get('/process', systemMonitoringController.getProcessInfo);

// System operations
router.post('/cleanup', systemMonitoringController.forceCleanup);

export default router;