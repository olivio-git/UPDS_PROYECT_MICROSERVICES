import { Card, CardContent, CardHeader, CardTitle } from '@/components/atoms/card';
import { Button } from '@/components/atoms/button';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { EducationalStats, LevelDistribution, RecentActivity } from '@/components/ui/EducationalStats';
import { MCERBadge, CompetencyIndicator } from '@/components/ui/MCERBadge';
import GradientBackground from '@/modules/home/screens/GradientBackground';

export function DashboardExample() {
  // Datos de ejemplo
  const levelDistributionData = [
    { level: 'A1', count: 25, percentage: 20 },
    { level: 'A2', count: 35, percentage: 28 },
    { level: 'B1', count: 30, percentage: 24 },
    { level: 'B2', count: 20, percentage: 16 },
    { level: 'C1', count: 10, percentage: 8 },
    { level: 'C2', count: 5, percentage: 4 },
  ];

  const recentActivities = [
    {
      id: '1',
      type: 'exam' as const,
      description: 'Nuevo examen de nivel B2 programado',
      timestamp: 'Hace 2 horas',
      user: 'Prof. María González'
    },
    {
      id: '2',
      type: 'registration' as const,
      description: 'Juan Pérez se registró para el examen A2',
      timestamp: 'Hace 3 horas',
      user: 'Sistema'
    },
    {
      id: '3',
      type: 'completion' as const,
      description: 'Ana Silva completó la evaluación B1',
      timestamp: 'Hace 5 horas',
      user: 'Ana Silva'
    },
    {
      id: '4',
      type: 'exam' as const,
      description: 'Resultados de evaluación C1 publicados',
      timestamp: 'Hace 1 día',
      user: 'Prof. Carlos Ruiz'
    }
  ];

  return (
    <>
      <GradientBackground />
      
      <div className="min-h-screen p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Dashboard CBA - Sistema de Evaluación Lingüística
            </h1>
            <p className="text-muted-foreground mt-2">
              Centro Boliviano Americano - Plataforma de Evaluación MCER
            </p>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <Button variant="outline">
              Configuración
            </Button>
          </div>
        </div>

        {/* Estadísticas principales */}
        <EducationalStats 
          totalStudents={125}
          activeExams={8}
          completedEvaluations={342}
          averageScore={78}
        />

        {/* Sección de ejemplos de componentes */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Ejemplos de badges MCER */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle>🏷️ Niveles MCER</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <MCERBadge level="A1" size="sm" />
                <MCERBadge level="A2" size="sm" />
                <MCERBadge level="B1" size="sm" />
                <MCERBadge level="B2" size="sm" />
                <MCERBadge level="C1" size="sm" />
                <MCERBadge level="C2" size="sm" />
              </div>
              
              <div className="pt-4">
                <h4 className="font-medium mb-3">Evaluación de Estudiante Ejemplo:</h4>
                <div className="space-y-2">
                  <CompetencyIndicator competency="listening" score={85} level="B2" />
                  <CompetencyIndicator competency="reading" score={78} level="B1" />
                  <CompetencyIndicator competency="writing" score={82} level="B2" />
                  <CompetencyIndicator competency="speaking" score={75} level="B1" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Distribución por niveles */}
          <LevelDistribution data={levelDistributionData} />
        </div>

        {/* Grid de dos columnas */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Actividad reciente */}
          <div className="lg:col-span-2">
            <RecentActivity activities={recentActivities} />
          </div>

          {/* Panel de acciones rápidas */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle>⚡ Acciones Rápidas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button className="w-full justify-start" variant="outline">
                📝 Crear Nuevo Examen
              </Button>
              <Button className="w-full justify-start" variant="outline">
                👥 Gestionar Candidatos
              </Button>
              <Button className="w-full justify-start" variant="outline">
                📊 Ver Reportes
              </Button>
              <Button className="w-full justify-start" variant="outline">
                ⚙️ Configurar Rúbricas
              </Button>
              <Button className="w-full justify-start" variant="outline">
                📧 Enviar Notificaciones
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Información del sistema */}
        <Card className="border-border/50 bg-gradient-to-r from-primary/5 to-secondary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              🏫 Información del Sistema
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="font-medium text-muted-foreground">Versión:</span>
                <p className="text-foreground">v1.0.0 - Beta</p>
              </div>
              <div>
                <span className="font-medium text-muted-foreground">Última actualización:</span>
                <p className="text-foreground">23 Julio 2025</p>
              </div>
              <div>
                <span className="font-medium text-muted-foreground">Soporte:</span>
                <p className="text-foreground">Centro Boliviano Americano</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
