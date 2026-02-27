import { Button } from '@/components/atoms/button';
import { Input } from '@/components/atoms/input';
import { Label } from '@/components/atoms/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/atoms/select';
import { Textarea } from '@/components/atoms/textarea';
import { Plus, Trash2 } from 'lucide-react';
import React from 'react';
import type { Question } from '../../types';

interface Props {
  formData: Partial<Question>;
  onChange: (data: Partial<Question>) => void;
  baseInputClass: string;
}

const QuestionSpecialTypes: React.FC<Props> = ({
  formData,
  onChange,
  baseInputClass,
}) => {
  const updateContent = (field: string, value: any) => {
    onChange({
      ...formData,
      content: {
        ...formData.content,
        [field]: value,
      },
    });
  };

  const needsFillBlanks = formData.type === 'fill_blanks';
  const needsItems = formData.type && ['drag_drop', 'matching', 'ordering'].includes(formData.type);
  const needsAudioResponse = formData.type === 'audio_response';

  if (!needsFillBlanks && !needsItems && !needsAudioResponse) return null;

  return (
    <div className="space-y-6">
      {/* Fill Blanks */}
      {needsFillBlanks && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-base font-medium">Plantilla con espacios en blanco</Label>
            <p className="text-sm text-gray-400">
              Usa <code className="bg-gray-700 px-1 rounded">___</code> para marcar los espacios en blanco
            </p>
            <Textarea
              rows={3}
              value={formData.content?.template || ''}
              onChange={e => updateContent('template', e.target.value)}
              placeholder="Ejemplo: The cat is ___ the house and the dog is ___ the garden."
              className={baseInputClass}
            />
          </div>

          <div className="space-y-2">
            <Label>Respuestas correctas (opcional)</Label>
            <p className="text-sm text-gray-400">
              Define respuestas específicas para cada espacio. Si no se definen, se evaluará como texto libre.
            </p>
            <Input
              value={
                typeof formData.content?.correctAnswer === 'string'
                  ? formData.content.correctAnswer
                  : Array.isArray(formData.content?.correctAnswer) 
                    ? formData.content.correctAnswer.join(', ')
                    : ''
              }
              onChange={e => updateContent('correctAnswer', e.target.value)}
              placeholder="in, outside (separadas por comas)"
              className={baseInputClass}
            />
          </div>
        </div>
      )}

      {/* Items para drag_drop, matching, ordering */}
      {needsItems && (
        <div className="space-y-4">
          <Label className="text-base font-medium">
            {formData.type === 'drag_drop' && 'Elementos para arrastrar y soltar'}
            {formData.type === 'matching' && 'Elementos para emparejar'}
            {formData.type === 'ordering' && 'Elementos para ordenar'}
          </Label>

          <div className="space-y-3">
            {formData.content?.items?.map((item, index) => (
              <div
                key={item.id}
                className="flex items-center gap-2 p-3 bg-gray-800/40 border border-gray-700 rounded-lg"
              >
                <span className="text-sm text-gray-400 w-8">
                  {index + 1}.
                </span>
                <Input
                  value={item.content}
                  onChange={e => {
                    const newItems = [...(formData.content?.items || [])];
                    newItems[index] = { ...item, content: e.target.value };
                    updateContent('items', newItems);
                  }}
                  placeholder="Contenido del elemento"
                  className={baseInputClass + ' flex-1'}
                />

                {formData.type === 'matching' && (
                  <Input
                    value={item.matchingPair || ''}
                    onChange={e => {
                      const newItems = [...(formData.content?.items || [])];
                      newItems[index] = {
                        ...item,
                        matchingPair: e.target.value,
                      };
                      updateContent('items', newItems);
                    }}
                    placeholder="Pareja correspondiente"
                    className={baseInputClass + ' flex-1'}
                  />
                )}

                {formData.type === 'ordering' && (
                  <Input
                    type="number"
                    value={item.correctPosition || ''}
                    onChange={e => {
                      const newItems = [...(formData.content?.items || [])];
                      newItems[index] = {
                        ...item,
                        correctPosition: Number(e.target.value),
                      };
                      updateContent('items', newItems);
                    }}
                    placeholder="Posición correcta"
                    className={baseInputClass + ' w-32'}
                    min={1}
                  />
                )}

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const newItems = formData.content?.items?.filter((_, i) => i !== index) || [];
                    updateContent('items', newItems);
                  }}
                  className="p-2 border-gray-700 hover:bg-gray-800"
                  title="Eliminar elemento"
                >
                  <Trash2 className="w-4 h-4 text-red-500" />
                </Button>
              </div>
            ))}

            <Button
              type="button"
              onClick={() => {
                const newItem = {
                  id: Date.now().toString(),
                  content: '',
                  correctPosition:
                    formData.type === 'ordering'
                      ? (formData.content?.items?.length || 0) + 1
                      : undefined,
                  matchingPair:
                    formData.type === 'matching' ? '' : undefined,
                };
                updateContent('items', [...(formData.content?.items || []), newItem]);
              }}
              className="gap-1 w-full"
              variant="outline"
            >
              <Plus className="w-4 h-4" />
              Agregar elemento
            </Button>
          </div>
        </div>
      )}

      {/* Audio Response Configuration */}
      {needsAudioResponse && (
        <div className="space-y-4">
          <Label className="text-base font-medium">Configuración de respuesta de audio</Label>
          
          <div className="space-y-2">
            <Label>Tipo de respuesta esperada</Label>
            <Select
              value={formData.content?.expectedResponseType || 'sentence'}
              onValueChange={(value: 'word' | 'sentence' | 'paragraph') =>
                updateContent('expectedResponseType', value)
              }
            >
              <SelectTrigger className={baseInputClass}>
                <SelectValue placeholder="Selecciona el tipo" />
              </SelectTrigger>
              <SelectContent className="bg-gray-900 border border-line">
                <SelectItem value="word">Palabra</SelectItem>
                <SelectItem value="sentence">Oración</SelectItem>
                <SelectItem value="paragraph">Párrafo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Palabras clave esperadas (opcional)</Label>
            <p className="text-sm text-gray-400">
              Define palabras clave que deberían aparecer en la respuesta del estudiante
            </p>
            <Input
              value={formData.content?.keywords?.join(', ') || ''}
              onChange={e => {
                const keywords = e.target.value.split(',').map(k => k.trim()).filter(k => k);
                updateContent('keywords', keywords);
              }}
              placeholder="palabra1, palabra2, palabra3"
              className={baseInputClass}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default QuestionSpecialTypes;
