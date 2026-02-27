import React, { useState } from 'react';
import { X, Upload, Download, FileSpreadsheet, AlertCircle } from 'lucide-react';
import { useQuestions } from '../hooks/useQuestions';
import { examService } from '../../../services/examService';
import { toast } from 'sonner';

interface ImportModalProps {
  onClose: () => void;
  onImport: () => void;
}

const ImportModal: React.FC<ImportModalProps> = ({ onClose, onImport }) => {
  const { importQuestions } = useQuestions();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      validateAndSetFile(droppedFile);
    }
  };

  const validateAndSetFile = (file: File) => {
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv'
    ];

    if (!validTypes.includes(file.type)) {
      toast.error('Por favor selecciona un archivo Excel (.xlsx, .xls) o CSV');
      return;
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB
      toast.error('El archivo no debe superar los 10MB');
      return;
    }

    setFile(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const handleImport = async () => {
    if (!file) {
      toast.error('Por favor selecciona un archivo');
      return;
    }

    setLoading(true);
    try {
      const result = await importQuestions(file);
      
      if (result) {
        toast.success(
          `Importación completada: ${result.success} exitosas, ${result.failed} fallidas`
        );
        
        if (result.errors && result.errors.length > 0) {
          console.error('Errores de importación:', result.errors);
        }
        
        onImport();
      }
    } catch (error) {
      console.error('Error importing:', error);
      toast.error('Error al importar el archivo');
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = async (format: 'xlsx' | 'csv') => {
    try {
      const blob = await examService.downloadImportTemplate(format);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `plantilla_preguntas.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Plantilla descargada exitosamente');
    } catch (error) {
      console.error('Error downloading template:', error);
      toast.error('Error al descargar la plantilla');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold">Importar Preguntas</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">Instrucciones de importación:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Descarga la plantilla en formato Excel o CSV</li>
                  <li>Completa los campos requeridos siguiendo el formato</li>
                  <li>Guarda el archivo y súbelo aquí</li>
                  <li>El sistema validará y procesará las preguntas automáticamente</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Download Templates */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-3">
              1. Descarga la plantilla:
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => downloadTemplate('xlsx')}
                className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                <FileSpreadsheet className="w-4 h-4 text-green-600" />
                Plantilla Excel (.xlsx)
              </button>
              <button
                onClick={() => downloadTemplate('csv')}
                className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                Plantilla CSV
              </button>
            </div>
          </div>

          {/* Upload Area */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-3">
              2. Sube tu archivo completado:
            </p>
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center ${
                dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              {file ? (
                <div className="space-y-3">
                  <FileSpreadsheet className="w-12 h-12 mx-auto text-green-600" />
                  <div>
                    <p className="font-medium">{file.name}</p>
                    <p className="text-sm text-gray-500">
                      {(file.size / 1024).toFixed(2)} KB
                    </p>
                  </div>
                  <button
                    onClick={() => setFile(null)}
                    className="text-sm text-red-600 hover:underline"
                  >
                    Quitar archivo
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <Upload className="w-12 h-12 mx-auto text-gray-400" />
                  <div>
                    <p className="text-gray-600">
                      Arrastra y suelta tu archivo aquí, o
                    </p>
                    <label className="text-blue-600 hover:underline cursor-pointer">
                      selecciona un archivo
                      <input
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </label>
                  </div>
                  <p className="text-xs text-gray-500">
                    Formatos soportados: Excel (.xlsx, .xls) o CSV - Máximo 10MB
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Supported Fields */}
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm font-medium text-gray-700 mb-2">
              Campos soportados:
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
              <div>• Tipo de pregunta</div>
              <div>• Competencia</div>
              <div>• Nivel (A1-C2)</div>
              <div>• Dificultad (1-5)</div>
              <div>• Pregunta</div>
              <div>• Instrucciones</div>
              <div>• Opciones de respuesta</div>
              <div>• Respuesta correcta</div>
              <div>• Puntos</div>
              <div>• Etiquetas</div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            onClick={handleImport}
            disabled={!file || loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Importando...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Importar Preguntas
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportModal;
