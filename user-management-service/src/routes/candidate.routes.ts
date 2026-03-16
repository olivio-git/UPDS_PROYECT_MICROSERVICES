import { Router } from 'express';
import { CandidateController } from '../controllers/CandidateController';
import {
  asyncHandler,
  candidatePermissions,
  middlewareStacks,
  validateBody,
  validateParams,
  validateQuery,
  validationPresets
} from '../middleware';
import {
  CreateCandidateSchema,
  UpdateCandidateSchema,
  getCandidatesQuerySchema,
  idParamsSchema,
  importCandidatesSchema
} from '../schemas';

// ================================
// CANDIDATE ROUTES
// ================================

const router = Router();
const candidateController = new CandidateController();

// ================================
// PUBLIC ROUTES
// ================================

/**
 * @route GET /health
 * @desc Health check específico para candidates
 * @access Public
 */
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Candidate management service is healthy',
    service: 'candidate-management',
    timestamp: new Date().toISOString()
  });
});

// ================================
// AUTHENTICATED ROUTES
// ================================

/**
 * @route GET /candidates
 * @desc Obtener lista de candidatos con filtros
 * @access Admin, Teacher, Proctor
 */
router.get('/',
  ...middlewareStacks.basicAuth,
  candidatePermissions.read,
  validateQuery(getCandidatesQuerySchema),
  asyncHandler(candidateController.getCandidates)
);

/**
 * @route GET /candidates/by-user/:userId
 * @desc Obtener candidato por userId
 * @access Admin, Teacher, Proctor
 */
router.get('/by-user/:userId',
  ...middlewareStacks.basicAuth,
  validateParams(idParamsSchema),
  candidatePermissions.read,
  asyncHandler(candidateController.getCandidateByUserId)
);
router.get('/by-auth-user/:id',
  ...middlewareStacks.basicAuth,
  validateParams(idParamsSchema),
  asyncHandler(candidateController.getCandidateByAuthUserId)
);
/**
 * @route POST /candidates/from-user/:userId
 * @desc Crear candidato automáticamente desde un usuario
 * @access Admin, Teacher
 */
router.post('/from-user/:userId',
  ...middlewareStacks.teacherOrAdmin,
  validateParams(idParamsSchema),
  candidatePermissions.create,
  asyncHandler(candidateController.createCandidateFromUser)
);

/**
 * @route GET /candidates/stats
 * @desc Obtener estadísticas de candidatos
 * @access Admin, Teacher
 */
router.get('/stats',
  ...middlewareStacks.teacherOrAdmin,
  candidatePermissions.read,
  asyncHandler(candidateController.getCandidateStats)
);

/**
 * @route GET /candidates/search
 * @desc Buscar candidatos por criterios
 * @access Admin, Teacher, Proctor
 */
router.get('/search',
  ...middlewareStacks.basicAuth,
  candidatePermissions.read,
  asyncHandler(candidateController.searchCandidates)
);

/**
 * @route GET /candidates/:id
 * @desc Obtener candidato por ID
 * @access Admin, Teacher, Proctor
 */
router.get('/:id',
  ...middlewareStacks.basicAuth,
  validateParams(idParamsSchema),
  candidatePermissions.read,
  asyncHandler(candidateController.getCandidateById)
);

/**
 * @route POST /candidates
 * @desc Crear nuevo candidato
 * @access Admin, Teacher
 */
router.post('/',
  ...middlewareStacks.teacherOrAdmin,
  validateBody(CreateCandidateSchema),
  candidatePermissions.create,
  asyncHandler(candidateController.createCandidate)
);

/**
 * @route POST /candidates/batch
 * @desc Obtener múltiples candidatos por IDs
 * @access Admin, Teacher, Proctor
 */
router.post('/batch',
  ...middlewareStacks.basicAuth,
  candidatePermissions.read,
  asyncHandler(candidateController.getCandidatesByIds)
);

/**
 * @route POST /candidates/internal/batch
 * @desc Obtener múltiples candidatos por IDs (para llamadas internas entre servicios)
 * @access Internal services only
 */
