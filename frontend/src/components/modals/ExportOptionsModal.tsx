import { Button } from '@/components/atoms/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/atoms/card';
import { Input } from '@/components/atoms/input';
import { Switch } from '@/components/atoms/switch';
import { type ExportOptions } from '@/services/reportsService';
import { Download, FileText, Settings, X } from 'lucide-react';
import React, { useState } from 'react';

interface ExportOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (format: 'csv' | 'pdf', options?: ExportOptions) => void;
  reportType: string;
  isLoading?: boolean;
}

const ExportOptionsModal: React.FC<ExportOptionsModalProps> = ({
  isOpen,
  onClose,
  onExport,
  reportType,
  isLoading = false
}) => {
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    includeInterpretation: false,
    language: 'spanish',
    interpretationLanguage: 'spanish',
    interpretationDepth: 'detailed',
    interpretationFocus: 'academic',
    companyName: ''
  });

  const handleOptionChange = (key: keyof ExportOptions, value: any) => {
    setExportOptions(prev => ({ ...prev, [key]: value }));
  };

  const handleExport = (format: 'csv' | 'pdf') => {
    onExport(format, format === 'pdf' ? exportOptions : undefined);
  };

  const getReportTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'competency': 'Análisis por Competencias',
      'students': 'Estadísticas de Estudiantes',
      'upcoming-sessions': 'Próximas Programaciones',
      'student-history': 'Historial de Estudiante'
    };
    return labels[type] || type;
  };

  const getFocusOptions = (type: string) => {
    if (type === 'upcoming-sessions') {
      return [
        { value: 'administrative', label: 'Administrativo' },
        { value: 'strategic', label: 'Estratégico' }
      ];
    }
    return [
      { value: 'academic', label: 'Académico' },
      { value: 'administrative', label: 'Administrativo' },
      { value: 'strategic', label: 'Estratégico' }
    ];
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="bg-box border-line w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2 text-foreground">
              <Download className="h-5 w-5 text-blue-400" />
              <span>Opciones de Exportación</span>
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Configurar opciones para exportar: {getReportTypeLabel(reportType)}
          </p>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Formato de Exportación */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center space-x-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span>Formato de Exportación</span>
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={() => handleExport('csv')}
                disabled={isLoading}
                className="h-20 flex flex-col items-center justify-center space-y-2 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <FileText className="h-6 w-6" />
                <div className="text-center">
                  <div className="font-medium">CSV</div>
                  <div className="text-xs opacity-80">Datos tabulares</div>
                </div>
              </Button>

              <Button
                onClick={() => handleExport('pdf')}
                disabled={isLoading}
                className="h-20 flex flex-col items-center justify-center space-y-2 bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Download className="h-6 w-6" />
                <div className="text-center">
                  <div className="font-medium">PDF</div>
                  <div className="text-xs opacity-80">Reporte completo</div>
                </div>
              </Button>
            </div>
          </div>

          {/* Configuración PDF Avanzada */}
          <div className="space-y-4 p-4 rounded-lg bg-muted/30 border border-border">
            <h3 className="text-sm font-semibold text-foreground flex items-center space-x-2">
              <Settings className="h-4 w-4 text-muted-foreground" />
              <span>Configuración PDF</span>
            </h3>

            {/* Interpretación con IA */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div>
                  <label className="text-sm font-medium text-foreground">
                    Incluir Análisis con IA
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Agregar interpretación
                  </p>
                </div>
              </div>
              <Switch
                checked={exportOptions.includeInterpretation}
                className='bg-blue-600'
                onCheckedChange={(checked) => handleOptionChange('includeInterpretation', checked)}
              />
            </div>

            {/* Opciones de IA (solo si está habilitada) */}
            {exportOptions.includeInterpretation && (
              <div className="space-y-4 pl-6 border-l-2 border-purple-500/30">
                {/* Idioma del Reporte */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-2 block">
                    Idioma del Reporte
                  </label>
                  <select
                    value={exportOptions.language}
                    onChange={(e) => handleOptionChange('language', e.target.value)}
                    className="w-full bg-muted border border-border text-foreground text-sm rounded px-3 py-2"
                  >
                    <option value="spanish">Español</option>
                    <option value="english">English</option>
                  </select>
                </div>

                {/* Idioma de Interpretación */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-2 block">
                    Idioma de Interpretación IA
                  </label>
                  <select
                    value={exportOptions.interpretationLanguage}
                    onChange={(e) => handleOptionChange('interpretationLanguage', e.target.value)}
                    className="w-full bg-muted border border-border text-foreground text-sm rounded px-3 py-2"
                  >
                    <option value="spanish">Español</option>
                    <option value="english">English</option>
                  </select>
                </div>

                {/* Profundidad de Análisis */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-2 block">
                    Profundidad de Análisis
                  </label>
                  <select
                    value={exportOptions.interpretationDepth}
                    onChange={(e) => handleOptionChange('interpretationDepth', e.target.value)}
                    className="w-full bg-muted border border-border text-foreground text-sm rounded px-3 py-2"
                  >
                    <option value="brief">Breve</option>
                    <option value="detailed">Detallado</option>
                  </select>
                </div>

                {/* Enfoque de Análisis */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-2 block">
                    Enfoque de Análisis
                  </label>
                  <select
                    value={exportOptions.interpretationFocus}
                    onChange={(e) => handleOptionChange('interpretationFocus', e.target.value)}
                    className="w-full bg-muted border border-border text-foreground text-sm rounded px-3 py-2"
                  >
                    {getFocusOptions(reportType).map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Nombre de la Empresa */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-2 block">
                Nombre de la Empresa (Opcional)
              </label>
              <Input
                value={exportOptions.companyName || ''}
                onChange={(e) => handleOptionChange('companyName', e.target.value)}
                placeholder="Sistema de Evaluación Académica"
                className="bg-muted border-border text-foreground text-sm"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ExportOptionsModal;
