import { Router } from 'express';
import { BootstrapController } from '../controllers/BootstrapController';

const router = Router();
const bootstrapController = new BootstrapController();

/**
 * @route POST /api/v1/bootstrap/admin
 * @desc Crear el primer usuario administrador del sistema
 * @access Public (solo funciona si no hay usuarios)
 */
router.post('/admin', bootstrapController.createFirstAdmin);

/**
 * @route GET /api/v1/bootstrap/status
 * @desc Verificar si el sistema necesita bootstrap
 * @access Public
 */
router.get('/status', bootstrapController.checkBootstrapStatus);

export default router;
