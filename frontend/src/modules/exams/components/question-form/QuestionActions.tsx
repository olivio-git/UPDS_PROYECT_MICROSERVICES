import { Button } from '@/components/keel/button';
import React from 'react';

interface Props {
  isEditing: boolean;
  onCancel: () => void;
  onSubmit: () => void;
  isLoading?: boolean;
  canSave?: boolean;
}

const QuestionActions: React.FC<Props> = ({
  isEditing,
  onCancel,
  onSubmit,
  isLoading = false,
  canSave = true,
}) => {
  return (
    <div className="flex justify-end gap-3 pt-6 border-t border-line">
      <Button
        type="button"
        variant="outline"
        onClick={onCancel}
        disabled={isLoading}
        className="gap-1 disabled:opacity-50"
      >
        Cancelar
      </Button>
      <Button
        type="button"
        onClick={onSubmit}
        disabled={isLoading || !canSave}
        className="gap-1"
      >
        {isLoading ? (
          <>
            <div className="w-4 h-4 border-2 border-foreground/30 border-t-white rounded-full animate-spin" />
            Guardando...
          </>
        ) : (
          <>
            {isEditing ? 'Guardar Cambios' : 'Crear Pregunta'}
          </>
        )}
      </Button>
    </div>
  );
};

export default QuestionActions;
