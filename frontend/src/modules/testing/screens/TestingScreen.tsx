import { useState } from "react";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/atoms/card";
import { Button } from "@/components/atoms/button";
import { Input } from "@/components/atoms/input";
import { Label } from "@/components/atoms/label";
import { Textarea } from "@/components/atoms/textarea";
import { Badge } from "@/components/atoms/badge";
import { Separator } from "@/components/atoms/separator";
import { Alert, AlertDescription } from "@/components/atoms/alert";
import { 
  notificationService, 
  type NotificationStats, 
  type EmailHistoryItem 
} from "@/services/notifications/notificationService";
import { authService } from "@/modules/auth/services/authService";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { MainLayout } from "@/components/layout";
import { ContentGradientSection, CardGradientWrapper } from "@/components/background";
import { 
  Mail, 
  Send, 
  BarChart3, 
  History, 
  // RefreshCw, 
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle,
  TestTube,
  // UserPlus,
  // LogIn,
  // Zap,
  Shield,
  Activity,
  Server
} from "lucide-react";

const TestingScreen = () => {
  const { 
    // user, 
    isAdmin, 
    // loginWithOTPFirst, 
    // registerWithOTPFirst, 
    // directLogin, 
    // directRegister 
  } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState<NotificationStats | null>(null);
  const [emailHistory, setEmailHistory] = useState<EmailHistoryItem[]>([]);
  
  // Test email form
  const [testEmail, setTestEmail] = useState({
    to: "",
    type: "welcome" as "welcome" | "otp" | "password_reset",
    data: "{}"
  });

  // OTP test form  
  const [otpTest, setOtpTest] = useState({
    email: "",
    purpose: "login" as "login" | "password_reset" | "email_verification",
    code: ""
  });

  // Auth flow test forms
  // const [authTest, setAuthTest] = useState({
  //   email: "",
  //   password: "test123456",
  //   firstName: "Test",
  //   lastName: "User",
  //   role: "student" as "student" | "teacher" | "proctor" | "admin"
  // });

  // Test auth endpoints
  const testAuthEndpoints = async () => {
    setIsLoading(true);
    try {
      // Test health
      const health = await fetch("http://localhost:3000/health");
      const healthData = await health.json();
      
      if (healthData.success) {
        toast.success("✅ Auth Service: Healthy");
      } else {
        toast.error("❌ Auth Service: Unhealthy");
      }
    } catch (error) {
      toast.error("❌ Auth Service: Connection failed");
    }
    setIsLoading(false);
  };

  // Test notification endpoints
  const testNotificationEndpoints = async () => {
    setIsLoading(true);
    try {
      const health = await notificationService.checkHealth();
      
      if (health.success) {
        toast.success("✅ Notification Service: Healthy");
      } else {
        toast.error("❌ Notification Service: Unhealthy");
      }
    } catch (error) {
      toast.error("❌ Notification Service: Connection failed");
    }
    setIsLoading(false);
  };

  // Test OTP-first login flow
  // const testOTPFirstLogin = async () => {
  //   if (!authTest.email || !authTest.password) {
  //     toast.error("Por favor completa email y contraseña");
  //     return;
  //   }

  //   setIsLoading(true);
  //   try {
  //     const result = await loginWithOTPFirst(authTest.email, authTest.password);
      
  //     if (result.success) {
  //       toast.success("✅ Flujo OTP-Login iniciado. Revisa tu email y completa en /otp-verification");
  //     } else {
  //       toast.error("❌ Error en flujo OTP-Login");
  //     }
  //   } catch (error) {
  //     toast.error("❌ Error inesperado en flujo OTP-Login");
  //   }
  //   setIsLoading(false);
  // };

  // // Test OTP-first register flow
  // const testOTPFirstRegister = async () => {
  //   if (!authTest.email || !authTest.password || !authTest.firstName || !authTest.lastName) {
  //     toast.error("Por favor completa todos los campos");
  //     return;
  //   }

  //   setIsLoading(true);
  //   try {
  //     const result = await registerWithOTPFirst({
  //       email: authTest.email,
  //       password: authTest.password,
  //       firstName: authTest.firstName,
  //       lastName: authTest.lastName,
  //       role: authTest.role
  //     });
      
  //     if (result.success) {
  //       toast.success("✅ Flujo OTP-Register iniciado. Revisa tu email y completa en /otp-verification");
  //     } else {
  //       toast.error("❌ Error en flujo OTP-Register");
  //     }
  //   } catch (error) {
  //     toast.error("❌ Error inesperado en flujo OTP-Register");
  //   }
  //   setIsLoading(false);
  // };

  // // Test direct login (bypass OTP)
  // const testDirectLogin = async () => {
  //   if (!authTest.email || !authTest.password) {
  //     toast.error("Por favor completa email y contraseña");
  //     return;
  //   }

  //   setIsLoading(true);
  //   try {
  //     const result = await directLogin(authTest.email, authTest.password);
      
  //     if (result.success) {
  //       toast.success("✅ Login directo exitoso (sin OTP)");
  //     } else {
  //       toast.error("❌ Error en login directo");
  //     }
  //   } catch (error) {
  //     toast.error("❌ Error inesperado en login directo");
  //   }
  //   setIsLoading(false);
  // };

  // // Test direct register (bypass OTP)
  // const testDirectRegister = async () => {
  //   if (!authTest.email || !authTest.password || !authTest.firstName || !authTest.lastName) {
  //     toast.error("Por favor completa todos los campos");
  //     return;
  //   }

  //   setIsLoading(true);
  //   try {
  //     const result = await directRegister({
  //       email: authTest.email,
  //       password: authTest.password,
  //       firstName: authTest.firstName,
  //       lastName: authTest.lastName,
  //       role: authTest.role
  //     });
      
  //     if (result.success) {
  //       toast.success("✅ Registro directo exitoso (sin OTP)");
  //     } else {
  //       toast.error("❌ Error en registro directo");
  //     }
  //   } catch (error) {
  //     toast.error("❌ Error inesperado en registro directo");
  //   }
  //   setIsLoading(false);
  // };

  // Send test email
  const sendTestEmail = async () => {
    if (!testEmail.to || !testEmail.data) {
      toast.error("Por favor completa todos los campos");
      return;
    }

    setIsLoading(true);
    try {
      let parsedData;
      try {
        parsedData = JSON.parse(testEmail.data);
      } catch {
        toast.error("El campo 'data' debe ser un JSON válido");
        setIsLoading(false);
        return;
      }

      const result = await notificationService.sendTestEmail({
        to: testEmail.to,
        type: testEmail.type,
        data: parsedData
      });

      if (result.success) {
        toast.success("✅ Email enviado exitosamente");
        setTestEmail({ to: "", type: "welcome", data: "{}" });
      } else {
        toast.error(`❌ Error: ${result.message}`);
      }
    } catch (error) {
      toast.error("❌ Error inesperado al enviar email");
    }
    setIsLoading(false);
  };

  // Generate OTP
  const generateOTP = async () => {
    if (!otpTest.email) {
      toast.error("Por favor ingresa un email");
      return;
    }

    setIsLoading(true);
    try {
      const result = await authService.generateOTP({
        email: otpTest.email,
        purpose: otpTest.purpose
      });

      if (result.success) {
        toast.success("✅ OTP generado exitosamente");
      } else {
        toast.error(`❌ Error: ${result.message}`);
      }
    } catch (error) {
      toast.error("❌ Error inesperado al generar OTP");
    }
    setIsLoading(false);
  };

  // Verify OTP
  const verifyOTP = async () => {
    if (!otpTest.email || !otpTest.code) {
      toast.error("Por favor completa todos los campos");
      return;
    }

    setIsLoading(true);
    try {
      const result = await authService.verifyOTP({
        email: otpTest.email,
        code: otpTest.code,
        purpose: otpTest.purpose
      });

      if (result.success) {
        toast.success("✅ OTP verificado exitosamente");
        setOtpTest({ ...otpTest, code: "" });
      } else {
        toast.error(`❌ Error: ${result.message}`);
      }
    } catch (error) {
      toast.error("❌ Error inesperado al verificar OTP");
    }
    setIsLoading(false);
  };

  // Get email stats
  const getEmailStats = async () => {
    setIsLoading(true);
    try {
      const result = await notificationService.getEmailStats();
      if (result.success && result.data) {
        setStats(result.data);
        toast.success("✅ Estadísticas obtenidas");
      } else {
        toast.error(`❌ Error: ${result.message}`);
      }
    } catch (error) {
      toast.error("❌ Error inesperado al obtener estadísticas");
    }
    setIsLoading(false);
  };

  // Get email history
  const getEmailHistory = async () => {
    setIsLoading(true);
    try {
      const result = await notificationService.getEmailHistory({ limit: 10 });
      if (result.success && result.data) {
        setEmailHistory(result.data);
        toast.success("✅ Historial obtenido");
      } else {
        toast.error(`❌ Error: ${result.message}`);
      }
    } catch (error) {
      toast.error("❌ Error inesperado al obtener historial");
    }
    setIsLoading(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "sent":
        return <Badge className="bg-green-500/20 text-green-300 border border-green-500/30"><CheckCircle className="h-3 w-3 mr-1" />Enviado</Badge>;
      case "pending":
        return <Badge className="bg-yellow-500/20 text-yellow-300 border border-yellow-500/30"><Clock className="h-3 w-3 mr-1" />Pendiente</Badge>;
      case "failed":
        return <Badge className="bg-red-500/20 text-red-300 border border-red-500/30"><XCircle className="h-3 w-3 mr-1" />Fallido</Badge>;
      default:
        return <Badge className="bg-gray-500/20 text-gray-300 border border-gray-500/30">{status}</Badge>;
    }
  };

  const getTestEmailData = (type: string) => {
    switch (type) {
      case "welcome":
        return JSON.stringify({ firstName: "Juan", lastName: "Pérez" }, null, 2);
      case "otp":
        return JSON.stringify({ code: "123456", purpose: "verificación de cuenta", expiryMinutes: 10 }, null, 2);
      case "password_reset":
        return JSON.stringify({ resetToken: "abc123token", firstName: "Juan" }, null, 2);
      default:
        return "{}";
    }
  };

  // Solo mostrar si es admin
  if (!isAdmin()) {
    return (
      <MainLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <Alert className="max-w-md bg-red-500/20 border border-red-500/30">
            <AlertCircle className="h-4 w-4 text-red-400" />
            <AlertDescription className="text-red-300">
              Esta página solo está disponible para administradores.
            </AlertDescription>
          </Alert>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout gradientVariant="aurora">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header Hero */}
        <div className="text-center space-y-4 mb-12">
          <div className="flex items-center justify-center gap-3">
            <div className="p-3 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-600/20 border border-blue-500/30">
              <TestTube className="h-8 w-8 text-blue-400" />
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white bg-gradient-to-r from-blue-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
            Panel de Testing
          </h1>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Centro de pruebas de integración para servicios de autenticación y notificaciones
          </p>
        </div>

        {/* Service Health Section */}
        <ContentGradientSection variant="primary" position="top-left">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* Service Health Checks */}
            <CardGradientWrapper variant="cool" intensity="medium">
              <Card className="bg-gray-900/60 backdrop-blur-sm border border-gray-700/50 h-full">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-white">
                    <Activity className="h-5 w-5 text-green-400" />
                    Health Checks
                  </CardTitle>
                  <CardDescription className="text-gray-300">
                    Verificar estado de los servicios
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button 
                    onClick={testAuthEndpoints} 
                    disabled={isLoading}
                    className="w-full bg-gradient-to-r from-green-500/20 to-emerald-600/20 border border-green-500/30 text-green-300 hover:from-green-500/30 hover:to-emerald-600/30"
                    variant="outline"
                  >
                    <Server className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                    Test Auth Service
                  </Button>
                  <Button 
                    onClick={testNotificationEndpoints} 
                    disabled={isLoading}
                    className="w-full bg-gradient-to-r from-blue-500/20 to-cyan-600/20 border border-blue-500/30 text-blue-300 hover:from-blue-500/30 hover:to-cyan-600/30"
                    variant="outline"
                  >
                    <Mail className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                    Test Notification Service
                  </Button>
                </CardContent>
              </Card>
            </CardGradientWrapper>

            {/* Email Stats */}
            <CardGradientWrapper variant="warm" intensity="medium">
              <Card className="bg-gray-900/60 backdrop-blur-sm border border-gray-700/50 h-full">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-white">
                    <BarChart3 className="h-5 w-5 text-orange-400" />
                    Estadísticas Email
                  </CardTitle>
                  <CardDescription className="text-gray-300">
                    Resumen del servicio de notificaciones
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button 
                    onClick={getEmailStats} 
                    disabled={isLoading}
                    className="w-full bg-gradient-to-r from-orange-500/20 to-red-600/20 border border-orange-500/30 text-orange-300 hover:from-orange-500/30 hover:to-red-600/30"
                    variant="outline"
                  >
                    <BarChart3 className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                    Obtener Estadísticas
                  </Button>
                  
                  {stats && (
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="space-y-1">
                        <p className="text-gray-300">Total: <span className="font-medium text-white">{stats.total}</span></p>
                        <p className="text-gray-300">Enviados: <span className="font-medium text-green-400">{stats.sent}</span></p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-gray-300">Pendientes: <span className="font-medium text-yellow-400">{stats.pending}</span></p>
                        <p className="text-gray-300">Fallidos: <span className="font-medium text-red-400">{stats.failed}</span></p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-gray-300">Tasa de éxito: <span className="font-medium text-blue-400">{stats.successRate}%</span></p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </CardGradientWrapper>

            {/* Email History Preview */}
            <CardGradientWrapper variant="accent" intensity="medium">
              <Card className="bg-gray-900/60 backdrop-blur-sm border border-gray-700/50 h-full">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-white">
                    <History className="h-5 w-5 text-purple-400" />
                    Historial Rápido
                  </CardTitle>
                  <CardDescription className="text-gray-300">
                    Últimos emails enviados
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button 
                    onClick={getEmailHistory} 
                    disabled={isLoading}
                    className="w-full bg-gradient-to-r from-purple-500/20 to-pink-600/20 border border-purple-500/30 text-purple-300 hover:from-purple-500/30 hover:to-pink-600/30"
                    variant="outline"
                  >
                    <History className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                    Cargar Historial
                  </Button>
                  
                  {emailHistory.length > 0 && (
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {emailHistory.slice(0, 3).map((email) => (
                        <div key={email._id} className="flex items-center justify-between p-2 bg-gray-800/50 rounded text-xs">
                          <div className="flex-1 truncate">
                            <p className="font-medium text-gray-200 truncate">{email.to}</p>
                            <p className="text-gray-400">{email.type}</p>
                          </div>
                          {getStatusBadge(email.status)}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </CardGradientWrapper>
          </div>
        </ContentGradientSection>

        {/* Auth Flow Testing */}
        {/* <ContentGradientSection variant="secondary" position="center-right">
          <CardGradientWrapper variant="aurora" intensity="high">
            <Card className="bg-gray-900/60 backdrop-blur-sm border border-gray-700/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Shield className="h-5 w-5 text-cyan-400" />
                  Testing de Flujos de Autenticación
                </CardTitle>
                <CardDescription className="text-gray-300">
                  Probar flujos OTP-first vs. flujos directos
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <Alert className="border-blue-500/30 bg-blue-500/10">
                  <AlertCircle className="h-4 w-4 text-blue-400" />
                  <AlertDescription className="text-blue-300">
                    <strong>Flujo OTP-First:</strong> Primero se envía OTP, luego se ejecuta login/registro.<br/>
                    <strong>Flujo Directo:</strong> Ejecuta login/registro inmediatamente (sin OTP).
                  </AlertDescription>
                </Alert>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg flex items-center gap-2 text-white">
                      <Zap className="h-5 w-5 text-orange-400" />
                      Datos de Prueba
                    </h3>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="authFirstName" className="text-gray-300">Nombre</Label>
                        <Input
                          id="authFirstName"
                          value={authTest.firstName}
                          onChange={(e) => setAuthTest({...authTest, firstName: e.target.value})}
                          placeholder="Juan"
                          className="bg-gray-800/50 border-gray-600 text-white placeholder-gray-400"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="authLastName" className="text-gray-300">Apellido</Label>
                        <Input
                          id="authLastName"
                          value={authTest.lastName}
                          onChange={(e) => setAuthTest({...authTest, lastName: e.target.value})}
                          placeholder="Pérez"
                          className="bg-gray-800/50 border-gray-600 text-white placeholder-gray-400"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="authEmail" className="text-gray-300">Email de prueba</Label>
                      <Input
                        id="authEmail"
                        type="email"
                        value={authTest.email}
                        onChange={(e) => setAuthTest({...authTest, email: e.target.value})}
                        placeholder="test@example.com"
                        className="bg-gray-800/50 border-gray-600 text-white placeholder-gray-400"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="authPassword" className="text-gray-300">Contraseña</Label>
                      <Input
                        id="authPassword"
                        value={authTest.password}
                        onChange={(e) => setAuthTest({...authTest, password: e.target.value})}
                        placeholder="test123456"
                        className="bg-gray-800/50 border-gray-600 text-white placeholder-gray-400"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="authRole" className="text-gray-300">Rol</Label>
                      <select
                        id="authRole"
                        value={authTest.role}
                        onChange={(e) => setAuthTest({...authTest, role: e.target.value as any})}
                        className="w-full px-3 py-2 bg-gray-800/50 border border-gray-600 rounded-md text-white focus:border-blue-400 focus:ring-1 focus:outline-none"
                      >
                        <option value="student">Estudiante</option>
                        <option value="teacher">Profesor</option>
                        <option value="proctor">Supervisor</option>
                        <option value="admin">Administrador</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg flex items-center gap-2 text-white">
                      <TestTube className="h-5 w-5 text-blue-400" />
                      Flujos de Prueba
                    </h3>

                    <div className="space-y-4">
                      <div className="p-4 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                        <h4 className="font-medium text-orange-300 mb-3">🔄 Flujos OTP-First (Recomendado)</h4>
                        <div className="space-y-3">
                          <Button 
                            onClick={testOTPFirstRegister} 
                            disabled={isLoading}
                            className="w-full bg-gradient-to-r from-orange-500/20 to-red-600/20 border border-orange-500/30 text-orange-300 hover:from-orange-500/30 hover:to-red-600/30"
                            size="sm"
                          >
                            <UserPlus className="h-4 w-4 mr-2" />
                            Test Register OTP-First
                          </Button>
                          <Button 
                            onClick={testOTPFirstLogin} 
                            disabled={isLoading}
                            className="w-full bg-gradient-to-r from-orange-500/20 to-red-600/20 border border-orange-500/30 text-orange-300 hover:from-orange-500/30 hover:to-red-600/30"
                            size="sm"
                          >
                            <LogIn className="h-4 w-4 mr-2" />
                            Test Login OTP-First
                          </Button>
                        </div>
                      </div>

                      <div className="p-4 bg-gray-500/10 border border-gray-500/30 rounded-lg">
                        <h4 className="font-medium text-gray-300 mb-3">⚡ Flujos Directos (Testing)</h4>
                        <div className="space-y-3">
                          <Button 
                            onClick={testDirectRegister} 
                            disabled={isLoading}
                            variant="outline"
                            className="w-full bg-gray-700/20 border-gray-500/30 text-gray-300 hover:bg-gray-700/30"
                            size="sm"
                          >
                            <UserPlus className="h-4 w-4 mr-2" />
                            Test Register Directo
                          </Button>
                          <Button 
                            onClick={testDirectLogin} 
                            disabled={isLoading}
                            variant="outline"
                            className="w-full bg-gray-700/20 border-gray-500/30 text-gray-300 hover:bg-gray-700/30"
                            size="sm"
                          >
                            <LogIn className="h-4 w-4 mr-2" />
                            Test Login Directo
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </CardGradientWrapper>
        </ContentGradientSection> */}

        {/* Email Testing and OTP Testing */}
        <ContentGradientSection variant="cool" position="bottom-left">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            {/* Test Email */}
            <CardGradientWrapper variant="primary" intensity="medium">
              <Card className="bg-gray-900/60 backdrop-blur-sm border border-gray-700/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-white">
                    <Mail className="h-5 w-5 text-blue-400" />
                    Enviar Email de Prueba
                  </CardTitle>
                  <CardDescription className="text-gray-300">
                    Probar el envío de diferentes tipos de email
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="testEmailTo" className="text-gray-300">Email destino</Label>
                      <Input
                        id="testEmailTo"
                        type="email"
                        value={testEmail.to}
                        onChange={(e) => setTestEmail({...testEmail, to: e.target.value})}
                        placeholder="test@example.com"
                        className="bg-gray-800/50 border-gray-600 text-white placeholder-gray-400"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="emailType" className="text-gray-300">Tipo de email</Label>
                      <select
                        id="emailType"
                        value={testEmail.type}
                        onChange={(e) => setTestEmail({
                          ...testEmail, 
                          type: e.target.value as any,
                          data: getTestEmailData(e.target.value)
                        })}
                        className="w-full px-3 py-2 bg-gray-800/50 border border-gray-600 rounded-md text-white focus:border-blue-400 focus:ring-1 focus:outline-none"
                      >
                        <option value="welcome">Bienvenida</option>
                        <option value="otp">Código OTP</option>
                        <option value="password_reset">Reset Password</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="emailData" className="text-gray-300">Datos (JSON)</Label>
                    <Textarea
                      id="emailData"
                      value={testEmail.data}
                      onChange={(e) => setTestEmail({...testEmail, data: e.target.value})}
                      rows={4}
                      className="font-mono text-sm bg-gray-800/50 border-gray-600 text-white placeholder-gray-400"
                    />
                  </div>
                  
                  <Button 
                    onClick={sendTestEmail} 
                    disabled={isLoading}
                    className="w-full bg-gradient-to-r from-blue-500/20 to-purple-600/20 border border-blue-500/30 text-blue-300 hover:from-blue-500/30 hover:to-purple-600/30"
                  >
                    <Send className={`h-4 w-4 mr-2 ${isLoading ? 'animate-pulse' : ''}`} />
                    Enviar Email de Prueba
                  </Button>
                </CardContent>
              </Card>
            </CardGradientWrapper>

            {/* OTP Testing */}
            <CardGradientWrapper variant="secondary" intensity="medium">
              <Card className="bg-gray-900/60 backdrop-blur-sm border border-gray-700/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-white">
                    <Shield className="h-5 w-5 text-green-400" />
                    Pruebas de OTP Manual
                  </CardTitle>
                  <CardDescription className="text-gray-300">
                    Generar y verificar códigos OTP independientemente
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="otpEmail" className="text-gray-300">Email</Label>
                      <Input
                        id="otpEmail"
                        type="email"
                        value={otpTest.email}
                        onChange={(e) => setOtpTest({...otpTest, email: e.target.value})}
                        placeholder="test@example.com"
                        className="bg-gray-800/50 border-gray-600 text-white placeholder-gray-400"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="otpPurpose" className="text-gray-300">Propósito</Label>
                      <select
                        id="otpPurpose"
                        value={otpTest.purpose}
                        onChange={(e) => setOtpTest({...otpTest, purpose: e.target.value as any})}
                        className="w-full px-3 py-2 bg-gray-800/50 border border-gray-600 rounded-md text-white focus:border-blue-400 focus:ring-1 focus:outline-none"
                      >
                        <option value="login">Login</option>
                        <option value="email_verification">Verificación Email</option>
                        <option value="password_reset">Reset Password</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="otpCode" className="text-gray-300">Código (para verificar)</Label>
                      <Input
                        id="otpCode"
                        value={otpTest.code}
                        onChange={(e) => setOtpTest({...otpTest, code: e.target.value})}
                        placeholder="123456"
                        maxLength={6}
                        className="bg-gray-800/50 border-gray-600 text-white placeholder-gray-400"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <Button 
                      onClick={generateOTP} 
                      disabled={isLoading}
                      variant="outline"
                      className="bg-green-700/20 border-green-500/30 text-green-300 hover:bg-green-700/30"
                    >
                      <Send className={`h-4 w-4 mr-2 ${isLoading ? 'animate-pulse' : ''}`} />
                      Generar OTP
                    </Button>
                    <Button 
                      onClick={verifyOTP} 
                      disabled={isLoading}
                      className="bg-gradient-to-r from-green-500/20 to-emerald-600/20 border border-green-500/30 text-green-300 hover:from-green-500/30 hover:to-emerald-600/30"
                    >
                      <CheckCircle className={`h-4 w-4 mr-2 ${isLoading ? 'animate-pulse' : ''}`} />
                      Verificar OTP
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </CardGradientWrapper>
          </div>
        </ContentGradientSection>

        {/* Email History Detailed */}
        <ContentGradientSection variant="accent" position="bottom-center">
          <CardGradientWrapper variant="sunset" intensity="low">
            <Card className="bg-gray-900/60 backdrop-blur-sm border border-gray-700/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <History className="h-5 w-5 text-yellow-400" />
                  Historial Detallado de Emails
                </CardTitle>
                <CardDescription className="text-gray-300">
                  Registro completo de emails enviados por el sistema
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button 
                  onClick={getEmailHistory} 
                  disabled={isLoading}
                  variant="outline"
                  className="bg-yellow-700/20 border-yellow-500/30 text-yellow-300 hover:bg-yellow-700/30"
                >
                  <History className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                  Recargar Historial Completo
                </Button>
                
                {emailHistory.length > 0 && (
                  <div className="space-y-2">
                    <Separator className="bg-gray-600" />
                    <div className="space-y-3 max-h-80 overflow-y-auto">
                      {emailHistory.map((email) => (
                        <div key={email._id} className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg border border-gray-700/50">
                          <div className="flex-1">
                            <p className="font-medium text-white text-sm">{email.to}</p>
                            <p className="text-xs text-gray-400">{email.type} • {new Date(email.createdAt).toLocaleString()}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {getStatusBadge(email.status)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </CardGradientWrapper>
        </ContentGradientSection>
      </div>
    </MainLayout>
  );
};

export default TestingScreen;