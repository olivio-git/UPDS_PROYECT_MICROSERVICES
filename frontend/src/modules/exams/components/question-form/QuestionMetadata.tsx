import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/atoms/card';
import { Input } from '@/components/atoms/input';
import { Label } from '@/components/atoms/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/atoms/select';
import React from 'react';
import type {
  Competency,
  Level,
  Question,
  QuestionType,
} from '../../types';

// Tipos válidos por competencia MCER
const TYPES_BY_COMPETENCY: Record<string, QuestionType[]> = {
  reading:   ['multiple_choice', 'true_false', 'fill_blanks', 'matching', 'ordering', 'drag_drop', 'open_text', 'essay'],
  writing:   ['essay', 'open_text', 'fill_blanks', 'multiple_choice', 'true_false', 'matching', 'ordering', 'drag_drop'],
  listening: ['multiple_choice', 'true_false', 'fill_blanks', 'matching', 'ordering', 'open_text'],
  speaking:  ['audio_response'],
};

const DEFAULT_TYPE: Record<string, QuestionType> = {
  reading:   'multiple_choice',
  writing:   'essay',
  listening: 'multiple_choice',
  speaking:  'audio_response',
};

const TYPE_LABELS: Record<QuestionType, string> = {
  multiple_choice: 'Opción Múltiple',
  true_false:      'Verdadero/Falso',
  open_text:       'Texto Abierto',
  essay:           'Ensayo',
  fill_blanks:     'Completar Espacios',
  drag_drop:       'Arrastrar y Soltar',
  matching:        'Emparejar',
  ordering:        'Ordenar',
  audio_response:  'Respuesta de Audio',
  file_upload:     'Subir Archivo',
};

interface Props {
  formData: Partial<Question>;
  onChange: (data: Partial<Question>) => void;
  baseInputClass: string;
}

