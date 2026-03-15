import { authSDK } from '@/services/sdk-simple-auth';
import axios from 'axios';
import { create } from 'zustand';
import { authService } from '../services/authService';

interface OTPState {
  isOTPRequired: boolean;
  otpEmail: string;
  otpPurpose: 'login' | 'password_reset' | 'email_verification';
  otpExpiresAt?: Date;
  attemptsRemaining: number;
}

export interface PublicRegisterRequest {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

interface AuthStore {
  // Estados
  user: any | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  isInitialized: boolean;
  
  // Estados OTP
  otp: OTPState;
  
  // Acciones principales
  login: (email: string, password: string) => Promise<boolean>;
  register: (data: PublicRegisterRequest) => Promise<boolean>;
  
  // Acciones OTP (para el nuevo flujo)
  generateOTP: (email: string, purpose: OTPState['otpPurpose']) => Promise<boolean>;
  verifyOTP: (code: string) => Promise<boolean>;
  clearOTP: () => void;
  
  // Acciones generales
  logout: () => Promise<void>;
  clearError: () => void;
  initialize: () => Promise<void>;

  // Reset password
  resetPassword: (email: string, newPassword: string) => Promise<boolean>;

  getCandidateId: () => Promise<string | null>;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  // Estados iniciales
  user: null,
  isLoading: true,
  isAuthenticated: false,
  error: null,
  isInitialized: false,
  
  otp: {
    isOTPRequired: false,
    otpEmail: '',
    otpPurpose: 'email_verification',
    attemptsRemaining: 3,
  },

  // Limpiar errores
  clearError: () => set({ error: null }),

  // 🔐 LOGIN DIRECTO (DESPUÉS DE VERIFICAR OTP)
  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    
    try {
      // console.log('🔑 [AuthStore] Login DIRECTO con credenciales verificadas');
      
      const result = await authService.login({ email, password });
      
      if (result.success) {
        // console.log('✅ [AuthStore] Login exitoso');
        
        // El SDK maneja el estado internamente, solo necesitamos actualizar nuestro estado local
        const currentUser = authService.getCurrentUser(); 
        const isAuth = await authService.isAuthenticated();
        
        if (currentUser && isAuth) {
          // console.log('🎉 [AuthStore] Login completado exitosamente');
          set({ 
            user: currentUser,
            isAuthenticated: true,
            isLoading: false,
            // Limpiar estado OTP después del login exitoso
            otp: {
              isOTPRequired: false,
              otpEmail: '',
              otpPurpose: 'email_verification',
              attemptsRemaining: 3,
            }
          });
          // if(currentUser.role === 'student'){
          //   console.log('Usuario es estudiante, redirigiendo a /student/dashboard');
          // }
          return true;
        } else {
          // console.log('⚠️ [AuthStore] Login exitoso pero sin datos de usuario');
          set({ isLoading: false });
          return true;
        }
      } else {
        console.error('❌ [AuthStore] Login falló:', result.message);
        set({ 
          error: result.message,
          isLoading: false 
        });
        return false;
      }
    } catch (error) {
      console.error('❌ [AuthStore] Error inesperado en login:', error);
      set({ 
        error: 'Error de conexión',
        isLoading: false 
      });
      return false;
    }
  },

  // 👥 REGISTRO DIRECTO
  register: async (data: PublicRegisterRequest) => {
    set({ isLoading: true, error: null });
    
    try {
      // console.log('🚀 [AuthStore] Registro directo');
      
      // Validación previa
      if (!data.email || !data.firstName || !data.lastName || !data.password) {
        console.error('❌ [AuthStore] Datos incompletos:', data);
        set({ 
          error: 'Todos los campos son obligatorios',
          isLoading: false 
        });
        return false;
      }
      
      const result = await authService.register({
        ...data,
        role: 'student',
      });
      
      // console.log('📥 [AuthStore] Resultado del registro:', {
      //   success: result.success,
      //   message: result.message,
      //   hasUser: !!result.data?.user,
      //   hasToken: !!result.data?.accessToken
      // });
      
      if (result.success) {
        // console.log('✅ [AuthStore] Registro exitoso');
        
        // Verificar si el registro incluye login automático
        const currentUser = authService.getCurrentUser();
        const isAuth = await authService.isAuthenticated();
        
        if (currentUser && isAuth) {
          // console.log('🎉 [AuthStore] Registro completado con login automático');
          set({ 
            user: currentUser,
            isAuthenticated: true,
            isLoading: false,
          });
          return true;
        } else {
          // console.log('✅ [AuthStore] Registro completado, login manual requerido');
          set({ 
            isLoading: false,
            error: null
          });
          return true;
        }
      } else {
        console.error('❌ [AuthStore] Registro falló:', result.message);
        set({ 
          error: result.message || 'Error en el registro',
          isLoading: false 
        });
        return false;
      }
    } catch (error) {
      console.error('❌ [AuthStore] Error inesperado en registro:', error);
      set({ 
        error: 'Error de conexión',
        isLoading: false 
      });
      return false;
    }
  },

