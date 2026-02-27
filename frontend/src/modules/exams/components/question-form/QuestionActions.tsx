import { Button } from '@/components/atoms/button';
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
        className="gap-1 text-white bg-transparent border border-line hover:bg-gray-800 disabled:opacity-50"
      >
        Cancelar
      </Button>
      <Button
        type="button"
        onClick={onSubmit}
        disabled={isLoading || !canSave}
        className="gap-1 bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <>
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
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
