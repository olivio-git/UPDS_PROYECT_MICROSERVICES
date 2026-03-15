import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/modules/auth/services/authStore';

/**
 * Hook que maneja la navegación automática basada en el estado de autenticación
 */
export const useAutoNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, isInitialized, user, otp } = useAuthStore();

  useEffect(() => {
    // Solo proceder si la inicialización está completa
    if (!isInitialized) return;

    // Pequeño delay para asegurar que el SDK esté completamente listo
    const timer = setTimeout(() => {
      console.log('🔄 [AutoNavigation] Estado:', {
        isAuthenticated,
        currentPath: location.pathname,
        userRole: user?.role,
        otpRequired: otp.isOTPRequired
      }); 
    // Si se requiere OTP y no estamos en la página de verificación, redirigir
    if (otp.isOTPRequired && location.pathname !== '/otp-verification') {
      console.log('📧 [AutoNavigation] OTP requerido, redirigiendo a verificación');
      navigate('/otp-verification', { replace: true });
      return;
    }

    // Si está autenticado y en rutas públicas, redirigir al dashboard
    if (isAuthenticated && (location.pathname === '/' || location.pathname === '/login' || location.pathname === '/otp-verification')) {
      const dashboardPath = getDashboardPath(user?.role);
      console.log('✅ [AutoNavigation] Usuario autenticado, redirigiendo a:', dashboardPath);
      navigate(dashboardPath, { replace: true });
      return;
    }

    // Si no está autenticado y en rutas protegidas, redirigir al login
    if (!isAuthenticated && !otp.isOTPRequired && !isPublicRoute(location.pathname)) {
      console.log('❌ [AutoNavigation] Usuario no autenticado, redirigiendo al login');
      navigate('/', { replace: true });
      return;
    }
    }, 100); // Delay de 100ms

    return () => clearTimeout(timer);
  }, [isAuthenticated, isInitialized, location.pathname, navigate, user, otp.isOTPRequired]);
};

/**
 * Determina el dashboard según el rol del usuario
 */
const getDashboardPath = (role?: string): string => {
  switch (role) {
    case 'admin':
      return '/dashboard';
    case 'student':
      return '/student/dashboard';
    case 'teacher':
      return '/teacher/dashboard';
    case 'proctor':
      return '/dashboard';
    default:
      return '/dashboard';
  }
};

/**
 * Verifica si una ruta es pública
 */
const isPublicRoute = (pathname: string): boolean => {
  const publicRoutes = ['/', '/login', '/otp-verification'];
  return publicRoutes.includes(pathname);
};
