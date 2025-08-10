import { Router } from 'express';
import { RoleController } from '../controllers/RoleController';
import { 
  middlewareStacks, 
  asyncHandler,
  rolePermissions,
  validateBody,
  validateQuery,
  validateParams
} from '../middleware';
import { 
  CreateRoleSchema, 
  UpdateRoleSchema, 
  getRolesQuerySchema, 
  idParamsSchema 
} from '../schemas';

// ================================
// ROLE ROUTES
// ================================

const router = Router();
const roleController = new RoleController();

// ================================
// PUBLIC ROUTES
// ================================

/**
 * @route GET /health
 * @desc Health check específico para roles
 * @access Public
 */
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Role management service is healthy',
    service: 'role-management',
    timestamp: new Date().toISOString()
  });
});

// ================================
// AUTHENTICATED ROUTES
// ================================

/**
 * @route GET /roles
 * @desc Obtener lista de roles con filtros
 * @access Admin, Teacher (limited)
 */
router.get('/',
  ...middlewareStacks.basicAuth,
  rolePermissions.read,
  validateQuery(getRolesQuerySchema),
  asyncHandler(roleController.getRoles)
);

/**
 * @route GET /roles/:id
 * @desc Obtener rol por ID
 * @access Admin, Teacher (limited)
 */
router.get('/:id',
  ...middlewareStacks.basicAuth,
  validateParams(idParamsSchema),
  rolePermissions.read,
  asyncHandler(roleController.getRoleById)
);

/**
 * @route POST /roles
 * @desc Crear nuevo rol
 * @access Admin only
 */
router.post('/',
  ...middlewareStacks.adminOnly,
  validateBody(CreateRoleSchema),
  rolePermissions.create,
  asyncHandler(roleController.createRole)
);

/**
 * @route PUT /roles/:id
 * @desc Actualizar rol completo
 * @access Admin only
 */
router.put('/:id',
  ...middlewareStacks.adminOnly,
  validateParams(idParamsSchema),
  validateBody(UpdateRoleSchema),
  rolePermissions.update,
  asyncHandler(roleController.updateRole)
);

/**
 * @route PATCH /roles/:id
 * @desc Actualización parcial de rol
 * @access Admin only
 */
router.patch('/:id',
  ...middlewareStacks.adminOnly,
  validateParams(idParamsSchema),
  validateBody(UpdateRoleSchema.partial()),
  rolePermissions.update,
  asyncHandler(roleController.patchRole)
);

/**
 * @route DELETE /roles/:id
 * @desc Eliminar rol (soft delete)
 * @access Admin only
 */
router.delete('/:id',
  ...middlewareStacks.adminOnly,
  validateParams(idParamsSchema),
  rolePermissions.delete,
  asyncHandler(roleController.deleteRole)
);

/**
 * @route PUT /roles/:id/activate
 * @desc Activar rol
 * @access Admin only
 */
router.put('/:id/activate',
  ...middlewareStacks.adminOnly,
  validateParams(idParamsSchema),
  rolePermissions.update,
  asyncHandler(roleController.activateRole)
);

/**
 * @route PUT /roles/:id/deactivate
 * @desc Desactivar rol
 * @access Admin only
 */
router.put('/:id/deactivate',
  ...middlewareStacks.adminOnly,
  validateParams(idParamsSchema),
  rolePermissions.update,
  asyncHandler(roleController.deactivateRole)
);

/**
 * @route PUT /roles/:id/permissions
 * @desc Actualizar permisos del rol
 * @access Admin only
 */
router.put('/:id/permissions',
  ...middlewareStacks.adminOnly,
  validateParams(idParamsSchema),
  rolePermissions.update,
  asyncHandler(roleController.updateRolePermissions)
);

/**
 * @route GET /roles/:id/permissions
 * @desc Obtener permisos del rol
 * @access Admin, Teacher (limited)
 */
router.get('/:id/permissions',
  ...middlewareStacks.basicAuth,
  validateParams(idParamsSchema),
  rolePermissions.read,
  asyncHandler(roleController.getRolePermissions)
);

/**
 * @route GET /roles/:id/users
 * @desc Obtener usuarios con este rol
 * @access Admin only
 */
router.get('/:id/users',
  ...middlewareStacks.adminOnly,
  validateParams(idParamsSchema),
  rolePermissions.read,
  asyncHandler(roleController.getUsersByRole)
);

/**
 * @route GET /roles/default
 * @desc Obtener roles por defecto del sistema
 * @access Admin, Teacher
 */
router.get('/default',
  ...middlewareStacks.teacherOrAdmin,
  rolePermissions.read,
  asyncHandler(roleController.getDefaultRoles)
);

/**
 * @route GET /roles/stats
 * @desc Obtener estadísticas de roles
 * @access Admin only
 */
router.get('/stats',
  ...middlewareStacks.adminOnly,
  rolePermissions.read,
  asyncHandler(roleController.getRoleStats)
);

/**
 * @route POST /roles/:id/clone
 * @desc Clonar rol existente
 * @access Admin only
 */
router.post('/:id/clone',
  ...middlewareStacks.adminOnly,
  validateParams(idParamsSchema),
  rolePermissions.create,
  asyncHandler(roleController.cloneRole)
);

/**
 * @route GET /roles/search
 * @desc Buscar roles por criterios
 * @access Admin, Teacher
 */
router.get('/search',
  ...middlewareStacks.teacherOrAdmin,
  rolePermissions.read,
  asyncHandler(roleController.searchRoles)
);

/**
 * @route PUT /roles/:id/hierarchy
 * @desc Actualizar jerarquía del rol
 * @access Admin only
 */
router.put('/:id/hierarchy',
  ...middlewareStacks.adminOnly,
  validateParams(idParamsSchema),
  rolePermissions.update,
  asyncHandler(roleController.updateRoleHierarchy)
);

/**
 * @route GET /roles/hierarchy
 * @desc Obtener jerarquía completa de roles
 * @access Admin, Teacher
 */
router.get('/hierarchy',
  ...middlewareStacks.teacherOrAdmin,
  rolePermissions.read,
  asyncHandler(roleController.getRoleHierarchy)
);

/**
 * @route POST /roles/bulk
 * @desc Crear múltiples roles
 * @access Admin only
 */
router.post('/bulk',
  ...middlewareStacks.adminOnly,
  rolePermissions.create,
  asyncHandler(roleController.createBulkRoles)
);

/**
 * @route PUT /roles/bulk
 * @desc Actualizar múltiples roles
 * @access Admin only
 */
router.put('/bulk',
  ...middlewareStacks.adminOnly,
  rolePermissions.update,
  asyncHandler(roleController.updateBulkRoles)
);

/**
 * @route DELETE /roles/bulk
 * @desc Eliminar múltiples roles
 * @access Admin only
 */
router.delete('/bulk',
  ...middlewareStacks.adminOnly,
  rolePermissions.delete,
  asyncHandler(roleController.deleteBulkRoles)
);

/**
 * @route GET /roles/permissions/available
 * @desc Obtener todos los permisos disponibles
 * @access Admin, Teacher
 */
router.get('/permissions/available',
  ...middlewareStacks.teacherOrAdmin,
  rolePermissions.read,
  asyncHandler(roleController.getAvailablePermissions)
);

/**
 * @route POST /roles/validate-permissions
 * @desc Validar conjunto de permisos
 * @access Admin only
 */
router.post('/validate-permissions',
  ...middlewareStacks.adminOnly,
  rolePermissions.read,
  asyncHandler(roleController.validatePermissions)
);

// ================================
// EXPORT ROUTER
// ================================

export default router;
