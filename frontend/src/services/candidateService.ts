import axios, { type AxiosInstance } from 'axios';
// @ts-ignore
import { authSDK } from './sdk-simple-auth';

export interface Candidate {
  _id: string;
  avatarUrl?: string;
  personalInfo: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    dateOfBirth?: Date;
    nationality?: string;
    identification?: {
      type: string;
      number: string;
    };
    address?: {
      street: string;
      city: string;
      state: string;
      country: string;
      zipCode: string;
    };
  };
  academicInfo: {
    currentLevel: string;
    targetLevel: string;
    studyPurpose?: string;
    previousExperience?: string;
    institution?: string;
  };
  technicalSetup?: {
    hasCamera: boolean;
    hasMicrophone: boolean;
    hasStableInternet: boolean;
    browser?: string;
    operatingSystem?: string;
  };
  examHistory?: any[];
  status: 'registered' | 'active' | 'inactive' | 'suspended';
  registeredBy?: string;
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// Interface para Users/Proctors (estructura diferente a Candidate)
export interface User {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'teacher' | 'proctor' | 'student';
  status: 'active' | 'inactive' | 'suspended' | 'pending';
  profile?: {
    phone?: string;
    preferences?: any;
  };
  permissions?: any[];
  teacherData?: any;
  proctorData?: {
    availableHours?: any[];
    certificationLevel?: string;
    languages?: string[];
    maxSimultaneousSessions?: number;
  };
  createdAt?: Date;
  updatedAt?: Date;
}

interface CandidateFilters {
  status?: string;
  level?: string;
  search?: string;
}

interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  totalPages: number;
}

