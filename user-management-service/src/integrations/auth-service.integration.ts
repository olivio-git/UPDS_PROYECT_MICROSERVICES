// src/integrations/auth-service.integration.ts - Integración con auth-service

import axios, { AxiosInstance, AxiosError } from 'axios';
import { ApiResponse } from '../types';
import config from '../config';

interface AuthServiceUser {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: string;
}

interface ChangePasswordRequest {
  userId: string;
  oldPassword: string;
  newPassword: string;
  jwt: string;
}

interface ResetPasswordRequest {
  email: string;
  newPassword: string;
  resetToken?: string;
}

export class AuthServiceIntegration {
  private httpClient: AxiosInstance;

  constructor() {
    this.httpClient = axios.create({
      baseURL: config.authService.baseUrl || 'http://localhost:3000',
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'x-service-token': config.authService.serviceToken,
        'x-service-name': 'user-management-service'
      }
    });

    // Interceptors para logging
    this.httpClient.interceptors.request.use(
      (config) => {
        console.log(`📞 Calling auth-service: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        console.error('❌ Error en request a auth-service:', error);
        return Promise.reject(error);
      }
    );

    this.httpClient.interceptors.response.use(
      (response) => {
        console.log(`✅ Response from auth-service: ${response.status}`);
        return response;
      },
      (error: AxiosError) => {
        console.error(`❌ Error response from auth-service: ${error.response?.status || 'NO_RESPONSE'}`);
        return Promise.reject(error);
      }
    );

    console.log('🔐 AuthServiceIntegration inicializado');
  }

  // ================================
  // USER CREATION IN AUTH-SERVICE
  // ================================

  /**
   * Crea un usuario en auth-service con una contraseña temporal
   * USA ENDPOINT INTERNO para llamadas desde microservicios
   */
  async createUserInAuthService(userData: AuthServiceUser): Promise<ApiResponse<any>> {
    try {
      const response = await this.httpClient.post('/auth/internal/register', {
        email: userData.email,
        password: userData.password,
        firstName: userData.firstName,
        lastName: userData.lastName,
        role: userData.role
      });

      return {
        success: true,
        message: 'Usuario creado en auth-service',
        data: response.data.data
      };
    } catch (error) {
      return this.handleError(error, 'Error creando usuario en auth-service');
    }
  }

  // ================================
  // PASSWORD MANAGEMENT
  // ================================

  /**
   * Cambia la contraseña de un usuario
   */
  async changePassword(changeData: ChangePasswordRequest): Promise<ApiResponse<any>> {
    try {
      const response = await this.httpClient.post('/auth/change-password', {
        userId: changeData.userId,
        oldPassword: changeData.oldPassword,
        newPassword: changeData.newPassword
      }, {
        headers: {
          'Authorization': `Bearer ${changeData.jwt}`
        }
      });

      return {
        success: true,
        message: 'Contraseña actualizada exitosamente',
        data: response.data.data
      };
    } catch (error) {
      return this.handleError(error, 'Error cambiando contraseña');
    }
  }

  /**
   * Resetea la contraseña de un usuario (solo para administradores)
   */
  async resetPassword(resetData: ResetPasswordRequest): Promise<ApiResponse<any>> {
    try {
      const response = await this.httpClient.post('/auth/reset-password', {
        email: resetData.email,
        newPassword: resetData.newPassword,
        resetToken: resetData.resetToken
      });

      return {
        success: true,
        message: 'Contraseña reseteada exitosamente',
        data: response.data.data
      };
    } catch (error) {
      return this.handleError(error, 'Error reseteando contraseña');
    }
  }

  /**
   * Genera una contraseña temporal segura
   */
  generateTemporaryPassword(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%';
    let password = '';
    
    // Asegurar al menos un carácter de cada tipo
    password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)]; // Mayúscula
    password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]; // Minúscula
    password += '0123456789'[Math.floor(Math.random() * 10)]; // Número
    password += '!@#$%'[Math.floor(Math.random() * 5)]; // Símbolo
    
    // Completar hasta 12 caracteres
    for (let i = 4; i < 12; i++) {
      password += chars[Math.floor(Math.random() * chars.length)];
    }
    
    // Mezclar los caracteres
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }

  // ================================
  // USER VALIDATION
  // ================================

  /**
   * Verifica si un usuario existe en auth-service
   */
  async validateUserExists(email: string): Promise<ApiResponse<boolean>> {
    try {
      const response = await this.httpClient.get(`/auth/validate-user?email=${encodeURIComponent(email)}`);

      return {
        success: true,
        message: 'Validación completada',
        data: response.data.exists || false
      };
    } catch (error) {
      // Si el endpoint no existe, asumimos que el usuario no existe
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return {
          success: true,
          message: 'Usuario no existe en auth-service',
          data: false
        };
      }
      return this.handleError(error, 'Error validando usuario');
    }
  }

  // ================================
  // USER SYNCHRONIZATION
  // ================================

  /**
   * Sincroniza los datos de un usuario entre servicios
   */
  async syncUserData(userId: string, userData: Partial<AuthServiceUser>): Promise<ApiResponse<any>> {
    try {
      const response = await this.httpClient.patch(`/auth/sync-user/${userId}`, userData);

      return {
        success: true,
        message: 'Datos sincronizados con auth-service',
        data: response.data.data
      };
    } catch (error) {
      return this.handleError(error, 'Error sincronizando datos');
    }
  }

  /**
   * Elimina un usuario de auth-service
   */
  async deleteUserFromAuthService(userId: string): Promise<ApiResponse<any>> {
    try {
      await this.httpClient.delete(`/auth/user/${userId}`);

      return {
        success: true,
        message: 'Usuario eliminado de auth-service'
      };
    } catch (error) {
      return this.handleError(error, 'Error eliminando usuario');
    }
  }

  // ================================
  // HEALTH CHECK
  // ================================

  /**
   * Verifica la conectividad con auth-service
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.httpClient.get('/health', { timeout: 5000 });
      return response.status === 200;
    } catch (error) {
      console.error('Auth-service health check failed:', error);
      return false;
    }
  }

  // ================================
  // UTILITY METHODS
  // ================================

  /**
   * Genera credenciales completas para un nuevo usuario
   */
  async generateUserCredentials(userData: {
    email: string;
    firstName: string;
    lastName: string;
    role: string;
  }): Promise<{ password: string; credentials: AuthServiceUser }> {
    const temporaryPassword = this.generateTemporaryPassword();
    
    const credentials: AuthServiceUser = {
      email: userData.email,
      password: temporaryPassword,
      firstName: userData.firstName,
      lastName: userData.lastName,
      role: userData.role
    };

    return {
      password: temporaryPassword,
      credentials
    };
  }

  /**
   * Configura la URL base del auth-service (útil para testing)
   */
  setBaseUrl(baseUrl: string): void {
    this.httpClient.defaults.baseURL = baseUrl;
  }

  /**
   * Obtiene el estado de la conexión
   */
  getConnectionInfo(): { baseUrl: string; hasToken: boolean } {
    return {
      baseUrl: this.httpClient.defaults.baseURL || '',
      hasToken: Boolean(this.httpClient.defaults.headers.Authorization)
    };
  }

  // ================================
  // PRIVATE METHODS
  // ================================

  private handleError(error: unknown, defaultMessage: string): ApiResponse<any> {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      
      if (axiosError.response) {
        // Error de respuesta del servidor
        const responseData = axiosError.response.data as any;
        return {
          success: false,
          message: responseData?.message || defaultMessage,
          error: responseData?.error || `HTTP_${axiosError.response.status}`
        };
      } else if (axiosError.request) {
        // Error de red/conexión
        return {
          success: false,
          message: 'Error de conexión con auth-service',
          error: 'CONNECTION_ERROR'
        };
      }
    }

    // Error desconocido
    console.error(`${defaultMessage}:`, error);
    return {
      success: false,
      message: defaultMessage,
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    };
  }
}

// Singleton instance
export const authServiceIntegration = new AuthServiceIntegration();
