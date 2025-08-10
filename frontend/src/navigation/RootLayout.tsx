import { useEffect, useState } from "react";
import { Outlet, ScrollRestoration } from "react-router-dom";
import { useAuthStore } from "@/modules/auth/services/authStore";
import { useRoutePersistence } from "@/hooks/useRoutePersist";
import { useAutoNavigation } from "@/hooks/useAutoNavigation";
import { authSDK } from "@/services/sdk-simple-auth";

// Root layout que maneja la autenticación y scroll restoration
export function RootLayout() {
  const { isLoading, isInitialized, initialize } = useAuthStore();
  const [localInitialized, setLocalInitialized] = useState(false);
  
  useRoutePersistence();
  useAutoNavigation();
  
  useEffect(() => {
    
    const onsubscribe = authSDK.onAuthStateChanged(() => {
      if (isInitialized) {
        setLocalInitialized(true);
      }
    });
    return () => {
      onsubscribe();
    };
  }, []);

  if (isLoading || !isInitialized || !localInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto"></div>
          <p className="text-gray-600">Inicializando aplicación...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Outlet />
      <ScrollRestoration />
    </>
  );
}
