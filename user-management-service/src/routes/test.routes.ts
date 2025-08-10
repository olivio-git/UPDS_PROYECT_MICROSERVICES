// src/routes/test.routes.ts - Rutas para testing y debugging

import { Router } from 'express';
import { TestController } from '../controllers/TestController';
import { 
  middlewareStacks, 
  asyncHandler
} from '../middleware';

const router = Router();
const testController = new TestController();

// ================================
// TESTING ROUTES (SOLO ADMIN)
// ================================

/**
 * @route GET /test/health
 * @desc Health check completo del sistema
 * @access Admin
 */
router.get('/health',
  ...middlewareStacks.adminOnly,
  asyncHandler(testController.systemHealthCheck)
);

/**
 * @route GET /test/info
 * @desc Información del servicio y configuración
 * @access Admin
 */
router.get('/info',
  ...middlewareStacks.adminOnly,
  asyncHandler(testController.getServiceInfo)
);

// ================================
// AUTH SERVICE TESTS
// ================================

/**
 * @route GET /test/auth-service
 * @desc Test de conexión con auth-service
 * @access Admin
 */
router.get('/auth-service',
  ...middlewareStacks.adminOnly,
  asyncHandler(testController.testAuthServiceConnection)
);

/**
 * @route POST /test/auth-service/validate-user
 * @desc Test de validación de usuario en auth-service
 * @access Admin
 */
router.post('/auth-service/validate-user',
  ...middlewareStacks.adminOnly,
  asyncHandler(testController.testUserValidation)
);

// ================================
// KAFKA TESTS
// ================================

/**
 * @route GET /test/kafka
 * @desc Test de conexión con Kafka
 * @access Admin
 */
router.get('/kafka',
  ...middlewareStacks.adminOnly,
  asyncHandler(testController.testKafkaConnection)
);

/**
 * @route POST /test/kafka/publish
 * @desc Test de publicación de eventos en Kafka
 * @access Admin
 */
router.post('/kafka/publish',
  ...middlewareStacks.adminOnly,
  asyncHandler(testController.testKafkaEventPublishing)
);

// ================================
// INTEGRATION TESTS
// ================================

/**
 * @route POST /test/user-flow
 * @desc Test completo del flujo de creación de usuario
 * @access Admin
 */
router.post('/user-flow',
  ...middlewareStacks.adminOnly,
  asyncHandler(testController.testCompleteUserFlow)
);

// ================================
// EXPORT
// ================================

export default router;
