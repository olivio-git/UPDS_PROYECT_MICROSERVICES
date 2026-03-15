import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/atoms/card';
import { Button } from '@/components/atoms/button';
import { Badge } from '@/components/atoms/badge';
import { TestTube, Palette, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { MainLayout } from '@/components/layout';
import GradientWrapper from '@/components/background/GrandWrapperSection';

const GradientTestScreen = () => {
  const [testResults, setTestResults] = useState<Record<string, boolean>>({});
  const [isRunningTests, setIsRunningTests] = useState(false);

  const gradientTests = [
    {
      id: 'radial-basic',
      name: 'Gradiente Radial Básico',
      className: 'bg-gradient-radial from-purple-500/30 via-blue-500/20 to-transparent',
      description: 'Gradiente radial desde el centro'
    },
    {
      id: 'radial-top',
      name: 'Gradiente Radial Superior',
      className: 'bg-gradient-radial-at-t from-green-500/40 via-emerald-400/20 to-transparent',
      description: 'Gradiente radial desde arriba'
    },
    {
      id: 'linear-diagonal',
      name: 'Gradiente Linear Diagonal',
      className: 'bg-gradient-to-br from-pink-500/30 via-purple-500/20 to-cyan-500/10',
      description: 'Gradiente linear diagonal'
    },
    {
      id: 'conic-gradient',
      name: 'Gradiente Cónico',
      className: 'bg-gradient-conic from-violet-500/30 via-purple-500/20 to-pink-500/10',
      description: 'Gradiente cónico rotativo'
    },
    {
      id: 'custom-learning',
      name: 'Gradiente Personalizado Learning',
      className: 'bg-gradient-learning',
      description: 'Gradiente personalizado del sistema CBA'
    },
    {
      id: 'glass-effect',
      name: 'Efecto Glass',
      className: 'glass backdrop-blur-glass',
      description: 'Efecto glassmorphism'
    },
    {
      id: 'animation-test',
      name: 'Animación Pulse Slow',
      className: 'bg-gradient-radial from-cyan-500/30 to-transparent animate-pulse-slow',
      description: 'Gradiente con animación personalizada'
    },
    {
      id: 'grid-pattern',
      name: 'Patrón Grid',
      className: 'bg-grid-pattern bg-gray-900',
      description: 'Patrón de fondo con grid'
    }
  ];

  const runTest = (testId: string) => {
    const element = document.getElementById(`test-${testId}`);
    if (!element) return false;
    
    const computedStyle = window.getComputedStyle(element);
    const hasBackground = computedStyle.background !== 'rgba(0, 0, 0, 0)' && 
                         computedStyle.background !== 'transparent' && 
                         computedStyle.background !== 'none';
    const hasBackgroundImage = computedStyle.backgroundImage !== 'none';
    
    const passed = hasBackground || hasBackgroundImage;
    
    setTestResults(prev => ({
      ...prev,
      [testId]: passed
    }));
    
    return passed;
  };

  const runAllTests = async () => {
    setIsRunningTests(true);
    setTestResults({});
    
    for (const test of gradientTests) {
      await new Promise(resolve => setTimeout(resolve, 200)); // Pequeña pausa para visualizar el proceso
      runTest(test.id);
    }
    
    setIsRunningTests(false);
  };

  const getTestStatus = (testId: string) => {
    if (isRunningTests) return 'running';
    if (testResults[testId] === undefined) return 'pending';
    return testResults[testId] ? 'passed' : 'failed';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <RefreshCw className="h-4 w-4 animate-spin text-blue-400" />;
      case 'passed':
        return <CheckCircle className="h-4 w-4 text-green-400" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-400" />;
      default:
        return <TestTube className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      running: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
      passed: 'bg-green-500/20 text-green-300 border border-green-500/30',
      failed: 'bg-red-500/20 text-red-300 border border-red-500/30',
      pending: 'bg-gray-500/20 text-gray-300 border border-gray-500/30'
    };
    
    const labels = {
      running: 'Ejecutando...',
      passed: 'Funciona',
      failed: 'Error',
      pending: 'Pendiente'
    };
    
    return (
      <Badge className={variants[status as keyof typeof variants]}>
        {getStatusIcon(status)}
        <span className="ml-1">{labels[status as keyof typeof labels]}</span>
      </Badge>
    );
  };

  const passedTests = Object.values(testResults).filter(Boolean).length;
  const totalTests = Object.keys(testResults).length;
  const testProgress = totalTests > 0 ? (passedTests / totalTests) * 100 : 0;

  return (
    <MainLayout gradientVariant="primary">
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-3">
          <div className="p-4 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-600/20 border border-purple-500/30">
            <Palette className="h-8 w-8 text-purple-400" />
          </div>
        </div>
        <h1 className="text-3xl font-bold text-white">
          Test de Gradientes CSS
        </h1>
        <p className="text-gray-300 max-w-2xl mx-auto">
          Verificación de que los gradientes y estilos personalizados de Tailwind CSS están funcionando correctamente
        </p>
      </div>
        
      {/* Controls */}
      <GradientWrapper variant="cosmic" position="left" className="" size="xl" intensity="high" animate={false}> 
      <Card className="bg-gray-900/60 backdrop-blur-sm border border-gray-700/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <TestTube className="h-5 w-5 text-blue-400" />
            Panel de Control
          </CardTitle>
          <CardDescription className="text-gray-300">
            Ejecuta las pruebas para verificar el funcionamiento de los gradientes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm text-gray-300">
                Progreso: {passedTests}/{gradientTests.length} pruebas pasadas
              </p>
              {totalTests > 0 && (
                <div className="w-64 h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all duration-500"
                    style={{ width: `${testProgress}%` }}
                  />
                </div>
              )}
            </div>
            <Button 
              onClick={runAllTests}
              disabled={isRunningTests}
              className="bg-purple-500/20 border border-purple-500/30 text-purple-300 hover:bg-purple-500/30"
            >
              {isRunningTests ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Ejecutando...
                </>
              ) : (
                <>
                  <TestTube className="h-4 w-4 mr-2" />
                  Ejecutar Todas las Pruebas
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
        </GradientWrapper>

      {/* Test Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {gradientTests.map((test) => {
          const status = getTestStatus(test.id);
          return (
            <Card key={test.id} className="bg-gray-900/60 backdrop-blur-sm border border-gray-700/50 overflow-hidden">
              <div className="relative">
                {/* Test Area */}
                <div 
                  id={`test-${test.id}`}
                  className={`h-32 w-full ${test.className} relative flex items-center justify-center`}
                >
                  <div className="text-center space-y-2">
                    <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center">
                      <Palette className="h-6 w-6 text-white" />
                    </div>
                    <p className="text-xs text-white/80 font-medium">Test Area</p>
                  </div>
                </div>
                
                {/* Status Badge */}
                <div className="absolute top-2 right-2">
                  {getStatusBadge(status)}
                </div>
              </div>
              
              <CardHeader className="pb-2">
                <CardTitle className="text-lg text-white flex items-center justify-between">
                  {test.name}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => runTest(test.id)}
                    className="h-8 px-3 bg-gray-800/50 border-gray-600 text-gray-300 hover:bg-gray-700/50"
                  >
                    Test
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm text-gray-400">{test.description}</p>
                <div className="mt-2">
                  <p className="text-xs text-gray-500 font-mono bg-gray-800/30 p-2 rounded border">
                    {test.className}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Diagnóstico */}
      <Card className="bg-gray-900/60 backdrop-blur-sm border border-gray-700/50">
        <CardHeader>
          <CardTitle className="text-white">Información de Diagnóstico</CardTitle>
          <CardDescription className="text-gray-300">
            Información útil para troubleshooting
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              <h4 className="font-medium text-gray-300">Configuración del Sistema</h4>
              <div className="space-y-1 text-gray-400">
                <p>• Tailwind CSS: v4.x (con plugin Vite)</p>
                <p>• Modo oscuro: Activado</p>
                <p>• Variables CSS: Definidas</p>
                <p>• Clases personalizadas: Configuradas</p>
              </div>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium text-gray-300">Posibles Soluciones</h4>
              <div className="space-y-1 text-gray-400">
                <p>• Ejecutar: <code className="bg-gray-800 px-1 rounded">npm run dev</code></p>
                <p>• Limpiar cache con el script incluido</p>
                <p>• Verificar DevTools por errores CSS</p>
                <p>• Recargar forzadamente (Ctrl+Shift+R)</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
    </MainLayout>
  );
};

export default GradientTestScreen;
