import { Button } from '@/components/atoms/button';
import { Input } from '@/components/atoms/input';
import { Label } from '@/components/atoms/label';
import { Plus, Trash2 } from 'lucide-react';
import React, { useState } from 'react';
import type { Question, QuestionOption } from '../../types';

interface Props {
  formData: Partial<Question>;
  onChange: (data: Partial<Question>) => void;
  baseInputClass: string;
}

const QuestionOptions: React.FC<Props> = ({
  formData,
  onChange,
  baseInputClass,
}) => {
  const [newOption, setNewOption] = useState('');

  const needsOptions =
    formData.type && ['multiple_choice', 'true_false'].includes(formData.type);

  const updateContent = (field: string, value: any) => {
    onChange({
      ...formData,
      content: {
        ...formData.content,
        [field]: value,
      },
    });
  };

  const addOption = () => {
    if (!newOption.trim()) return;

    const option: QuestionOption = {
      id: Date.now().toString(),
      text: newOption,
      isCorrect: false,
    };

    const currentOptions = formData.content?.options || [];
    updateContent('options', [...currentOptions, option]);
    setNewOption('');
  };

  const removeOption = (id: string) => {
    const currentOptions = formData.content?.options || [];
    updateContent('options', currentOptions.filter(o => o.id !== id));
  };

  const setCorrectOption = (id: string) => {
    const currentOptions = formData.content?.options || [];
    const updatedOptions = currentOptions.map(o => ({
      ...o,
      isCorrect: o.id === id,
    }));
    
    updateContent('options', updatedOptions);
    updateContent('correctAnswer', id);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addOption();
    }
  };

  if (!needsOptions) return null;

  // Auto-generate true/false options if type is true_false and no options exist
  React.useEffect(() => {
    if (formData.type === 'true_false' && (!formData.content?.options || formData.content.options.length === 0)) {
      const truefalseOptions = [
        { id: 'true', text: 'Verdadero', isCorrect: false },
        { id: 'false', text: 'Falso', isCorrect: false },
      ];
      updateContent('options', truefalseOptions);
    }
  }, [formData.type]);

  return (
    <div className="space-y-4">
      <Label className="text-base font-medium">Opciones de Respuesta</Label>
      
      {/* Add new option input (only for multiple_choice) */}
      {formData.type === 'multiple_choice' && (
        <div className="flex gap-2">
          <Input
            value={newOption}
            onChange={e => setNewOption(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe una opción..."
            className={baseInputClass + ' flex-1'}
          />
          <Button type="button" onClick={addOption} className="gap-1">
            <Plus className="w-4 h-4" />
            Agregar
          </Button>
        </div>
      )}

      {/* Display options */}
      <div className="space-y-2">
        {formData.content?.options?.map((opt: QuestionOption) => (
          <div
            key={opt.id}
            className="flex items-center gap-3 p-3 bg-muted/40 border border-border rounded-lg"
          >
            <input
              type="radio"
              name="correctOption"
              checked={!!opt.isCorrect}
              onChange={() => setCorrectOption(opt.id)}
              className="w-4 h-4 text-blue-600 focus:ring-blue-500"
              title="Marcar como respuesta correcta"
            />
            
            {formData.type === 'multiple_choice' ? (
              <Input
                value={opt.text}
                onChange={e => {
                  const currentOptions = formData.content?.options || [];
                  const updatedOptions = currentOptions.map(o =>
                    o.id === opt.id ? { ...o, text: e.target.value } : o
                  );
                  updateContent('options', updatedOptions);
                }}
                className={baseInputClass + ' flex-1'}
                placeholder="Texto de la opción"
              />
            ) : (
              <span className="flex-1 text-foreground/80">{opt.text}</span>
            )}
            
            {formData.type === 'multiple_choice' && (
              <Button
                type="button"
                variant="outline"
                onClick={() => removeOption(opt.id)}
                className="p-2 border-border hover:bg-muted"
                title="Eliminar opción"
              >
                <Trash2 className="w-4 h-4 text-red-500" />
              </Button>
            )}
          </div>
        ))}
      </div>

      {/* Validation hints */}
      {formData.type === 'multiple_choice' && (!formData.content?.options || formData.content.options.length < 2) && (
        <p className="text-sm text-yellow-400">
          💡 Las preguntas de opción múltiple necesitan al menos 2 opciones
        </p>
      )}

      {formData.content?.options && formData.content.options.length > 0 && 
       !formData.content.options.some(o => o.isCorrect) && (
        <p className="text-sm text-yellow-400">
          💡 Selecciona cuál es la respuesta correcta marcando el círculo correspondiente
        </p>
      )}
    </div>
  );
};

export default QuestionOptions;
