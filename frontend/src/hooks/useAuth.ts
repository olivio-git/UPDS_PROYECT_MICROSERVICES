import { useAuthStore } from "@/modules/auth/services/authStore";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { toast } from "sonner";

export const useAuth = () => {
  const navigate = useNavigate();
  const authStore = useAuthStore();

  // Auto redirect when auth state changes
  useEffect(() => {
    if (authStore.isAuthenticated && !authStore.isLoading) {
      // Si está autenticado y está en una página de login, redirigir al dashboard
      const currentPath = window.location.pathname;
      if (currentPath === "/" || currentPath === "/login" || currentPath === "/otp-verification") {
        navigate("/dashboard", { replace: true });
      }
    }
  }, [authStore.isAuthenticated, authStore.isLoading, navigate]);

  // Enhanced login with OTP-first flow
  const loginWithOTPFirst = async (email: string, password: string) => {
    try {
      const success = await authStore.initiateLogin(email, password);
      
      if (success) {
        toast.success("📧 Te hemos enviado un código de verificación");
        return { success: true, requiresOTP: true };
      } else {
        return { success: false, requiresOTP: false };
      }
    } catch (error) {
      toast.error("Error inesperado al iniciar el proceso de login");
      return { success: false, requiresOTP: false };
    }
  };

  // Enhanced register with OTP-first flow
  const registerWithOTPFirst = async (userData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role?: string;
  }) => {
    try {
      const success = await authStore.initiateRegister(userData);
      
      if (success) {
        toast.success("📧 Te hemos enviado un código de verificación para completar tu registro");
        return { success: true, requiresOTP: true };
      }
      
      return { success: false, requiresOTP: false };
    } catch (error) {
      toast.error("Error inesperado al iniciar el proceso de registro");
      return { success: false, requiresOTP: false };
    }
  };

  // Direct login (sin OTP) - para casos especiales o testing
  const directLogin = async (email: string, password: string) => {
    try {
      const success = await authStore.directLogin(email, password);
      
      if (success) {
        toast.success("¡Inicio de sesión exitoso!");
        return { success: true };
      } else {
        return { success: false };
      }
    } catch (error) {
      toast.error("Error inesperado al iniciar sesión directamente");
      return { success: false };
    }
  };

  // Direct register (sin OTP) - para casos especiales o testing
  const directRegister = async (userData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role?: string;
  }) => {
    try {
      const success = await authStore.directRegister(userData);
      
      if (success) {
        toast.success("¡Registro exitoso!");
        return { success: true };
      }
      
      return { success: false };
    } catch (error) {
      toast.error("Error inesperado al registrarse directamente");
      return { success: false };
    }
  };

  // Complete action after OTP verification
  const completeAfterOTP = async () => {
    try {
      const success = await authStore.completeAfterOTP();
      
      if (success) {
        const action = authStore.otp.pendingAction;
        if (action === "login") {
          toast.success("¡Inicio de sesión completado exitosamente!");
        } else if (action === "register") {
          toast.success("¡Registro completado exitosamente!");
        }
        return { success: true };
      }
      
      return { success: false };
    } catch (error) {
      toast.error("Error al completar la acción");
      return { success: false };
    }
  };

  // Verify OTP (wrapper for store function with enhanced feedback)
  const verifyOTPCode = async (code: string) => {
    try {
      const success = await authStore.verifyOTP(code);
      
      if (success) {
        // El store se encarga de la acción pendiente automáticamente
        return { success: true };
      }
      
      return { success: false };
    } catch (error) {
      toast.error("Error al verificar el código OTP");
      return { success: false };
    }
  };

  // Generate OTP manually
  const generateOTPManual = async (email: string, purpose: "login" | "password_reset" | "email_verification") => {
    try {
      const success = await authStore.generateOTP(email, purpose);
      
      if (success) {
        toast.success("📧 Código OTP enviado exitosamente");
        return { success: true };
      }
      
      return { success: false };
    } catch (error) {
      toast.error("Error al generar código OTP");
      return { success: false };
    }
  };

  // Check if user has specific permission
  const hasPermission = (permission: string) => {
    return authStore.user?.permissions?.includes(permission) || false;
  };

  // Check if user has specific role
  const hasRole = (role: string) => {
    return authStore.user?.role === role;
  };

  // Check if user is admin
  const isAdmin = () => {
    return authStore.user?.role === "admin";
  };

  // Check if user is active
  const isActive = () => {
    return authStore.user?.isActive || false;
  };

  // Logout with navigation
  const logoutAndRedirect = async () => {
    try {
      await authStore.logout();
      toast.success("Sesión cerrada exitosamente");
      navigate("/", { replace: true });
    } catch (error) {
      toast.error("Error al cerrar sesión");
    }
  };

  // Clear OTP state
  const clearOTPState = () => {
    authStore.clearOTP();
  };

  // Get pending action info
  const getPendingActionInfo = () => {
    const { pendingAction, pendingData, otpEmail, otpPurpose } = authStore.otp;
    
    return {
      hasPendingAction: !!pendingAction,
      action: pendingAction,
      email: otpEmail,
      purpose: otpPurpose,
      data: pendingData
    };
  };

  // Check if in OTP flow
  const isInOTPFlow = () => {
    return authStore.otp.isOTPRequired;
  };

  // Get OTP attempts remaining
  const getOTPAttemptsRemaining = () => {
    return authStore.otp.attemptsRemaining;
  };

  // Get OTP expiration info
  const getOTPExpirationInfo = () => {
    const { otpExpiresAt } = authStore.otp;
    
    if (!otpExpiresAt) return null;
    
    const now = new Date();
    const remainingMs = otpExpiresAt.getTime() - now.getTime();
    const remainingSeconds = Math.max(0, Math.floor(remainingMs / 1000));
    
    return {
      expiresAt: otpExpiresAt,
      remainingSeconds,
      isExpired: remainingSeconds === 0
    };
  };

  return {
    // Store state
    ...authStore,
    
    // Enhanced OTP-first methods
    loginWithOTPFirst,
    registerWithOTPFirst,
    
    // Direct methods (for special cases)
    directLogin,
    directRegister,
    
    // OTP management
    completeAfterOTP,
    verifyOTPCode,
    generateOTPManual,
    clearOTPState,
    
    // Permission helpers
    hasPermission,
    hasRole,
    isAdmin,
    isActive,
    
    // Navigation
    logoutAndRedirect,
    navigate,
    
    // OTP flow helpers
    getPendingActionInfo,
    isInOTPFlow,
    getOTPAttemptsRemaining,
    getOTPExpirationInfo,
  };
};

export default useAuth;