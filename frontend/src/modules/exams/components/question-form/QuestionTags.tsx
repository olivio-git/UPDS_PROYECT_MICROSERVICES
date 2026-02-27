import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/atoms/card';
import { Button } from '@/components/atoms/button';
import { Input } from '@/components/atoms/input';
import { Label } from '@/components/atoms/label';
import React, { useState } from 'react';
import type { Question } from '../../types';

interface Props {
  formData: Partial<Question>;
  onChange: (data: Partial<Question>) => void;
  baseInputClass: string;
}

const QuestionTags: React.FC<Props> = ({
  formData,
  onChange,
  baseInputClass,
}) => {
  const [tagInput, setTagInput] = useState('');

  const updateMetadata = (field: string, value: any) => {
    onChange({
      ...formData,
      metadata: {
        ...formData.metadata,
        [field]: value,
      },
    });
  };

  const addTag = () => {
    if (!tagInput.trim()) return;
    
    const currentTags = formData.metadata?.tags || [];
    const newTag = tagInput.trim();
    
    // Evitar duplicados
    if (currentTags.includes(newTag)) {
      setTagInput('');
      return;
    }
    
    updateMetadata('tags', [...currentTags, newTag]);
    setTagInput('');
  };

  const removeTag = (index: number) => {
    const currentTags = formData.metadata?.tags || [];
    const updatedTags = currentTags.filter((_, i) => i !== index);
    updateMetadata('tags', updatedTags);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  };

  return (
    <Card className="border border-line">
      <CardHeader>
        <CardTitle className="text-white">Etiquetas</CardTitle>
        <CardDescription>
          Palabras clave para búsqueda y categorización
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Input para agregar etiquetas */}
        <div className="flex gap-2">
          <Input
            value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Agregar etiqueta..."
            className={baseInputClass + ' flex-1'}
          />
          <Button 
            type="button" 
            variant="secondary" 
            onClick={addTag}
            disabled={!tagInput.trim()}
          >
            Agregar
          </Button>
        </div>

        {/* Lista de etiquetas */}
        {formData.metadata?.tags && formData.metadata.tags.length > 0 && (
          <div>
            <Label className="text-sm text-gray-400 mb-2 block">
              Etiquetas actuales:
            </Label>
            <div className="flex flex-wrap gap-2">
              {formData.metadata.tags.map((tag: string, index: number) => (
                <span
                  key={`${tag}-${index}`}
                  className="px-3 py-1 bg-gray-800/50 border border-gray-700 text-gray-200 rounded-full text-sm flex items-center gap-2 group"
                >
                  <span>{tag}</span>
                  <button
                    type="button"
                    onClick={() => removeTag(index)}
                    className="hover:text-red-400 transition-colors ml-1 text-gray-400 group-hover:text-red-400"
                    title="Quitar etiqueta"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Sugerencias de etiquetas comunes */}
        <div className="pt-2">
          <Label className="text-sm text-gray-400 mb-2 block">
            Etiquetas sugeridas (click para agregar):
          </Label>
          <div className="flex flex-wrap gap-2">
            {getSuggestedTags(formData).map((suggestedTag) => (
              <button
                key={suggestedTag}
                type="button"
                onClick={() => {
                  const currentTags = formData.metadata?.tags || [];
                  if (!currentTags.includes(suggestedTag)) {
                    updateMetadata('tags', [...currentTags, suggestedTag]);
                  }
                }}
                className="px-2 py-1 bg-gray-700/50 border border-gray-600 text-gray-300 rounded text-xs hover:bg-gray-600/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={formData.metadata?.tags?.includes(suggestedTag)}
              >
                {suggestedTag}
              </button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Función helper para generar etiquetas sugeridas basadas en el contexto
function getSuggestedTags(formData: Partial<Question>): string[] {
  const suggestions: string[] = [];
  
  // Basado en competencia
  switch (formData.competency) {
    case 'reading':
      suggestions.push('comprensión', 'lectura', 'texto');
      break;
    case 'writing':
      suggestions.push('redacción', 'escritura', 'composición');
      break;
    case 'listening':
      suggestions.push('audio', 'comprensión auditiva', 'escucha');
      break;
    case 'speaking':
      suggestions.push('pronunciación', 'conversación', 'oral');
      break;
    case 'grammar':
      suggestions.push('gramática', 'estructura', 'reglas');
      break;
    case 'vocabulary':
      suggestions.push('vocabulario', 'palabras', 'léxico');
      break;
  }
  
  // Basado en nivel
  if (formData.level) {
    suggestions.push(formData.level.toLowerCase());
    if (['A1', 'A2'].includes(formData.level)) {
      suggestions.push('básico', 'elemental');
    } else if (['B1', 'B2'].includes(formData.level)) {
      suggestions.push('intermedio');
    } else if (['C1', 'C2'].includes(formData.level)) {
      suggestions.push('avanzado');
    }
  }
  
  // Basado en tipo de pregunta
  switch (formData.type) {
    case 'multiple_choice':
      suggestions.push('opción múltiple', 'selección');
      break;
    case 'true_false':
      suggestions.push('verdadero/falso', 'binaria');
      break;
    case 'fill_blanks':
      suggestions.push('completar', 'espacios en blanco');
      break;
    case 'matching':
      suggestions.push('emparejar', 'relacionar');
      break;
    case 'ordering':
      suggestions.push('ordenar', 'secuencia');
      break;
    case 'drag_drop':
      suggestions.push('arrastrar', 'interactiva');
      break;
    case 'audio_response':
      suggestions.push('grabación', 'respuesta oral');
      break;
    case 'essay':
      suggestions.push('ensayo', 'redacción libre');
      break;
    case 'open_text':
      suggestions.push('texto libre', 'abierta');
      break;
  }
  
  // Basado en tema/subtema
  if (formData.metadata?.topic) {
    suggestions.push(formData.metadata.topic.toLowerCase());
  }
  
  if (formData.metadata?.subtopic) {
    suggestions.push(formData.metadata.subtopic.toLowerCase());
  }
  
  // Etiquetas generales comunes
  const commonTags = [
    'práctica',
    'evaluación',
    'ejercicio',
    'tarea',
    'examen',
    'quiz',
    'repaso',
    'estudio'
  ];
  
  suggestions.push(...commonTags);
  
  // Remover duplicados y filtrar las que ya existen
  const uniqueSuggestions = [...new Set(suggestions)];
  const existingTags = formData.metadata?.tags || [];
  
  return uniqueSuggestions.filter(tag => !existingTags.includes(tag));
}

export default QuestionTags;
