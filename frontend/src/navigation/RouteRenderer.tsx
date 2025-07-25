import type React from "react";
import type RouteType from "./RouteType";
import { Navigate } from "react-router";

interface AuthUser {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
  permissions: string[];
}

interface RouteRendererProps {
  route: RouteType;
  isAuthenticated?: boolean;
  user?: AuthUser | null;
  redirectTo?: string;
}

const RouteRenderer: React.FC<RouteRendererProps> = ({ 
  route, 
  isAuthenticated = false, 
  user = null,
  redirectTo = "/" 
}) => { 
  const Component = route.element;
  
  if (!Component) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-red-600">Error</h1>
          <p className="text-gray-600">Componente no encontrado para la ruta: {route.path}</p>
        </div>
      </div>
    );
  }
  
  // Si es ruta protegida y no está autenticado, redirigir al login
  if (route.type === "protected" && !isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  // Si es ruta pública y ya está autenticado, redirigir al dashboard
  if (route.type === "public" && isAuthenticated && route.path === "/") {
    return <Navigate to="/dashboard" replace />;
  }

  // Verificar permisos de rol para rutas protegidas
  if (route.type === "protected" && isAuthenticated && user) {
    // Si la ruta requiere admin y el usuario no es admin
    if (route.isAdmin && user.role !== "admin") {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold text-red-600">403</h1>
            <p className="text-gray-600">No tienes permisos para acceder a esta página</p>
            <a 
              href="/dashboard" 
              className="inline-block px-4 py-2 bg-black text-white rounded hover:bg-gray-800 transition-colors"
            >
              Volver al Dashboard
            </a>
          </div>
        </div>
      );
    }

    // Si la ruta requiere un rol específico (que no sea "all")
    if (route.role && route.role !== "all" && user.role !== route.role) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold text-red-600">403</h1>
            <p className="text-gray-600">
              Esta función requiere permisos de {route.role}
            </p>
            <a 
              href="/dashboard" 
              className="inline-block px-4 py-2 bg-black text-white rounded hover:bg-gray-800 transition-colors"
            >
              Volver al Dashboard
            </a>
          </div>
        </div>
      );
    }

    // Verificar si el usuario está activo
    if (!user.isActive) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold text-orange-600">Cuenta Inactiva</h1>
            <p className="text-gray-600">
              Tu cuenta está desactivada. Contacta al administrador.
            </p>
          </div>
        </div>
      );
    }
  }
  
  return <Component />;
};

export default RouteRenderer;