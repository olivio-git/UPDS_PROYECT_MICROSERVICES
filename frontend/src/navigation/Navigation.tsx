import { Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import { useAuthStore } from "@/modules/auth/services/authStore";

import { publicRoutes } from "./Public.Route";
import { protectedRoutes } from "./Protected.Route";
import RouteRenderer from "./RouteRenderer"; 

const Navigation = () => {
  const { user, isLoading, initialize, isAuthenticated } = useAuthStore();

  useEffect(() => {
    // Initialize auth store on app start
    initialize();
  }, [initialize]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto"></div>
          <p className="text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

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
              user={user?.user}
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
              <a 
                href="/" 
                className="inline-block px-4 py-2 bg-black text-white rounded hover:bg-gray-800 transition-colors"
              >
                Volver al inicio
              </a>
            </div>
          </div>
        } 
      />
    </Routes>
  );
};

export default Navigation;