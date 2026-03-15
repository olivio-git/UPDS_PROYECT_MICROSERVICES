import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/modules/auth/services/authStore';
import { authSDK } from '@/services/sdk-simple-auth';

const CURRENT_ROUTE_KEY = 'cba_current_route';
const INTENDED_ROUTE_KEY = 'cba_intended_route';

export const useRoutePersistence = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, isInitialized, user } = useAuthStore();

  // Guardar la ruta actual cuando cambie
  useEffect(() => {
    if (isAuthenticated && location.pathname !== '/login' && location.pathname !== '/') {
      try {
        sessionStorage.setItem(CURRENT_ROUTE_KEY, location.pathname);
      } catch (error) {
        console.warn('No se pudo guardar la ruta en sessionStorage:', error);
      }
    }
  }, [location.pathname, isAuthenticated]);

  // Manejar la restauración de ruta después de la inicialización
  useEffect(() => {
    if (!isInitialized) return;

    const checkAndRedirect = async () => {
      // Verificar si el SDK realmente tiene una sesión activa
      const isSDKAuthenticated = await authSDK.isAuthenticated();
      
      // Si está autenticado y está en una ruta de login
      if (isAuthenticated && isSDKAuthenticated && (location.pathname === '/login' || location.pathname === '/')) {
      try {
        // Primero intentar con la ruta deseada (para casos de acceso directo)
        const intendedRoute = sessionStorage.getItem(INTENDED_ROUTE_KEY);
        if (intendedRoute && intendedRoute !== '/login' && intendedRoute !== '/') {
          sessionStorage.removeItem(INTENDED_ROUTE_KEY);
          navigate(intendedRoute, { replace: true });
          return;
        }

        // Luego intentar con la última ruta visitada
        const lastRoute = sessionStorage.getItem(CURRENT_ROUTE_KEY);
        if (lastRoute && lastRoute !== '/login' && lastRoute !== '/') {
          navigate(lastRoute, { replace: true });
          return;
        }

        // Finalmente, ir al dashboard por defecto
        const userRole = user?.role || 'admin';
        const defaultPaths = {
          admin: '/dashboard',
          student: '/student/dashboard',
          teacher: '/teacher/dashboard',
          all: '/home'
        };
        const defaultPath = defaultPaths[userRole as keyof typeof defaultPaths] || '/dashboard';
        navigate(defaultPath, { replace: true });
      } catch (error) {
        console.warn('Error al acceder a sessionStorage:', error);
      }
    }

      // Si no está autenticado y está en una ruta protegida
      if (!isAuthenticated && !isSDKAuthenticated && location.pathname !== '/login' && location.pathname !== '/' && location.pathname !== '/otp-verification') {
        try {
          sessionStorage.setItem(INTENDED_ROUTE_KEY, location.pathname);
        } catch (error) {
          console.warn('No se pudo guardar la ruta deseada:', error);
        }
        navigate('/login', { replace: true });
      }
    };
    
    checkAndRedirect();
  }, [isInitialized, isAuthenticated, location.pathname, navigate, user]);

  return {
    clearStoredRoutes: () => {
      try {
        sessionStorage.removeItem(CURRENT_ROUTE_KEY);
        sessionStorage.removeItem(INTENDED_ROUTE_KEY);
      } catch (error) {
        console.warn('Error al limpiar rutas almacenadas:', error);
      }
    }
  };
};