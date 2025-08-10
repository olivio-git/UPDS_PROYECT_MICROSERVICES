import { Router } from 'express';
import { CandidateController } from '../controllers/CandidateController';
import { 
  middlewareStacks, 
  asyncHandler,
  candidatePermissions,
  validateBody,
  validateQuery,
  validateParams,
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
  candidatePermissions.update,
  asyncHandler(candidateController.updateTechnicalSetup)
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