  // 📧 GENERAR OTP (NUEVO FLUJO - PRIMERA ETAPA)
  generateOTP: async (email: string, purpose: OTPState['otpPurpose']) => {
    set({ isLoading: true, error: null });
    
    try {
      console.log('📧 [AuthStore] Generando OTP inicial para:', email, 'propósito:', purpose);

      const result = await authService.generateOTP({ email, purpose });

      if (result.success) {
        console.log('✅ [AuthStore] OTP generado exitosamente');

        const newOtpState = {
          isOTPRequired: true,
          otpEmail: email,
          otpPurpose: purpose,
          otpExpiresAt: result.data?.expiresIn
            ? new Date(Date.now() + result.data.expiresIn * 1000)
            : undefined,
          attemptsRemaining: 3,
        };

        console.log('📧 [AuthStore] Estableciendo estado OTP:', newOtpState);

        set({
          isLoading: false,
          otp: newOtpState
        });
        return true;
      } else {
        console.error('❌ [AuthStore] Error generando OTP:', result.message);
        set({ 
          error: result.message,
          isLoading: false 
        });
        return false;
      }
    } catch (error) {
      console.error('❌ [AuthStore] Error inesperado generando OTP:', error);
      set({ 
        error: 'Error de conexión',
        isLoading: false 
      });
      return false;
    }
  },

  // ✅ VERIFICAR OTP (NUEVO FLUJO - SEGUNDA ETAPA)
  verifyOTP: async (code: string) => {
    const { otp } = get();
    set({ isLoading: true, error: null });
    
    try {
      // console.log('🔍 [AuthStore] Verificando OTP:', code, 'para propósito:', otp.otpPurpose);
      
      const result = await authService.verifyOTP({
        email: otp.otpEmail,
        code,
        purpose: otp.otpPurpose,
      });
      
      if (result.success) {
        // console.log('✅ [AuthStore] OTP verificado exitosamente');
        
        // Para el nuevo flujo, el OTP solo verifica el email
        // No hacemos login automático aquí
        set({
          isLoading: false,
          // No limpiamos completamente el OTP, solo marcamos como verificado
          otp: {
            ...otp,
            isOTPRequired: false, // Ya no se requiere
            attemptsRemaining: 3 // Resetear intentos
          }
        });
        return true;
      } else {
        console.error('❌ [AuthStore] OTP inválido:', result.message);
        const attemptsRemaining = otp.attemptsRemaining - 1;
        
        if (attemptsRemaining <= 0) {
          set({ 
            error: 'Se agotaron los intentos. Genera un nuevo código.',
            isLoading: false,
            otp: {
              isOTPRequired: false,
              otpEmail: '',
              otpPurpose: 'email_verification',
              attemptsRemaining: 3,
            }
          });
        } else {
          set({ 
            error: `${result.message} Intentos restantes: ${attemptsRemaining}`,
            isLoading: false,
            otp: { ...otp, attemptsRemaining }
          });
        }
        return false;
      }
    } catch (error) {
      console.error('❌ [AuthStore] Error inesperado verificando OTP:', error);
      set({ 
        error: 'Error de conexión',
        isLoading: false 
      });
      return false;
    }
  },

  // 🗑️ LIMPIAR ESTADO OTP
  clearOTP: () => {
    // console.log('🗑️ [AuthStore] Limpiando estado OTP');
    set({
      otp: {
        isOTPRequired: false,
        otpEmail: '',
        otpPurpose: 'email_verification',
        attemptsRemaining: 3,
      }
    });
  },

  // 🚪 LOGOUT
  logout: async () => {
    set({ isLoading: true });
    
    try {
      // console.log('🚪 [AuthStore] Cerrando sesión...');
      await authService.logout();
      
      // Limpiar rutas guardadas
      try {
        sessionStorage.removeItem('cba_current_route');
        sessionStorage.removeItem('cba_intended_route');
      } catch (error) {
        // Silencioso
      }
      
      set({ 
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
        otp: {
          isOTPRequired: false,
          otpEmail: '',
          otpPurpose: 'email_verification',
          attemptsRemaining: 3,
        }
      });
      
      // console.log('✅ [AuthStore] Logout completado');
    } catch (error) {
      console.error('❌ [AuthStore] Error en logout:', error);
      set({ isLoading: false });
    }
  },

