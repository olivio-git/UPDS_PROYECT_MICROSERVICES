import { NextFunction, Request, Response, Router } from 'express';
import multer from 'multer';
import { UserController } from '../controllers/UserController';
import {
  asyncHandler,
  middlewareStacks,
  userPermissions,
  validateBody,
  validateParams,
  validateQuery
} from '../middleware';
import {
  CreateUserSchema,
  UpdateUserPasswordSchema,
  UpdateUserSchema,
  getUsersQuerySchema,
  idParamsSchema
} from '../schemas';

const upload = multer({ storage: multer.memoryStorage() });

// ================================
// USER ROUTES
// ================================

const router = Router();
const userController = new UserController();

// ================================
// PUBLIC ROUTES
// ================================

/**
 * @route GET /health
 * @desc Health check específico para users
 * @access Public
 */
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'User management service is healthy',
    service: 'user-management',
    timestamp: new Date().toISOString()
  });
});

/**
 * @route GET /health/detailed
 * @desc Health check detallado con conexiones externas
 * @access Admin
 */
router.get('/health/detailed',
  ...middlewareStacks.adminOnly,
  asyncHandler(userController.healthCheck)
);

// ================================
// AUTHENTICATED ROUTES
// ================================

/**
 * @route GET /users
 * @desc Obtener lista de usuarios con filtros
 * @access Admin, Teacher (limited)
 */
router.get('/',
  ...middlewareStacks.basicAuth,
  userPermissions.read,
  validateQuery(getUsersQuerySchema),
  asyncHandler(userController.getUsers)
);
// GET PROCTORS WITH NOT EXISTING IN SESSION
router.get('/proctors',
  ...middlewareStacks.basicAuth,
  userPermissions.read,
  validateQuery(getUsersQuerySchema),
  asyncHandler(userController.getProctors)
);

/**
 * @route GET /users/stats
 * @desc Obtener estadísticas de usuarios
 * @access Admin only
 */
router.get('/stats',
  ...middlewareStacks.adminOnly,
  userPermissions.read,
  asyncHandler(userController.getUserStats)
);

/**
 * @route GET /users/search
 * @desc Buscar usuarios por criterios
 * @access Admin, Teacher
 */
router.get('/search',
  ...middlewareStacks.teacherOrAdmin,
  userPermissions.read,
  asyncHandler(userController.searchUsers)
);

/**
 * @route GET /users/template
 * @desc Descargar plantilla Excel para importación de usuarios
 * @access Admin only
 */
router.get('/template',
  ...middlewareStacks.adminOnly,
  asyncHandler(userController.downloadTemplate)
);

/**
 * @route GET /users/export
 * @desc Exportar usuarios a Excel con filtros opcionales
 * @access Admin only
 */
router.get('/export',
  ...middlewareStacks.adminOnly,
  validateQuery(getUsersQuerySchema),
  asyncHandler(userController.exportUsers)
);

/**
 * @route POST /users/import
 * @desc Importar usuarios desde archivo Excel o CSV
 * @access Admin only
 */
router.post('/import',
  ...middlewareStacks.adminOnly,
  upload.single('file'),
  asyncHandler(userController.importUsers)
);

/**
 * @route GET /users/:id
 * @desc Obtener usuario por ID
 * @access Admin, Teacher, Own User
 */
router.get('/:id',
  ...middlewareStacks.basicAuth,
  validateParams(idParamsSchema),
  userPermissions.read,
  asyncHandler(userController.getUserById)
);

/**
 * @route POST /users
 * @desc Crear nuevo usuario
 * @access Admin
 */
router.post('/',
  ...middlewareStacks.adminOnly,
  validateBody(CreateUserSchema),
  userPermissions.create,
  asyncHandler(userController.createUser)
);

/**
 * @route GET /users/me
 * @desc Obtener perfil completo del usuario autenticado (por JWT)
 * @access Own User
 */
router.get('/me',
  ...middlewareStacks.basicAuth,
  asyncHandler(userController.getMe)
);

/**
 * @route PATCH /users/me
 * @desc Actualizar perfil del usuario autenticado (por JWT)
 * @access Own User
 */
router.patch('/me',
  ...middlewareStacks.basicAuth,
  validateBody(UpdateUserSchema.partial()),
  asyncHandler(userController.updateMe)
);

/**
 * @route PUT /users/:id
 * @desc Actualizar usuario completo
 * @access Admin, Own User (limited fields)
 */
router.put('/:id',
  ...middlewareStacks.basicAuth,
  validateParams(idParamsSchema),
  validateBody(UpdateUserSchema),
  userPermissions.update,
  asyncHandler(userController.updateUser)
);

/**
 * @route PUT /users/:id
 * @desc Actualizar usuario completo
 * @access Admin,Student Own User (limited fields)
 */
