import { useState, useEffect } from "react";
import { 
  Mic, 
  Volume2, 
  Camera,
  Monitor,
  Wifi,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Play,
  RotateCcw,
  ArrowLeft
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/atoms/card";
import { Button } from "@/components/atoms/button";
import { Badge } from "@/components/atoms/badge";
import { Alert, AlertDescription } from "@/components/atoms/alert";
import { MainLayout } from "@/components/layout";
import { ContentGradientSection } from "@/components/background";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

interface TechnicalCheck {
  name: string;
  status: 'pending' | 'checking' | 'success' | 'warning' | 'error';
  message: string;
  required: boolean;
}

const ExamPreparation = () => {
  const navigate = useNavigate();
  const { examId } = useParams();
  const [isTestingAudio, setIsTestingAudio] = useState(false);
  const [micPermission, setMicPermission] = useState<'pending' | 'granted' | 'denied'>('pending');
  const [cameraPermission, setCameraPermission] = useState<'pending' | 'granted' | 'denied'>('pending');
  const [connectionQuality, setConnectionQuality] = useState<'excellent' | 'good' | 'fair' | 'poor'>('excellent');

  // Mock exam data
  const [examInfo] = useState({
    id: examId,
    name: "Examen de Progreso B1-B2",
    duration: 120,
    startTime: "10:00 AM",
    date: "15 de agosto, 2025",
    competencies: ['Listening', 'Reading', 'Writing', 'Speaking'],
    instructions: [
      "Asegúrate de estar en un lugar silencioso y bien iluminado",
      "Verifica que tu micrófono y auriculares funcionen correctamente",
      "Mantén una conexión a internet estable durante todo el examen",
      "No salgas de la ventana del navegador durante el examen",
      "Asegúrate de tener suficiente batería o estar conectado a la corriente"
    ]
  });

  const [technicalChecks, setTechnicalChecks] = useState<TechnicalCheck[]>([
    {
      name: "Conexión a Internet",
      status: 'pending',
      message: "Verificando velocidad de conexión...",
      required: true
    },
    {
      name: "Navegador Compatible",
      status: 'pending',
      message: "Verificando compatibilidad...",
      required: true
    },
    {
      name: "Micrófono",
      status: 'pending',
      message: "Esperando permisos...",
      required: true
    },
    {
      name: "Auriculares/Altavoces",
      status: 'pending',
      message: "Esperando prueba de audio...",
      required: true
    },
    {
      name: "Cámara Web",
      status: 'pending',
      message: "Esperando permisos...",
      required: false
    }
  ]);

  useEffect(() => {
    checkBrowserCompatibility();
    checkInternetConnection();
  }, []);

  const checkBrowserCompatibility = () => {
    updateTechnicalCheck("Navegador Compatible", 'checking', "Verificando...");
    
    setTimeout(() => {
      const isCompatible = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
      if (isCompatible) {
        updateTechnicalCheck("Navegador Compatible", 'success', "Navegador compatible detectado");
      } else {
        updateTechnicalCheck("Navegador Compatible", 'error', "Navegador no compatible. Use Chrome, Firefox o Safari.");
      }
    }, 1000);
  };

  const checkInternetConnection = () => {
    updateTechnicalCheck("Conexión a Internet", 'checking', "Verificando velocidad...");
    
    setTimeout(() => {
      const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
      let quality = 'excellent';
      let message = "Conexión excelente (>10 Mbps)";
      
      if (connection) {
        const downlink = connection.downlink;
        if (downlink < 1) {
          quality = 'poor';
          message = "Conexión lenta (<1 Mbps). Considera mejorar tu conexión.";
        } else if (downlink < 5) {
          quality = 'fair';
          message = "Conexión moderada (1-5 Mbps). Funcional pero no óptima.";
        } else if (downlink < 10) {
          quality = 'good';
          message = "Buena conexión (5-10 Mbps)";
        }
      }
      
      setConnectionQuality(quality as any);
      const status = quality === 'poor' ? 'warning' : 'success';
      updateTechnicalCheck("Conexión a Internet", status, message);
    }, 2000);
  };

  const requestMicrophonePermission = async () => {
    updateTechnicalCheck("Micrófono", 'checking', "Solicitando permisos...");
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicPermission('granted');
      updateTechnicalCheck("Micrófono", 'success', "Micrófono detectado y funcionando");
      
      setTimeout(() => {
        stream.getTracks().forEach(track => track.stop());
      }, 3000);
      
    } catch (error) {
      setMicPermission('denied');
      updateTechnicalCheck("Micrófono", 'error', "No se pudo acceder al micrófono. Verifica los permisos.");
    }
  };

  const requestCameraPermission = async () => {
    updateTechnicalCheck("Cámara Web", 'checking', "Solicitando permisos...");
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setCameraPermission('granted');
      updateTechnicalCheck("Cámara Web", 'success', "Cámara detectada y funcionando");
      
      setTimeout(() => {
        stream.getTracks().forEach(track => track.stop());
      }, 3000);
      
    } catch (error) {
      setCameraPermission('denied');
      updateTechnicalCheck("Cámara Web", 'warning', "Cámara no disponible (opcional para este examen)");
    }
  };

  const testAudioPlayback = () => {
    setIsTestingAudio(true);
    updateTechnicalCheck("Auriculares/Altavoces", 'checking', "Reproduciendo audio de prueba...");
    
    setTimeout(() => {
      setIsTestingAudio(false);
    }, 3000);
  };

  const confirmAudioTest = (heard: boolean) => {
    if (heard) {
      updateTechnicalCheck("Auriculares/Altavoces", 'success', "Audio funcionando correctamente");
    } else {
      updateTechnicalCheck("Auriculares/Altavoces", 'error', "Problema con la reproducción de audio. Verifica tus auriculares.");
    }
    setIsTestingAudio(false);
  };

  const updateTechnicalCheck = (name: string, status: TechnicalCheck['status'], message: string) => {
    setTechnicalChecks(prev => 
      prev.map(check => 
        check.name === name 
          ? { ...check, status, message }
          : check
      )
    );
  };

  const getStatusIcon = (status: TechnicalCheck['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-400" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-400" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-400" />;
      case 'checking':
        return <div className="h-5 w-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />;
      default:
        return <div className="h-5 w-5 rounded-full bg-gray-400" />;
    }
  };

  const canProceed = () => {
    const requiredChecks = technicalChecks.filter(check => check.required);
    return requiredChecks.every(check => check.status === 'success' || check.status === 'warning');
  };

  const handleStartExam = () => {
    if (canProceed()) {
      navigate(`/student/exam/${examId}/taking`);
    } else {
      toast.error("Debes completar todas las verificaciones requeridas antes de continuar.");
    }
  };

  return (
    <MainLayout gradientVariant="primary">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <ContentGradientSection variant="secondary" position="top-right" className="mb-8">
          <div className="text-center space-y-6 m-6">
            <div className="space-y-2">
              <h1 className="mb-4 text-3xl font-extrabold text-gray-900 dark:text-white md:text-5xl lg:text-6xl">
                Preparación del{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r to-emerald-600 from-sky-400">
                  Examen
                </span>
              </h1>
              <p className="text-xl text-gray-300 max-w-2xl mx-auto font-portfolio">
                Verificación técnica y configuración del sistema
              </p>
            </div>
          </div>
        </ContentGradientSection>

        {/* Información del Examen */}
        <Card className="bg-[#0B1422] backdrop-blur-sm border border-gray-700/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-white">{examInfo.name}</CardTitle>
                <CardDescription className="text-gray-300">
                  {examInfo.date} a las {examInfo.startTime} • Duración: {examInfo.duration} minutos
                </CardDescription>
              </div>
              <Button
                variant="outline"
                onClick={() => navigate('/student/exams')}
                className="border-gray-600 text-gray-300 hover:bg-gray-800"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Volver
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-300 mb-2">Competencias a evaluar:</p>
                <div className="flex flex-wrap gap-2">
                  {examInfo.competencies.map((competency, index) => (
                    <Badge key={index} variant="secondary" className="bg-blue-500/20 text-blue-300">
                      {competency}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Panel Principal */}
          <div className="lg:col-span-2 space-y-6">
            {/* Verificaciones Técnicas */}
            <Card className="bg-[#0B1422] backdrop-blur-sm border border-gray-700/50">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Monitor className="h-5 w-5 text-blue-400" />
                  Verificaciones Técnicas
                </CardTitle>
                <CardDescription className="text-gray-300">
                  Comprobando que tu sistema esté listo para el examen
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {technicalChecks.map((check, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(check.status)}
                      <div>
                        <p className="font-medium text-white">
                          {check.name}
                          {check.required && <span className="text-red-400 ml-1">*</span>}
                        </p>
                        <p className="text-sm text-gray-400">{check.message}</p>
                      </div>
                    </div>
                    {check.name === "Micrófono" && check.status === 'pending' && (
                      <Button
                        onClick={requestMicrophonePermission}
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        <Mic className="h-4 w-4 mr-2" />
                        Probar
                      </Button>
                    )}
                    {check.name === "Cámara Web" && check.status === 'pending' && (
                      <Button
                        onClick={requestCameraPermission}
                        size="sm"
                        variant="outline"
                        className="border-gray-600 text-gray-300"
                      >
                        <Camera className="h-4 w-4 mr-2" />
                        Probar
                      </Button>
                    )}
                    {check.name === "Auriculares/Altavoces" && check.status === 'pending' && (
                      <Button
                        onClick={testAudioPlayback}
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                        disabled={isTestingAudio}
                      >
                        <Volume2 className="h-4 w-4 mr-2" />
                        {isTestingAudio ? 'Reproduciendo...' : 'Probar Audio'}
                      </Button>
                    )}
                  </div>
                ))}
                
                {/* Confirmación de audio */}
                {isTestingAudio && (
                  <Alert>
                    <Volume2 className="h-4 w-4" />
                    <AlertDescription>
                      ¿Puedes escuchar un sonido de prueba?
                      <div className="flex gap-2 mt-2">
                        <Button size="sm" onClick={() => confirmAudioTest(true)}>
                          Sí, lo escucho
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => confirmAudioTest(false)}>
                          No, no escucho nada
                        </Button>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Panel Lateral */}
          <div className="space-y-6">
            {/* Instrucciones */}
            <Card className="bg-[#0B1422] backdrop-blur-sm border border-gray-700/50">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-400" />
                  Instrucciones Importantes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {examInfo.instructions.map((instruction, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm text-gray-300">
                      <CheckCircle className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                      {instruction}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Estado de Conexión */}
            <Card className="bg-[#0B1422] backdrop-blur-sm border border-gray-700/50">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Wifi className="h-5 w-5 text-blue-400" />
                  Estado de Conexión
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-300">Calidad:</span>
                    <Badge className={`${
                      connectionQuality === 'excellent' ? 'bg-green-500/20 text-green-300 border-green-500/30' :
                      connectionQuality === 'good' ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' :
                      connectionQuality === 'fair' ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' :
                      'bg-red-500/20 text-red-300 border-red-500/30'
                    }`}>
                      {connectionQuality === 'excellent' ? 'Excelente' :
                       connectionQuality === 'good' ? 'Buena' :
                       connectionQuality === 'fair' ? 'Regular' : 'Deficiente'}
                    </Badge>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={checkInternetConnection}
                    className="w-full border-gray-600 text-gray-300"
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Volver a Probar
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Botón de Inicio */}
            <Card className="bg-[#0B1422] backdrop-blur-sm border border-gray-700/50">
              <CardContent className="p-6">
                <div className="space-y-4">
                  {canProceed() ? (
                    <>
                      <div className="text-center">
                        <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-2" />
                        <p className="text-green-400 font-medium">Sistema Listo</p>
                        <p className="text-sm text-gray-400">Todas las verificaciones completadas</p>
                      </div>
                      <Button
                        onClick={handleStartExam}
                        className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white"
                        size="lg"
                      >
                        <Play className="h-5 w-5 mr-2" />
                        Iniciar Examen
                      </Button>
                    </>
                  ) : (
                    <>
                      <div className="text-center">
                        <AlertTriangle className="h-12 w-12 text-yellow-400 mx-auto mb-2" />
                        <p className="text-yellow-400 font-medium">Verificaciones Pendientes</p>
                        <p className="text-sm text-gray-400">Completa las verificaciones requeridas</p>
                      </div>
                      <Button
                        disabled
                        className="w-full"
                        size="lg"
                      >
                        Completar Verificaciones
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default ExamPreparation;