import { createBrowserRouter } from "react-router-dom";
import { publicRoutes } from "./Public.Route";
import { protectedRoutes } from "./Protected.Route";
import { RootLayout } from "./RootLayout";
import AuthWrapper from "./AuthWrapper"; 

const allRoutes = [...publicRoutes, ...protectedRoutes]; 
export const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    children: [
      ...allRoutes.map((route) => ({
        path: route.path === "/" ? "/" : route.path,
        element: (
          <AuthWrapper route={route} />
        ),
      })),
      {
        path: "*",
        element: (
          <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="text-center space-y-4">
              <h1 className="text-4xl font-bold text-gray-800">404</h1>
              <p className="text-gray-600">Página no encontrada</p>
              <a 
                href="/dashboard" 
                className="inline-block px-4 py-2 bg-black text-white rounded hover:bg-gray-800 transition-colors"
              >
                Volver al inicio
              </a>
            </div>
          </div>
        ),
      },
    ],
  },
]);