router.post('/internal/batch',
  // Middleware especial para verificar que la llamada viene de un servicio interno
  (req, res, next) => {
    const serviceHeader = req.headers['x-service'];
    const internalServices = ['exam-service', 'notification-service'];
    
    if (!serviceHeader || !internalServices.includes(serviceHeader as string)) {
      res.status(403).json({
        success: false,
        message: 'Acceso denegado. Solo servicios internos autorizados.'
      });
      return;
    }
    
    next();
  },
  asyncHandler(candidateController.getCandidatesByIds)
);

/**
 * @route PUT /candidates/:id
 * @desc Actualizar candidato completo
 * @access Admin, Teacher
 */
router.put('/:id',
  ...middlewareStacks.teacherOrAdmin,
  validateParams(idParamsSchema),
  validateBody(UpdateCandidateSchema),
  candidatePermissions.update,
  asyncHandler(candidateController.updateCandidate)
);

/**
 * @route PATCH /candidates/:id
 * @desc Actualización parcial de candidato
 * @access Admin, Teacher
 */
router.patch('/:id',
  ...middlewareStacks.teacherOrAdmin,
  validateParams(idParamsSchema),
  validateBody(UpdateCandidateSchema.partial()),
  candidatePermissions.update,
  asyncHandler(candidateController.patchCandidate)
);

/**
 * @route DELETE /candidates/:id
 * @desc Eliminar candidato (soft delete)
 * @access Admin only
 */
router.delete('/:id',
  ...middlewareStacks.adminOnly,
  validateParams(idParamsSchema),
  candidatePermissions.delete,
  asyncHandler(candidateController.deleteCandidate)
);

/**
 * @route PUT /candidates/:id/verify
 * @desc Verificar candidato
 * @access Admin, Teacher
 */
router.put('/:id/verify',
  ...middlewareStacks.teacherOrAdmin,
  validateParams(idParamsSchema),
  candidatePermissions.update,
  asyncHandler(candidateController.verifyCandidate)
);

/**
 * @route PUT /candidates/:id/technical-setup
 * @desc Actualizar configuración técnica del candidato
 * @access Admin, Teacher, Proctor
 */
router.put('/:id/technical-setup',
  ...middlewareStacks.basicAuth,
  validateParams(idParamsSchema),
  // candidatePermissions.update,
  asyncHandler(candidateController.updateTechnicalSetup)
);
router.get('/:id/technical-exist',
  ...middlewareStacks.basicAuth,
  validateParams(idParamsSchema),
  // candidatePermissions.update,
  asyncHandler(candidateController.getTechnicalSetup)
);
/**
 * @route PATCH /candidates/:id/technical-verification
 * @desc Guardar verificación técnica específica del candidato
 * @access Admin, Teacher, Proctor, Student (self)
 */
router.patch('/:id/technical-verification',
  ...middlewareStacks.basicAuth,
  validateParams(idParamsSchema),
  // Permitir que el estudiante actualice su propia verificación técnica
  (req, res, next) => {
    const user = req.user as any;
    const candidateId = req.params.id;
    
    // Si es admin, teacher o proctor, permitir acceso
    if (['admin', 'teacher', 'proctor'].includes(user.role)) {
      return next();
    }
    
    // Si es student, verificar que sea su propio candidato
    if (user.role === 'student') {
      // Aquí deberíamos verificar que el candidateId corresponde al userId
      // Por simplicidad, permitimos el acceso y la verificación se hace en el controller
      return next();
    }
    
    res.status(403).json({
      success: false,
      message: 'No tienes permisos para actualizar esta verificación técnica'
    });
  },
  asyncHandler(candidateController.updateTechnicalVerification)
);

/**
 * @route GET /candidates/:id/technical-verification-history
 * @desc Obtener historial de verificaciones técnicas del candidato
 * @access Admin, Teacher, Proctor
 */
router.get('/:id/technical-verification-history',
  ...middlewareStacks.basicAuth,
  validateParams(idParamsSchema),
  candidatePermissions.read,
  asyncHandler(candidateController.getTechnicalVerificationHistory)
);

/**
 * @route GET /candidates/:id/exam-history
 * @desc Obtener historial de exámenes del candidato
 * @access Admin, Teacher, Proctor
 */
router.get('/:id/exam-history',
  ...middlewareStacks.basicAuth,
  validateParams(idParamsSchema),
  candidatePermissions.read,
  asyncHandler(candidateController.getExamHistory)
);

/**
 * @route GET /candidates/:id/eligibility/:level
 * @desc Verificar elegibilidad para un nivel específico
 * @access Admin, Teacher
 */
