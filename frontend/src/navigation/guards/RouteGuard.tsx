import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/modules/auth/services/authStore';
import { Loader2, AlertTriangle, Lock, UserX } from 'lucide-react';
import { toast } from 'sonner';

interface RouteGuardProps {
  children: React.ReactNode;
  requiredRoles?: string[];
  requiresAuth?: boolean;
  requiresPermissions?: string[];
  redirectTo?: string;
  fallbackComponent?: React.ComponentType;
}

export const RouteGuard: React.FC<RouteGuardProps> = ({
  children,
  requiredRoles = [],
  requiresAuth = true,
  requiresPermissions = [],
  redirectTo,
  fallbackComponent: FallbackComponent
}) => {
  const { user, isAuthenticated, isLoading, isInitialized } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  // Show loading while auth is initializing
  if (!isInitialized || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-blue-600" />
          <p className="text-gray-600 dark:text-gray-400">
            {!isInitialized ? 'Inicializando sistema...' : 'Verificando autenticación...'}
          </p>
        </div>
      </div>
    );
  }

  // Check authentication requirement
  if (requiresAuth && !isAuthenticated) {
    useEffect(() => {
      toast.error('Debes iniciar sesión para acceder a esta página');
      // Store the attempted location for redirect after login
      const returnUrl = location.pathname + location.search;
      navigate('/auth/login', { 
        state: { from: returnUrl },
        replace: true 
      });
    }, [navigate, location]);

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center space-y-4">
          <Lock className="h-12 w-12 mx-auto text-red-500" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Acceso Restringido
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Redirigiendo al inicio de sesión...
          </p>
        </div>
      </div>
    );
  }

  // Check user account status
  if (isAuthenticated && user && !user.isActive) {
    if (FallbackComponent) {
      return <FallbackComponent />;
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center space-y-4 max-w-md">
          <UserX className="h-16 w-16 mx-auto text-orange-500" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Cuenta Desactivada
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Tu cuenta está temporalmente desactivada. 
            Por favor contacta al administrador del sistema.
          </p>
          <div className="pt-4">
            <button
              onClick={() => navigate('/auth/login')}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              Volver al Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Check role-based access
  if (requiredRoles.length > 0 && user) {
    const hasRequiredRole = requiredRoles.includes('all') || requiredRoles.includes(user.role);
    
    if (!hasRequiredRole) {
      const defaultPaths = {
        admin: '/dashboard',
        teacher: '/sessions',
        proctor: '/sessions',
        student: '/student/dashboard'
      };

      const userRole = user.role as keyof typeof defaultPaths;
      const defaultPath = defaultPaths[userRole] || '/dashboard';

      useEffect(() => {
        toast.error(`Esta página requiere permisos de: ${requiredRoles.join(', ')}`);
        if (redirectTo) {
          navigate(redirectTo, { replace: true });
        } else {
          navigate(defaultPath, { replace: true });
        }
      }, [navigate]);

      if (FallbackComponent) {
        return <FallbackComponent />;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
          <div className="text-center space-y-4 max-w-md">
            <AlertTriangle className="h-16 w-16 mx-auto text-red-500" />
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              403
            </h1>
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">
              Acceso Denegado
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              No tienes los permisos necesarios para acceder a esta página.
            </p>
            <div className="space-y-2 pt-4">
              <p className="text-sm text-gray-500 dark:text-gray-500">
                Permisos requeridos: {requiredRoles.join(', ')}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500">
                Tu rol actual: {user.role}
              </p>
            </div>
            <div className="pt-4">
              <button
                onClick={() => navigate(defaultPath)}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                Volver al Dashboard
              </button>
            </div>
          </div>
        </div>
      );
    }
  }

  // Check permission-based access (if implemented)
  if (requiresPermissions.length > 0 && user) {
    const userPermissions = user.permissions || [];
    const hasRequiredPermissions = requiresPermissions.every(permission =>
      userPermissions.includes(permission)
    );

    if (!hasRequiredPermissions) {
      useEffect(() => {
        toast.error(`No tienes los permisos necesarios: ${requiresPermissions.join(', ')}`);
        if (redirectTo) {
          navigate(redirectTo, { replace: true });
        }
      }, [navigate]);

      if (FallbackComponent) {
        return <FallbackComponent />;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
          <div className="text-center space-y-4 max-w-md">
            <Lock className="h-16 w-16 mx-auto text-red-500" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Permisos Insuficientes
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              No tienes los permisos específicos requeridos para esta acción.
            </p>
            <div className="space-y-2 pt-4">
              <p className="text-sm text-gray-500 dark:text-gray-500">
                Permisos requeridos: {requiresPermissions.join(', ')}
              </p>
            </div>
          </div>
        </div>
      );
    }
  }

  // All checks passed, render children
  return <>{children}</>;
};

// Higher Order Component version for backward compatibility
export const withRouteGuard = <P extends object>(
  WrappedComponent: React.ComponentType<P>,
  guardOptions: Omit<RouteGuardProps, 'children'>
) => {
  const GuardedComponent = (props: P) => (
    <RouteGuard {...guardOptions}>
      <WrappedComponent {...props} />
    </RouteGuard>
  );

  GuardedComponent.displayName = `withRouteGuard(${WrappedComponent.displayName || WrappedComponent.name})`;
  
  return GuardedComponent;
};