import { create } from 'zustand';
import { authService, type RegisterRequest } from '../services/authService';

// interface AuthUser {
//   _id: string;
//   email: string;
//   firstName: string;
//   lastName: string;
//   role: string;
//   isActive: boolean;
//   permissions: string[];
// }

interface OTPState {
  isOTPRequired: boolean;
  otpEmail: string;
  otpPurpose: 'login' | 'password_reset' | 'email_verification';
  otpExpiresAt?: Date;
  attemptsRemaining: number;
  // Nuevos campos para el flujo OTP-first
  pendingAction: 'login' | 'register' | null;
  pendingData: any;
}

interface AuthStore {
  // Estados
  user: any | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  
  // Estados OTP
  otp: OTPState;
  
  // Acciones de autenticación (NUEVAS - con OTP primero)
  initiateLogin: (email: string, password: string) => Promise<boolean>;
  initiateRegister: (data: any) => Promise<boolean>;
  completeAfterOTP: () => Promise<boolean>;
  
  // Acciones OTP
  generateOTP: (email: string, purpose: OTPState['otpPurpose']) => Promise<boolean>;
  verifyOTP: (code: string) => Promise<boolean>;
  clearOTP: () => void;
  checkOTPStatus: (email: string, purpose: string) => Promise<void>;
  
  // Acciones de autenticación directas (para casos especiales)
  directLogin: (email: string, password: string) => Promise<boolean>;
  directRegister: (data: any) => Promise<boolean>;
  logout: () => Promise<void>;
  clearError: () => void;
  
  // Inicialización
  initialize: () => void;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  // Estados iniciales
  user: null,
  isLoading: false,
  isAuthenticated: false,
  error: null,
  
  otp: {
    isOTPRequired: false,
    otpEmail: '',
    otpPurpose: 'login',
    attemptsRemaining: 3,
    pendingAction: null,
    pendingData: null,
  },

  // Limpiar errores
  clearError: () => set({ error: null }),

