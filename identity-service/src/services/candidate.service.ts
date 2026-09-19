// src/services/candidate.service.ts - Implementación completa

import { ObjectId } from 'mongodb';
import { CandidateModel } from '../models/Candidate';
import { CacheRepository } from '../repositories/cache.repository';
import { CandidateRepository } from '../repositories/candidate.repository';
import { UserRepository } from '../repositories/user.repository';
import {
  ApiResponse,
  BulkImportResult,
  CandidateStatus,
  CreateCandidateRequest,
  FilterParams,
  PaginationParams,
  PersonalInfo,
  TechnicalSetup,
  UpdateCandidateRequest
} from '../types';
import { eventService } from './event.service';

export class CandidateService {
  private candidateRepository: CandidateRepository;
  private userRepository: UserRepository;
  private redis: CacheRepository;
  private readonly USER_VERIFICATION_PREFIX = 'user_tech:';

  constructor() {
    this.candidateRepository = new CandidateRepository();
    this.userRepository = new UserRepository();
    this.redis = new CacheRepository();
  }

  // ================================
  // CRUD OPERATIONS
  // ================================

  // 🆕 NUEVO: Buscar candidato por userId
  async findByUserId(userId: string): Promise<CandidateModel | null> {
    try {
      return await this.candidateRepository.findByUserId(userId);
    } catch (error) {
      console.error(`Error finding candidate by userId ${userId}:`, error);
      throw error;
    }
  }
  async findByAuthUserId(id: string): Promise<CandidateModel | null> {
    try {
      return await this.candidateRepository.findByAuthUserId(id);
    } catch (error) {
      console.error(`Error finding candidate by id ${id}:`, error);
      throw error;
    }
  }
  // 🆕 NUEVO: Crear candidato desde User
  async createFromUser(user: any): Promise<CandidateModel> {
    try {
      // Verificar que no existe candidato para este usuario
      const existing = await this.findByUserId(user._id.toString());
      if (existing) {
        throw new Error('Candidate already exists for this user');
      }

      // Crear candidato con datos del usuario
      const candidateData = CandidateModel.createFromUser(user);
      const candidate = await this.candidateRepository.create(candidateData.toJSON());

      // Publicar evento
      try {
        await eventService.publishCandidateRegistered(
          candidate._id!.toString(),
          candidate.toJSON(),
          user._id.toString()
        );
      } catch (eventError) {
        console.warn('⚠️ Error publicando evento de candidato creado desde usuario:', eventError);
      }

      return candidate;
    } catch (error) {
      console.error('Error creating candidate from user:', error);
      throw error;
    }
  }

  // 🆕 "one person, one id": resolves the person (auth user + user-management
  // profile) behind a candidate, creating it through the standard UserService
  // flow when it does not exist yet, and reusing it (by email) otherwise.
  // The returned id becomes the candidate's own _id and userId.
  private async resolvePersonId(personalInfo: PersonalInfo, registeredBy?: string): Promise<ObjectId> {
    const existingUser = await this.userRepository.findByEmail(personalInfo.email);
    if (existingUser?._id) {
      // Only a student can be an exam candidate. Reusing a teacher's or
      // proctor's account here would recreate the role mix-up where staff
      // appeared as candidates.
      if (existingUser.role !== 'student') {
        throw new Error(
          `El email ${personalInfo.email} pertenece a un usuario con rol "${existingUser.role}" y no puede registrarse como candidato`
        );
      }
      return existingUser._id;
    }

    // Dynamic import to avoid a circular dependency with UserService, which
    // itself dynamically imports CandidateService to auto-create candidates
    // for student users.
    const { UserService } = await import('./user.service');
    const userService = new UserService();

    const userResult = await userService.createUser(
      {
        email: personalInfo.email,
        firstName: personalInfo.firstName,
        lastName: personalInfo.lastName,
        role: 'student',
      },
      registeredBy
    );

    if (!userResult.success) {
      throw new Error(userResult.message || 'Error creando el usuario asociado al candidato');
    }

    const createdUserId = userResult.data?.user?._id;
    if (!createdUserId) {
      throw new Error('El usuario creado no tiene un id válido');
    }

    return new ObjectId(createdUserId);
  }

