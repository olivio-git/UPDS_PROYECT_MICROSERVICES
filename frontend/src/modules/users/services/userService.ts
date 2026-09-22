import axios from 'axios';
import { toast } from 'sonner';
import { authSDK } from '@/services/sdk-simple-auth';
import type {
  User,
  CreateUserRequest,
  UpdateUserRequest,
  UserFilters,
  PaginatedUsersResponse,
  ApiResponse
} from '../types/user.types';

class UserService {
  private baseUrl = import.meta.env.VITE_USER_MANAGEMENT_URL || 'http://localhost:3002';

  /**
   * Obtener headers de autenticación
   */
  private getAuthHeaders() {
    const accessToken = authSDK.getAccessToken();
    return {
      'Content-Type': 'application/json',
      ...(accessToken && { 'Authorization': `Bearer ${accessToken}` })
    };
  }

  /**
   * Manejar renovación de token automática
   */
  private async makeAuthenticatedRequest<T>(
    request: () => Promise<T>
  ): Promise<T> {
    try {
      return await request();
    } catch (error: any) {
      // Si el token expiró, intentar renovar
      if (error.response?.status === 401) {
        try {
          await authSDK.refreshTokens();
          // Reintentar la petición con el nuevo token
          return await request();
        } catch (refreshError) {
          // Si la renovación falla, redirigir al login
          toast.error('Sesión expirada. Por favor, inicia sesión nuevamente.');
          authSDK.logout();
          window.location.href = '/login';
          throw refreshError;
        }
      }
      throw error;
    }
  }

  /**
   * Obtener lista de usuarios con filtros y paginación
   */
  async getUsers(filters: UserFilters = {}): Promise<ApiResponse<PaginatedUsersResponse>> {
    try {
      const queryParams = new URLSearchParams();
      
      // Configurar parámetros de paginación
      queryParams.append('page', (filters.page || 1).toString());
      queryParams.append('limit', (filters.limit || 10).toString());
      
      // Configurar filtros
      if (filters.search) queryParams.append('search', filters.search);
      if (filters.role) queryParams.append('role', filters.role);
      if (filters.status) queryParams.append('status', filters.status);
      if (filters.sortBy) queryParams.append('sortBy', filters.sortBy);
      if (filters.sortOrder) queryParams.append('sortOrder', filters.sortOrder);
      if (filters.dateFrom) queryParams.append('dateFrom', filters.dateFrom);
      if (filters.dateTo) queryParams.append('dateTo', filters.dateTo);
      const response = await this.makeAuthenticatedRequest(() =>
        axios.get(
          `${this.baseUrl}/api/v1/users?${queryParams.toString()}`,
          { headers: this.getAuthHeaders() }
        )
      );
      let data = response.data.data;
      let pagination = {
        page: data.page,
        limit: data.limit,
        total: data.total,
        totalPages: data.totalPages,
        hasNext: data.hasNext,
        hasPrev: data.hasPrev
      }
      return {
        success: true,
        message: 'Usuarios obtenidos exitosamente',
        data: {
          ...data,
          pagination
        }
      };
    } catch (error: any) {
      return this.handleError(error, 'Error obteniendo usuarios');
    }
  }

  /**
   * Obtener usuario por ID
   */
  async getUserById(id: string): Promise<ApiResponse<User>> {
    try {
      const response = await this.makeAuthenticatedRequest(() =>
        axios.get(
          `${this.baseUrl}/api/v1/users/${id}`,
          { headers: this.getAuthHeaders() }
        )
      );

      return {
        success: true,
        message: 'Usuario obtenido exitosamente',
        data: response.data.data
      };
    } catch (error: any) {
      return this.handleError(error, 'Error obteniendo usuario');
    }
  }

  /**
   * Crear nuevo usuario
   */
  async createUser(userData: CreateUserRequest): Promise<ApiResponse<User>> {
    try {
      console.log('📤 Creando usuario:', userData.email);

      const response = await this.makeAuthenticatedRequest(() =>
        axios.post(
          `${this.baseUrl}/api/v1/users`,
          userData,
          {
            headers: this.getAuthHeaders(),
            timeout: 15000
          }
        )
      );

      console.log('✅ Usuario creado exitosamente:', response.data);

      return {
        success: true,
        message: response.data.message || 'Usuario creado exitosamente',
        data: response.data.data
      };
    } catch (error: any) {
      console.error('❌ Error creando usuario:', error);
      return this.handleError(error, 'Error creando usuario');
    }
  }

