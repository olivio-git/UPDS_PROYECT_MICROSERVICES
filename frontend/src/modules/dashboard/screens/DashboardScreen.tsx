import { useState, useEffect } from "react";
import { Button } from "@/components/atoms/button";
import { useAuthStore } from "@/modules/auth/services/authStore";
import { MainLayout } from "@/components/layout"; 
import GradientWrapper from "@/components/background/GrandWrapperSection";
import { useNavigate } from "react-router";

const DashboardScreen = () => {
  const { user, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const [forceUpdate, setForceUpdate] = useState(0);
  
  // Escuchar eventos de cambio de autenticación
  useEffect(() => {
    const handleAuthChange = () => {
      console.log('🔄 [DashboardScreen] Evento auth-state-changed recibido');
      setForceUpdate(prev => prev + 1);
    };
    
    window.addEventListener('auth-state-changed', handleAuthChange);
    return () => window.removeEventListener('auth-state-changed', handleAuthChange);
  }, []);
  
  // Debug para ver el estado
  console.log('🎯 [DashboardScreen] Estado completo:', {
    hasUser: !!user,
    isAuthenticated,
    userRole: user?.role,
    firstName: user?.firstName,
    lastName: user?.lastName,
    email: user?.email,
    fullUser: user
  });
  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "admin":
        return "bg-gray-800 text-white shadow-md";
      case "teacher":
        return "bg-gray-800 text-white shadow-md";
      case "proctor":
        return "bg-green-500/20 text-green-300 border border-green-500/30";
      case "student":
        return "bg-gray-800 text-white shadow-md";
      default:
        return "bg-gray-500/20 text-gray-300 border border-gray-500/30";
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "admin":
        return "Administrador";
      case "teacher":
        return "Profesor";
      case "proctor":
        return "Supervisor";
      case "student":
        return "Estudiante";
      default:
        return role;
    }
  };

  return (
    <MainLayout gradientVariant="primary">
      <div className="max-w-6xl mx-auto">
        <GradientWrapper
          variant="cosmic"
          position="center"
          className="min-h-[80vh] flex items-center justify-center"
          size="xl"
          intensity="high"
          animate={false}
        > 
            <div className="text-center space-y-6">
              <div className="space-y-2">
                <h1 className="mb-4 text-3xl font-extrabold text-gray-900 dark:text-white md:text-5xl lg:text-6xl">
                  ¡Bienvenido,{" "}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r to-emerald-600 from-sky-400">
                    {user?.firstName}!
                  </span>
                </h1>
                <p className="text-sm text-gray-300 max-w-2xl mx-auto font-portfolio">
                  Todo lo que necesitas para gestionar tu cuenta y acceder a tus
                  recursos académicos en un solo lugar.
                </p> 
                <Button
                  onClick={() => {
                    if (user?.role === "admin") {
                      navigate("/dashboard");
                    } else {
                      navigate(`/${user?.role}/dashboard`);
                    }
                  }}
                  className="mt-2 text-white bg-[#20A6FF] hover:bg-[#1A8CD4] focus:ring-4 focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center inline-flex items-center dark:focus:ring-blue-900"
                  >
                  <span className="flex items-center gap-2">
                    Ir a mi Pannel
                    <span
                    className={`px-2 py-1 rounded-md text-xs font-extralight ${getRoleBadgeColor(
                      user?.role || ""
                    )}`}
                  >
                    {getRoleLabel(user?.role || "")}
                  </span>
                  </span>
                </Button>
              </div>
            </div>
        </GradientWrapper>
      </div>
    </MainLayout>
  );
};

export default DashboardScreen;
