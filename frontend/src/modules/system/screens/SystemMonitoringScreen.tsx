import GradientWrapper from '@/components/background/GrandWrapperSection';
import { MainLayout } from '@/components/layout';
import {
  Activity,
  AlertTriangle,
  Clock,
  Database,
  HardDrive,
  MemoryStick,
  Users,
  Zap
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useWebSocket } from '../services/systemMonitoringService';
// Temporalmente comentamos el WebSocket hasta implementar el backend
// import { useWebSocket } from '../services/systemMonitoringService';

interface SystemStats {
  sessions: {
    totalSessions: number;
    activeSessions: number;
    expiredSessions: number;
    totalSubSessions: number;
    activeSubSessions: number;
  };
  activeJobs: number;
  autoSaveJobs: number;
  queueStats: {
    session: {
      waiting: any[];
      active: any[];
      completed: any[];
      failed: any[];
    };
    autoSave: {
      waiting: any[];
      active: any[];
    };
  };
  memory: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
  connections: number;
}

const SystemMonitoringScreen: React.FC = () => {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [alerts, setAlerts] = useState<
    Array<{ id: string; type: 'warning' | 'error'; message: string; timestamp: Date }>
  >([]);

  // Temporalmente deshabilitamos el WebSocket hasta implementar el backend 
  const {
    connect,
    disconnect,
    sendMessage,
    isConnected: wsConnected
  } = useWebSocket('ws://localhost:3003/monitoring', {
    reconnectInterval: 30000,
    maxReconnectAttempts: 3,
    onMessage: (data:any) => {
      if (data.type === 'system-stats') {
        setStats(data.stats);
        setLastUpdate(new Date());
        checkForAlerts(data.stats);
      } else if (data.type === 'memory-warning') {
        addAlert('warning', data.message);
      } else if (data.type === 'memory-critical') {
        addAlert('error', data.message);
      }
    },
    onConnect: () => {
      setIsConnected(true);
      sendMessage({ type: 'get-system-stats' });
    },
    onDisconnect: () => {
      setIsConnected(false);
    }
  });

  useEffect(() => {
    connect();
    return () => disconnect();
  }, []); // Vacío - solo ejecutar una vez al montar

  useEffect(() => {
    // Solo solicitar datos si realmente está conectado al WebSocket
    if (!wsConnected || !isConnected) return;
    
    // Solicitar datos iniciales inmediatamente
    sendMessage({ type: 'get-system-stats' });
    
    // Luego solicitar cada 2 minutos
    const interval = setInterval(() => {
      if (wsConnected && isConnected) {
        sendMessage({ type: 'get-system-stats' });
      }
    }, 120000);
    
    return () => clearInterval(interval);
  }, [wsConnected, isConnected]);

  const addAlert = (type: 'warning' | 'error', message: string) => {
    const alert = {
      id: Date.now().toString(),
      type,
      message,
      timestamp: new Date()
    };
    setAlerts((prev) => [alert, ...prev.slice(0, 9)]);
    if (type === 'error') {
      toast.error(message);
    } else {
      toast.warning(message);
    }
  };

  const lastAlertTime = useRef<{ [key: string]: number }>({});

  const checkForAlerts = (currentStats: SystemStats) => {
    const now = Date.now();
    const memoryUsageMB = Math.round(currentStats.memory.heapUsed / 1024 / 1024);
    
    // Solo alertar si ha pasado al menos 5 minutos desde la última alerta del mismo tipo
    const canAlert = (type: string) => {
      const lastTime = lastAlertTime.current[type] || 0;
      return now - lastTime > 300000; // 5 minutos
    };
    
    // Umbrales más altos y realistas para mock data
    if (memoryUsageMB > 800 && canAlert('memory')) {
      addAlert('warning', `Uso de memoria alto: ${memoryUsageMB}MB`);
      lastAlertTime.current['memory'] = now;
    }
    
    if (currentStats.sessions.expiredSessions > 15 && canAlert('expired')) {
      addAlert('warning', `${currentStats.sessions.expiredSessions} sesiones expiradas sin limpiar`);
      lastAlertTime.current['expired'] = now;
    }
    
    if (currentStats.activeJobs > 50 && canAlert('jobs')) {
      addAlert('warning', `${currentStats.activeJobs} trabajos activos - posible acumulación`);
      lastAlertTime.current['jobs'] = now;
    }
  };

  const formatBytes = (bytes: number) => {
    const mb = bytes / 1024 / 1024;
    return `${mb.toFixed(1)} MB`;
  };

  const getHealthStatus = () => {
    if (!stats) return { status: 'unknown', color: 'gray' };
    const memoryUsageMB = Math.round(stats.memory.heapUsed / 1024 / 1024);
    
    // Umbrales más realistas para el mock data (300-450MB rango normal)
    if (memoryUsageMB > 900 || stats.sessions.expiredSessions > 20) {
      return { status: 'critical', color: 'red' };
    } else if (memoryUsageMB > 800 || stats.sessions.expiredSessions > 15) {
      return { status: 'warning', color: 'yellow' };
    } else {
      return { status: 'healthy', color: 'green' };
    }
  };

  const healthStatus = getHealthStatus();

  return (
    <MainLayout>
      <GradientWrapper>
        <div className="max-w-7xl mx-auto p-6 space-y-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Monitoreo del Sistema</h1>
              <p className="text-gray-400">Dashboard en tiempo real del estado del sistema</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg">
                <div
                  className={`w-2 h-2 rounded-full ${
                    isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'
                  }`}
                />
                <span className="text-sm text-gray-300">
                  {isConnected ? 'Conectado' : 'Desconectado'}
                </span>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg">
                <Activity className={`w-4 h-4 text-${healthStatus.color}-400`} />
                <span
                  className={`text-sm font-medium text-${healthStatus.color}-400 capitalize`}
                >
                  {healthStatus.status}
                </span>
              </div>
            </div>
          </div>

            {stats && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <MemoryStick className="w-6 h-6 text-blue-400" />
                    <h3 className="text-lg font-semibold text-white">Memoria</h3>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Heap Used:</span>
                      <span className="text-white font-mono">
                        {formatBytes(stats.memory.heapUsed)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Heap Total:</span>
                      <span className="text-white font-mono">
                        {formatBytes(stats.memory.heapTotal)}
                      </span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2 mt-3">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-300"
                        style={{
                          width: `${Math.min(
                            (stats.memory.heapUsed / stats.memory.heapTotal) * 100,
                            100
                          )}%`
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <Users className="w-6 h-6 text-green-400" />
                    <h3 className="text-lg font-semibold text-white">Sesiones</h3>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Activas:</span>
                      <span className="text-green-400 font-bold">
                        {stats.sessions.activeSessions}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Total:</span>
                      <span className="text-white">{stats.sessions.totalSessions}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Sub-sesiones:</span>
                      <span className="text-purple-400">
                        {stats.sessions.activeSubSessions}/{stats.sessions.totalSubSessions}
                      </span>
                    </div>
                    {stats.sessions.expiredSessions > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">Expiradas:</span>
                        <span className="text-yellow-400">
                          {stats.sessions.expiredSessions}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <Zap className="w-6 h-6 text-yellow-400" />
                    <h3 className="text-lg font-semibold text-white">Trabajos</h3>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Activos:</span>
                      <span className="text-yellow-400 font-bold">{stats.activeJobs}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Auto-save:</span>
                      <span className="text-white">{stats.autoSaveJobs}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">En cola:</span>
                      <span className="text-blue-400">
                        {stats.queueStats.session.waiting.length}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Procesando:</span>
                      <span className="text-green-400">
                        {stats.queueStats.session.active.length}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <Database className="w-6 h-6 text-purple-400" />
                    <h3 className="text-lg font-semibold text-white">Conexiones</h3>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-400">WebSocket:</span>
                      <span className="text-purple-400 font-bold">{stats.connections}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Estado:</span>
                      <span
                        className={`font-medium ${
                          isConnected ? 'text-green-400' : 'text-red-400'
                        }`}
                      >
                        {isConnected ? 'Online' : 'Offline'}
                      </span>
                    </div>
                    {lastUpdate && (
                      <div className="text-xs text-gray-500 mt-2">
                        Última actualización: {lastUpdate.toLocaleTimeString()}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

          {alerts.length > 0 && (
            <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <AlertTriangle className="w-6 h-6 text-red-400" />
                <h3 className="text-lg font-semibold text-white">Alertas Recientes</h3>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`flex items-start gap-3 p-3 rounded-lg ${
                      alert.type === 'error'
                        ? 'bg-red-900/20 border border-red-800/30'
                        : 'bg-yellow-900/20 border border-yellow-800/30'
                    }`}
                  >
                    <AlertTriangle
                      className={`w-4 h-4 mt-0.5 ${
                        alert.type === 'error' ? 'text-red-400' : 'text-yellow-400'
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm ${
                          alert.type === 'error' ? 'text-red-300' : 'text-yellow-300'
                        }`}
                      >
                        {alert.message}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        <Clock className="w-3 h-3 inline mr-1" />
                        {alert.timestamp.toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!stats && (
            <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-12 text-center">
              <HardDrive className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">
                Cargando estadísticas...
              </h3>
              <p className="text-gray-400">
                {isConnected
                  ? 'Conectando con el sistema de monitoreo...'
                  : 'Intentando conectar con el servidor...'}
              </p>
            </div>
          )}
        </div>
      </GradientWrapper>
    </MainLayout>
  );
};

export default SystemMonitoringScreen;