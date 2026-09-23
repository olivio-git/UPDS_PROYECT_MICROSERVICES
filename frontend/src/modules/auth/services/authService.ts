import { authSDK } from "@/services/sdk-simple-auth";
import axios from "axios";
import { toast } from "sonner";
import { AUTH_SERVICE_URL } from '@/lib/serviceUrls';

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

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

class AuthService {
  private baseUrl = AUTH_SERVICE_URL;

  // 📝 REGISTRO DIRECTO (SIN OTP AUTOMÁTICO)
  async register(data: RegisterRequest): Promise<ApiResponse> {
    console.log('📝 [AuthService] Registro DIRECTO (sin OTP automático)');
    console.log('📤 [AuthService] Datos:', {
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      role: data.role,
      hasPassword: !!data.password
    });
    
    try {
      const response = await axios.post(`${this.baseUrl}/auth/register`, {
        email: data.email,
        password: data.password,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role || 'student'
      }); 
      return {
        success: response.data.success,
        message: response.data.message || 'Usuario registrado exitosamente',
        data: response.data.data
      };
    } catch (error: any) {
      console.error('❌ [AuthService] Error en registro:', error);
      const errorMessage = error.response?.data?.message || 'Error de conexión';
      toast.error(errorMessage);
      return {
        success: false,
        message: errorMessage,
        error: 'Network error'
      };
    }
  }

  // 🔐 LOGIN DIRECTO (SIN OTP AUTOMÁTICO)  
  async login(data: LoginRequest): Promise<ApiResponse> { 
    try {
      const response = await authSDK.login({
        email: data.email,
        password: data.password
      });  
      return {
        success: true,
        message: response.message || 'Inicio de sesión exitoso',
        data: response
      };
    } catch (error: any) {
      console.error('❌ [AuthService] Error en login:', error);
      // Propagate the backend's machine-readable error code (e.g.
      // OTP_REQUIRED) when the call actually reached identity-service —
      // authStore.login() needs it to tell "verify the OTP first" apart from
      // any other login failure. Falls back to a generic message/code only
      // when there is no backend response (real network error).
      const backendData = error.response?.data;
      const errorMessage = backendData?.message || error.message || 'Error de conexión';
      toast.error(errorMessage);
      return {
        success: false,
        message: errorMessage,
        error: backendData?.error || 'Network error'
      };
    }
  }

  // 📧 GENERAR OTP (MANUAL/SEPARADO)
  async generateOTP(data: OTPRequest): Promise<ApiResponse> {
    console.log('📧 [AuthService] Generando OTP MANUAL para:', data.email, 'propósito:', data.purpose);
    
    try {
      const response = await axios.post(`${this.baseUrl}/auth/otp/generate`, {
        email: data.email,
        purpose: data.purpose
      });
      return {
        success: response.data.success,
        message: response.data.message || 'Código OTP enviado exitosamente',
        data: response.data.data
      };
    } catch (error: any) {
      console.error('❌ [AuthService] Error generando OTP:', error);
      const errorMessage = error.response?.data?.message || 'Error generando OTP';
      // showCustomToast();
      toast.error(errorMessage);
      return {
        success: false,
        message: errorMessage,
        error: 'Network error'
      };
    }
  }

  // ✅ VERIFICAR OTP (MANUAL/SEPARADO)
  async verifyOTP(data: OTPVerifyRequest): Promise<ApiResponse> { 
    try {
      const response = await axios.post(`${this.baseUrl}/auth/otp/verify`, {
        email: data.email,
        code: data.code,
        purpose: data.purpose
      }); 
      return {
        success: response.data.success,
        message: response.data.message || 'Código verificado exitosamente',
        data: response.data.data
      };
    } catch (error: any) {
      console.error('❌ [AuthService] Error verificando OTP:', error);
      const errorMessage = error.response?.data?.message || 'Error verificando OTP';
      toast.error(errorMessage);
      return {
        success: false,
        message: errorMessage,
        error: 'Network error'
      };
    }
  }

  // getOTPStatus/revokeOTP were removed along with the backend's
  // unauthenticated GET /auth/otp/status and DELETE /auth/otp/revoke routes
  // (identity-service/src/auth/routes/auth.routes.ts) — neither method had
  // any caller in this codebase, and the routes let anyone probe or cancel
  // an arbitrary email's in-flight OTP with no proof of ownership.

