import { NextFunction, Request, Response } from 'express';
import { createError } from '../middleware/error.middleware';
import { CandidateService } from '../services/candidate.service';
import { UserService } from '../services/user.service';
import { JWTPayload } from '../types';

export class CandidateController {
  private candidateService: CandidateService;
  private userService: UserService;

  constructor() {
    this.candidateService = new CandidateService();
    this.userService = new UserService();
  }

  // ================================
  // GET CANDIDATES
  // ================================
  
  getCandidates = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = req.query as any;
      const page = parseInt(query.page) || 1;
      const limit = parseInt(query.limit) || 10;
      const status = query.status || undefined;
      const search = query.search || undefined;
      const level = query.level || undefined;
      const sortBy = query.sortBy || 'createdAt';
      const sortOrder = query.sortOrder || 'desc';

      // Construir parámetros de paginación
      const pagination = {
        page,
        limit,
        sortBy,
        sortOrder: sortOrder as 'asc' | 'desc'
      };

      // Construir filtros
      const filters: any = {};
      if (status) filters.status = status;
      if (search) filters.search = search;
      if (level) filters.level = level;

      // Obtener candidatos usando el servicio real
      const result = await this.candidateService.getCandidates(pagination, filters);

      if (!result.success) {
        res.status(400).json(result);
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Lista de candidatos obtenida exitosamente',
        data: {
          items: result.data.candidates,
          total: result.data.total,
          page: result.data.page,
          totalPages: result.data.totalPages,
          hasNext: result.data.hasNext,
          hasPrev: result.data.hasPrev
        }
      });
    } catch (error) {
      next(error);
    }
  };

  // ================================
  // GET CANDIDATE BY ID
  // ================================
  
  getCandidateById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      if (!id) {
        res.status(400).json({
          success: false,
          message: 'ID de candidato es requerido'
        });
        return;
      }
      const result = await this.candidateService.getCandidateById(id!);
      
      if (!result.success) {
        res.status(result.error === 'CANDIDATE_NOT_FOUND' ? 404 : 400).json(result);
        return 
      }

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  // ================================
  // 🆕 GET CANDIDATE BY USER ID
  // ================================
  
  getCandidateByUserId = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { userId } = req.params;
      if( !userId) {
        res.status(400).json({
          success: false,
          message: 'User ID es requerido'
        });
        return;
      }
      const candidate = await this.candidateService.findByUserId(userId);
      
      if (!candidate) {
        res.status(404).json({
          success: false,
          message: 'No se encontró candidato para este usuario'
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Candidato obtenido exitosamente',
        data: candidate.toJSON()
      });
    } catch (error) {
      next(error);
    }
  };
  getCandidateByAuthUserId = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const { id } = req.params;
        if( !id) {
          res.status(400).json({
            success: false,
            message: 'User ID es requerido'
          });
          return;
        }
        const candidate = await this.candidateService.findByAuthUserId(id);

        if (!candidate) {
          res.status(404).json({
            success: false,
            message: 'No se encontró candidato para este usuario'
          });
          return;
        }

        res.status(200).json({
          success: true,
          message: 'Candidato obtenido exitosamente',
          data: candidate.toJSON()
        });
      } catch (error) {
        next(error);
      }
    };
  // ================================
  // 🆕 CREATE CANDIDATE FROM USER
  // ================================
  
  createCandidateFromUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { userId } = req.params;
      if(!userId){
        res.status(400).json({
          success: false,
          message: 'User ID es requerido'
        });
        return;
      }
      // Verificar que no existe candidato ya
      const existingCandidate = await this.candidateService.findByUserId(userId);
      if (existingCandidate) {
        res.status(409).json({
          success: false,
          message: 'Ya existe un candidato para este usuario'
        });
      }

      // Obtener datos del usuario real
      const userResult = await this.userService.getUserById(userId);
      if (!userResult.success) {
        res.status(404).json({
          success: false,
          message: 'Usuario no encontrado'
        });
      }

      const user = userResult.data.user;

      // Solo crear candidato si es student
      if (user.role !== 'student') {
        res.status(400).json({
          success: false,
          message: 'Solo se pueden crear candidatos para usuarios con rol student'
        });
      }

      // Crear candidato desde user
      const candidate = await this.candidateService.createFromUser(user);

      res.status(201).json({
        success: true,
        message: 'Candidato creado exitosamente desde usuario',
        data: candidate.toJSON()
      });
    } catch (error) {
      next(error);
    }
  };

  // ================================
  // CREATE CANDIDATE
  // ================================
  
  createCandidate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const candidateData = req.body;
      const currentUser = req.user as JWTPayload;

      const result = await this.candidateService.createCandidate(candidateData, currentUser.userId);

      if (!result.success) {
        res.status(400).json(result);
      }

      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  };

  // ================================
  // UPDATE CANDIDATE
  // ================================
  
  updateCandidate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const updates = req.body;
      if (!id) {
        res.status(400).json({
          success: false,
          message: 'ID de candidato es requerido'
        });
        return;
      }
      const result = await this.candidateService.updateCandidate(id, updates);

      if (!result.success) {
        res.status(result.error === 'CANDIDATE_NOT_FOUND' ? 404 : 400).json(result);
      }

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  // ================================
  // PATCH CANDIDATE
  // ================================
  
  patchCandidate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const updates = req.body;
      if(!id) {
        res.status(400).json({
          success: false,
          message: 'ID de candidato es requerido'
        });
        return;
      }
      const result = await this.candidateService.updateCandidate(id, updates);

      if (!result.success) {
        res.status(result.error === 'CANDIDATE_NOT_FOUND' ? 404 : 400).json(result);
      }

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  // ================================
  // DELETE CANDIDATE
  // ================================
  
  deleteCandidate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      if(!id) {
        res.status(400).json({
          success: false,
          message: 'ID de candidato es requerido'
        });
        return;
      }
      const result = await this.candidateService.deleteCandidate(id);

      if (!result.success) {
        res.status(result.error === 'CANDIDATE_NOT_FOUND' ? 404 : 400).json(result);
      }

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  // ================================
  // VERIFY CANDIDATE
  // ================================
  
  verifyCandidate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      if( !id) {
        res.status(400).json({
          success: false,
          message: 'ID de candidato es requerido'
        });
        return;
      }
      const result = await this.candidateService.updateCandidateStatus(id, 'verified');

      if (!result.success) {
        res.status(result.error === 'CANDIDATE_NOT_FOUND' ? 404 : 400).json(result);
      }
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  // ================================
  // UPDATE TECHNICAL SETUP
  // ================================
  
  updateTechnicalSetup = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const technicalData = req.body;

      if (!id) {
        res.status(400).json({
          success: false,
          message: 'ID de candidato es requerido'
        });
        return;
      }

      // Obtener candidato actual para fusionar datos técnicos
      const candidateResult = await this.candidateService.getCandidateById(id);
      if (!candidateResult.success) {
        res.status(404).json({
          success: false,
          message: 'Candidato no encontrado'
        });
        return;
      }

      const currentCandidate = candidateResult.data.candidate;
      
      // Fusionar configuración técnica existente con nueva
      const updatedTechnicalSetup = {
        ...currentCandidate.technicalSetup,
        ...technicalData,
        lastTechCheck: new Date(),
        // Agregar historial de verificaciones si existe
        verificationHistory: [
          ...(currentCandidate.technicalSetup?.verificationHistory || []),
          {
            id: `verification_${Date.now()}`,
            timestamp: new Date(),
            results: technicalData.techCheckResults || {},
            overallStatus: technicalData.verificationStatus || 'pending',
            metadata: {
              browser: technicalData.browserInfo?.name || 'Unknown',
              os: technicalData.systemInfo?.os || 'Unknown',
              ipAddress: req.ip || 'Unknown',
              userAgent: req.get('User-Agent') || 'Unknown'
            }
          }
        ].slice(-10) // Mantener solo las últimas 10 verificaciones
      };

      const updates = {
        technicalSetup: updatedTechnicalSetup
      };
      
      const result = await this.candidateService.updateCandidate(id, updates);

      if (!result.success) {
        res.status(result.error === 'CANDIDATE_NOT_FOUND' ? 404 : 400).json(result);
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Configuración técnica actualizada exitosamente',
        data: {
          candidateId: id,
          technicalSetup: updatedTechnicalSetup,
          updatedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      next(error);
    }
  };
  getTechnicalSetup = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const { id } = req.params; 

        if (!id) {
          res.status(400).json({
            success: false,
            message: 'ID de candidato es requerido'
          });
          return;
        }

        const getTechnicalSetup = await this.candidateService.getTechnicalSetupById(id);
        if (!getTechnicalSetup.success) {
          res.status(404).json({
            success: false,
            message: 'Configuración técnica no encontrada'
          });
          return;
        }

        res.status(200).json({
          success: true,
          message: 'Configuración técnica obtenida exitosamente',
          data: {
            candidateId: id,
            technicalSetup: getTechnicalSetup.data.technicalSetup,
            updatedAt: new Date().toISOString()
          }
        });
      } catch (error) {
        next(error);
      }
    };
  // ================================
  // 🆕 UPDATE TECHNICAL VERIFICATION (SPECIFIC ENDPOINT)
  // ================================
  
  updateTechnicalVerification = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const verificationData = req.body;

      if (!id) {
        res.status(400).json({
          success: false,
          message: 'ID de candidato es requerido'
        });
        return;
      }

      // Validar datos de verificación
      if (!verificationData.verificationData) {
        res.status(400).json({
          success: false,
          message: 'Datos de verificación requeridos'
        });
        return;
      }

      // Obtener candidato actual
      const candidateResult = await this.candidateService.getCandidateById(id);
      if (!candidateResult.success) {
        res.status(404).json({
          success: false,
          message: 'Candidato no encontrado'
        });
        return;
      }

      const currentCandidate = candidateResult.data.candidate;
      const verification = verificationData.verificationData;
      
      // Crear nueva entrada de verificación
      const newVerification = {
        id: `verification_${Date.now()}`,
        sessionId: verificationData.sessionId,
        timestamp: new Date(),
        results: {
          camera: verification.permissions?.camera === 'granted',
          microphone: verification.permissions?.microphone === 'granted',
          speakers: verification.checks?.find((c: any) => c.name === 'Auriculares/Altavoces')?.status === 'success',
          internetSpeed: verification.connection?.downlink || 0,
          latency: verification.connection?.rtt || 0,
          browserCompatible: verification.checks?.find((c: any) => c.name === 'Navegador Compatible')?.status === 'success',
          screenResolution: verification.screen ? `${verification.screen.width}x${verification.screen.height}` : 'Unknown'
        },
        overallStatus: verification.overallStatus || 'pending',
        metadata: {
          browser: verification.browser?.userAgent || 'Unknown',
          os: verification.browser?.platform || 'Unknown',
          ipAddress: req.ip || 'Unknown',
          userAgent: req.get('User-Agent') || 'Unknown',
          verificationStarted: verification.verificationStarted,
          verificationCompleted: verification.verificationCompleted
        }
      };

      // Actualizar configuración técnica
      const updatedTechnicalSetup = {
        ...currentCandidate.technicalSetup,
        hasCamera: newVerification.results.camera,
        hasMicrophone: newVerification.results.microphone,
        hasStableInternet: newVerification.results.internetSpeed > 1, // > 1 Mbps
        browserInfo: {
          name: verification.browser?.userAgent?.includes('Chrome') ? 'Chrome' : 
                verification.browser?.userAgent?.includes('Firefox') ? 'Firefox' : 
                verification.browser?.userAgent?.includes('Safari') ? 'Safari' : 'Unknown',
          version: 'Unknown',
          userAgent: verification.browser?.userAgent || 'Unknown'
        },
        systemInfo: {
          os: verification.browser?.platform || 'Unknown',
          device: 'Unknown',
          screenResolution: newVerification.results.screenResolution
        },
        lastTechCheck: new Date(),
        techCheckResults: newVerification.results,
        verificationStatus: newVerification.overallStatus,
        lastVerificationId: newVerification.id,
        verificationHistory: [
          ...(currentCandidate.technicalSetup?.verificationHistory || []),
          newVerification
        ].slice(-10) // Mantener solo las últimas 10 verificaciones
      };

      const updates = {
        technicalSetup: updatedTechnicalSetup
      };
      
      const result = await this.candidateService.updateCandidate(id, updates);

      if (!result.success) {
        res.status(result.error === 'CANDIDATE_NOT_FOUND' ? 404 : 400).json(result);
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Verificación técnica guardada exitosamente',
        data: {
          candidateId: id,
          verificationId: newVerification.id,
          overallStatus: newVerification.overallStatus,
          results: newVerification.results,
          timestamp: newVerification.timestamp,
          sessionId: verificationData.sessionId
        }
      });
    } catch (error) {
      next(error);
    }
  };

  // ================================
  // 🆕 GET TECHNICAL VERIFICATION HISTORY
  // ================================
  
  getTechnicalVerificationHistory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const limit = parseInt(req.query.limit as string) || 10;

      if (!id) {
        res.status(400).json({
          success: false,
          message: 'ID de candidato es requerido'
        });
        return;
      }

      const candidateResult = await this.candidateService.getCandidateById(id);
      if (!candidateResult.success) {
        res.status(404).json({
          success: false,
          message: 'Candidato no encontrado'
        });
        return;
      }

      const candidate = candidateResult.data.candidate;
      const verificationHistory = candidate.technicalSetup?.verificationHistory || [];
      
      // Ordenar por timestamp descendente y limitar
      const sortedHistory = verificationHistory
        .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, limit);

      res.status(200).json({
        success: true,
        message: 'Historial de verificaciones técnicas obtenido exitosamente',
        data: {
          candidateId: id,
          verifications: sortedHistory,
          total: verificationHistory.length,
          currentTechnicalSetup: candidate.technicalSetup
        }
      });
    } catch (error) {
      next(error);
    }
  };

  // ================================
  // GET EXAM HISTORY
  // ================================
  
  getExamHistory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      if(!id) {
        res.status(400).json({
          success: false,
          message: 'ID de candidato es requerido'
        });
        return;
      }
      const candidateResult = await this.candidateService.getCandidateById(id);
      
      if (!candidateResult.success) {
        res.status(404).json({
          success: false,
          message: 'Candidato no encontrado'
        });
      }

      const candidate = candidateResult.data.candidate;

      res.status(200).json({
        success: true,
        message: 'Historial de exámenes obtenido exitosamente',
        data: {
          candidateId: id,
          examHistory: candidate.examHistory || [],
          total: candidate.examHistory?.length || 0
        }
      });
    } catch (error) {
      next(error);
    }
  };

  // ================================
  // CHECK ELIGIBILITY
  // ================================
  
  checkEligibility = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id, level } = req.params;
      if(!id){
        res.status(400).json({
          success: false,
          message: 'ID de candidato es requerido'
        });
        return;
      }
      const candidateResult = await this.candidateService.getCandidateById(id);
      
      if (!candidateResult.success) {
        res.status(404).json({
          success: false,
          message: 'Candidato no encontrado'
        });
      }

      const candidate = candidateResult.data.candidate;
      
      // Lógica simple de elegibilidad (puede ser más compleja)
      const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
      const currentIndex = levels.indexOf(candidate.academicInfo.currentLevel);
      if (currentIndex === -1) {
        res.status(400).json({
          success: false,
          message: 'Nivel actual no válido'
        });
        return;
      }
      const targetIndex = levels.indexOf(level!);
      
      const isEligible = targetIndex <= currentIndex + 1;
      const reasons = [];
      
      if (!isEligible) {
        reasons.push(`Nivel actual (${candidate.academicInfo.currentLevel}) no permite acceso directo a ${level}`);
      }

      res.status(200).json({
        success: true,
        message: 'Elegibilidad verificada exitosamente',
        data: {
          candidateId: id,
          level,
          isEligible,
          reasons,
          currentLevel: candidate.academicInfo.currentLevel,
          suggestedLevel: currentIndex < levels.length - 1 ? levels[currentIndex + 1] : candidate.academicInfo.currentLevel
        }
      });
    } catch (error) {
      next(error);
    }
  };

  // ================================
  // CALCULATE TARGET LEVEL
  // ================================
  
  calculateTargetLevel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      if(!id) {
        res.status(400).json({
          success: false,
          message: 'ID de candidato es requerido'
        });
        return;
      }
      const candidateResult = await this.candidateService.getCandidateById(id!);
      
      if (!candidateResult.success) {
        res.status(404).json({
          success: false,
          message: 'Candidato no encontrado'
        });
      }

      const candidate = candidateResult.data.candidate;
      
      // Lógica para calcular nivel objetivo basada en historial
      const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
      const currentIndex = levels.indexOf(candidate.academicInfo.currentLevel);
      
      let targetLevel = candidate.academicInfo.currentLevel;
      let confidence = 0.5;
      
      // Si tiene historial de exámenes, usar el último aprobado
      if (candidate.examHistory && candidate.examHistory.length > 0) {
        const passedExams = candidate.examHistory.filter((exam:any) => exam.result === 'passed');
        if (passedExams.length > 0) {
          const lastPassed = passedExams[passedExams.length - 1];
          const lastPassedIndex = levels.indexOf(lastPassed.level);
          if (lastPassedIndex < levels.length - 1) {
            targetLevel = levels[lastPassedIndex + 1];
            confidence = 0.85;
          }
        }
      } else {
        // Sin historial, sugerir el siguiente nivel
        if (currentIndex < levels.length - 1) {
          targetLevel = levels[currentIndex + 1];
          confidence = 0.7;
        }
      }

      res.status(200).json({
        success: true,
        message: 'Nivel objetivo calculado exitosamente',
        data: {
          candidateId: id,
          currentLevel: candidate.academicInfo.currentLevel,
          targetLevel,
          confidence,
          examHistory: candidate.examHistory?.length || 0
        }
      });
    } catch (error) {
      next(error);
    }
  };

  // ================================
  // GET CANDIDATES BY IDS (BATCH)
  // ================================
  
  getCandidatesByIds = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { ids } = req.body;
      
      if (!ids || !Array.isArray(ids)) {
        throw createError.badRequest('IDs array is required');
      }

      const candidates = [];
      
      for (const id of ids) {
        try {
          const result = await this.candidateService.getCandidateById(id);
          if (result.success) {
            candidates.push(result.data.candidate);
          }
        } catch (error) {
          console.warn(`Error obteniendo candidato ${id}:`, error);
        }
      }

      res.status(200).json({
        success: true,
        message: 'Candidatos obtenidos exitosamente',
        data: candidates
      });
    } catch (error) {
      next(error);
    }
  };

  // ================================
  // SEARCH CANDIDATES
  // ================================
  
  searchCandidates = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { query } = req.query;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;

      if (!query || typeof query !== 'string') {
        res.status(400).json({
          success: false,
          message: 'Parámetro de búsqueda requerido'
        });
        return;
      }

      const pagination = { page, limit, sortBy: 'createdAt', sortOrder: 'desc' as 'desc' };
      
      const result = await this.candidateService.searchCandidates(query, pagination);

      if (!result.success) {
        res.status(400).json(result);
      }

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  // ================================
  // GET CANDIDATE STATS
  // ================================
  
  getCandidateStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.candidateService.getCandidateStats();

      if (!result.success) {
        res.status(400).json(result);
      }

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  // ================================
  // IMPORT CANDIDATES
  // ================================
  
  importCandidates = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const csvData = req.body.data || [];
      const currentUser = req.user as JWTPayload;
      
      const options = {
        importedBy: currentUser.userId
      };

      const result = await this.candidateService.importCandidates(csvData, options);

      if (!result.success) {
        res.status(400).json(result);
      }

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  // ================================
  // EXPORT CANDIDATES
  // ================================
  
  exportCandidates = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Por ahora, implementación básica
      // En producción, esto podría generar un archivo real y devolver URL de descarga
      
      const filters = req.query;
      const pagination = { page: 1, limit: 1000, sortBy: 'createdAt', sortOrder: 'desc' as 'desc' };
      
      const result = await this.candidateService.getCandidates(pagination, filters);

      if (!result.success) {
        res.status(400).json(result);
      }

      res.status(200).json({
        success: true,
        message: 'Exportación completada exitosamente',
        data: {
          candidates: result.data.candidates,
          total: result.data.total,
          exportedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      next(error);
    }
  };

  // ================================
  // BULK OPERATIONS
  // ================================
  
  createBulkCandidates = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const candidatesData = req.body.candidates || [];
      const currentUser = req.user as JWTPayload;

      let created = 0;
      let failed = 0;
      const results = [];

      for (const candidateData of candidatesData) {
        try {
          const result = await this.candidateService.createCandidate(candidateData, currentUser.userId);
          if (result.success) {
            created++;
            results.push({ status: 'created', data: result.data });
          } else {
            failed++;
            results.push({ status: 'failed', error: result.message });
          }
        } catch (error) {
          failed++;
          results.push({ status: 'failed', error: 'Error interno' });
        }
      }

      res.status(200).json({
        success: true,
        message: 'Creación masiva completada',
        data: {
          created,
          failed,
          total: candidatesData.length,
          results
        }
      });
    } catch (error) {
      next(error);
    }
  };

  updateBulkCandidates = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const updates = req.body.updates || [];

      let updated = 0;
      let failed = 0;
      const results = [];

      for (const update of updates) {
        try {
          if (!update.id) {
            failed++;
            results.push({ status: 'failed', error: 'ID requerido' });
            continue;
          }

          const result = await this.candidateService.updateCandidate(update.id, update.data);
          if (result.success) {
            updated++;
            results.push({ status: 'updated', data: result.data });
          } else {
            failed++;
            results.push({ status: 'failed', error: result.message });
          }
        } catch (error) {
          failed++;
          results.push({ status: 'failed', error: 'Error interno' });
        }
      }

      res.status(200).json({
        success: true,
        message: 'Actualización masiva completada',
        data: {
          updated,
          failed,
          total: updates.length,
          results
        }
      });
    } catch (error) {
      next(error);
    }
  };

  deleteBulkCandidates = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { ids } = req.body;

      if (!ids || !Array.isArray(ids)) {
        res.status(400).json({
          success: false,
          message: 'Array de IDs requerido'
        });
      }

      const result = await this.candidateService.bulkDeleteCandidates(ids);

      if (!result.success) {
        res.status(400).json(result);
      }

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  bulkVerifyCandidates = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { ids } = req.body;

      if (!ids || !Array.isArray(ids)) {
        res.status(400).json({
          success: false,
          message: 'Array de IDs requerido'
        });
      }

      let verified = 0;
      let failed = 0;
      const results = [];

      for (const id of ids) {
        try {
          const result = await this.candidateService.updateCandidateStatus(id, 'verified');
          if (result.success) {
            verified++;
            results.push({ id, status: 'verified' });
          } else {
            failed++;
            results.push({ id, status: 'failed', error: result.message });
          }
        } catch (error) {
          failed++;
          results.push({ id, status: 'failed', error: 'Error interno' });
        }
      }

      res.status(200).json({
        success: true,
        message: 'Verificación masiva completada',
        data: {
          verified,
          failed,
          total: ids.length,
          results
        }
      });
    } catch (error) {
      next(error);
    }
  };

  // ================================
  // ADDITIONAL OPERATIONS
  // ================================
  
  duplicateCandidate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const currentUser = req.user as JWTPayload;
      if (!id) {
        res.status(400).json({
          success: false,
          message: 'ID de candidato es requerido'
        });
        return;
      }
      // Obtener candidato original
      const originalResult = await this.candidateService.getCandidateById(id);
      
      if (!originalResult.success) {
        res.status(404).json({
          success: false,
          message: 'Candidato original no encontrado'
        });
      }

      const original = originalResult.data.candidate;

      // Crear datos para el duplicado
      const duplicateData = {
        personalInfo: {
          ...original.personalInfo,
          email: `${original.personalInfo.email.split('@')[0]}_copy@${original.personalInfo.email.split('@')[1]}`
        },
        academicInfo: original.academicInfo,
        technicalSetup: original.technicalSetup,
        notes: `Duplicado de ${original.personalInfo.firstName} ${original.personalInfo.lastName}`
      };

      // Crear candidato duplicado
      const result = await this.candidateService.createCandidate(duplicateData, currentUser.userId);

      if (!result.success) {
        res.status(400).json(result);
      }

      res.status(201).json({
        success: true,
        message: 'Candidato duplicado exitosamente',
        data: {
          originalId: id,
          newCandidate: result.data.candidate
        }
      });
    } catch (error) {
      next(error);
    }
  };

  getCandidatesByLevel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { level } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;

      const pagination = { page, limit, sortBy: 'createdAt', sortOrder: 'desc' as 'desc' };
      const filters = { level: level as import('../types').MCERLevel | undefined };
      if (!level) {
        res.status(400).json({
          success: false,
          message: 'Nivel es requerido'
        });
        return;
      } 
      const result = await this.candidateService.getCandidates(pagination, filters);

      if (!result.success) {
        res.status(400).json(result);
      }

      res.status(200).json({
        success: true,
        message: `Candidatos de nivel ${level} obtenidos exitosamente`,
        data: {
          level,
          candidates: result.data.candidates,
          total: result.data.total,
          page: result.data.page,
          totalPages: result.data.totalPages
        }
      });
    } catch (error) {
      next(error);
    }
  };

  getCandidatesByStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { status } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;

      const pagination = { page, limit, sortBy: 'createdAt', sortOrder: 'desc' as 'desc' };
      const filters = { status };

      const result = await this.candidateService.getCandidates(pagination, filters);

      if (!result.success) {
        res.status(400).json(result);
      }

      res.status(200).json({
        success: true,
        message: `Candidatos con estado ${status} obtenidos exitosamente`,
        data: {
          status,
          candidates: result.data.candidates,
          total: result.data.total,
          page: result.data.page,
          totalPages: result.data.totalPages
        }
      });
    } catch (error) {
      next(error);
    }
  };

  updateCandidateNotes = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const { notes } = req.body;

      const updates = { notes };
      if (!id) {
        res.status(400).json({
          success: false,
          message: 'ID de candidato es requerido'
        });
        return;
      }
      const result = await this.candidateService.updateCandidate(id, updates);

      if (!result.success) {
        res.status(result.error === 'CANDIDATE_NOT_FOUND' ? 404 : 400).json(result);
      }

      res.status(200).json({
        success: true,
        message: 'Notas del candidato actualizadas exitosamente',
        data: {
          candidateId: id,
          notes,
          updatedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      next(error);
    }
  };

  getRecentCandidates = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;

      const pagination = { page: 1, limit, sortBy: 'createdAt', sortOrder: 'desc' as 'desc' };
      const filters = {};

      const result = await this.candidateService.getCandidates(pagination, filters);

      if (!result.success) {
        res.status(400).json(result);
      }

      res.status(200).json({
        success: true,
        message: 'Candidatos recientes obtenidos exitosamente',
        data: {
          candidates: result.data.candidates,
          total: result.data.total,
          limit
        }
      });
    } catch (error) {
      next(error);
    }
  };
}
