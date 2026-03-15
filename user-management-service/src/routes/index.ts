import { Router } from 'express';
import { permissionMiddleware } from '../middleware/permission.middleware';

// ================================
// IMPORT ROUTES
// ================================

import userRoutes from './user.routes';
import candidateRoutes from './candidate.routes';
import roleRoutes from './role.routes';
import testRoutes from './test.routes';
import bootstrapRoutes from './bootstrap.routes';

// ================================
// MAIN ROUTER
// ================================

const router = Router();

// ================================
// HEALTH CHECK GENERAL
// ================================

/**
 * @route GET /health
 * @desc Health check general del servicio
 * @access Public
 */
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'User Management Service is healthy',
    service: 'user-management-service',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

/**
 * @route GET /
 * @desc Información básica del servicio
 * @access Public
 */
router.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'CBA Platform - User Management Service',
    service: 'user-management-service',
    version: '1.0.0',
    description: 'Microservicio para gestión de usuarios, candidatos y roles',
    endpoints: {
      users: '/api/v1/users',
      candidates: '/api/v1/candidates',
      roles: '/api/v1/roles',
      permissions: '/api/v1/permissions'
    },
    timestamp: new Date().toISOString()
  });
});

// ================================
// API ROUTES
// ================================

/**
 * @route /api/v1/bootstrap/*
 * @desc Rutas para inicialización del sistema (PÚBLICO)
 * @access Public (solo funciona si no hay usuarios)
 */
router.use('/api/v1/bootstrap', bootstrapRoutes);

/**
 * @route /api/v1/users/*
 * @desc Rutas para gestión de usuarios
 */
router.use('/api/v1/users', userRoutes);

/**
 * @route /api/v1/candidates/*
 * @desc Rutas para gestión de candidatos
 */
router.use('/api/v1/candidates', candidateRoutes);

/**
 * @route /api/v1/roles/*
 * @desc Rutas para gestión de roles
 */
router.use('/api/v1/roles', roleRoutes);

/**
 * @route /api/v1/test/*
 * @desc Rutas para testing y debugging (solo admin)
 */
router.use('/api/v1/test', testRoutes);

// ================================
// PERMISSION ROUTES
// ================================

/**
 * @route GET /api/v1/permissions
 * @desc Obtener permisos del usuario actual
 * @access Authenticated
 */
router.get('/api/v1/permissions', 
  permissionMiddleware.getUserPermissions
);

/**
 * @route GET /api/v1/permissions/check
 * @desc Verificar si el usuario tiene un permiso específico
 * @access Authenticated
 */
router.post('/api/v1/permissions/check', (req, res) => {
  // Implementar verificación de permisos específicos
  res.status(200).json({
    success: true,
    message: 'Verificación de permisos',
    data: { hasPermission: false } // Implementar lógica
  });
});

// ================================
// SYSTEM ROUTES
// ================================

/**
 * @route GET /api/v1/system/info
 * @desc Información del sistema
 * @access Admin only
 */
router.get('/api/v1/system/info', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Información del sistema',
    data: {
      service: 'user-management-service',
      version: '1.0.0',
      node_version: process.version,
      platform: process.platform,
      arch: process.arch,
      memory: process.memoryUsage(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString()
    }
  });
});

/**
 * @route GET /api/v1/system/metrics
 * @desc Métricas del sistema
 * @access Admin only
 */
router.get('/api/v1/system/metrics', (req, res) => {
  const metrics = {
    memory: process.memoryUsage(),
    uptime: process.uptime(),
    cpu: process.cpuUsage(),
    version: process.version,
    platform: process.platform
  };

  res.status(200).json({
    success: true,
    message: 'Métricas del sistema',
    data: metrics,
    timestamp: new Date().toISOString()
  });
});

// ================================
// ERROR ROUTES
// ================================

/**
 * @route * (catch-all)
 * @desc Manejo de rutas no encontradas
 * @access Public
 */
router.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint no encontrado',
    error: 'NOT_FOUND',
    details: {
      method: req.method,
      path: req.originalUrl,
      service: 'user-management-service'
    },
    timestamp: new Date().toISOString()
  });
});

// ================================
// EXPORT ROUTER
// ================================

export default router;
