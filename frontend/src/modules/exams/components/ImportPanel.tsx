import { Button, buttonVariants } from '@/components/keel/button';
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
      <div className="border border-border bg-card p-4">
        <div className="flex items-center gap-3">
          <Upload className="w-5 h-5 text-muted-foreground" />
          <div>
            <h3 className="text-foreground font-medium">Importar desde CSV/Excel</h3>
            <p className="text-muted-foreground text-sm">Selecciona un archivo .csv o .xlsx con el formato esperado.</p>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <label className={buttonVariants({ variant: "outline", className: "cursor-pointer" })}>
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
        <Button variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button
          onClick={handleImport}
          disabled={!file || isLoading}
        >
          {isLoading ? "Importando..." : "Importar"}
        </Button>
      </div>
    </div>
  );
};

export default ImportPanel;
