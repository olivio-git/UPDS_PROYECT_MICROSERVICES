import { useAuthPersistence } from "@/hooks/useAuthPersistence";
import { Route, Routes, useNavigate } from "react-router-dom";
import { protectedRoutes } from "./Protected.Route";
import { publicRoutes } from "./Public.Route";
import RouteRenderer from "./RouteRenderer";

const Navigation = () => {
  const { isReady, isAuthenticated, user } = useAuthPersistence();
  const navigate = useNavigate();

  // Mostrar loading mientras se inicializa la persistencia
  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto"></div>
          <p className="text-gray-600">Inicializando sesión...</p>
        </div>
      </div>
    );
  }

  // Debug del estado de autenticación
  // console.log('🎯 [Navigation] Estado final:', {
  //   isReady,
  //   isAuthenticated,
  //   hasUser: !!user,
  //   userRole: user?.role,
  //   userEmail: user?.email
  // });

  const allRoutes = [...publicRoutes, ...protectedRoutes];
  return (
    <Routes> 
      {allRoutes.map((route, index) => (
        <Route 
          key={`${route.type}-${index}`} 
          path={route.path} 
          element={
            <RouteRenderer 
              route={route} 
              isAuthenticated={isAuthenticated}
              user={user}
              redirectTo="/" 
            />
          } 
        />
      ))}

      <Route
        path="*"
        element={
          <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="text-center space-y-4">
              <h1 className="text-4xl font-bold text-gray-800">404</h1>
              <p className="text-gray-600">Página no encontrada</p>
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={() => navigate(-1)}
                  className="px-4 py-2 rounded border border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors text-sm"
                >
                  ← Volver
                </button>
                <a
                  href={isAuthenticated && user ?
                    ({ admin: "/dashboard", teacher: "/sessions", proctor: "/sessions", student: "/student/dashboard" }[user.role] ?? "/dashboard")
                    : "/"
                  }
                  className="px-4 py-2 bg-black text-white rounded hover:bg-gray-800 transition-colors text-sm"
                >
                  {isAuthenticated ? 'Ir al Dashboard' : 'Ir al inicio'}
                </a>
              </div>
            </div>
          </div>
        }
      />
    </Routes>
  );
};

export default Navigation;