  /**
   * Actualizar usuario existente
   */
  async updateUser(id: string, userData: UpdateUserRequest): Promise<ApiResponse<User>> {
    try {
      console.log('📤 Actualizando usuario:', id);

      const response = await this.makeAuthenticatedRequest(() =>
        axios.put(
          `${this.baseUrl}/api/v1/users/${id}`,
          userData,
          {
            headers: this.getAuthHeaders(),
            timeout: 15000
          }
        )
      );

      console.log('✅ Usuario actualizado exitosamente:', response.data);

      return {
        success: true,
        message: response.data.message || 'Usuario actualizado exitosamente',
        data: response.data.data
      };
    } catch (error: any) {
      console.error('❌ Error actualizando usuario:', error);
      return this.handleError(error, 'Error actualizando usuario');
    }
  }

  /**
   * Eliminar usuario (soft delete)
   */
  async deleteUser(id: string): Promise<ApiResponse> {
    try {
      console.log('📤 Eliminando usuario:', id);

      const response = await this.makeAuthenticatedRequest(() =>
        axios.delete(
          `${this.baseUrl}/api/v1/users/${id}`,
          { headers: this.getAuthHeaders() }
        )
      );

      console.log('✅ Usuario eliminado exitosamente');

      return {
        success: true,
        message: response.data.message || 'Usuario eliminado exitosamente'
      };
    } catch (error: any) {
      console.error('❌ Error eliminando usuario:', error);
      return this.handleError(error, 'Error eliminando usuario');
    }
  }

  /**
   * Activar usuario
   */
  async activateUser(id: string): Promise<ApiResponse<User>> {
    try {
      const response = await this.makeAuthenticatedRequest(() =>
        axios.put(
          `${this.baseUrl}/api/v1/users/${id}/activate`,
          {},
          { headers: this.getAuthHeaders() }
        )
      );

      return {
        success: true,
        message: 'Usuario activado exitosamente',
        data: response.data.data
      };
    } catch (error: any) {
      return this.handleError(error, 'Error activando usuario');
    }
  }

  /**
   * Desactivar usuario
   */
  async deactivateUser(id: string): Promise<ApiResponse<User>> {
    try {
      const response = await this.makeAuthenticatedRequest(() =>
        axios.put(
          `${this.baseUrl}/api/v1/users/${id}/deactivate`,
          {},
          { headers: this.getAuthHeaders() }
        )
      );

      return {
        success: true,
        message: 'Usuario desactivado exitosamente',
        data: response.data.data
      };
    } catch (error: any) {
      return this.handleError(error, 'Error desactivando usuario');
    }
  }

  /**
   * Generar contraseña temporal
   */
  async generateTemporaryPassword(id: string, sendByEmail: boolean = true): Promise<ApiResponse> {
    try {
      const endpoint = sendByEmail 
        ? `${this.baseUrl}/api/v1/users/${id}/generate-password`
        : `${this.baseUrl}/api/v1/users/${id}/generate-password-visible`;

      const response = await this.makeAuthenticatedRequest(() =>
        axios.post(
          endpoint,
          {},
          { headers: this.getAuthHeaders() }
        )
      );

      const message = sendByEmail 
        ? 'Contraseña temporal enviada por email'
        : 'Contraseña temporal generada';
      
      return {
        success: true,
        message: response.data.message || message,
        data: response.data.data
      };
    } catch (error: any) {
      return this.handleError(error, 'Error generando contraseña temporal');
    }
  }

  /**
   * Asignar rol a usuario
   */
  async assignRole(id: string, roleId: string): Promise<ApiResponse<User>> {
    try {
      const response = await this.makeAuthenticatedRequest(() =>
        axios.put(
          `${this.baseUrl}/api/v1/users/${id}/assign-role`,
          { roleId },
          { headers: this.getAuthHeaders() }
        )
      );

      return {
        success: true,
        message: 'Rol asignado exitosamente',
        data: response.data.data
      };
    } catch (error: any) {
      return this.handleError(error, 'Error asignando rol');
    }
  }