  // 🔄 INICIALIZAR - ESTE ES EL PUNTO CLAVE PARA LA PERSISTENCIA
  initialize: async ():Promise<any> => {
    set({ isLoading: true, isInitialized: false });
    
    try {
      // console.log('🔄 [AuthStore] Inicializando...');
      
      // PASO 1: Verificar inmediatamente si hay una sesión válida
      const currentUser = authService.getCurrentUser();
      const isAuth = await authService.isAuthenticated();
      
      // console.log('🔍 [AuthStore] Estado inicial del SDK:', {
      //   hasUser: !!currentUser,
      //   isAuthenticated: isAuth,
      //   userRole: currentUser?.role,
      //   userEmail: currentUser?.email
      // });
      
      // PASO 2: Configurar el estado inicial basado en el SDK
      // console.log("Current User in Auth Store Initialization:", currentUser);
      // if(currentUser?.role === "student"){
      //   console.log("Executed to get candidate ID");
      //   const response = await axios.get('http://localhost:3001/api/v1/candidates/by-auth-user/'+currentUser.id);
      //   console.log('✅ [AuthStore] Candidate ID obtenido:', response);
        
      // }
      set({
        user: currentUser,
        isAuthenticated: isAuth,
        isLoading: false,
        isInitialized: true
      });
      
      // PASO 3: Suscribirse a cambios de estado del SDK
      const unsubscribe = authService.onAuthStateChanged((state) => {
        // console.log('🔔 [AuthStore] Cambio de estado del SDK:', {
        //   hasUser: !!state.user,
        //   isAuthenticated: !!state.user,
        //   loading: state.loading,
        //   error: state.error
        // });
        
        // Actualizar el estado del store cuando el SDK cambie
        set({
          user: state.user || null,
          isAuthenticated: !!state.user,
          isLoading: state.loading || false,
          error: state.error || null
        });
      });
      
      // console.log('✅ [AuthStore] Inicialización completada');
      
      // Retornar función de limpieza (opcional)
      return unsubscribe;
      
    } catch (error) {
      console.error('❌ [AuthStore] Error durante inicialización:', error);
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        isInitialized: true,
        error: 'Error al inicializar autenticación'
      });
    }
  },
  async getCandidateId(): Promise<string | null> {
    try {
      const currentUser = authSDK.getCurrentUser();
      const token = authSDK.getAccessToken();
      
      console.log('🔍 Obteniendo candidateId para usuario:', currentUser?.id);
      
      if (!currentUser?.id) {
        throw new Error('No hay usuario autenticado');
      }
      
      if (!token) {
        throw new Error('No hay token de autenticación');
      }
      
      const response = await axios.get(
        `${import.meta.env.VITE_USER_MANAGEMENT_URL}/api/v1/candidates/by-auth-user/${currentUser.id}`,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      console.log('✅ Respuesta candidateId:', response.data);
      
      const candidateId = response.data.data._id;
      if (!candidateId) {
        throw new Error('Candidate ID no encontrado en la respuesta');
      }
      
      return candidateId;
    } catch (error) {
      console.error('❌ Error obteniendo ID de candidato:', error);
      return null;
    }
  },

  // 🔐 RESET PASSWORD (SIN CONTRASEÑA ACTUAL)
  resetPassword: async (email: string, newPassword: string) => {
    set({ isLoading: true, error: null });

    try {
      console.log('🔐 [AuthStore] Restableciendo contraseña para:', email);

      const result = await authService.resetPassword(email, newPassword);

      if (result.success) {
        console.log('✅ [AuthStore] Contraseña restablecida exitosamente');

        set({
          isLoading: false,
          error: null,
          // Limpiar estado OTP después del reset
          otp: {
            isOTPRequired: false,
            otpEmail: '',
            otpPurpose: 'email_verification',
            attemptsRemaining: 3,
          }
        });
        return true;
      } else {
        console.error('❌ [AuthStore] Error restableciendo contraseña:', result.message);
        set({
          error: result.message,
          isLoading: false
        });
        return false;
      }
    } catch (error) {
      console.error('❌ [AuthStore] Error inesperado restableciendo contraseña:', error);
      set({
        error: 'Error de conexión',
        isLoading: false
      });
      return false;
    }
  }
}));