const QuestionMetadata: React.FC<Props> = ({
  formData,
  onChange,
  baseInputClass,
}) => {
  const updateField = (field: string, value: any) => {
    onChange({ ...formData, [field]: value });
  };

  const updateMetadata = (field: string, value: any) => {
    onChange({
      ...formData,
      metadata: {
        ...formData.metadata,
        [field]: value,
      },
    });
  };

  const handleCompetencyChange = (v: Competency) => {
    const availableTypes = TYPES_BY_COMPETENCY[v] ?? [];
    const currentType = formData.type as QuestionType | undefined;
    const newType = currentType && availableTypes.includes(currentType)
      ? currentType
      : DEFAULT_TYPE[v];
    onChange({ ...formData, competency: v, type: newType });
  };

  const availableTypes = TYPES_BY_COMPETENCY[formData.competency as string] ?? Object.keys(TYPE_LABELS) as QuestionType[];
  const typeIsFixed = availableTypes.length === 1;

  return (
    <Card className="border border-line">
      <CardHeader>
        <CardTitle className="text-foreground">Metadatos</CardTitle>
        <CardDescription>Configura tipo, competencia y nivel</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Competencia — va primero para que filtre el tipo */}
          <div className="space-y-2">
            <Label>Competencia</Label>
            <Select
              value={formData.competency as string}
              onValueChange={handleCompetencyChange}
            >
              <SelectTrigger className={baseInputClass}>
                <SelectValue placeholder="Selecciona la competencia" />
              </SelectTrigger>
              <SelectContent className="bg-popover border border-line">
                <SelectItem className="hover:bg-muted" value="reading">
                  Comprensión Lectora
                </SelectItem>
                <SelectItem className="hover:bg-muted" value="writing">
                  Expresión Escrita
                </SelectItem>
                <SelectItem className="hover:bg-muted" value="listening">
                  Comprensión Auditiva
                </SelectItem>
                <SelectItem className="hover:bg-muted" value="speaking">
                  Expresión Oral
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Tipo de pregunta — filtrado según competencia */}
          <div className="space-y-2">
            <Label>Tipo de Pregunta</Label>
            {typeIsFixed ? (
              <div className={`${baseInputClass} flex items-center px-3 h-10 gap-2`}>
                <span className="text-foreground text-sm">{TYPE_LABELS[availableTypes[0]]}</span>
                <span className="ml-auto text-xs text-muted-foreground italic">único disponible</span>
              </div>
            ) : (
              <Select
                value={formData.type as string}
                onValueChange={(v: QuestionType) => updateField('type', v)}
              >
                <SelectTrigger className={baseInputClass}>
                  <SelectValue placeholder="Selecciona el tipo" />
                </SelectTrigger>
                <SelectContent className="bg-popover border border-line">
                  {availableTypes.map(type => (
                    <SelectItem key={type} className="hover:bg-muted" value={type}>
                      {TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Nivel */}
          <div className="space-y-2">
            <Label>Nivel MCER</Label>
            <Select
              value={formData.level as string}
              onValueChange={(v: Level) => updateField('level', v)}
            >
              <SelectTrigger className={baseInputClass}>
                <SelectValue placeholder="Selecciona el nivel" />
              </SelectTrigger>
              <SelectContent className="bg-popover border border-line">
                <SelectItem className="hover:bg-muted" value="A1">A1</SelectItem>
                <SelectItem className="hover:bg-muted" value="A2">A2</SelectItem>
                <SelectItem className="hover:bg-muted" value="B1">B1</SelectItem>
                <SelectItem className="hover:bg-muted" value="B2">B2</SelectItem>
                <SelectItem className="hover:bg-muted" value="C1">C1</SelectItem>
                <SelectItem className="hover:bg-muted" value="C2">C2</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Dificultad / Puntos / Estado */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Dificultad</Label>
            <Select
              value={String(formData.difficulty ?? 3)}
              onValueChange={v => updateField('difficulty', Number(v))}
            >
              <SelectTrigger className={baseInputClass}>
                <SelectValue placeholder="Selecciona la dificultad" />
              </SelectTrigger>
              <SelectContent className="bg-popover border border-line">
                <SelectItem className="hover:bg-muted" value="1">Muy Fácil</SelectItem>
                <SelectItem className="hover:bg-muted" value="2">Fácil</SelectItem>
                <SelectItem className="hover:bg-muted" value="3">Medio</SelectItem>
                <SelectItem className="hover:bg-muted" value="4">Difícil</SelectItem>
                <SelectItem className="hover:bg-muted" value="5">Muy Difícil</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Puntos</Label>
            <Input
              type="number"
              min={1}
              value={formData.points ?? 1}
              onChange={e => updateField('points', Number(e.target.value))}
              className={baseInputClass}
            />
          </div>

          <div className="space-y-2">
            <Label>Estado</Label>
            <Select
              value={formData.isActive ?? true ? 'true' : 'false'}
              onValueChange={v => updateField('isActive', v === 'true')}
            >
              <SelectTrigger className={baseInputClass}>
                <SelectValue placeholder="Selecciona el estado" />
              </SelectTrigger>
              <SelectContent className="bg-popover border border-line">
                <SelectItem className="hover:bg-muted" value="true">Activa</SelectItem>
                <SelectItem className="hover:bg-muted" value="false">Inactiva</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Metadatos adicionales */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Tema</Label>
            <Input
              value={formData.metadata?.topic || ''}
              onChange={e => updateMetadata('topic', e.target.value)}
              className={baseInputClass}
              placeholder="Ej: Present Simple"
            />
          </div>

          <div className="space-y-2">
            <Label>Subtema</Label>
            <Input
              value={formData.metadata?.subtopic || ''}
              onChange={e => updateMetadata('subtopic', e.target.value)}
              className={baseInputClass}
              placeholder="Ej: Afirmaciones"
            />
          </div>

          <div className="space-y-2">
            <Label>Tiempo estimado (minutos)</Label>
            <Input
              type="number"
              min={1}
              value={formData.metadata?.estimatedTime || ''}
              onChange={e =>
                updateMetadata(
                  'estimatedTime',
                  e.target.value ? Number(e.target.value) : undefined
                )
              }
              className={baseInputClass}
              placeholder="5"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default QuestionMetadata;
