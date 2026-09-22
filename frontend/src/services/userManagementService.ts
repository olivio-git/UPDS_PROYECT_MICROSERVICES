import axios from 'axios';
import { toast } from 'sonner';
import { authSDK } from './sdk-simple-auth';

export interface CreateUserRequest {
  email: string;
  firstName: string;
  lastName: string;
  role?: 'student' | 'teacher' | 'proctor' | 'admin';
  profile?: {
    phone?: string;
    preferences?: {
      language?: string;
      notifications?: {
        email?: boolean;
        push?: boolean;
        sms?: boolean;
      };
    };
  };
}

export interface BootstrapAdminRequest {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

class UserManagementService {
  private baseUrl = import.meta.env.VITE_USER_MANAGEMENT_URL || 'http://localhost:3002';

  private getAuthHeaders() {
    const token = authSDK.getAccessToken();
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  async uploadAvatar(userId: string, file: File): Promise<ApiResponse<{ avatarUrl: string }>> {
    try {
      const token = authSDK.getAccessToken();
      const formData = new FormData();
      formData.append('avatar', file);
      const response = await axios.post(
        `${this.baseUrl}/api/v1/users/${userId}/avatar`,
        formData,
        { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } }
      );
      return { success: true, message: response.data.message || 'Avatar actualizado', data: response.data.data };
    } catch (error: any) {
      return this.handleError(error, 'Error subiendo avatar');
    }
  }

  async getMe(): Promise<ApiResponse<{ user: any }>> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/api/v1/users/me`,
        { headers: this.getAuthHeaders() }
      );
      return { success: true, message: 'OK', data: response.data.data };
    } catch (error: any) {
      return this.handleError(error, 'Error obteniendo perfil');
    }
  }

  async updateProfile(data: { profile?: { phone?: string; address?: string; dateOfBirth?: string; bio?: string; nationality?: string; preferences?: { notifications?: { email?: boolean; push?: boolean; sms?: boolean } } } }): Promise<ApiResponse> {
    try {
      const response = await axios.patch(
        `${this.baseUrl}/api/v1/users/me`,
        data,
        { headers: this.getAuthHeaders() }
      );
      return {
        success: true,
        message: response.data.message || 'Perfil actualizado',
        data: response.data.data,
      };
    } catch (error: any) {
      return this.handleError(error, 'Error actualizando perfil');
    }
  }

  /**
   * Crear usuario via user-management-service
   * Este es el método recomendado para registro
   */
  async createUser(userData: CreateUserRequest): Promise<ApiResponse> {
    try {
      console.log('📤 Creando usuario via user-management:', userData.email);

      const response = await axios.post(
        `${this.baseUrl}/api/v1/users`,
        {
          ...userData,
          role: userData.role || 'student', // Default role
        },
        {
          headers: this.getAuthHeaders(),
          timeout: 15000, // 15 segundos timeout
        }
      );

      console.log('✅ Usuario creado exitosamente:', response.data);

      return {
        success: true,
        message: response.data.message || 'Usuario creado exitosamente',
        data: response.data.data
      };
    } catch (error: any) {
      console.error('❌ Error creando usuario:', error);

      if (error.response) {
        const errorMessage = error.response.data?.message || 'Error creando usuario';
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
          message: 'Sin conexión con el servidor de gestión de usuarios',
          error: 'CONNECTION_ERROR'
        };
      } else {
        toast.error('Error inesperado');
        return {
          success: false,
          message: 'Error inesperado',
          error: 'UNKNOWN_ERROR'
        };
      }
    }
  }

  /**
   * Obtener usuario por ID
   */
  async getUserById(id: string): Promise<ApiResponse> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/api/v1/users/${id}`,
        { headers: this.getAuthHeaders() }
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
   * Listar usuarios con paginación
   */
  async getUsers(params?: {
    page?: number;
    limit?: number;
    search?: string;
    role?: string;
    status?: string;
  }): Promise<ApiResponse> {
    try {
      const queryParams = new URLSearchParams();
      
      if (params?.page) queryParams.append('page', params.page.toString());
      if (params?.limit) queryParams.append('limit', params.limit.toString());
      if (params?.search) queryParams.append('search', params.search);
      if (params?.role) queryParams.append('role', params.role);
      if (params?.status) queryParams.append('status', params.status);

      const response = await axios.get(
        `${this.baseUrl}/api/v1/users?${queryParams.toString()}`,
        { headers: this.getAuthHeaders() }
      );

      return {
        success: true,
        message: 'Usuarios obtenidos exitosamente',
        data: response.data.data
      };
    } catch (error: any) {
      return this.handleError(error, 'Error obteniendo usuarios');
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
      console.warn('User-management service health check failed:', error);
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
        message: 'Sin conexión con el servidor',
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

export const userManagementService = new UserManagementService();
