import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/atoms/card";
import { Button } from "@/components/atoms/button";
import { useAuthStore } from "@/modules/auth/services/authStore";
import {
  LogOut,
  User,
  Mail,
  Shield,
  TestTube,
  Settings,
  BookOpen,
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const DashboardScreen = () => {
  const { user, logout, isLoading } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      toast.success("Sesión cerrada exitosamente");
    } catch (error) {
      console.error("Error logging out:", error);
      toast.error("Error al cerrar sesión");
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "admin":
        return "bg-red-100 text-red-800";
      case "teacher":
        return "bg-blue-100 text-blue-800";
      case "proctor":
        return "bg-green-100 text-green-800";
      case "student":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
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
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              ¡Bienvenido, {user?.firstName}!
            </h1>
            <p className="text-gray-600 mt-1">
              Panel de Control - CBA Platform
            </p>
          </div>
          <Button
            onClick={handleLogout}
            disabled={isLoading}
            variant="outline"
            className="flex items-center gap-2"
          >
            <LogOut className="h-4 w-4" />
            Cerrar Sesión
          </Button>
        </div>

        {/* User Info Card */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Información de Usuario
            </CardTitle>
            <CardDescription>Detalles de tu cuenta y permisos</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  Nombre Completo
                </label>
                <p className="text-gray-900">
                  {user?.firstName} {user?.lastName}
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  Email
                </label>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-gray-500" />
                  <p className="text-gray-900">{user?.email}</p>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Rol</label>
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-gray-500" />
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleBadgeColor(
                      user?.role || ""
                    )}`}
                  >
                    {getRoleLabel(user?.role || "")}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  Estado
                </label>
                <span
                  className={`px-2 py-1 rounded-full text-xs font-medium ${
                    user?.isActive
                      ? "bg-green-100 text-green-800"
                      : "bg-red-100 text-red-800"
                  }`}
                >
                  {user?.isActive ? "Activo" : "Inactivo"}
                </span>
              </div>
            </div>

            {user?.permissions && user?.permissions.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  Permisos
                </label>
                <div className="flex flex-wrap gap-2">
                  {user?.permissions.map(
                    (permission: string, index: number) => (
                      <span
                        key={index}
                        className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs"
                      >
                        {permission}
                      </span>
                    )
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Acciones Rápidas</CardTitle>
            <CardDescription>
              Funciones disponibles según tu rol
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {user?.role === "admin" && (
                <>
                  <Button
                    variant="outline"
                    className="h-20 flex-col gap-2"
                    onClick={() => navigate("/testing")}
                  >
                    <TestTube className="h-6 w-6" />
                    <span className="text-sm">Panel de Testing</span>
                  </Button>
                  <Button
                    variant="outline"
                    className="h-20 flex-col gap-2"
                    onClick={() => toast.info("Próximamente disponible")}
                  >
                    <Shield className="h-6 w-6" />
                    <span className="text-sm">Gestionar Usuarios</span>
                  </Button>
                  <Button
                    variant="outline"
                    className="h-20 flex-col gap-2"
                    onClick={() => toast.info("Próximamente disponible")}
                  >
                    <Settings className="h-6 w-6" />
                    <span className="text-sm">Configuración Sistema</span>
                  </Button>
                </>
              )}

              {(user?.role === "teacher" || user?.role === "admin") && (
                <>
                  <Button
                    variant="outline"
                    className="h-20 flex-col gap-2"
                    onClick={() => toast.info("Próximamente disponible")}
                  >
                    <BookOpen className="h-6 w-6" />
                    <span className="text-sm">Crear Examen</span>
                  </Button>
                  <Button
                    variant="outline"
                    className="h-20 flex-col gap-2"
                    onClick={() => toast.info("Próximamente disponible")}
                  >
                    <Shield className="h-6 w-6" />
                    <span className="text-sm">Ver Resultados</span>
                  </Button>
                </>
              )}

              {user?.role === "student" && (
                <>
                  <Button
                    variant="outline"
                    className="h-20 flex-col gap-2"
                    onClick={() => toast.info("Próximamente disponible")}
                  >
                    <BookOpen className="h-6 w-6" />
                    <span className="text-sm">Mis Exámenes</span>
                  </Button>
                  <Button
                    variant="outline"
                    className="h-20 flex-col gap-2"
                    onClick={() => toast.info("Próximamente disponible")}
                  >
                    <User className="h-6 w-6" />
                    <span className="text-sm">Mis Resultados</span>
                  </Button>
                </>
              )}

              <Button
                variant="outline"
                className="h-20 flex-col gap-2"
                onClick={() => toast.info("Próximamente disponible")}
              >
                <User className="h-6 w-6" />
                <span className="text-sm">Mi Perfil</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DashboardScreen;
