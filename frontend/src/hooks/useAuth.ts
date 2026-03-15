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
      const currentPath = window.location.pathname;
      if (currentPath === "/" || currentPath === "/login" || currentPath === "/otp-verification") {
        navigate("/dashboard", { replace: true });
      }
    }
  }, [authStore.isAuthenticated, authStore.isLoading, navigate]);
 
   
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
    isInOTPFlow,
    getOTPAttemptsRemaining,
    getOTPExpirationInfo,
  };
};

export default useAuth;