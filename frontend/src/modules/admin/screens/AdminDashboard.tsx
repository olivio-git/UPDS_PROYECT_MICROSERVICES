import React, { useState, useEffect } from 'react';
import { 
  Users, 
  BookOpen, 
  Activity, 
  Settings, 
  BarChart3, 
  Shield, 
  FileText, 
  AlertTriangle,
  TrendingUp,
  Database,
  Server,
  Clock,
  CheckCircle,
  XCircle,
  Loader2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/atoms/card';
import { Button } from '@/components/atoms/button';
import { Progress } from '@/components/atoms/progress';
import { MainLayout } from '@/components/layout';
import { useNavigation } from '@/hooks/useNavigation';
import { useSystemMonitoring } from '@/modules/system/services/systemMonitoringService';
import { toast } from 'sonner';

interface SystemOverview {
  totalUsers: number;
  activeUsers: number;
  totalExams: number;
  activeSessions: number;
  systemHealth: 'healthy' | 'warning' | 'critical';
  uptime: string;
}

interface RecentActivity {
  id: string;
  type: 'exam_started' | 'user_registered' | 'system_alert' | 'exam_completed';
  description: string;
  timestamp: Date;
  status: 'success' | 'warning' | 'error';
}

const AdminDashboard: React.FC = () => {
  const { 
    navigateToUserManagement, 
    navigateToExamManagement, 
    navigateToSystemMonitoring 
  } = useNavigation();
  
  const { stats, loading: systemLoading, error: systemError, fetchStats } = useSystemMonitoring();
  
  const [overview, setOverview] = useState<SystemOverview>({
    totalUsers: 0,
    activeUsers: 0,
    totalExams: 0,
    activeSessions: 0,
    systemHealth: 'healthy',
    uptime: '0h 0m'
  });
  
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);

  // Load dashboard data
  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        setLoading(true);
        
        // Fetch system stats
        await fetchStats();
        
        // Mock data for demonstration - replace with real API calls
        setOverview({
          totalUsers: 1247,
          activeUsers: 89,
          totalExams: 156,
          activeSessions: 23,
          systemHealth: 'healthy',
          uptime: '15d 8h 42m'
        });

        // Mock recent activity
        setRecentActivity([
          {
            id: '1',
            type: 'exam_started',
            description: 'Examen de Matemáticas iniciado por 15 estudiantes',
            timestamp: new Date(Date.now() - 5 * 60 * 1000),
            status: 'success'
          },
          {
            id: '2', 
            type: 'user_registered',
            description: '3 nuevos estudiantes registrados',
            timestamp: new Date(Date.now() - 15 * 60 * 1000),
            status: 'success'
          },
          {
            id: '3',
            type: 'system_alert',
            description: 'Uso de memoria del servidor al 78%',
            timestamp: new Date(Date.now() - 30 * 60 * 1000),
            status: 'warning'
          },
          {
            id: '4',
            type: 'exam_completed',
            description: 'Examen de Física completado por 12 estudiantes',
            timestamp: new Date(Date.now() - 45 * 60 * 1000),
            status: 'success'
          }
        ]);

      } catch (error) {
        console.error('Error loading dashboard data:', error);
        toast.error('Error cargando datos del dashboard');
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, [fetchStats]);

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'healthy': return 'text-green-600 bg-green-100';
      case 'warning': return 'text-yellow-600 bg-yellow-100';
      case 'critical': return 'text-red-600 bg-red-100';
      default: return 'text-muted-foreground bg-muted';
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'exam_started': return <BookOpen className="w-4 h-4" />;
      case 'user_registered': return <Users className="w-4 h-4" />;
      case 'system_alert': return <AlertTriangle className="w-4 h-4" />;
      case 'exam_completed': return <CheckCircle className="w-4 h-4" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'text-green-600';
      case 'warning': return 'text-yellow-600';
      case 'error': return 'text-red-600';
      default: return 'text-muted-foreground';
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center space-y-4">
            <Loader2 className="h-12 w-12 animate-spin mx-auto text-blue-600" />
            <p className="text-muted-foreground">Cargando dashboard...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Panel de Administración
            </h1>
            <p className="text-muted-foreground">
              Gestiona y monitorea el sistema de evaluación
            </p>
          </div>
          
          <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm font-medium ${getHealthColor(overview.systemHealth)}`}>
            <div className="w-2 h-2 rounded-full bg-current"></div>
            <span className="capitalize">{overview.systemHealth}</span>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Total Usuarios
                  </p>
                  <p className="text-3xl font-bold text-foreground">
                    {overview.totalUsers.toLocaleString()}
                  </p>
                  <p className="text-sm text-green-600">
                    {overview.activeUsers} activos
                  </p>
                </div>
                <Users className="h-12 w-12 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Exámenes
                  </p>
                  <p className="text-3xl font-bold text-foreground">
                    {overview.totalExams}
                  </p>
                  <p className="text-sm text-blue-600">
                    {overview.activeSessions} sesiones activas
                  </p>
                </div>
                <BookOpen className="h-12 w-12 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Sistema
                  </p>
                  <p className="text-2xl font-bold text-foreground">
                    {overview.uptime}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Tiempo activo
                  </p>
                </div>
                <Server className="h-12 w-12 text-purple-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Estado del Sistema
                  </p>
                  <div className="flex items-center space-x-2 mt-2">
                    {overview.systemHealth === 'healthy' && (
                      <CheckCircle className="h-8 w-8 text-green-600" />
                    )}
                    {overview.systemHealth === 'warning' && (
                      <AlertTriangle className="h-8 w-8 text-yellow-600" />
                    )}
                    {overview.systemHealth === 'critical' && (
                      <XCircle className="h-8 w-8 text-red-600" />
                    )}
                    <span className="text-lg font-semibold capitalize">
                      {overview.systemHealth}
                    </span>
                  </div>
                </div>
                <Activity className="h-12 w-12 text-indigo-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* System Performance and Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* System Performance */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <BarChart3 className="h-5 w-5" />
                <span>Rendimiento del Sistema</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {systemLoading ? (
                <div className="text-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                  <p className="text-sm text-muted-foreground mt-2">Cargando métricas...</p>
                </div>
              ) : systemError ? (
                <div className="text-center py-4 text-red-600">
                  <p>Error cargando métricas del sistema</p>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Uso de CPU</span>
                      <span>45%</span>
                    </div>
                    <Progress value={45} className="h-2" />
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Memoria RAM</span>
                      <span>
                        {stats ? `${Math.round(stats.heapUsedMB)}MB / ${Math.round(stats.heapTotalMB)}MB` : '0MB / 0MB'}
                      </span>
                    </div>
                    <Progress 
                      value={stats ? (stats.heapUsedMB / stats.heapTotalMB) * 100 : 0} 
                      className="h-2" 
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Almacenamiento</span>
                      <span>67%</span>
                    </div>
                    <Progress value={67} className="h-2" />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Conexiones Activas</span>
                      <span>{stats?.connections || 0}</span>
                    </div>
                    <Progress 
                      value={stats ? Math.min((stats.connections / 100) * 100, 100) : 0} 
                      className="h-2" 
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Clock className="h-5 w-5" />
                <span>Actividad Reciente</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-start space-x-3 p-3 rounded-lg bg-muted">
                    <div className={`p-2 rounded-full ${getStatusColor(activity.status)} bg-current bg-opacity-10`}>
                      {getActivityIcon(activity.type)}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">
                        {activity.description}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {activity.timestamp.toLocaleTimeString('es-ES')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Settings className="h-5 w-5" />
              <span>Acciones Rápidas</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Button
                onClick={navigateToUserManagement}
                variant="outline"
                className="flex items-center space-x-2 p-6 h-auto"
              >
                <Users className="h-6 w-6" />
                <div className="text-left">
                  <div className="font-semibold">Gestionar Usuarios</div>
                  <div className="text-xs text-muted-foreground">Crear, editar y administrar usuarios</div>
                </div>
              </Button>

              <Button
                onClick={navigateToExamManagement}
                variant="outline"
                className="flex items-center space-x-2 p-6 h-auto"
              >
                <BookOpen className="h-6 w-6" />
                <div className="text-left">
                  <div className="font-semibold">Gestionar Exámenes</div>
                  <div className="text-xs text-muted-foreground">Crear y administrar evaluaciones</div>
                </div>
              </Button>

              <Button
                onClick={navigateToSystemMonitoring}
                variant="outline"
                className="flex items-center space-x-2 p-6 h-auto"
              >
                <Activity className="h-6 w-6" />
                <div className="text-left">
                  <div className="font-semibold">Monitoreo del Sistema</div>
                  <div className="text-xs text-muted-foreground">Ver métricas y rendimiento</div>
                </div>
              </Button>

              <Button
                onClick={() => window.location.href = '/reports'}
                variant="outline"
                className="flex items-center space-x-2 p-6 h-auto"
              >
                <FileText className="h-6 w-6" />
                <div className="text-left">
                  <div className="font-semibold">Generar Reportes</div>
                  <div className="text-xs text-muted-foreground">Reportes y análisis de datos</div>
                </div>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
};

export default AdminDashboard;