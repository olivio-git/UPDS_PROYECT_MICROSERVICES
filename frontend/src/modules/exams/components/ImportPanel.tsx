import React, { useState } from "react";
import { Upload, FileText } from "lucide-react";

interface Props {
  onCancel: () => void;
  onImported: () => void;
}

const ImportPanel: React.FC<Props> = ({ onCancel, onImported }) => {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleImport = async () => {
    if (!file) return;
    setIsLoading(true);
    try {
      // TODO: llama a tu servicio real de importación
      await new Promise((r) => setTimeout(r, 900));
      onImported();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="p-4 bg-dark-light border border-line rounded-lg">
        <div className="flex items-center gap-3">
          <Upload className="w-5 h-5 text-muted-foreground" />
          <div>
            <h3 className="text-foreground font-medium">Importar desde CSV/Excel</h3>
            <p className="text-muted-foreground text-sm">Selecciona un archivo .csv o .xlsx con el formato esperado.</p>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <label className="px-4 py-2 bg-dark-light border border-line rounded-lg hover:bg-dark-light/80 cursor-pointer text-muted-foreground flex items-center gap-2">
            <FileText className="w-4 h-4" />
            <span>Seleccionar archivo</span>
            <input
              type="file"
              accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </label>

          {file && <span className="text-sm text-muted-foreground">{file.name}</span>}
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <button onClick={onCancel} className="px-4 py-2 bg-dark-light border border-line rounded-lg text-muted-foreground hover:bg-dark-light/80">
          Cancelar
        </button>
        <button
          onClick={handleImport}
          disabled={!file || isLoading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {isLoading ? "Importando..." : "Importar"}
        </button>
      </div>
    </div>
  );
};

export default ImportPanel;
