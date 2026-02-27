import { Alert, AlertDescription } from "@/components/atoms/alert";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/atoms/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/atoms/dialog";
import { Input } from "@/components/atoms/input";
import { Label } from "@/components/atoms/label";
import { ScrollArea } from "@/components/atoms/scroll-area";
import { Separator } from "@/components/atoms/separator";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/atoms/tabs";
import { Textarea } from "@/components/atoms/textarea";
import { CardGradientWrapper, ContentGradientSection } from "@/components/background";
import { MainLayout } from "@/components/layout";
import { useAuth } from "@/hooks/useAuth";
import { authService } from "@/modules/auth/services/authService";
import {
  notificationService,
  type EmailHistoryItem,
  type EmailHistoryResponse,
  type NotificationStats
} from "@/services/notifications/notificationService";
import {
  Activity,
  // RefreshCw, 
  AlertCircle,
  BarChart3,
  Calendar,
  CheckCircle,
  Clock,
  Copy,
  Eye,
  FileText,
  History,
  Info,
  Mail,
  MessageSquare,
  RotateCcw,
  Search,
  Send,
  Server,
  // UserPlus,
  // LogIn,
  // Zap,
  Shield,
  TestTube,
  User,
  XCircle
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

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
  const [emailHistory, setEmailHistory] = useState<EmailHistoryResponse | null>(null);
  const [historyEmail, setHistoryEmail] = useState("subelzaolivitocabezas@gmail.com");
  const [selectedEmail, setSelectedEmail] = useState<EmailHistoryItem | null>(null);
  const [isEmailDetailOpen, setIsEmailDetailOpen] = useState(false);
  
  // Service status tracking
  const [serviceStatus, setServiceStatus] = useState<{[key: string]: 'checking' | 'healthy' | 'unhealthy' | 'unknown'}>({
    auth: 'unknown',
    notification: 'unknown',
    userManagement: 'unknown',
    exam: 'unknown',
    sessionManager: 'unknown',
    aiGrading: 'unknown'
  });
  
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
    setServiceStatus(prev => ({ ...prev, auth: 'checking' }));
    try {
      // Test health
      const health = await fetch("http://localhost:3000/health");
      const healthData = await health.json();
      
      if (healthData.success) {
        setServiceStatus(prev => ({ ...prev, auth: 'healthy' }));
        toast.success("✅ Auth Service: Healthy");
      } else {
        setServiceStatus(prev => ({ ...prev, auth: 'unhealthy' }));
        toast.error("❌ Auth Service: Unhealthy");
      }
    } catch (error) {
      setServiceStatus(prev => ({ ...prev, auth: 'unhealthy' }));
      toast.error("❌ Auth Service: Connection failed");
    }
  };

  // Test notification endpoints
  const testNotificationEndpoints = async () => {
    setServiceStatus(prev => ({ ...prev, notification: 'checking' }));
    try {
      const health = await notificationService.checkHealth();
      
      if (health.success) {
        setServiceStatus(prev => ({ ...prev, notification: 'healthy' }));
        toast.success("✅ Notification Service: Healthy");
      } else {
        setServiceStatus(prev => ({ ...prev, notification: 'unhealthy' }));
        toast.error("❌ Notification Service: Unhealthy");
      }
    } catch (error) {
      setServiceStatus(prev => ({ ...prev, notification: 'unhealthy' }));
      toast.error("❌ Notification Service: Connection failed");
    }
  };

  // Test user management service
  const testUserManagementService = async () => {
    setServiceStatus(prev => ({ ...prev, userManagement: 'checking' }));
    try {
      const health = await fetch("http://localhost:3002/health");
      const healthData = await health.json();
      if (healthData.success || healthData.status === 'OK') {
        setServiceStatus(prev => ({ ...prev, userManagement: 'healthy' }));
        toast.success("✅ User Management Service: Healthy");
      } else {
        setServiceStatus(prev => ({ ...prev, userManagement: 'unhealthy' }));
        toast.error("❌ User Management Service: Unhealthy");
      }
    } catch (error) {
      setServiceStatus(prev => ({ ...prev, userManagement: 'unhealthy' }));
      toast.error("❌ User Management Service: Connection failed");
    }
  };

  // Test exam service
  const testExamService = async () => {
    setServiceStatus(prev => ({ ...prev, exam: 'checking' }));
    try {
      const health = await fetch("http://localhost:3003/health");
      const healthData = await health.json();

      if (healthData.success || healthData.status === 'healthy') {
        setServiceStatus(prev => ({ ...prev, exam: 'healthy' }));
        toast.success("✅ Exam Service: Healthy");
      } else {
        setServiceStatus(prev => ({ ...prev, exam: 'unhealthy' }));
        toast.error("❌ Exam Service: Unhealthy");
      }
    } catch (error) {
      setServiceStatus(prev => ({ ...prev, exam: 'unhealthy' }));
      toast.error("❌ Exam Service: Connection failed");
    }
  };

  // Test session manager service
  const testSessionManagerService = async () => {
    setServiceStatus(prev => ({ ...prev, sessionManager: 'checking' }));
    try {
      const health = await fetch("http://localhost:3004/health");
      const healthData = await health.json();

      if (healthData.success || healthData.status === 'healthy') {
        setServiceStatus(prev => ({ ...prev, sessionManager: 'healthy' }));
        toast.success("✅ Session Manager Service: Healthy");
      } else {
        setServiceStatus(prev => ({ ...prev, sessionManager: 'unhealthy' }));
        toast.error("❌ Session Manager Service: Unhealthy");
      }
    } catch (error) {
      setServiceStatus(prev => ({ ...prev, sessionManager: 'unhealthy' }));
      toast.error("❌ Session Manager Service: Connection failed");
    }
  };

  // Test AI grading service
  const testAIGradingService = async () => {
    setServiceStatus(prev => ({ ...prev, aiGrading: 'checking' }));
    try {
      const health = await fetch("http://localhost:3006/health");
      const healthData = await health.json();
      console.log(healthData);
      if (healthData.success || healthData.status === 'healthy') {
        setServiceStatus(prev => ({ ...prev, aiGrading: 'healthy' }));
        toast.success("✅ AI Grading Service: Healthy");
      } else {
        setServiceStatus(prev => ({ ...prev, aiGrading: 'unhealthy' }));
        toast.error("❌ AI Grading Service: Unhealthy");
      }
    } catch (error) {
      setServiceStatus(prev => ({ ...prev, aiGrading: 'unhealthy' }));
      toast.error("❌ AI Grading Service: Connection failed");
    }
  };

  // Test all services at once
  const testAllServices = async () => {
    setIsLoading(true);
    
    // Set all to checking
    setServiceStatus({
      auth: 'checking',
      notification: 'checking',
      userManagement: 'checking',
      exam: 'checking',
      sessionManager: 'checking',
      aiGrading: 'checking'
    });

    const services = [
      { key: 'auth', name: "Auth Service", url: "http://localhost:3000/health" },
      { key: 'userManagement', name: "User Management", url: "http://localhost:3002/health" },
      { key: 'exam', name: "Exam Service", url: "http://localhost:3003/health" },
      { key: 'sessionManager', name: "Session Manager", url: "http://localhost:3004/health" },
      { key: 'aiGrading', name: "AI Grading", url: "http://localhost:3006/health" }
    ];

    let healthyCount = 0;
    const totalServices = services.length + 1; // +1 for notification service

    // Test regular services
    for (const service of services) {
      try {
        const health = await fetch(service.url);
        const healthData = await health.json();
        
        if (healthData.success || healthData.status === 'OK' || healthData.status === 'healthy') {
          healthyCount++;
          setServiceStatus(prev => ({ ...prev, [service.key]: 'healthy' }));
        } else {
          setServiceStatus(prev => ({ ...prev, [service.key]: 'unhealthy' }));
        }
      } catch (error) {
        setServiceStatus(prev => ({ ...prev, [service.key]: 'unhealthy' }));
      }
    }

    // Test notification service separately
    try {
      const notificationHealth = await notificationService.checkHealth();
      if (notificationHealth.success) {
        healthyCount++;
        setServiceStatus(prev => ({ ...prev, notification: 'healthy' }));
      } else {
        setServiceStatus(prev => ({ ...prev, notification: 'unhealthy' }));
      }
    } catch (error) {
      setServiceStatus(prev => ({ ...prev, notification: 'unhealthy' }));
    }

    if (healthyCount === totalServices) {
      toast.success(`✅ Todos los servicios están operativos (${healthyCount}/${totalServices})`);
    } else if (healthyCount > totalServices / 2) {
      toast.warning(`⚠️ Algunos servicios tienen problemas (${healthyCount}/${totalServices} operativos)`);
    } else {
      toast.error(`❌ Múltiples servicios caídos (${healthyCount}/${totalServices} operativos)`);
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
  const getEmailHistory = async (email?: string) => {
    setIsLoading(true);
    try {
      const result = await notificationService.getEmailHistory({ 
        limit: 20,
        email: email || historyEmail 
      });
      if (result.success && result.data) {
        setEmailHistory(result.data);
        toast.success(`✅ Historial obtenido para ${result.data.email}`);
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

  // Get service status icon
  const getServiceStatusIcon = (status: 'checking' | 'healthy' | 'unhealthy' | 'unknown') => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-5 w-5 text-green-400" />;
      case 'unhealthy':
        return <XCircle className="h-5 w-5 text-red-400" />;
      case 'checking':
        return <Clock className="h-5 w-5 text-yellow-400 animate-spin" />;
      case 'unknown':
      default:
        return <AlertCircle className="h-5 w-5 text-gray-400" />;
    }
  };

  // Get service status text
  const getServiceStatusText = (status: 'checking' | 'healthy' | 'unhealthy' | 'unknown') => {
    switch (status) {
      case 'healthy':
        return { text: 'Operativo', color: 'text-green-400' };
      case 'unhealthy':
        return { text: 'Caído', color: 'text-red-400' };
      case 'checking':
        return { text: 'Verificando...', color: 'text-yellow-400' };
      case 'unknown':
      default:
        return { text: 'Sin verificar', color: 'text-gray-400' };
    }
  };

  // Copy to clipboard utility
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("✅ Copiado al portapapeles");
    } catch (error) {
      toast.error("❌ Error al copiar");
    }
  };

  // Format template data as markdown
  const formatTemplateDataAsMarkdown = (templateData: any): string => {
    if (!templateData || Object.keys(templateData).length === 0) {
      return "Sin datos del template";
    }

    const formatValue = (key: string, value: any): string => {
      if (typeof value === 'object' && value !== null) {
        return `**${key}:**\n\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\`\n`;
      }
      return `**${key}:** \`${value}\`\n`;
    };

    let markdown = "## Datos del Template\n\n";
    for (const [key, value] of Object.entries(templateData)) {
      markdown += formatValue(key, value);
    }

    return markdown;
  };

  // Open email detail modal
  const openEmailDetail = (email: EmailHistoryItem) => {
    setSelectedEmail(email);
    setIsEmailDetailOpen(true);
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
      <div className="max-w-7xl mx-auto space-y-20 px-4 sm:px-6 lg:px-8 py-10">
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Service Status Table */}
            <CardGradientWrapper variant="cool" intensity="medium">
              <Card className="bg-gray-900/60 backdrop-blur-sm border border-gray-700/50 h-full">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-white">
                    <Activity className="h-5 w-5 text-green-400" />
                    Estado de Microservicios
                  </CardTitle>
                  <CardDescription className="text-gray-300">
                    Monitor en tiempo real de todos los servicios
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Test All Button */}
                  <Button 
                    onClick={testAllServices} 
                    disabled={isLoading}
                    className="w-full bg-gradient-to-r from-purple-500/20 to-pink-600/20 border border-purple-500/30 text-purple-300 hover:from-purple-500/30 hover:to-pink-600/30"
                    variant="outline"
                  >
                    <Activity className={`h-4 w-4 mr-2 ${isLoading ? 'animate-pulse' : ''}`} />
                    Verificar Todos los Servicios
                  </Button>
                  
                  {/* Services Status Table */}
                  <div className="border border-gray-700 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-800/50">
                        <tr>
                          <th className="px-4 py-3 text-left text-gray-300 font-medium">Servicio</th>
                          <th className="px-4 py-3 text-center text-gray-300 font-medium">Puerto</th>
                          <th className="px-4 py-3 text-center text-gray-300 font-medium">Estado</th>
                          <th className="px-4 py-3 text-center text-gray-300 font-medium">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-700/50">
                        <tr className="hover:bg-gray-800/30 transition-colors">
                          <td className="px-4 py-3 flex items-center gap-2">
                            <Server className="h-4 w-4 text-green-400" />
                            <span className="text-white font-medium">Auth Service</span>
                          </td>
                          <td className="px-4 py-3 text-center text-gray-400">3000</td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              {getServiceStatusIcon(serviceStatus.auth)}
                              <span className={getServiceStatusText(serviceStatus.auth).color}>
                                {getServiceStatusText(serviceStatus.auth).text}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Button
                              onClick={testAuthEndpoints}
                              disabled={serviceStatus.auth === 'checking'}
                              size="sm"
                              variant="outline"
                              className="bg-green-500/10 border-green-500/20 text-green-400 hover:bg-green-500/20 text-xs"
                            >
                              Test
                            </Button>
                          </td>
                        </tr>
                        
                        <tr className="hover:bg-gray-800/30 transition-colors">
                          <td className="px-4 py-3 flex items-center gap-2">
                            <Mail className="h-4 w-4 text-blue-400" />
                            <span className="text-white font-medium">Notifications</span>
                          </td>
                          <td className="px-4 py-3 text-center text-gray-400">3001</td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              {getServiceStatusIcon(serviceStatus.notification)}
                              <span className={getServiceStatusText(serviceStatus.notification).color}>
                                {getServiceStatusText(serviceStatus.notification).text}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Button
                              onClick={testNotificationEndpoints}
                              disabled={serviceStatus.notification === 'checking'}
                              size="sm"
                              variant="outline"
                              className="bg-blue-500/10 border-blue-500/20 text-blue-400 hover:bg-blue-500/20 text-xs"
                            >
                              Test
                            </Button>
                          </td>
                        </tr>
                        
                        <tr className="hover:bg-gray-800/30 transition-colors">
                          <td className="px-4 py-3 flex items-center gap-2">
                            <User className="h-4 w-4 text-indigo-400" />
                            <span className="text-white font-medium">User Management</span>
                          </td>
                          <td className="px-4 py-3 text-center text-gray-400">3002</td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              {getServiceStatusIcon(serviceStatus.userManagement)}
                              <span className={getServiceStatusText(serviceStatus.userManagement).color}>
                                {getServiceStatusText(serviceStatus.userManagement).text}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Button
                              onClick={testUserManagementService}
                              disabled={serviceStatus.userManagement === 'checking'}
                              size="sm"
                              variant="outline"
                              className="bg-indigo-500/10 border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/20 text-xs"
                            >
                              Test
                            </Button>
                          </td>
                        </tr>
                        
                        <tr className="hover:bg-gray-800/30 transition-colors">
                          <td className="px-4 py-3 flex items-center gap-2">
                            <TestTube className="h-4 w-4 text-orange-400" />
                            <span className="text-white font-medium">Exam Service</span>
                          </td>
                          <td className="px-4 py-3 text-center text-gray-400">3003</td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              {getServiceStatusIcon(serviceStatus.exam)}
                              <span className={getServiceStatusText(serviceStatus.exam).color}>
                                {getServiceStatusText(serviceStatus.exam).text}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Button
                              onClick={testExamService}
                              disabled={serviceStatus.exam === 'checking'}
                              size="sm"
                              variant="outline"
                              className="bg-orange-500/10 border-orange-500/20 text-orange-400 hover:bg-orange-500/20 text-xs"
                            >
                              Test
                            </Button>
                          </td>
                        </tr>
                        
                        <tr className="hover:bg-gray-800/30 transition-colors">
                          <td className="px-4 py-3 flex items-center gap-2">
                            <Clock className="h-4 w-4 text-yellow-400" />
                            <span className="text-white font-medium">Session Manager</span>
                          </td>
                          <td className="px-4 py-3 text-center text-gray-400">3004</td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              {getServiceStatusIcon(serviceStatus.sessionManager)}
                              <span className={getServiceStatusText(serviceStatus.sessionManager).color}>
                                {getServiceStatusText(serviceStatus.sessionManager).text}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Button
                              onClick={testSessionManagerService}
                              disabled={serviceStatus.sessionManager === 'checking'}
                              size="sm"
                              variant="outline"
                              className="bg-yellow-500/10 border-yellow-500/20 text-yellow-400 hover:bg-yellow-500/20 text-xs"
                            >
                              Test
                            </Button>
                          </td>
                        </tr>
                        
                        <tr className="hover:bg-gray-800/30 transition-colors">
                          <td className="px-4 py-3 flex items-center gap-2">
                            <Activity className="h-4 w-4 text-emerald-400" />
                            <span className="text-white font-medium">AI Grading</span>
                          </td>
                          <td className="px-4 py-3 text-center text-gray-400">3006</td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              {getServiceStatusIcon(serviceStatus.aiGrading)}
                              <span className={getServiceStatusText(serviceStatus.aiGrading).color}>
                                {getServiceStatusText(serviceStatus.aiGrading).text}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Button
                              onClick={testAIGradingService}
                              disabled={serviceStatus.aiGrading === 'checking'}
                              size="sm"
                              variant="outline"
                              className="bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 text-xs"
                            >
                              Test
                            </Button>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </CardGradientWrapper>

            {/* Email Stats */}
            <CardGradientWrapper variant="warm" intensity="medium">
              <Card className="bg-gray-900/60 backdrop-blur-sm border border-gray-700/50">
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

                  {/* Quick History Preview */}
                  {/* <div className="border-t border-gray-700/50 pt-4">
                    <div className="flex items-center gap-2 mb-3">
                      <History className="h-4 w-4 text-purple-400" />
                      <span className="text-sm font-medium text-purple-400">Historial Rápido</span>
                    </div>
                    <Button 
                      onClick={() => getEmailHistory()} 
                      disabled={isLoading}
                      size="sm"
                      className="w-full bg-gradient-to-r from-purple-500/20 to-pink-600/20 border border-purple-500/30 text-purple-300 hover:from-purple-500/30 hover:to-pink-600/30"
                      variant="outline"
                    >
                      <History className={`h-3 w-3 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                      Cargar Historial
                    </Button>
                    
                    {emailHistory?.history && emailHistory.history.length > 0 && (
                      <div className="space-y-2 max-h-32 overflow-y-auto mt-3">
                        {emailHistory.history.slice(0, 3).map((email: EmailHistoryItem) => (
                          <div key={email._id} className="flex items-center justify-between p-2 bg-gray-800/50 rounded text-xs">
                            <div className="flex-1 truncate">
                              <p className="font-medium text-gray-200 truncate">{email.to}</p>
                              <p className="text-gray-400">{email.template}</p>
                            </div>
                            {getStatusBadge(email.status)}
                          </div>
                        ))}
                      </div>
                    )}
                  </div> */}
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
                <div className="flex gap-3">
                  <div className="flex-1">
                    <Label htmlFor="history-email" className="text-gray-300">Email a consultar</Label>
                    <Input
                      id="history-email"
                      type="email"
                      value={historyEmail}
                      onChange={(e) => setHistoryEmail(e.target.value)}
                      placeholder="Ingresa el email para ver su historial"
                      className="bg-gray-800/50 border-gray-600 text-white placeholder:text-gray-400"
                    />
                  </div>
                  <div className="flex items-end">
                    <Button 
                      onClick={() => getEmailHistory()} 
                      disabled={isLoading || !historyEmail.trim()}
                      variant="outline"
                      className="bg-yellow-700/20 border-yellow-500/30 text-yellow-300 hover:bg-yellow-700/30"
                    >
                      <Search className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                      Buscar
                    </Button>
                  </div>
                </div>
                
                {emailHistory && (
                  <div className="space-y-4">
                    <Separator className="bg-gray-600" />
                    
                    {/* Summary Info */}
                    <div className="flex items-center justify-between p-3 bg-gray-800/30 rounded-lg border border-gray-700/30">
                      <div className="text-sm text-gray-300">
                        <strong className="text-white">{emailHistory.email}</strong>
                        <span className="mx-2">•</span>
                        <span>{emailHistory.count} emails encontrados</span>
                      </div>
                      <Badge className="bg-blue-500/20 text-blue-300 border border-blue-500/30">
                        Total: {emailHistory.count}
                      </Badge>
                    </div>
                    
                    {/* History List */}
                    {emailHistory.history.length > 0 ? (
                      <div className="space-y-3 max-h-96 overflow-y-auto">
                        {emailHistory.history.map((email: EmailHistoryItem) => (
                          <div key={email._id} className="p-4 bg-gray-800/50 rounded-lg border border-gray-700/50 hover:border-gray-600/70 transition-colors">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1 min-w-0">
                                <h4 className="font-medium text-white text-sm truncate flex items-center gap-2">
                                  <MessageSquare className="h-4 w-4 text-blue-400" />
                                  {email.subject}
                                </h4>
                                <p className="text-xs text-gray-400 mt-1 flex items-center gap-2">
                                  <Calendar className="h-3 w-3" />
                                  <span className="font-mono">{email.template}</span>
                                  {email.priority && <span className="ml-2 px-1 py-0.5 bg-orange-500/20 text-orange-300 rounded text-xs">
                                    {email.priority}
                                  </span>}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 ml-3">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openEmailDetail(email)}
                                  className="bg-blue-500/20 border-blue-500/30 text-blue-300 hover:bg-blue-500/30 h-7 px-2"
                                >
                                  <Eye className="h-3 w-3 mr-1" />
                                  Ver
                                </Button>
                                {getStatusBadge(email.status)}
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4 text-xs text-gray-400">
                              <div>
                                <p><span className="text-gray-300">Creado:</span> {new Date(email.createdAt).toLocaleString()}</p>
                                {email.sentAt && (
                                  <p><span className="text-gray-300">Enviado:</span> {new Date(email.sentAt).toLocaleString()}</p>
                                )}
                              </div>
                              <div>
                                <p><span className="text-gray-300">Reintentos:</span> {email.retryCount}/{email.maxRetries}</p>
                                {email.messageId && (
                                  <p className="truncate"><span className="text-gray-300">ID:</span> {email.messageId}</p>
                                )}
                              </div>
                            </div>
                            
                            {email.error && (
                              <div className="mt-3 p-2 bg-red-500/10 border border-red-500/20 rounded">
                                <p className="text-xs text-red-300">
                                  <span className="font-medium">Error:</span> {email.error}
                                </p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-400">
                        <History className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p>No se encontraron emails para esta dirección</p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </CardGradientWrapper>
        </ContentGradientSection>
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

        {/* Email Detail Modal */}
        <Dialog open={isEmailDetailOpen} onOpenChange={setIsEmailDetailOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] bg-box border border-line text-white">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl">
                <Mail className="h-5 w-5 text-blue-400" />
                Detalles del Email
              </DialogTitle>
              <DialogDescription className="text-gray-400">
                {selectedEmail?.subject}
              </DialogDescription>
            </DialogHeader>

            {selectedEmail && (
              <Tabs defaultValue="overview" className="w-full">
                <TabsList className="grid w-full grid-cols-4 bg-gray-800">
                  <TabsTrigger value="overview" className="data-[state=active]:bg-blue-600 text-white">
                    <Info className="h-4 w-4 mr-2" />
                    Resumen
                  </TabsTrigger>
                  <TabsTrigger value="template" className="data-[state=active]:bg-green-600 text-white">
                    <FileText className="h-4 w-4 mr-2" />
                    Template
                  </TabsTrigger>
                  <TabsTrigger value="technical" className="data-[state=active]:bg-purple-600 text-white">
                    <Server className="h-4 w-4 mr-2" />
                    Técnico
                  </TabsTrigger>
                  <TabsTrigger value="raw" className="data-[state=active]:bg-orange-600 text-white">
                    <FileText className="h-4 w-4 mr-2" />
                    JSON Raw
                  </TabsTrigger>
                </TabsList>

                <ScrollArea className="h-[60vh] w-full">
                  <TabsContent value="overview" className="space-y-4 p-1">
                    <Card className="bg-gray-800/50 border-gray-700">
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                          <span className="flex items-center gap-2">
                            <MessageSquare className="h-5 w-5 text-blue-400" />
                            Información General
                          </span>
                          <div className="flex items-center gap-2">
                            {getStatusBadge(selectedEmail.status)}
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => copyToClipboard(selectedEmail.subject)}
                              className="h-7 px-2"
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-3">
                            <div>
                              <label className="text-sm font-medium text-gray-300">Destinatario:</label>
                              <p className="text-white font-mono">{selectedEmail.to}</p>
                            </div>
                            <div>
                              <label className="text-sm font-medium text-gray-300">Asunto:</label>
                              <p className="text-white">{selectedEmail.subject}</p>
                            </div>
                            <div>
                              <label className="text-sm font-medium text-gray-300">Template:</label>
                              <Badge className="bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                {selectedEmail.template}
                              </Badge>
                            </div>
                          </div>
                          <div className="space-y-3">
                            <div>
                              <label className="text-sm font-medium text-gray-300">Prioridad:</label>
                              <Badge className="bg-orange-500/20 text-orange-300 border border-orange-500/30">
                                {selectedEmail.priority}
                              </Badge>
                            </div>
                            <div>
                              <label className="text-sm font-medium text-gray-300">Reintentos:</label>
                              <p className="text-white">
                                {selectedEmail.retryCount}/{selectedEmail.maxRetries}
                                {selectedEmail.retryCount > 0 && (
                                  <RotateCcw className="h-4 w-4 inline ml-2 text-yellow-400" />
                                )}
                              </p>
                            </div>
                            <div>
                              <label className="text-sm font-medium text-gray-300">Message ID:</label>
                              <p className="text-white font-mono text-xs break-all">{selectedEmail.messageId}</p>
                            </div>
                          </div>
                        </div>

                        <Separator className="bg-gray-700" />

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                              <Calendar className="h-4 w-4" />
                              Fecha de Creación:
                            </label>
                            <p className="text-white">{new Date(selectedEmail.createdAt).toLocaleString()}</p>
                          </div>
                          {selectedEmail.sentAt && (
                            <div>
                              <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                                <Send className="h-4 w-4" />
                                Fecha de Envío:
                              </label>
                              <p className="text-white">{new Date(selectedEmail.sentAt).toLocaleString()}</p>
                            </div>
                          )}
                          {selectedEmail.updatedAt && (
                            <div>
                              <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                                <Clock className="h-4 w-4" />
                                Última Actualización:
                              </label>
                              <p className="text-white">{new Date(selectedEmail.updatedAt).toLocaleString()}</p>
                            </div>
                          )}
                        </div>

                        {selectedEmail.error && (
                          <Card className="bg-red-500/10 border border-red-500/20">
                            <CardHeader>
                              <CardTitle className="text-red-300 flex items-center gap-2">
                                <XCircle className="h-5 w-5" />
                                Error
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <p className="text-red-200">{selectedEmail.error}</p>
                            </CardContent>
                          </Card>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="template" className="space-y-4 p-1">
                    <Card className="bg-gray-800/50 border-gray-700">
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                          <span className="flex items-center gap-2">
                            <FileText className="h-5 w-5 text-green-400" />
                            Datos del Template
                          </span>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => copyToClipboard(formatTemplateDataAsMarkdown(selectedEmail.templateData))}
                            className="bg-green-500/20 border-green-500/30 text-green-300 hover:bg-green-500/30"
                          >
                            <Copy className="h-3 w-3 mr-1" />
                            Copiar como Markdown
                          </Button>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {selectedEmail.templateData && Object.keys(selectedEmail.templateData).length > 0 ? (
                          <div className="space-y-4">
                            {Object.entries(selectedEmail.templateData).map(([key, value]) => (
                              <div key={key} className="border border-gray-700 rounded-lg p-3">
                                <div className="flex items-center justify-between mb-2">
                                  <label className="text-sm font-medium text-gray-300">{key}:</label>
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    onClick={() => copyToClipboard(typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value))}
                                    className="h-6 px-2"
                                  >
                                    <Copy className="h-3 w-3" />
                                  </Button>
                                </div>
                                {typeof value === 'object' && value !== null ? (
                                  <pre className="text-xs bg-gray-900/50 p-2 rounded overflow-x-auto text-gray-200">
                                    {JSON.stringify(value, null, 2)}
                                  </pre>
                                ) : (
                                  <p className="text-white bg-gray-900/50 p-2 rounded font-mono text-sm">
                                    {String(value)}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-gray-400 text-center py-8">No hay datos del template disponibles</p>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="technical" className="space-y-4 p-1">
                    <Card className="bg-gray-800/50 border-gray-700">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Server className="h-5 w-5 text-purple-400" />
                          Información Técnica
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <Card className="bg-gray-900/50 border-gray-700">
                            <CardHeader className="pb-3">
                              <CardTitle className="text-sm">Identificadores</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-gray-300">MongoDB ID:</span>
                                <span className="text-white font-mono text-xs">{selectedEmail._id}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-300">Message ID:</span>
                                <span className="text-white font-mono text-xs truncate ml-2" title={selectedEmail.messageId}>
                                  {selectedEmail.messageId}
                                </span>
                              </div>
                            </CardContent>
                          </Card>

                          <Card className="bg-gray-900/50 border-gray-700">
                            <CardHeader className="pb-3">
                              <CardTitle className="text-sm">Configuración de Reintentos</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-gray-300">Intentos realizados:</span>
                                <Badge className="bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                  {selectedEmail.retryCount}
                                </Badge>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-300">Máximo permitido:</span>
                                <Badge className="bg-gray-500/20 text-gray-300 border border-gray-500/30">
                                  {selectedEmail.maxRetries}
                                </Badge>
                              </div>
                            </CardContent>
                          </Card>
                        </div>

                        <Card className="bg-gray-900/50 border-gray-700">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm">Cronología de Eventos</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-3">
                              <div className="flex items-center gap-3">
                                <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                                <div className="flex-1">
                                  <p className="text-sm text-white">Email creado</p>
                                  <p className="text-xs text-gray-400">{new Date(selectedEmail.createdAt).toLocaleString()}</p>
                                </div>
                              </div>
                              {selectedEmail.sentAt && (
                                <div className="flex items-center gap-3">
                                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                                  <div className="flex-1">
                                    <p className="text-sm text-white">Email enviado</p>
                                    <p className="text-xs text-gray-400">{new Date(selectedEmail.sentAt).toLocaleString()}</p>
                                  </div>
                                </div>
                              )}
                              {selectedEmail.updatedAt !== selectedEmail.createdAt && (
                                <div className="flex items-center gap-3">
                                  <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                                  <div className="flex-1">
                                    <p className="text-sm text-white">Última actualización</p>
                                    <p className="text-xs text-gray-400">{new Date(selectedEmail.updatedAt).toLocaleString()}</p>
                                  </div>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="raw" className="space-y-4 p-1">
                    <Card className="bg-gray-800/50 border-gray-700">
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                          <span className="flex items-center gap-2">
                            <FileText className="h-5 w-5 text-orange-400" />
                            Datos Raw (JSON)
                          </span>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => copyToClipboard(JSON.stringify(selectedEmail, null, 2))}
                            className="bg-orange-500/20 border-orange-500/30 text-orange-300 hover:bg-orange-500/30"
                          >
                            <Copy className="h-3 w-3 mr-1" />
                            Copiar JSON
                          </Button>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <pre className="text-xs bg-gray-900/50 p-4 rounded-lg overflow-x-auto text-gray-200 max-h-96 overflow-y-auto">
                          {JSON.stringify(selectedEmail, null, 2)}
                        </pre>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </ScrollArea>
              </Tabs>
            )}
          </DialogContent>
        </Dialog>

        {/* <ContentGradientSection variant="accent" position="bottom-center">
          <CardGradientWrapper variant="sunset" intensity="low">
            <Card className="bg-gray-900/60 backdrop-blur-sm border border-gray-700/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <History className="h-5 w-5 text-yellow-400" />
                  Audio de Pruebas
                </CardTitle>
                <CardDescription className="text-gray-300">
                  Prueba de audio reproductor
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <audio controls className="w-full">
                  <source src="http://localhost:9000/exam-files/questions/689ae1a5109dc1f7e82fc9ae/audio/1754980792328_Example1.mp3" type="audio/mpeg" />
                  Tu navegador no soporta el elemento de audio.
                </audio>
              </CardContent>
            </Card>
          </CardGradientWrapper>
        </ContentGradientSection> */}
      </div>
    </MainLayout>
  );
};

export default TestingScreen;