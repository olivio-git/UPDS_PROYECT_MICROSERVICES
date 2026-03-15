import type React from "react";
import type RouteType from "./RouteType";
import { useAuthStore } from "@/modules/auth/services/authStore";

interface AuthWrapperProps {
  route: RouteType;
}

type UserRole = "admin" | "student" | "teacher" | "all";

const AuthWrapper: React.FC<AuthWrapperProps> = ({ route }) => {
  const { isAuthenticated, user, isLoading, isInitialized } = useAuthStore();
  const Component = route.element;

  if (!isInitialized || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto"></div>
          <p className="text-gray-600">
            {!isInitialized ? 'Inicializando...' : 'Verificando autenticación...'}
          </p>
        </div>
      </div>
    );
  }

  if (!Component) {
    // console.error("No se encontró el componente para la ruta:", route.path);
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-red-600">Error</h1>
          <p className="text-gray-600">Componente no encontrado para la ruta: {route.path}</p>
        </div>
      </div>
    );
  }

  // Para rutas protegidas, verificar autenticación
  if (route.type === "protected" && !isAuthenticated) {
    console.log("Ruta protegida sin autenticación:", route.path);
    // La redirección se maneja en useRoutePersistence
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto"></div>
          <p className="text-gray-600">Verificando acceso...</p>
        </div>
      </div>
    );
  }

  // Para rutas públicas, permitir acceso siempre
  if (route.type === "public") {
    return <Component />;
  }

  // Verificar permisos de rol para rutas protegidas
  if (route.type === "protected" && isAuthenticated && user) {
    // console.log("Ruta protegida:", route.path, "Usuario:", user.role);
    const userData = user; 
    // Verificar si el usuario está activo
    if (!userData.isActive) {
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

    // Si la ruta requiere admin y el usuario no es admin
    if (route.isAdmin && userData.role !== "admin") {
      const pathsByRole = {
        admin: "/dashboard",
        student: "/student/dashboard", 
        teacher: "/teacher/dashboard",
        all: "/home"
      };
      const userRole = userData.role as UserRole;
      const defaultPath = pathsByRole[userRole] || pathsByRole.admin;
      
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold text-red-600">403</h1>
            <p className="text-gray-600">No tienes permisos para acceder a esta página</p>
            <a
              href={defaultPath}
              className="inline-block px-4 py-2 bg-black text-white rounded hover:bg-gray-800 transition-colors"
            >
              Volver al Dashboard
            </a>
          </div>
        </div>
      );
    }

    if (
      route.role &&
      Array.isArray(route.role) &&
      !route.role.includes("all") &&
      !route.role.includes(userData.role)
    ) {
      const pathsByRole = {
        admin: "/dashboard",
        student: "/student/dashboard",
        teacher: "/teacher/dashboard", 
        all: "/home"
      };
      const userRole = userData.role as UserRole;
      const defaultPath = pathsByRole[userRole] || pathsByRole.admin;
      
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold text-red-600">403</h1>
            <p className="text-gray-600">
              Esta función requiere permisos de {route.role.join(", ")}
            </p>
            <a
              href={defaultPath}
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

export default AuthWrapper;