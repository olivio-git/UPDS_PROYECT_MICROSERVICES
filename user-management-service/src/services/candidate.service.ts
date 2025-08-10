// src/services/candidate.service.ts - Implementación completa

import { 
  CreateCandidateRequest, 
  UpdateCandidateRequest,
  PaginationParams,
  FilterParams,
  ApiResponse,
  BulkImportResult,
  Candidate,
  CandidateStatus,
  TechnicalSetup
} from '../types';
import { CandidateRepository } from '../repositories/candidate.repository';
import { CandidateModel } from '../models/Candidate';
import { eventService } from './event.service';
import { ObjectId } from 'mongodb';

export class CandidateService {
  private candidateRepository: CandidateRepository;

  constructor() {
    this.candidateRepository = new CandidateRepository();
    console.log('👨‍🎓 CandidateService inicializado');
  }

  // ================================
  // CRUD OPERATIONS
  // ================================

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
        personalInfo: candidateData.personalInfo,
        academicInfo: candidateData.academicInfo,
        technicalSetup: defaultTechnicalSetup,
        status: 'registered',
        registeredBy: new ObjectId(registeredBy || '000000000000000000000000'),
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

      // Crear candidato
      const candidate = await this.candidateRepository.create(candidateModel);

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
