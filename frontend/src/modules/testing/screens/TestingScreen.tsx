import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/atoms/card";
import { Button } from "@/components/atoms/button";
import { Input } from "@/components/atoms/input";
import { Label } from "@/components/atoms/label";
import { Textarea } from "@/components/atoms/textarea";
import { Badge } from "@/components/atoms/badge";
import { Separator } from "@/components/atoms/separator";
import { Alert, AlertDescription } from "@/components/atoms/alert";
import { notificationService, type NotificationStats, type EmailHistoryItem } from "@/services/notifications/notificationService";
import { authService } from "@/modules/auth/services/authService";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { 
  Mail, 
  Send, 
  BarChart3, 
  History, 
  RefreshCw, 
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle,
  TestTube,
  UserPlus,
  LogIn,
  Zap,
  Shield
} from "lucide-react";

const TestingScreen = () => {
  const { 
    user, 
    isAdmin, 
    loginWithOTPFirst, 
    registerWithOTPFirst, 
    directLogin, 
    directRegister 
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
  const [authTest, setAuthTest] = useState({
    email: "",
    password: "test123456",
    firstName: "Test",
    lastName: "User",
    role: "student" as "student" | "teacher" | "proctor" | "admin"
  });

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
  const testOTPFirstLogin = async () => {
    if (!authTest.email || !authTest.password) {
      toast.error("Por favor completa email y contraseña");
      return;
    }

    setIsLoading(true);
    try {
      const result = await loginWithOTPFirst(authTest.email, authTest.password);
      
      if (result.success) {
        toast.success("✅ Flujo OTP-Login iniciado. Revisa tu email y completa en /otp-verification");
      } else {
        toast.error("❌ Error en flujo OTP-Login");
      }
    } catch (error) {
      toast.error("❌ Error inesperado en flujo OTP-Login");
    }
    setIsLoading(false);
  };

  // Test OTP-first register flow
  const testOTPFirstRegister = async () => {
    if (!authTest.email || !authTest.password || !authTest.firstName || !authTest.lastName) {
      toast.error("Por favor completa todos los campos");
      return;
    }

    setIsLoading(true);
    try {
      const result = await registerWithOTPFirst({
        email: authTest.email,
        password: authTest.password,
        firstName: authTest.firstName,
        lastName: authTest.lastName,
        role: authTest.role
      });
      
      if (result.success) {
        toast.success("✅ Flujo OTP-Register iniciado. Revisa tu email y completa en /otp-verification");
      } else {
        toast.error("❌ Error en flujo OTP-Register");
      }
    } catch (error) {
      toast.error("❌ Error inesperado en flujo OTP-Register");
    }
    setIsLoading(false);
  };

  // Test direct login (bypass OTP)
  const testDirectLogin = async () => {
    if (!authTest.email || !authTest.password) {
      toast.error("Por favor completa email y contraseña");
      return;
    }

    setIsLoading(true);
    try {
      const result = await directLogin(authTest.email, authTest.password);
      
      if (result.success) {
        toast.success("✅ Login directo exitoso (sin OTP)");
      } else {
        toast.error("❌ Error en login directo");
      }
    } catch (error) {
      toast.error("❌ Error inesperado en login directo");
    }
    setIsLoading(false);
  };

  // Test direct register (bypass OTP)
  const testDirectRegister = async () => {
    if (!authTest.email || !authTest.password || !authTest.firstName || !authTest.lastName) {
      toast.error("Por favor completa todos los campos");
      return;
    }

    setIsLoading(true);
    try {
      const result = await directRegister({
        email: authTest.email,
        password: authTest.password,
        firstName: authTest.firstName,
        lastName: authTest.lastName,
        role: authTest.role
      });
      
      if (result.success) {
        toast.success("✅ Registro directo exitoso (sin OTP)");
      } else {
        toast.error("❌ Error en registro directo");
      }
    } catch (error) {
      toast.error("❌ Error inesperado en registro directo");
    }
    setIsLoading(false);
  };

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
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Enviado</Badge>;
      case "pending":
        return <Badge className="bg-yellow-100 text-yellow-800"><Clock className="h-3 w-3 mr-1" />Pendiente</Badge>;
      case "failed":
        return <Badge className="bg-red-100 text-red-800"><XCircle className="h-3 w-3 mr-1" />Fallido</Badge>;
      default:
        return <Badge>{status}</Badge>;
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Alert className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Esta página solo está disponible para administradores.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-2 mb-8">
          <TestTube className="h-8 w-8 text-blue-600" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Panel de Testing</h1>
            <p className="text-gray-600">Pruebas de integración para servicios de auth y notificaciones</p>
          </div>
        </div>

        {/* Service Health Checks */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Health Checks
              </CardTitle>
              <CardDescription>Verificar estado de los servicios</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                onClick={testAuthEndpoints} 
                disabled={isLoading}
                className="w-full"
                variant="outline"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Test Auth Service
              </Button>
              <Button 
                onClick={testNotificationEndpoints} 
                disabled={isLoading}
                className="w-full"
                variant="outline"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Test Notification Service
              </Button>
            </CardContent>
          </Card>

          {/* Email Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-blue-600" />
                Estadísticas de Email
              </CardTitle>
              <CardDescription>Resumen del servicio de notificaciones</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                onClick={getEmailStats} 
                disabled={isLoading}
                className="w-full"
                variant="outline"
              >
                <BarChart3 className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Obtener Estadísticas
              </Button>
              
              {stats && (
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="space-y-1">
                    <p className="text-gray-600">Total: <span className="font-medium">{stats.total}</span></p>
                    <p className="text-gray-600">Enviados: <span className="font-medium text-green-600">{stats.sent}</span></p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-gray-600">Pendientes: <span className="font-medium text-yellow-600">{stats.pending}</span></p>
                    <p className="text-gray-600">Fallidos: <span className="font-medium text-red-600">{stats.failed}</span></p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-gray-600">Tasa de éxito: <span className="font-medium text-blue-600">{stats.successRate}%</span></p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* NEW: Auth Flow Testing */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-purple-600" />
              Testing de Flujos de Autenticación
            </CardTitle>
            <CardDescription>Probar flujos OTP-first vs. flujos directos</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Alert className="border-blue-200 bg-blue-50">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                <strong>Flujo OTP-First:</strong> Primero se envía OTP, luego se ejecuta login/registro.<br/>
                <strong>Flujo Directo:</strong> Ejecuta login/registro inmediatamente (sin OTP).
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <Zap className="h-5 w-5 text-orange-500" />
                  Datos de Prueba
                </h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="authFirstName">Nombre</Label>
                    <Input
                      id="authFirstName"
                      value={authTest.firstName}
                      onChange={(e) => setAuthTest({...authTest, firstName: e.target.value})}
                      placeholder="Juan"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="authLastName">Apellido</Label>
                    <Input
                      id="authLastName"
                      value={authTest.lastName}
                      onChange={(e) => setAuthTest({...authTest, lastName: e.target.value})}
                      placeholder="Pérez"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="authEmail">Email de prueba</Label>
                  <Input
                    id="authEmail"
                    type="email"
                    value={authTest.email}
                    onChange={(e) => setAuthTest({...authTest, email: e.target.value})}
                    placeholder="test@example.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="authPassword">Contraseña</Label>
                  <Input
                    id="authPassword"
                    value={authTest.password}
                    onChange={(e) => setAuthTest({...authTest, password: e.target.value})}
                    placeholder="test123456"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="authRole">Rol</Label>
                  <select
                    id="authRole"
                    value={authTest.role}
                    onChange={(e) => setAuthTest({...authTest, role: e.target.value as any})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:border-black focus:ring-1 focus:outline-none"
                  >
                    <option value="student">Estudiante</option>
                    <option value="teacher">Profesor</option>
                    <option value="proctor">Supervisor</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <TestTube className="h-5 w-5 text-blue-500" />
                  Flujos de Prueba
                </h3>

                <div className="space-y-3">
                  <div className="p-3 bg-orange-50 rounded-lg">
                    <h4 className="font-medium text-orange-800 mb-2">🔄 Flujos OTP-First (Recomendado)</h4>
                    <div className="space-y-2">
                      <Button 
                        onClick={testOTPFirstRegister} 
                        disabled={isLoading}
                        className="w-full bg-orange-600 hover:bg-orange-700"
                        size="sm"
                      >
                        <UserPlus className="h-4 w-4 mr-2" />
                        Test Register OTP-First
                      </Button>
                      <Button 
                        onClick={testOTPFirstLogin} 
                        disabled={isLoading}
                        className="w-full bg-orange-600 hover:bg-orange-700"
                        size="sm"
                      >
                        <LogIn className="h-4 w-4 mr-2" />
                        Test Login OTP-First
                      </Button>
                    </div>
                  </div>

                  <div className="p-3 bg-gray-50 rounded-lg">
                    <h4 className="font-medium text-gray-800 mb-2">⚡ Flujos Directos (Testing)</h4>
                    <div className="space-y-2">
                      <Button 
                        onClick={testDirectRegister} 
                        disabled={isLoading}
                        variant="outline"
                        className="w-full"
                        size="sm"
                      >
                        <UserPlus className="h-4 w-4 mr-2" />
                        Test Register Directo
                      </Button>
                      <Button 
                        onClick={testDirectLogin} 
                        disabled={isLoading}
                        variant="outline"
                        className="w-full"
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

        {/* Test Email */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-purple-600" />
              Enviar Email de Prueba
            </CardTitle>
            <CardDescription>Probar el envío de diferentes tipos de email</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="testEmailTo">Email destino</Label>
                <Input
                  id="testEmailTo"
                  type="email"
                  value={testEmail.to}
                  onChange={(e) => setTestEmail({...testEmail, to: e.target.value})}
                  placeholder="test@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emailType">Tipo de email</Label>
                <select
                  id="emailType"
                  value={testEmail.type}
                  onChange={(e) => setTestEmail({
                    ...testEmail, 
                    type: e.target.value as any,
                    data: getTestEmailData(e.target.value)
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:border-black focus:ring-1 focus:outline-none"
                >
                  <option value="welcome">Bienvenida</option>
                  <option value="otp">Código OTP</option>
                  <option value="password_reset">Reset Password</option>
                </select>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="emailData">Datos (JSON)</Label>
              <Textarea
                id="emailData"
                value={testEmail.data}
                onChange={(e) => setTestEmail({...testEmail, data: e.target.value})}
                rows={4}
                className="font-mono text-sm"
              />
            </div>
            
            <Button 
              onClick={sendTestEmail} 
              disabled={isLoading}
              className="w-full"
            >
              <Send className={`h-4 w-4 mr-2 ${isLoading ? 'animate-pulse' : ''}`} />
              Enviar Email de Prueba
            </Button>
          </CardContent>
        </Card>

        {/* OTP Testing */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TestTube className="h-5 w-5 text-orange-600" />
              Pruebas de OTP Manual
            </CardTitle>
            <CardDescription>Generar y verificar códigos OTP independientemente</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="otpEmail">Email</Label>
                <Input
                  id="otpEmail"
                  type="email"
                  value={otpTest.email}
                  onChange={(e) => setOtpTest({...otpTest, email: e.target.value})}
                  placeholder="test@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="otpPurpose">Propósito</Label>
                <select
                  id="otpPurpose"
                  value={otpTest.purpose}
                  onChange={(e) => setOtpTest({...otpTest, purpose: e.target.value as any})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:border-black focus:ring-1 focus:outline-none"
                >
                  <option value="login">Login</option>
                  <option value="email_verification">Verificación Email</option>
                  <option value="password_reset">Reset Password</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="otpCode">Código (para verificar)</Label>
                <Input
                  id="otpCode"
                  value={otpTest.code}
                  onChange={(e) => setOtpTest({...otpTest, code: e.target.value})}
                  placeholder="123456"
                  maxLength={6}
                />
              </div>
            </div>
            
            <div className="flex gap-4">
              <Button 
                onClick={generateOTP} 
                disabled={isLoading}
                variant="outline"
                className="flex-1"
              >
                <Send className={`h-4 w-4 mr-2 ${isLoading ? 'animate-pulse' : ''}`} />
                Generar OTP
              </Button>
              <Button 
                onClick={verifyOTP} 
                disabled={isLoading}
                className="flex-1"
              >
                <CheckCircle className={`h-4 w-4 mr-2 ${isLoading ? 'animate-pulse' : ''}`} />
                Verificar OTP
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Email History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-indigo-600" />
              Historial de Emails
            </CardTitle>
            <CardDescription>Últimos emails enviados</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              onClick={getEmailHistory} 
              disabled={isLoading}
              variant="outline"
            >
              <History className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Cargar Historial
            </Button>
            
            {emailHistory.length > 0 && (
              <div className="space-y-2">
                <Separator />
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {emailHistory.map((email) => (
                    <div key={email._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{email.to}</p>
                        <p className="text-xs text-gray-600">{email.type} • {new Date(email.createdAt).toLocaleString()}</p>
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
      </div>
    </div>
  );
};

export default TestingScreen;