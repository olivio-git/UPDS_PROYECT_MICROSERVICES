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
  
  // Si es ruta protegida y no está autenticado, redirigir al login inicial (OTP)
  if (route.type === "protected" && !isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  // Si es ruta pública y ya está autenticado, redirigir según el rol
  if (route.type === "public" && isAuthenticated && user) {
    console.log("Usuario autenticado accediendo a ruta pública, redirigiendo según rol");
    
    // Redirigir automáticamente según el rol del usuario
    const getRoleBasedRedirect = (userRole: string) => {
      switch (userRole) {
        case "admin":
          return "/dashboard";
        case "teacher":
          return "/teacher/dashboard";
        case "proctor":
          return "/proctor/dashboard";
        case "student":
          return "/student/dashboard";
        default:
          return "/dashboard";
      }
    };

    return <Navigate to={getRoleBasedRedirect(user.role)} replace />;
  }

  // Redirección automática del dashboard general según el rol
  if (route.path === "/dashboard" && isAuthenticated && user && user.role !== "admin") {
    console.log("Redirigiendo desde dashboard general al dashboard específico del rol:", user.role);
    return <Navigate to={`/${user.role}/dashboard`} replace />;
  }

  if (route.type === "protected" && isAuthenticated && user) {
    console.log("Es ruta protegida y el usuario está autenticado");
    
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

    // Verificar roles permitidos
    if (route.role && route.role.length > 0) {
      console.log("Verificando roles para la ruta:", route.path);
      // Si la ruta incluye "all", permitir acceso a todos los usuarios autenticados
      if (!route.role.includes("all") && !route.role.includes(user.role as any)) {
        return (
          <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="text-center space-y-4">
              <h1 className="text-4xl font-bold text-red-600">403</h1>
              <p className="text-gray-600">
                Esta función requiere uno de estos roles: {route.role.join(", ")}
              </p>
              <a 
                href={user.role === "admin" ? "/dashboard" : `/${user.role}/dashboard`}
                className="inline-block px-4 py-2 bg-black text-white rounded hover:bg-gray-800 transition-colors"
              >
                Volver al Dashboard
              </a>
            </div>
          </div>
        );
      }
    }

    // Verificación adicional para isAdmin (opcional, ya que role debería manejarlo)
    if (route.isAdmin && user.role !== "admin") {
      console.log("Acceso denegado a ruta de administrador:", route.path);
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold text-red-600">403</h1>
            <p className="text-gray-600">No tienes permisos de administrador</p>
            <a 
              href={`/${user.role}/dashboard`}
              className="inline-block px-4 py-2 bg-black text-white rounded hover:bg-gray-800 transition-colors"
            >
              Volver al Dashboard
            </a>
          </div>
        </div>
      );
    }
  }
  
  return <Component />;
};

export default RouteRenderer;