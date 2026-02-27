import { authSDK } from "@/services/sdk-simple-auth";
import axios from "axios";
import { toast } from "sonner";

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
  private baseUrl = import.meta.env.VITE_AUTH_SERVICE_URL || 'http://localhost:3000';

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
      const errorMessage = error.message || 'Error de conexión';
      toast.error(errorMessage);
      return {
        success: false,
        message: errorMessage,
        error: 'Network error'
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

  // 📊 ESTADO DEL OTP
  async getOTPStatus(email: string, purpose: string): Promise<ApiResponse> {
    console.log('📊 [AuthService] Consultando estado OTP para:', email);
    
    try {
      const response = await axios.get(
        `${this.baseUrl}/auth/otp/status?email=${encodeURIComponent(email)}&purpose=${purpose}`
      );
      
      return {
        success: response.data.success,
        message: response.data.message,
        data: response.data.data
      };
    } catch (error: any) {
      console.error('❌ [AuthService] Error consultando estado OTP:', error);
      const errorMessage = error.response?.data?.message || 'Error consultando estado OTP';
      return {
        success: false,
        message: errorMessage,
        error: 'Network error'
      };
    }
  }

  // 🗑️ REVOCAR OTP
  async revokeOTP(email: string, purpose: string): Promise<ApiResponse> {
    console.log('🗑️ [AuthService] Revocando OTP para:', email);
    
    try {
      const response = await axios.delete(`${this.baseUrl}/auth/otp/revoke`, {
        data: { email, purpose }
      });

      return {
        success: response.data.success,
        message: response.data.message,
        data: response.data.data
      };
    } catch (error: any) {
      console.error('❌ [AuthService] Error revocando OTP:', error);
      const errorMessage = error.response?.data?.message || 'Error revocando OTP';
      return {
        success: false,
        message: errorMessage,
        error: 'Network error'
      };
    }
  }
 
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

    // Primero validamos la contraseña actual intentando hacer login
    try {
      const loginValidation = await this.login({
        email: user.email,
        password: currentPassword
      });

      if (!loginValidation.success) {
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
  async resetPassword(email: string, newPassword: string): Promise<ApiResponse> {
    console.log('🔐 [AuthService] Restableciendo contraseña para:', email);

    try {
      const response = await axios.post(`${this.baseUrl}/auth/reset-password`, {
        email,
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