  async createCandidate(candidateData: CreateCandidateRequest, registeredBy?: string): Promise<ApiResponse<any>> {
    try {
      // Verificar si ya existe un candidato con el mismo email
      const existingCandidate = await this.candidateRepository.findByEmail(candidateData.personalInfo.email);
      if (existingCandidate) {
        return {
          success: false,
          message: 'Ya existe un candidato registrado con este email',
          error: 'EMAIL_EXISTS'
        };
      }

      // "one person, one id": asegurar que exista la persona (auth user + perfil)
      // antes de crear el candidato, y reutilizar ese mismo id como _id/userId.
      const personId = await this.resolvePersonId(candidateData.personalInfo, registeredBy);

      // Preparar technicalSetup con valores por defecto
      const defaultTechnicalSetup: TechnicalSetup = {
        hasCamera: false,
        hasMicrophone: false,
        hasStableInternet: false,
        browser: 'Unknown',
        operatingSystem: 'Unknown',
        ...candidateData.technicalSetup
      };

      // Validar datos del candidato
      const candidateModel = new CandidateModel({
        _id: personId,
        userId: personId,
        personalInfo: candidateData.personalInfo,
        academicInfo: candidateData.academicInfo,
        technicalSetup: defaultTechnicalSetup,
        status: 'registered',
        registeredBy: new ObjectId(registeredBy || personId.toString()),
        notes: candidateData.notes || ''
      });

      const validation = candidateModel.validate();
      if (!validation.isValid) {
        return {
          success: false,
          message: `Datos del candidato inválidos: ${validation.errors.join(', ')}`,
          error: 'VALIDATION_ERROR'
        };
      }

      // Si resolvePersonId creó un usuario student nuevo, UserService ya habrá
      // auto-creado un candidato mínimo con este mismo _id (ver
      // UserService.createUser). En ese caso actualizamos ese registro con los
      // datos reales en vez de insertar uno duplicado.
      const autoCreatedCandidate = await this.candidateRepository.findById(personId);
      const candidate = autoCreatedCandidate
        ? await this.candidateRepository.update(personId, {
            personalInfo: candidateData.personalInfo,
            academicInfo: candidateData.academicInfo,
            technicalSetup: defaultTechnicalSetup,
            notes: candidateData.notes || ''
          })
        : await this.candidateRepository.create(candidateModel);

      if (!candidate) {
        return {
          success: false,
          message: 'Error registrando candidato',
          error: 'CANDIDATE_CREATE_FAILED'
        };
      }

      // Publicar evento de candidato registrado
      try {
        await eventService.publishCandidateRegistered(
          candidate._id!.toString(),
          candidate.toJSON(),
          registeredBy || 'system'
        );
      } catch (eventError) {
        console.warn('⚠️ Error publicando evento de candidato registrado:', eventError);
      }

      return {
        success: true,
        message: 'Candidato registrado exitosamente',
        data: { candidate: candidate.toJSON() }
      };
    } catch (error) {
      console.error('Error registrando candidato:', error);
      return {
        success: false,
        message: 'Error interno del servidor',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async getCandidateById(id: string): Promise<ApiResponse<any>> {
    try {
      const candidate = await this.candidateRepository.findById(id);

      if (!candidate) {
        return {
          success: false,
          message: 'Candidato no encontrado',
          error: 'CANDIDATE_NOT_FOUND'
        };
      }

      return {
        success: true,
        message: 'Candidato obtenido exitosamente',
        data: { candidate: candidate.toJSON() }
      };
    } catch (error) {
      console.error('Error obteniendo candidato por ID:', error);
      return {
        success: false,
        message: 'Error interno del servidor',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async updateCandidate(id: string, updates: UpdateCandidateRequest): Promise<ApiResponse<any>> {
    try {
      // Verificar si el candidato existe
      const existingCandidate = await this.candidateRepository.findById(id);
      if (!existingCandidate) {
        return {
          success: false,
          message: 'Candidato no encontrado',
          error: 'CANDIDATE_NOT_FOUND'
        };
      }

      // Si se está actualizando el email, verificar que no exista otro candidato con ese email
      if (updates.personalInfo?.email) {
        const emailExists = await this.candidateRepository.emailExists(updates.personalInfo.email, id);
        if (emailExists) {
          return {
            success: false,
            message: 'Ya existe un candidato con este email',
            error: 'EMAIL_EXISTS'
          };
        }
      }

      const updatedCandidate = await this.candidateRepository.update(id, updates);
      if (updates.technicalSetup) {
        console.log('💾 Guardando verificación técnica en Redis:', updates.technicalSetup);
        await this.redis.set(`${this.USER_VERIFICATION_PREFIX}${id}`, JSON.stringify(updates.technicalSetup), 3600); // Expira en 1 hora
        console.log('✅ Verificación técnica guardada en Redis');
      }
      // Publicar evento de candidato actualizado
      if (updatedCandidate) {
        try {
          await eventService.publishCandidateUpdated(id, updates);
        } catch (eventError) {
          console.warn('⚠️ Error publicando evento de candidato actualizado:', eventError);
        }
      }

      return {
        success: true,
        message: 'Candidato actualizado exitosamente',
        data: { candidate: updatedCandidate?.toJSON() }
      };
    } catch (error) {
      console.error('Error actualizando candidato:', error);
      return {
        success: false,
        message: 'Error interno del servidor',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  async getTechnicalSetupById(id: string): Promise<ApiResponse<any>> {
    try {
      // Verificar si el candidato existe
      const existingCandidate = await this.candidateRepository.findById(id);
      if (!existingCandidate) {
        return {
          success: false,
          message: 'Candidato no encontrado',
          error: 'CANDIDATE_NOT_FOUND'
        };
      }
      const technicalSetupRaw = await this.redis.get(`${this.USER_VERIFICATION_PREFIX}${id}`);
      if (typeof technicalSetupRaw !== 'string' || !technicalSetupRaw) {
        return {
          success: false,
          message: 'No se encontró configuración técnica para este candidato',
          error: 'TECHNICAL_SETUP_NOT_FOUND'
        };
      }
      // Parsear la configuración técnica almacenada como string JSON
      return {
        success: true,
        message: 'Candidato actualizado exitosamente',
        data: { technicalSetup: JSON.parse(technicalSetupRaw) }
      };
    } catch (error) {
      console.error('Error actualizando candidato:', error);
      return {
        success: false,
        message: 'Error interno del servidor',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  async deleteCandidate(id: string): Promise<ApiResponse<any>> {
    try {
      const candidateExists = await this.candidateRepository.findById(id);
      if (!candidateExists) {
        return {
          success: false,
          message: 'Candidato no encontrado',
          error: 'CANDIDATE_NOT_FOUND'
        };
      }

      const deleted = await this.candidateRepository.delete(id);

      if (!deleted) {
        return {
          success: false,
          message: 'Error eliminando candidato',
          error: 'DELETE_FAILED'
        };
      }

      return {
        success: true,
        message: 'Candidato eliminado exitosamente',
        data: { deletedId: id }
      };
    } catch (error) {
      console.error('Error eliminando candidato:', error);
      return {
        success: false,
        message: 'Error interno del servidor',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async getCandidates(pagination: PaginationParams, filters: FilterParams): Promise<ApiResponse<any>> {
    try {
      const { candidates, total } = await this.candidateRepository.findAll(pagination, filters);

      const totalPages = Math.ceil(total / pagination.limit);

      return {
        success: true,
        message: 'Lista de candidatos obtenida exitosamente',
        data: {
          candidates: candidates.map(candidate => candidate.toJSON()),
          total,
          page: pagination.page,
          limit: pagination.limit,
          totalPages,
          hasNext: pagination.page < totalPages,
          hasPrev: pagination.page > 1
        }
      };
    } catch (error) {
      console.error('Error obteniendo candidatos:', error);
      return {
        success: false,
        message: 'Error interno del servidor',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // ================================
  // SPECIALIZED OPERATIONS
  // ================================

  async updateCandidateStatus(id: string, status: CandidateStatus): Promise<ApiResponse<any>> {
    try {
      const updatedCandidate = await this.candidateRepository.updateStatus(id, status);

      if (!updatedCandidate) {
        return {
          success: false,
          message: 'Candidato no encontrado',
          error: 'CANDIDATE_NOT_FOUND'
        };
      }

      return {
        success: true,
        message: `Estado del candidato actualizado a ${status}`,
        data: { candidate: updatedCandidate.toJSON() }
      };
    } catch (error) {
      console.error('Error actualizando estado del candidato:', error);
      return {
        success: false,
        message: 'Error interno del servidor',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async searchCandidates(searchTerm: string, pagination: PaginationParams): Promise<ApiResponse<any>> {
    try {
      const { candidates, total } = await this.candidateRepository.search(searchTerm, pagination);

      const totalPages = Math.ceil(total / pagination.limit);

      return {
        success: true,
        message: 'Búsqueda completada exitosamente',
        data: {
          results: candidates.map(candidate => candidate.toJSON()),
          total,
          page: pagination.page,
          limit: pagination.limit,
          totalPages,
          hasNext: pagination.page < totalPages,
          hasPrev: pagination.page > 1,
          query: searchTerm
        }
      };
    } catch (error) {
      console.error('Error en búsqueda de candidatos:', error);
      return {
        success: false,
        message: 'Error interno del servidor',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async getCandidateStats(): Promise<ApiResponse<any>> {
    try {
      const stats = await this.candidateRepository.getStatistics();

      return {
        success: true,
        message: 'Estadísticas obtenidas exitosamente',
        data: stats
      };
    } catch (error) {
      console.error('Error obteniendo estadísticas:', error);
      return {
        success: false,
        message: 'Error interno del servidor',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async bulkDeleteCandidates(ids: string[]): Promise<ApiResponse<any>> {
    try {
      const deleted = await this.candidateRepository.bulkDelete(ids);

      return {
        success: true,
        message: 'Candidatos eliminados en lote exitosamente',
        data: {
          deleted,
          total: ids.length,
          failed: ids.length - deleted
        }
      };
    } catch (error) {
      console.error('Error en eliminación masiva:', error);
      return {
        success: false,
        message: 'Error interno del servidor',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // ================================
  // IMPORT/EXPORT OPERATIONS
  // ================================

  async importCandidates(csvData: any[], options: any = {}): Promise<ApiResponse<BulkImportResult>> {
    try {
      const result: BulkImportResult = {
        total: csvData.length,
        successful: 0,
        failed: 0,
        errors: []
      };

      for (let i = 0; i < csvData.length; i++) {
        try {
          const candidateData = this.mapCsvToCandidate(csvData[i]);
          await this.createCandidate(candidateData, options.importedBy);
          result.successful++;
        } catch (error) {
          result.failed++;
          result.errors.push({
            row: i + 1,
            field: 'system',
            message: error instanceof Error ? error.message : 'Error desconocido',
            data: csvData[i]
          });
        }
      }

      return {
        success: true,
        message: 'Importación completada',
        data: result
      };
    } catch (error) {
      console.error('Error en importación masiva:', error);
      return {
        success: false,
        message: 'Error interno del servidor',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private mapCsvToCandidate(csvRow: any): CreateCandidateRequest {
    return {
      personalInfo: {
        firstName: csvRow.firstName || csvRow['Nombre'] || '',
        lastName: csvRow.lastName || csvRow['Apellido'] || '',
        email: csvRow.email || csvRow['Email'] || '',
        phone: csvRow.phone || csvRow['Teléfono'] || '',
        dateOfBirth: csvRow.dateOfBirth || csvRow['Fecha de Nacimiento'] || '',
        nationality: csvRow.nationality || csvRow['Nacionalidad'] || '',
        identification: {
          type: 'ci',
          number: csvRow.idNumber || csvRow['CI/Pasaporte'] || ''
        }
      },
      academicInfo: {
        currentLevel: csvRow.currentLevel || csvRow['Nivel Actual'] || 'A1',
        targetLevel: csvRow.targetLevel || csvRow['Nivel Objetivo'] || 'A2',
        previousExperience: csvRow.previousExperience || csvRow['Experiencia Previa'] || '',
        motivation: csvRow.motivation || csvRow['Motivación'] || ''
      },
      technicalSetup: {
        hasCamera: csvRow.hasCamera === 'true' || csvRow['Tiene Cámara'] === 'Sí',
        hasMicrophone: csvRow.hasMicrophone === 'true' || csvRow['Tiene Micrófono'] === 'Sí',
        hasStableInternet: csvRow.hasStableInternet === 'true' || csvRow['Internet Estable'] === 'Sí',
        browser: csvRow.browser || csvRow['Navegador'] || 'Chrome',
        operatingSystem: csvRow.operatingSystem || csvRow['Sistema Operativo'] || 'Windows'
      },
      notes: csvRow.notes || csvRow['Notas'] || ''
    };
  }
}
