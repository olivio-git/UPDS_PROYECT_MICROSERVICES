import { Button } from '@/components/atoms/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/atoms/card';
import { Input } from '@/components/atoms/input';
import GradientWrapper from '@/components/background/GrandWrapperSection';
import { MainLayout } from '@/components/layout';
import {
  reportsService,
  type ReportFilters,
  type UpcomingSessionsData,
  type ExportOptions
} from '@/services/reportsService';
import { notificationSocket } from '@/services/notifications/notificationSocket';
import ExportOptionsModal from '@/components/modals/ExportOptionsModal';
import {
  Calendar,
  ChevronDown,
  ChevronUp,
  Clock,
  Filter,
  Loader2,
  RefreshCw,
  Users,
  AlertTriangle,
  CheckCircle,
  UserCheck,
  FileText,
  CalendarDays,
  Download
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';

const UpcomingSessionsScreen: React.FC = () => {
  const [sessionsData, setSessionsData] = useState<UpcomingSessionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  // Filters state
  const [filters, setFilters] = useState<ReportFilters>({
    startDate: '',
    endDate: '',
  });

  // Load sessions data
  useEffect(() => {
    loadSessionsData();

    // Real-time updates when any session status changes
    const onSessionStatusChanged = (data: any) => {
      console.log('📡 [UpcomingSessions] session.status.changed:', data);
      loadSessionsData();
    };
    notificationSocket.on('session.status.changed', onSessionStatusChanged);
    notificationSocket.connect().catch(() => {});

    return () => {
      notificationSocket.off('session.status.changed', onSessionStatusChanged);
    };
  }, []);

  const loadSessionsData = async (customFilters?: ReportFilters) => {
    try {
      setLoading(true);
      const activeFilters = customFilters || filters;
      const sessions = await reportsService.getUpcomingSessions(activeFilters);
      setSessionsData(sessions);
    } catch (error) {
      console.error('Error loading upcoming sessions:', error);
      toast.error('Error cargando las próximas sesiones');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key: keyof ReportFilters, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleApplyFilters = () => {
    loadSessionsData(filters);
  };

  const handleClearFilters = () => {
    const emptyFilters: ReportFilters = {};
    setFilters(emptyFilters);
    loadSessionsData(emptyFilters);
  };

  const handleOpenExportModal = () => {
    setExportModalOpen(true);
  };

  const handleExportSessions = async (format: 'csv' | 'pdf', exportOptions?: ExportOptions) => {
    try {
      setExportLoading(true);
      await reportsService.exportReport('upcoming-sessions', filters, format, undefined, exportOptions);
      const formatText = format === 'pdf' ? 'PDF' : 'CSV';
      const aiText = exportOptions?.includeInterpretation ? ' con análisis IA' : '';
      toast.success(`Reporte de próximas sesiones exportado como ${formatText}${aiText} exitosamente`);
      setExportModalOpen(false);
    } catch (error) {
      toast.error('Error exportando el reporte');
    } finally {
      setExportLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'text-blue-400 bg-blue-500/10 border border-blue-500/20';
      case 'in_progress': return 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20';
      case 'completed': return 'text-slate-400 bg-slate-500/10 border border-slate-500/20';
      case 'cancelled': return 'text-red-400 bg-red-500/10 border border-red-500/20';
      default: return 'text-slate-400 bg-slate-500/10 border border-slate-500/20';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'scheduled': return 'Programada';
      case 'in_progress': return 'En Progreso';
      case 'completed': return 'Completada';
      case 'cancelled': return 'Cancelada';
      default: return status;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatTime = (timeString: string) => {
    return timeString;
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-500" />
            <p className="text-muted-foreground text-sm">Cargando próximas sesiones...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-4 p-4 min-h-screen">
        {/* Header */}
        <GradientWrapper
          intensity="medium"
          size="md"
          position="center"
          animate={false}
          variant="cosmic"
        >
          <div className="flex items-center justify-between p-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                Próximas Programaciones
              </h1>
              <p className="text-muted-foreground text-sm">
                Gestión y seguimiento de sesiones de examen programadas
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <Button
                onClick={handleOpenExportModal}
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white border-0"
              >
                <Download className="h-3.5 w-3.5 mr-1.5" />
                Exportar
              </Button>

              <Button
                onClick={() => loadSessionsData()}
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white border-0"
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                Actualizar
              </Button>
            </div>
          </div>
        </GradientWrapper>

        {/* Filters Section */}
        <Card className="bg-box border-line">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center space-x-2 text-foreground text-base">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span>Filtros de Fecha</span>
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFiltersExpanded(!filtersExpanded)}
                className="text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                {filtersExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </CardHeader>

          {filtersExpanded && (
            <CardContent className="space-y-3 pt-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-foreground/80 mb-1 block">
                    Fecha Inicio
                  </label>
                  <Input
                    type="date"
                    value={filters.startDate || ''}
                    onChange={(e) => handleFilterChange('startDate', e.target.value)}
                    className="bg-muted border-line text-foreground text-sm h-8"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-foreground/80 mb-1 block">
                    Fecha Fin
                  </label>
                  <Input
                    type="date"
                    value={filters.endDate || ''}
                    onChange={(e) => handleFilterChange('endDate', e.target.value)}
                    className="bg-muted border-line text-foreground text-sm h-8"
                  />
                </div>
              </div>

              <div className="flex space-x-2">
                <Button onClick={handleApplyFilters} size="sm" className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white">
                  Aplicar Filtros
                </Button>
                <Button onClick={handleClearFilters} variant="outline" size="sm" className="h-7 text-xs border-line text-muted-foreground bg-muted hover:bg-muted/80">
                  Limpiar
                </Button>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Summary Cards */}
        {sessionsData && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <Card className="bg-box border-line">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">
                      Total Sesiones
                    </p>
                    <p className="text-2xl font-bold text-foreground">
                      {sessionsData.totalUpcomingSessions}
                    </p>
                    <p className="text-xs text-blue-400">
                      Próximas
                    </p>
                  </div>
                  <CalendarDays className="h-8 w-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-box border-line">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">
                      Esta Semana
                    </p>
                    <p className="text-2xl font-bold text-foreground">
                      {sessionsData.sessionsThisWeek}
                    </p>
                    <p className="text-xs text-emerald-400">
                      Próximos 7 días
                    </p>
                  </div>
                  <Calendar className="h-8 w-8 text-emerald-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-box border-line">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">
                      Candidatos Registrados
                    </p>
                    <p className="text-2xl font-bold text-foreground">
                      {sessionsData.summary.totalCandidatesRegistered}
                    </p>
                    <p className="text-xs text-blue-400">
                      Total
                    </p>
                  </div>
                  <Users className="h-8 w-8 text-purple-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-box border-line">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">
                      Necesitan Proctors
                    </p>
                    <p className="text-2xl font-bold text-foreground">
                      {sessionsData.summary.sessionsNeedingProctors}
                    </p>
                    <p className="text-xs text-amber-400">
                      Sesiones
                    </p>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-amber-500" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Upcoming Sessions List */}
        {sessionsData && (
          <Card className="bg-box border-line">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center space-x-2 text-foreground text-base">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span>Próximas Sesiones ({sessionsData.upcomingSessions.length})</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-3">
                {sessionsData.upcomingSessions.map((session) => (
                  <div key={session.sessionId} className="p-4 rounded-lg border border-line bg-muted/30">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <h3 className="font-medium text-foreground text-sm">
                            {session.sessionName}
                          </h3>
                          <div className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(session.status)}`}>
                            {getStatusText(session.status)}
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">
                          {session.examTitle}
                        </p>
                        <div className="flex items-center space-x-4 text-xs text-foreground/80">
                          <div className="flex items-center space-x-1">
                            <Calendar className="h-3 w-3" />
                            <span>{formatDate(session.startDate)}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Users className="h-3 w-3" />
                            <span>{session.registeredCandidates}/{session.maxCandidates}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <UserCheck className="h-3 w-3" />
                            <span>{session.proctorsAssigned} proctors</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Time Slots */}
                    {session.timeSlots.length > 0 && (
                      <div className="border-t border-line pt-3">
                        <h4 className="text-xs font-medium text-foreground/80 mb-2">Horarios Disponibles:</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                          {session.timeSlots.map((slot, index) => (
                            <div key={index} className="flex items-center justify-between p-2 rounded bg-muted/50 border border-border">
                              <div className="flex items-center space-x-2">
                                <Clock className="h-3 w-3 text-muted-foreground" />
                                <span className="text-xs text-foreground/80">
                                  {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                                </span>
                              </div>
                              <div className="flex items-center space-x-1">
                                <span className={`text-xs font-medium ${
                                  slot.available > 0 ? 'text-emerald-400' : 'text-red-400'
                                }`}>
                                  {slot.enrolled}/{slot.capacity}
                                </span>
                                {slot.available > 0 ? (
                                  <CheckCircle className="h-3 w-3 text-emerald-400" />
                                ) : (
                                  <AlertTriangle className="h-3 w-3 text-red-400" />
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Session Settings */}
                    <div className="border-t border-line pt-3 mt-3">
                      <div className="flex items-center space-x-4 text-xs">
                        <div className="flex items-center space-x-1">
                          <div className={`w-2 h-2 rounded-full ${
                            session.settings.requireProctor ? 'bg-emerald-400' : 'bg-muted-foreground'
                          }`} />
                          <span className="text-foreground/80">
                            {session.settings.requireProctor ? 'Requiere proctor' : 'Sin proctor'}
                          </span>
                        </div>
                        {session.settings.allowLateEntry && (
                          <div className="flex items-center space-x-1">
                            <div className="w-2 h-2 rounded-full bg-amber-400" />
                            <span className="text-foreground/80">
                              Entrada tardía: {session.settings.lateEntryMinutes} min
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {sessionsData.upcomingSessions.length === 0 && (
                  <div className="text-center py-8">
                    <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground text-sm">No hay sesiones programadas próximamente</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Proctor Workload */}
        {sessionsData && sessionsData.proctorWorkload.length > 0 && (
          <Card className="bg-box border-line">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center space-x-2 text-foreground text-base">
                <UserCheck className="h-4 w-4 text-muted-foreground" />
                <span>Carga de Trabajo de Proctors</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {sessionsData.proctorWorkload.map((proctor) => (
                  <div key={proctor.proctorId} className="p-3 rounded-lg border border-line bg-muted/30">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-foreground text-sm">
                        {proctor.proctorName}
                      </h4>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Sesiones:</span>
                        <span className="text-foreground/80 font-medium">
                          {proctor.assignedSessions}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Horas:</span>
                        <span className="text-foreground/80 font-medium">
                          {proctor.upcomingHours.toFixed(1)}h
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Modal de Exportación */}
        <ExportOptionsModal
          isOpen={exportModalOpen}
          onClose={() => setExportModalOpen(false)}
          onExport={handleExportSessions}
          reportType="upcoming-sessions"
          isLoading={exportLoading}
        />
      </div>
    </MainLayout>
  );
};

export default UpcomingSessionsScreen;