  async logout(): Promise<void> {
    console.log('🚪 [AuthService] Cerrando sesión...');
    
    try {
      await authSDK.logout();
      console.log('✅ [AuthService] Logout completado');
    } catch (error) {
      console.error('❌ [AuthService] Error en logout:', error);
    }
  }

  // 👤 USER INFO (desde SDK)
  getCurrentUser() {
    return authSDK.getCurrentUser();
  }

  // 🔐 AUTH STATUS (desde SDK)
  async isAuthenticated(): Promise<boolean> {
    return await authSDK.isAuthenticated();
  }

  // 🔄 AUTH STATE CHANGES (desde SDK)
  onAuthStateChanged(callback: (state: any) => void) {
    return authSDK.onAuthStateChanged(callback);
  }

  // 🔐 CHANGE PASSWORD WITH OTP VERIFICATION
  async initiatePasswordChange(currentPassword: string): Promise<ApiResponse> {
    console.log('🔐 [AuthService] Iniciando cambio de contraseña con OTP');

    const user = this.getCurrentUser();
    if (!user?.email) {
      return {
        success: false,
        message: 'Usuario no autenticado',
        error: 'No authenticated user'
      };
    }

    // La contraseña actual se confirma con el endpoint autenticado: hacer
    // login aquí dejó de funcionar cuando el login pasó a exigir el OTP.
    try {
      const validation = await axios.post(
        `${this.baseUrl}/auth/verify-password`,
        { password: currentPassword },
        { headers: { Authorization: `Bearer ${authSDK.getAccessToken()}` } }
      ).then((res) => res.data).catch((error) => error.response?.data ?? { success: false });

      if (!validation?.success) {
        return {
          success: false,
          message: 'Contraseña actual incorrecta',
          error: 'Invalid current password'
        };
      }

      // Si la contraseña es correcta, generamos OTP para reset
      const otpResult = await this.generateOTP({
        email: user.email,
        purpose: 'password_reset'
      });

      return otpResult;
    } catch (error: any) {
      console.error('❌ [AuthService] Error validando contraseña actual:', error);
      return {
        success: false,
        message: 'Error validando contraseña actual',
        error: error.message
      };
    }
  }

  // 🔄 COMPLETE PASSWORD CHANGE
  async completePasswordChange(otpCode: string, currentPassword: string, newPassword: string): Promise<ApiResponse> {
    console.log('🔄 [AuthService] Completando cambio de contraseña');

    const user = this.getCurrentUser();
    if (!user?.email) {
      return {
        success: false,
        message: 'Usuario no autenticado',
        error: 'No authenticated user'
      };
    }

    try {
      // Verificar OTP primero
      const otpVerification = await this.verifyOTP({
        email: user.email,
        code: otpCode,
        purpose: 'password_reset'
      });

      if (!otpVerification.success) {
        return otpVerification;
      }
        
      // Si OTP es válido, cambiar contraseña
      const response = await axios.post(`${this.baseUrl}/auth/change-password`, {
        userId: authSDK.getCurrentUser()?.id || authSDK.getCurrentUser()?._id,
        oldPassword: currentPassword,
        newPassword: newPassword
      },{
        headers:{
          Authorization: `Bearer ${authSDK.getAccessToken()}`
        }
      });

      return {
        success: response.data.success,
        message: response.data.message || 'Contraseña cambiada exitosamente',
        data: response.data.data
      };
    } catch (error: any) {
      console.error('❌ [AuthService] Error cambiando contraseña:', error);
      const errorMessage = error.response?.data?.message || 'Error cambiando contraseña';
      toast.error(errorMessage);
      return {
        success: false,
        message: errorMessage,
        error: 'Network error'
      };
    }
  }

  // 🔐 RESET PASSWORD (SIN CONTRASEÑA ACTUAL)
  async resetPassword(resetToken: string, newPassword: string): Promise<ApiResponse> {
    try {
      const response = await axios.post(`${this.baseUrl}/auth/reset-password`, {
        resetToken,
        newPassword
      });

      return {
        success: response.data.success,
        message: response.data.message || 'Contraseña restablecida exitosamente',
        data: response.data.data
      };
    } catch (error: any) {
      console.error('❌ [AuthService] Error restableciendo contraseña:', error);
      const errorMessage = error.response?.data?.message || 'Error restableciendo contraseña';
      toast.error(errorMessage);
      return {
        success: false,
        message: errorMessage,
        error: 'Network error'
      };
    }
  }
}

export const authService = new AuthService();