router.put('/:id/change-password',
  ...middlewareStacks.basicAuth,
  validateBody(UpdateUserPasswordSchema),
  userPermissions.update,
  asyncHandler(userController.changePassword)
);

/**
 * @route PATCH /users/:id
 * @desc Actualización parcial de usuario
 * @access Admin, Own User (limited fields)
 */
router.patch('/:id',
  ...middlewareStacks.basicAuth,
  validateParams(idParamsSchema),
  validateBody(UpdateUserSchema.partial()),
  userPermissions.update,
  asyncHandler(userController.patchUser)
);

/**
 * @route DELETE /users/:id
 * @desc Eliminar usuario (soft delete)
 * @access Admin only
 */
router.delete('/:id',
  ...middlewareStacks.adminOnly,
  validateParams(idParamsSchema),
  userPermissions.delete,
  asyncHandler(userController.deleteUser)
);

/**
 * @route PUT /users/:id/activate
 * @desc Activar usuario
 * @access Admin only
 */
router.put('/:id/activate',
  ...middlewareStacks.adminOnly,
  validateParams(idParamsSchema),
  userPermissions.update,
  asyncHandler(userController.activateUser)
);

/**
 * @route PUT /users/:id/deactivate
 * @desc Desactivar usuario
 * @access Admin only
 */
router.put('/:id/deactivate',
  ...middlewareStacks.adminOnly,
  validateParams(idParamsSchema),
  userPermissions.update,
  asyncHandler(userController.deactivateUser)
);

/**
 * @route POST /users/:id/generate-password
 * @desc Generar nueva contraseña temporal (envía por email por defecto)
 * @access Admin only
 */
router.post('/:id/generate-password',
  ...middlewareStacks.adminOnly,
  validateParams(idParamsSchema),
  userPermissions.update,
  asyncHandler(userController.generateTemporaryPassword)
);

/**
 * @route POST /users/:id/generate-password-visible
 * @desc Generar contraseña temporal visible (solo casos especiales)
 * @access Admin only
 */
router.post('/:id/generate-password-visible',
  ...middlewareStacks.adminOnly,
  validateParams(idParamsSchema),
  userPermissions.update,
  (req: Request, res: Response, next: NextFunction) => {
    req.body.sendByEmail = false; // Forzar mostrar contraseña
    next();
  },
  asyncHandler(userController.generateTemporaryPassword)
);

/**
 * @route PUT /users/:id/assign-role
 * @desc Asignar rol a usuario
 * @access Admin only
 */
router.put('/:id/assign-role',
  ...middlewareStacks.adminOnly,
  validateParams(idParamsSchema),
  userPermissions.update,
  asyncHandler(userController.assignRole)
);

/**
 * @route PUT /users/:id/assign-permissions
 * @desc Asignar permisos específicos a usuario
 * @access Admin only
 */
router.put('/:id/assign-permissions',
  ...middlewareStacks.adminOnly,
  validateParams(idParamsSchema),
  userPermissions.update,
  asyncHandler(userController.assignPermissions)
);

/**
 * @route GET /users/:id/permissions
 * @desc Obtener permisos de usuario
 * @access Admin, Own User
 */
router.get('/:id/permissions',
  ...middlewareStacks.basicAuth,
  validateParams(idParamsSchema),
  userPermissions.read,
  asyncHandler(userController.getUserPermissions)
);


/**
 * @route POST /users/:id/avatar
 * @desc Subir foto de perfil (avatar)
 * @access Own User, Admin
 */
router.post('/:id/avatar',
  ...middlewareStacks.basicAuth,
  validateParams(idParamsSchema),
  upload.single('avatar'),
  asyncHandler(userController.uploadAvatar)
);

/**
 * @route PUT /users/:id/profile
 * @desc Actualizar perfil de usuario
 * @access Own User, Admin
 */
router.put('/:id/profile',
  ...middlewareStacks.basicAuth,
  validateParams(idParamsSchema),
  // El controller verificará ownership o permisos admin
  asyncHandler(userController.updateProfile)
);

/**
 * @route POST /users/bulk
 * @desc Crear múltiples usuarios
 * @access Admin only
 */
router.post('/bulk',
  ...middlewareStacks.adminOnly,
  userPermissions.create,
  asyncHandler(userController.createBulkUsers)
);

/**
 * @route PUT /users/bulk
 * @desc Actualizar múltiples usuarios
 * @access Admin only
 */
router.put('/bulk',
  ...middlewareStacks.adminOnly,
  userPermissions.update,
  asyncHandler(userController.updateBulkUsers)
);

/**
 * @route DELETE /users/bulk
 * @desc Eliminar múltiples usuarios
 * @access Admin only
 */
router.delete('/bulk',
  ...middlewareStacks.adminOnly,
  userPermissions.delete,
  asyncHandler(userController.deleteBulkUsers)
);

// ================================
// EXPORT ROUTER
// ================================

export default router;