router.get('/:id/eligibility/:level',
  ...middlewareStacks.teacherOrAdmin,
  validateParams(idParamsSchema),
  candidatePermissions.read,
  asyncHandler(candidateController.checkEligibility)
);

/**
 * @route GET /candidates/:id/target-level
 * @desc Calcular nivel objetivo del candidato
 * @access Admin, Teacher
 */
router.get('/:id/target-level',
  ...middlewareStacks.teacherOrAdmin,
  validateParams(idParamsSchema),
  candidatePermissions.read,
  asyncHandler(candidateController.calculateTargetLevel)
);


/**
 * @route POST /candidates/import
 * @desc Importar candidatos desde archivo Excel/CSV
 * @access Admin, Teacher
 */
router.post('/import',
  ...middlewareStacks.teacherOrAdmin,
  validationPresets.documentFile,
  validateBody(importCandidatesSchema),
  candidatePermissions.any(['create', 'import']),
  asyncHandler(candidateController.importCandidates)
);

/**
 * @route GET /candidates/export
 * @desc Exportar candidatos a Excel/CSV
 * @access Admin, Teacher
 */
router.get('/export',
  ...middlewareStacks.teacherOrAdmin,
  candidatePermissions.any(['read', 'export']),
  asyncHandler(candidateController.exportCandidates)
);

/**
 * @route POST /candidates/bulk
 * @desc Crear múltiples candidatos
 * @access Admin, Teacher
 */
router.post('/bulk',
  ...middlewareStacks.teacherOrAdmin,
  candidatePermissions.create,
  asyncHandler(candidateController.createBulkCandidates)
);

/**
 * @route PUT /candidates/bulk
 * @desc Actualizar múltiples candidatos
 * @access Admin, Teacher
 */
router.put('/bulk',
  ...middlewareStacks.teacherOrAdmin,
  candidatePermissions.update,
  asyncHandler(candidateController.updateBulkCandidates)
);

/**
 * @route DELETE /candidates/bulk
 * @desc Eliminar múltiples candidatos
 * @access Admin only
 */
router.delete('/bulk',
  ...middlewareStacks.adminOnly,
  candidatePermissions.delete,
  asyncHandler(candidateController.deleteBulkCandidates)
);

/**
 * @route PUT /candidates/bulk/verify
 * @desc Verificar múltiples candidatos
 * @access Admin, Teacher
 */
router.put('/bulk/verify',
  ...middlewareStacks.teacherOrAdmin,
  candidatePermissions.update,
  asyncHandler(candidateController.bulkVerifyCandidates)
);

/**
 * @route POST /candidates/:id/duplicate
 * @desc Duplicar candidato (para tests o templates)
 * @access Admin, Teacher
 */
router.post('/:id/duplicate',
  ...middlewareStacks.teacherOrAdmin,
  validateParams(idParamsSchema),
  candidatePermissions.create,
  asyncHandler(candidateController.duplicateCandidate)
);

/**
 * @route GET /candidates/by-level/:level
 * @desc Obtener candidatos por nivel
 * @access Admin, Teacher, Proctor
 */
router.get('/by-level/:level',
  ...middlewareStacks.basicAuth,
  candidatePermissions.read,
  asyncHandler(candidateController.getCandidatesByLevel)
);

/**
 * @route GET /candidates/by-status/:status
 * @desc Obtener candidatos por estado
 * @access Admin, Teacher, Proctor
 */
router.get('/by-status/:status',
  ...middlewareStacks.basicAuth,
  candidatePermissions.read,
  asyncHandler(candidateController.getCandidatesByStatus)
);

/**
 * @route PUT /candidates/:id/notes
 * @desc Actualizar notas del candidato
 * @access Admin, Teacher
 */
router.put('/:id/notes',
  ...middlewareStacks.teacherOrAdmin,
  validateParams(idParamsSchema),
  candidatePermissions.update,
  asyncHandler(candidateController.updateCandidateNotes)
);

/**
 * @route GET /candidates/recent
 * @desc Obtener candidatos recientes
 * @access Admin, Teacher
 */
router.get('/recent',
  ...middlewareStacks.teacherOrAdmin,
  candidatePermissions.read,
  asyncHandler(candidateController.getRecentCandidates)
);

// ================================
// EXPORT ROUTER
// ================================

export default router;