  // NUEVO: Iniciar login (con OTP primero)
  initiateLogin: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    
    try {
      // Primero generar OTP para login
      const otpResult = await authService.generateOTP({ email, purpose: 'login' });
      
      if (otpResult.success) {
        set({ 
          isLoading: false,
          otp: {
            isOTPRequired: true,
            otpEmail: email,
            otpPurpose: 'login',
            otpExpiresAt: otpResult.data?.expiresIn 
              ? new Date(Date.now() + otpResult.data.expiresIn * 1000)
              : undefined,
            attemptsRemaining: 3,
            pendingAction: 'login',
            pendingData: { email, password }
          }
        });
        return true;
      } else {
        set({ 
          error: otpResult.message,
          isLoading: false 
        });
        return false;
      }
    } catch (error) {
      set({ 
        error: 'Error de conexión',
        isLoading: false 
      });
      return false;
    }
  },

  // NUEVO: Iniciar registro (con OTP primero)
  initiateRegister: async (data: RegisterRequest) => {
    set({ isLoading: true, error: null });
    
    try {
      // Primero generar OTP para verificación de email
      const otpResult = await authService.generateOTP({ 
        email: data.email, 
        purpose: 'email_verification' 
      });
      
      if (otpResult.success) {
        set({ 
          isLoading: false,
          otp: {
            isOTPRequired: true,
            otpEmail: data.email,
            otpPurpose: 'email_verification',
            otpExpiresAt: otpResult.data?.expiresIn 
              ? new Date(Date.now() + otpResult.data.expiresIn * 1000)
              : undefined,
            attemptsRemaining: 3,
            pendingAction: 'register',
            pendingData: data
          }
        });
        return true;
      } else {
        set({ 
          error: otpResult.message,
          isLoading: false 
        });
        return false;
      }
    } catch (error) {
      set({ 
        error: 'Error de conexión',
        isLoading: false 
      });
      return false;
    }
  },

  // NUEVO: Completar acción después de verificar OTP
  completeAfterOTP: async () => {
    const { otp } = get();
    
    if (!otp.pendingAction || !otp.pendingData) {
      set({ error: 'No hay acción pendiente' });
      return false;
    }

    set({ isLoading: true });

    try {
      let result;
      
      if (otp.pendingAction === 'login') {
        result = await authService.login(otp.pendingData);
      } else if (otp.pendingAction === 'register') {
        result = await authService.register(otp.pendingData);
      }

      if (result?.success && result.data) {
        set({ 
          user: result.data.user || null,
          isAuthenticated: true,
          isLoading: false,
          otp: {
            isOTPRequired: false,
            otpEmail: '',
            otpPurpose: 'login',
            attemptsRemaining: 3,
            pendingAction: null,
            pendingData: null,
          }
        });
        return true;
      } else {
        set({ 
          error: result?.message || 'Error en la operación',
          isLoading: false 
        });
        return false;
      }
    } catch (error) {
      set({ 
        error: 'Error de conexión',
        isLoading: false 
      });
      return false;
    }
  },

  // Login directo (sin OTP) - para casos especiales
  directLogin: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    
    try {
      const result = await authService.login({ email, password });
      
      if (result.success) {
        set({ 
          user: result.data?.user || null,
          isAuthenticated: true,
          isLoading: false,
          otp: { ...get().otp, isOTPRequired: false }
        });
        return true;
      } else {
        set({ 
          error: result.message,
          isLoading: false 
        });
        return false;
      }
    } catch (error) {
      set({ 
        error: 'Error de conexión',
        isLoading: false 
      });
      return false;
    }
  },

  // Registro directo (sin OTP) - para casos especiales
  directRegister: async (data: RegisterRequest) => {
    set({ isLoading: true, error: null });
    
    try {
      const result = await authService.register(data);
      
      if (result.success) {
        set({ 
          user: result.data?.user || null,
          isAuthenticated: true,
          isLoading: false,
          otp: { ...get().otp, isOTPRequired: false }
        });
        return true;
      } else {
        set({ 
          error: result.message,
          isLoading: false 
        });
        return false;
      }
    } catch (error) {
      set({ 
        error: 'Error de conexión',
        isLoading: false 
      });
      return false;
    }
  },

  // Logout
  logout: async () => {
    set({ isLoading: true });
    
    try {
      await authService.logout();
      set({ 
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
        otp: {
          isOTPRequired: false,
          otpEmail: '',
          otpPurpose: 'login',
          attemptsRemaining: 3,
          pendingAction: null,
          pendingData: null,
        }
      });
    } catch (error) {
      set({ isLoading: false });
    }
  },

  // Generar OTP
  generateOTP: async (email: string, purpose: OTPState['otpPurpose']) => {
    set({ isLoading: true, error: null });
    
    try {
      const result = await authService.generateOTP({ email, purpose });
      
      if (result.success) {
        set({ 
          isLoading: false,
          otp: {
            ...get().otp,
            isOTPRequired: true,
            otpEmail: email,
            otpPurpose: purpose,
            otpExpiresAt: result.data?.expiresIn 
              ? new Date(Date.now() + result.data.expiresIn * 1000)
              : undefined,
            attemptsRemaining: 3,
          }
        });
        return true;
      } else {
        set({ 
          error: result.message,
          isLoading: false 
        });
        return false;
      }
    } catch (error) {
      set({ 
        error: 'Error de conexión',
        isLoading: false 
      });
      return false;
    }
  },

  // Verificar OTP
  verifyOTP: async (code: string) => {
    const { otp } = get();
    set({ isLoading: true, error: null });
    
    try {
      const result = await authService.verifyOTP({
        email: otp.otpEmail,
        code,
        purpose: otp.otpPurpose,
      });
      
      if (result.success) {
        // Si hay una acción pendiente, ejecutarla
        if (otp.pendingAction) {
          set({ isLoading: false });
          return await get().completeAfterOTP();
        } else {
          // Solo marcar OTP como verificado
          set({ 
            isLoading: false,
            otp: { ...otp, isOTPRequired: false }
          });
          return true;
        }
      } else {
        const attemptsRemaining = otp.attemptsRemaining - 1;
        set({ 
          error: result.message,
          isLoading: false,
          otp: { ...otp, attemptsRemaining }
        });
        return false;
      }
    } catch (error) {
      set({ 
        error: 'Error de conexión',
        isLoading: false 
      });
      return false;
    }
  },

  // Limpiar estado OTP
  clearOTP: () => {
    set({
      otp: {
        isOTPRequired: false,
        otpEmail: '',
        otpPurpose: 'login',
        attemptsRemaining: 3,
        pendingAction: null,
        pendingData: null,
      }
    });
  },

  // Verificar estado del OTP
  checkOTPStatus: async (email: string, purpose: string) => {
    try {
      const result = await authService.getOTPStatus(email, purpose);
      
      if (result.success && result.data?.exists) {
        set({
          otp: {
            ...get().otp,
            isOTPRequired: true,
            otpEmail: email,
            otpPurpose: purpose as OTPState['otpPurpose'],
            otpExpiresAt: result.data.expiresAt ? new Date(result.data.expiresAt) : undefined,
            attemptsRemaining: result.data.attemptsRemaining || 3,
          }
        });
      }
    } catch (error) {
      console.error('Error verificando estado OTP:', error);
    }
  },

  // Inicializar - sincronizar con SDK
  initialize: async () => {
    const currentUser = authService.getCurrentUser();
    const isAuth = await authService.isAuthenticated();
    
    set({
      user: currentUser,
      isAuthenticated: isAuth,
      isLoading: false
    });

    // Suscribirse a cambios del SDK
    authService.onAuthStateChanged((state) => {
      set({
        user: state.user,
        isAuthenticated: !!state.user
      });
    });
  },
}));