interface ProctorsResponse {
  proctors: User[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

class CandidateService {
  private api: AxiosInstance; 
  private baseURL: string; 

  constructor() {
    this.baseURL = import.meta.env.VITE_API_GATEWAY_URL || 'http://localhost:80';

    this.api = axios.create({
      baseURL: `${this.baseURL}/api/v1`,
      headers: {
        'Content-Type': 'application/json',
      },
    }); 

    // Interceptor para agregar token de autenticación
    this.api.interceptors.request.use(
      async (config) => {
        const token = await authSDK.getAccessToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Interceptor para manejar errores
    this.api.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          // Token expirado, intentar renovar
          const refreshed = await authSDK.getRefreshToken();
          if (refreshed) {
            // Reintentar la petición original
            const originalRequest = error.config;
            const token = await authSDK.getAccessToken();
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return this.api(originalRequest);
          }
        }
        return Promise.reject(error);
      }
    );
  }

  // Obtener todos los candidatos
  async getCandidates(
    filters?: CandidateFilters,
    pagination?: PaginationParams
  ): Promise<ApiResponse<PaginatedResponse<Candidate>>> {
    try {
      const params = {
        ...filters,
        page: pagination?.page || 1,
        limit: pagination?.limit || 10,
        sortBy: pagination?.sortBy,
        sortOrder: pagination?.sortOrder,
      };
      
      const response = await this.api.get('/candidates', { params });
      console.log(response.data);
      return response.data;
    } catch (error) {
      console.error('Error fetching candidates:', error);
      throw error;
    }
  }

  // Obtener candidatos disponibles (no asignados a una sesión específica)
  async getAvailableCandidates(
    sessionId?: string,
    filters?: CandidateFilters,
    pagination?: PaginationParams
  ): Promise<ApiResponse<PaginatedResponse<Candidate>>> {
    try {
      console.log(  filters,   "GET-AVAILABLE-CANDIDATES");
      const params = {
        // ...filters,
        excludeSession: sessionId,
        // status: 'active', // Solo candidatos activos
        page: pagination?.page || 1,
        limit: pagination?.limit || 100, // Más candidatos por página para selección
        sortBy: pagination?.sortBy || 'personalInfo.firstName',
        sortOrder: pagination?.sortOrder || 'asc',
      };
      
      const response = await this.api.get('/candidates', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching available candidates:', error);
      throw error;
    }
  }
  // async getAvailableProctors(
  //   sessionId?: string,
  //   filters?: CandidateFilters,
  //   pagination?: PaginationParams
  // ): Promise<any> {
  //   try {
  //     console.log(  filters,   "GET-AVAILABLE-PROCTORS");
  //     const params = {
  //       // ...filters,
  //       sessionId: sessionId,
  //       // status: 'active', // Solo candidatos activos
  //       page: pagination?.page || 1,
  //       limit: pagination?.limit || 100, // Más candidatos por página para selección
  //       sortBy: pagination?.sortBy || 'createdAt',
  //       sortOrder: pagination?.sortOrder || 'asc',
  //       role: 'proctor'
  //     };

  //     const response = await this.api.get('/users/proctors', { params });

  //     return response.data;
  //   } catch (error) {
  //     console.error('Error fetching available proctors:', error);
  //     throw error;
  //   }
  // }

  // Obtener candidato por ID
  async getCandidateById(id: string): Promise<ApiResponse<Candidate>> {
    try {
      const response = await this.api.get(`/candidates/${id}`);
      console.log(response,'response getCandidateById');
      return response.data;
    } catch (error) {
      console.error('Error fetching candidate:', error);
      throw error;
    }
  }

  // Obtener múltiples candidatos por IDs
  async getCandidatesByIds(ids: string[]): Promise<ApiResponse<Candidate[]>> {
    try {
      const response = await this.api.post('/candidates/batch', { ids });
      return response.data;
    } catch (error) {
      console.error('Error fetching candidates by IDs:', error);
      throw error;
    }
  }

  // Crear nuevo candidato
  async createCandidate(candidate: Partial<Candidate>): Promise<ApiResponse<Candidate>> {
    try {
      const response = await this.api.post('/candidates', candidate);
      return response.data;
    } catch (error) {
      console.error('Error creating candidate:', error);
      throw error;
    }
  }

  // Actualizar candidato
  async updateCandidate(id: string, updates: Partial<Candidate>): Promise<ApiResponse<Candidate>> {
    try {
      const response = await this.api.put(`/candidates/${id}`, updates);
      return response.data;
    } catch (error) {
      console.error('Error updating candidate:', error);
      throw error;
    }
  }

  // Eliminar candidato
  async deleteCandidate(id: string): Promise<ApiResponse<void>> {
    try {
      const response = await this.api.delete(`/candidates/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting candidate:', error);
      throw error;
    }
  }

  // Buscar candidatos
  async searchCandidates(query: string): Promise<ApiResponse<Candidate[]>> {
    try {
      const response = await this.api.get('/candidates/search', {
        params: { query }
      });
      return response.data;
    } catch (error) {
      console.error('Error searching candidates:', error);
      throw error;
    }
  }

  // Importar candidatos desde Excel/CSV
  async importCandidates(file: File): Promise<ApiResponse<{ success: number; failed: number; errors: any[] }>> {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await this.api.post(
        '/candidates/import',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error importing candidates:', error);
      throw error;
    }
  }

  // Descargar plantilla de importación
  async downloadImportTemplate(format: 'xlsx' | 'csv' = 'xlsx'): Promise<Blob> {
    try {
      const response = await this.api.get('/candidates/import/template', {
        params: { format },
        responseType: 'blob',
      });
      return response.data;
    } catch (error) {
      console.error('Error downloading template:', error);
      throw error;
    }
  }

  // Exportar candidatos
  async exportCandidates(format: 'xlsx' | 'csv' | 'pdf' = 'xlsx'): Promise<Blob> {
    try {
      const response = await this.api.get('/candidates/export', {
        params: { format },
        responseType: 'blob',
      });
      return response.data;
    } catch (error) {
      console.error('Error exporting candidates:', error);
      throw error;
    }
  }

  // Actualizar estado del candidato
  async updateCandidateStatus(id: string, status: 'active' | 'inactive' | 'suspended'): Promise<ApiResponse<Candidate>> {
    try {
      const response = await this.api.patch(`/candidates/${id}/status`, { status });
      return response.data;
    } catch (error) {
      console.error('Error updating candidate status:', error);
      throw error;
    }
  }

  // Verificar setup técnico del candidato
  async verifyTechnicalSetup(id: string): Promise<ApiResponse<{ ready: boolean; issues: string[] }>> {
    try {
      const response = await this.api.get(`/candidates/${id}/verify-setup`);
      return response.data;
    } catch (error) {
      console.error('Error verifying technical setup:', error);
      throw error;
    }
  }

  // ========================================
  // MÉTODOS PARA PROCTORS 
  // ========================================
  
  // Obtener proctors disponibles (usando el endpoint de user-management)
  async getAvailableProctors(
    sessionId: string, 
    filters: { status?: string } = {}, 
    pagination: PaginationParams = {}
  ): Promise<ApiResponse<ProctorsResponse>> {
    try {
      // Cambiar la URL para usar user-management-service
      // const userManagementBaseURL = import.meta.env.VITE_USER_MANAGEMENT_SERVICE_URL || 'http://localhost:3003';

      const response = await this.api.get(`/users/proctors`, {
        params: {
          sessionId,
          ...filters,
          ...pagination
        },
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await authSDK.getAccessToken()}`
        }
      });
      
      return response.data;
    } catch (error) {
      console.error('Error fetching available proctors:', error);
      throw error;
    }
  }
}

// Exportar instancia única del servicio
export const candidateService = new CandidateService();