  /**
   * Exportar usuarios a Excel
   */
  async exportUsers(filters: UserFilters = {}): Promise<ApiResponse> {
    try {
      console.log('📤 Exportando usuarios a Excel');

      const queryParams = new URLSearchParams();

      // Agregar filtros al export
      if (filters.search) queryParams.append('search', filters.search);
      if (filters.role) queryParams.append('role', filters.role);
      if (filters.status) queryParams.append('status', filters.status);
      if (filters.sortBy) queryParams.append('sortBy', filters.sortBy);
      if (filters.sortOrder) queryParams.append('sortOrder', filters.sortOrder);

      const response = await this.makeAuthenticatedRequest(() =>
        axios.get(
          `${this.baseUrl}/api/v1/users/export?${queryParams.toString()}`,
          {
            headers: this.getAuthHeaders(),
            responseType: 'blob', // Important for downloading binary data
            timeout: 30000 // 30 seconds for export
          }
        )
      );

      // Create blob and download
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      // Generate filename with current date
      const fileName = `usuarios_${new Date().toISOString().split('T')[0]}.xlsx`;
      link.download = fileName;

      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up
      window.URL.revokeObjectURL(url);

      console.log('✅ Usuarios exportados exitosamente');

      return {
        success: true,
        message: 'Usuarios exportados exitosamente'
      };
    } catch (error: any) {
      console.error('❌ Error exportando usuarios:', error);
      return this.handleError(error, 'Error exportando usuarios');
    }
  }

  /**
   * Importar usuarios desde Excel
   */
  async importUsers(file: File): Promise<ApiResponse> {
    try {
      console.log('📤 Importando usuarios desde Excel:', file.name);

      // Validate file type
      const allowedTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
        'application/vnd.ms-excel', // .xls
        'text/csv' // .csv
      ];

      if (!allowedTypes.includes(file.type)) {
        const errorMessage = 'Tipo de archivo no válido. Use .xlsx, .xls o .csv';
        toast.error(errorMessage);
        return {
          success: false,
          message: errorMessage,
          error: 'INVALID_FILE_TYPE'
        };
      }

      // Validate file size (max 10MB)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        const errorMessage = 'Archivo muy grande. Máximo 10MB permitido';
        toast.error(errorMessage);
        return {
          success: false,
          message: errorMessage,
          error: 'FILE_TOO_LARGE'
        };
      }

      // Create FormData
      const formData = new FormData();
      formData.append('file', file);

      const response = await this.makeAuthenticatedRequest(() =>
        axios.post(
          `${this.baseUrl}/api/v1/users/import`,
          formData,
          {
            headers: {
              'Authorization': this.getAuthHeaders().Authorization,
              // Don't set Content-Type, let browser set it with boundary for FormData
            },
            timeout: 60000 // 1 minute for import
          }
        )
      );

      console.log('✅ Usuarios importados exitosamente:', response.data);

      const successMessage = response.data.message || 'Usuarios importados exitosamente';

      return {
        success: true,
        message: successMessage,
        data: response.data.data
      };
    } catch (error: any) {
      console.error('❌ Error importando usuarios:', error);
      return this.handleError(error, 'Error importando usuarios');
    }
  }

  /**
   * Descargar template de Excel para importación
   */
  async downloadTemplate(): Promise<ApiResponse> {
    try {
      console.log('📤 Descargando template de usuarios');

      const response = await this.makeAuthenticatedRequest(() =>
        axios.get(
          `${this.baseUrl}/api/v1/users/template`,
          {
            headers: this.getAuthHeaders(),
            responseType: 'blob',
            timeout: 15000
          }
        )
      );

      // Create blob and download
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'plantilla_usuarios.xlsx';

      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up
      window.URL.revokeObjectURL(url);

      console.log('✅ Template descargado exitosamente');
      toast.success('Plantilla descargada exitosamente');

      return {
        success: true,
        message: 'Plantilla descargada exitosamente'
      };
    } catch (error: any) {
      console.error('❌ Error descargando template:', error);
      return this.handleError(error, 'Error descargando plantilla');
    }
  }

  /**
   * Health check del servicio
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.baseUrl}/health`, {
        timeout: 5000
      });
      return response.status === 200;
    } catch (error) {
      console.warn('❌ User service health check failed:', error);
      return false;
    }
  }

  /**
   * Manejar errores de forma consistente
   */
  private handleError(error: any, defaultMessage: string): ApiResponse {
    if (error.response) {
      const errorMessage = error.response.data?.message || defaultMessage;
      toast.error(errorMessage);
      
      return {
        success: false,
        message: errorMessage,
        error: error.response.data?.error || 'API_ERROR'
      };
    } else if (error.request) {
      toast.error('Sin conexión con el servidor');
      return {
        success: false,
        message: 'Sin conexión con el servidor de usuarios',
        error: 'CONNECTION_ERROR'
      };
    } else {
      toast.error(defaultMessage);
      return {
        success: false,
        message: defaultMessage,
        error: 'UNKNOWN_ERROR'
      };
    }
  }
}

export const userService = new UserService();
