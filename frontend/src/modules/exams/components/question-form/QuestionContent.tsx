import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/atoms/card';
import { Label } from '@/components/atoms/label';
import { Textarea } from '@/components/atoms/textarea';
import React from 'react';
import type { Question } from '../../types';

interface Props {
  formData: Partial<Question>;
  onChange: (data: Partial<Question>) => void;
  baseInputClass: string;
}

const QuestionContent: React.FC<Props> = ({
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

  return (
    <Card className="border border-line">
      <CardHeader>
        <CardTitle className="text-white">Contenido</CardTitle>
        <CardDescription>Enunciado e instrucciones</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Pregunta *</Label>
          <Textarea
            rows={3}
            value={formData.content?.question || ''}
            onChange={e => updateContent('question', e.target.value)}
            className={baseInputClass}
            placeholder="Escribe la pregunta aquí..."
          />
        </div>

        <div className="space-y-2">
          <Label>Instrucciones (opcional)</Label>
          <Textarea
            rows={2}
            value={formData.content?.instructions || ''}
            onChange={e => updateContent('instructions', e.target.value)}
            className={baseInputClass}
            placeholder="Instrucciones adicionales para el estudiante..."
          />
        </div>

        {/* Contexto opcional */}
        <div className="space-y-2">
          <Label>Contexto (opcional)</Label>
          <Textarea
            rows={2}
            value={formData.content?.context || ''}
            onChange={e => updateContent('context', e.target.value)}
            className={baseInputClass}
            placeholder="Contexto o información adicional..."
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default QuestionContent;
