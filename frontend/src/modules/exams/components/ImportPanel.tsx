import { Button, buttonVariants } from '@/components/keel/button';
import { examService, type QuestionImportResult } from '@/services/examService';
import { Download, FileText, Upload } from 'lucide-react';
import React, { useState } from 'react';
import { toast } from 'sonner';

interface Props {
  onCancel: () => void;
  onImported: () => void;
}

const ACCEPTED = '.xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv';

/** Server message (400 with a reason) when there is one, else a generic one. */
function errorMessage(error: unknown): string {
  const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
  return message || 'No se pudo importar el archivo. Inténtalo de nuevo.';
}

const ImportPanel: React.FC<Props> = ({ onCancel, onImported }) => {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<QuestionImportResult | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const handleImport = async () => {
    if (!file) return;
    setIsLoading(true);
    setFailure(null);
    try {
      const response = await examService.importQuestions(file);
      if (response.success && response.data) setResult(response.data);
      else setFailure(response.message || 'No se pudo importar el archivo.');
    } catch (error) {
      setFailure(errorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const handleTemplate = () => {
    examService.downloadImportTemplate().catch(() => toast.error('No se pudo descargar la plantilla'));
  };

  const created = result ? result.imported + result.drafts : 0;

  return (
    <div className="space-y-6">
      <div className="border border-border bg-card p-4 rounded-xl">
        <div className="flex items-center gap-3">
          <Upload className="w-5 h-5 text-muted-foreground" />
          <div className="flex-1">
            <h3 className="text-foreground font-medium">Importar desde Excel o CSV</h3>
            <p className="text-muted-foreground text-sm">
              Usa la plantilla: trae un ejemplo de cada tipo de pregunta y una hoja de instrucciones.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleTemplate}>
            <Download className="w-3.5 h-3.5" /> Descargar plantilla
          </Button>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <label className={buttonVariants({ variant: 'outline', className: 'cursor-pointer' })}>
            <FileText className="w-4 h-4" />
            <span>Seleccionar archivo</span>
            <input
              type="file"
              accept={ACCEPTED}
              className="hidden"
              onChange={(e) => {
                setFile(e.target.files?.[0] || null);
                setResult(null);
                setFailure(null);
              }}
            />
          </label>

          {file && <span className="text-sm text-muted-foreground">{file.name}</span>}
        </div>
      </div>

      {failure && (
        <div role="alert" className="border border-destructive/30 bg-destructive/5 p-4 rounded-xl text-sm text-destructive">
          {failure}
        </div>
      )}

      {result && (
        <div className="border border-border bg-card p-4 rounded-xl space-y-3" aria-live="polite">
          <h3 className="text-foreground font-medium">Resultado de la importación</h3>
          <div className="grid grid-cols-3 gap-3 text-center">
            <Summary label="Importadas" value={result.imported} />
            <Summary label="Borradores sin audio" value={result.drafts} />
            <Summary label="Con errores" value={result.failed} />
          </div>

          {result.drafts > 0 && (
            <p className="text-sm text-muted-foreground">
              Las preguntas de comprensión auditiva se guardaron como borrador (inactivas). Edítalas, sube el audio y actívalas
              para poder usarlas en un examen.
              {result.draftRows.length > 0 && ` Filas: ${result.draftRows.join(', ')}.`}
            </p>
          )}

          {result.errors.length > 0 && (
            <div>
              <p className="text-sm font-medium text-foreground">Estas filas no se importaron:</p>
              <ul className="mt-1 max-h-64 space-y-1 overflow-y-auto text-sm text-muted-foreground">
                {result.errors.map((e) => (
                  <li key={`${e.row}-${e.message}`}>
                    <span className="font-medium text-foreground">Fila {e.row}:</span> {e.message}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-sm text-muted-foreground">
                Corrige esas filas en tu archivo e impórtalo de nuevo; las que ya se importaron aparecerán duplicadas, así que deja solo las filas con error.
              </p>
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end gap-3">
        {result ? (
          <Button onClick={created > 0 ? onImported : onCancel}>Cerrar</Button>
        ) : (
          <>
            <Button variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
            <Button onClick={handleImport} disabled={!file || isLoading}>
              {isLoading ? 'Importando...' : 'Importar'}
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

const Summary: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className="rounded-lg border border-border px-3 py-2">
    <div className="text-2xl font-semibold text-foreground tabular-nums">{value}</div>
    <div className="text-xs text-muted-foreground">{label}</div>
  </div>
);

export default ImportPanel;
