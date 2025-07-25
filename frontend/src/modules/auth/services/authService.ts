import { authSDK } from "@/services/sdk-simple-auth";

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role?: 'student' | 'teacher' | 'proctor' | 'admin';
}

export interface OTPRequest {
  email: string;
  purpose: 'login' | 'password_reset' | 'email_verification';
}

export interface OTPVerifyRequest {
  email: string;
  code: string;
  purpose: 'login' | 'password_reset' | 'email_verification';
}

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

class AuthService {
  private baseUrl = import.meta.env.VITE_AUTH_SERVICE_URL || 'http://localhost:3000';

  // Registro con verificación OTP
  async register(data: RegisterRequest): Promise<ApiResponse> {
    console.log(data)
    try {
      // const response = await fetch(`${this.baseUrl}/auth/register`, {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //   },
      //   body: JSON.stringify({ ...data, role: data.role || 'student' }),
      // });
      const result = await authSDK.register({
        email: data.email,
        password: data.password,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role || 'student'
      }); 
      console.log(result) 

      if (result.success && result.data) {
        // Almacenar tokens automáticamente usando el SDK
        console.log(result.data)
        // await authSDK.setUserSession({
        //   accessToken: result.data.accessToken,
        //   refreshToken: result.data.refreshToken,
        //   user: result.data.user,
        // });
      }

      return {
        success: result.success,
        message: result.message || 'Usuario registrado exitosamente',
        data: result.data
      };
    } catch (error) {
      console.error('Error en registro:', error);
      return {
        success: false,
        message: 'Error de conexión',
        error: 'Network error'
      };
    }
  }

  // Login con SDK
  async login(data: LoginRequest): Promise<ApiResponse> {
    console.log(data)
    try {
      const result = await authSDK.login({ email: data.email, password: data.password });
      
      if (result.success) {
        return {
          success: true,
          message: 'Inicio de sesión exitoso',
          data: result.data
        };
      }

      return {
        success: false,
        message: result.error || 'Error en el inicio de sesión',
        error: result.error
      };
    } catch (error) {
      console.error('Error en login:', error);
      return {
        success: false,
        message: 'Error de conexión',
        error: 'Network error'
      };
    }
  }

  // Logout con SDK
  async logout(): Promise<void> {
    try {
      await authSDK.logout();
    } catch (error) {
      console.error('Error en logout:', error);
    }
  }

  // Generar OTP
  async generateOTP(data: OTPRequest): Promise<ApiResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/auth/otp/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      return await response.json();
    } catch (error) {
      console.error('Error generando OTP:', error);
      return {
        success: false,
        message: 'Error de conexión',
        error: 'Network error'
      };
    }
  }

  // Verificar OTP
  async verifyOTP(data: OTPVerifyRequest): Promise<ApiResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/auth/otp/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      return await response.json();
    } catch (error) {
      console.error('Error verificando OTP:', error);
      return {
        success: false,
        message: 'Error de conexión',
        error: 'Network error'
      };
    }
  }

  // Estado del OTP
  async getOTPStatus(email: string, purpose: string): Promise<ApiResponse> {
    try {
      const response = await fetch(
        `${this.baseUrl}/auth/otp/status?email=${encodeURIComponent(email)}&purpose=${purpose}`
      );

      return await response.json();
    } catch (error) {
      console.error('Error obteniendo estado OTP:', error);
      return {
        success: false,
        message: 'Error de conexión',
        error: 'Network error'
      };
    }
  }

  // Revocar OTP
  async revokeOTP(email: string, purpose: string): Promise<ApiResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/auth/otp/revoke`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, purpose }),
      });

      return await response.json();
    } catch (error) {
      console.error('Error revocando OTP:', error);
      return {
        success: false,
        message: 'Error de conexión',
        error: 'Network error'
      };
    }
  }

  // Obtener usuario actual del SDK
  getCurrentUser() {
    return authSDK.getCurrentUser();
  }

  // Verificar si está autenticado
  async isAuthenticated(): Promise<boolean> {
    return await authSDK.isAuthenticated();
  }

  // Suscribirse a cambios de autenticación
  onAuthStateChanged(callback: (state: any) => void) {
    return authSDK.onAuthStateChanged(callback);
  }
}

export const authService = new AuthService();