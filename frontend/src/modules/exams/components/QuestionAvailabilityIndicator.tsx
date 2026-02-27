import React from 'react';
import { AlertTriangle, CheckCircle, Info } from 'lucide-react';

interface QuestionAvailabilityData {
  available: number;
  needed: number;
  isAvailable: boolean;
  remaining: number;
  maxAllowed: number;
}

interface QuestionAvailabilityIndicatorProps {
  competency: string;
  level: string;
  neededCount: number;
  availability: Record<string, QuestionAvailabilityData>;
  loading?: boolean;
}

const QuestionAvailabilityIndicator: React.FC<QuestionAvailabilityIndicatorProps> = ({
  competency,
  level,
  neededCount,
  availability,
  loading = false
}) => {
  const key = `${competency}-${level}`;
  const data = availability[key];

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
        <div className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin" />
        <span>Verificando disponibilidad...</span>
      </div>
    );
  }

  if (!data || !competency || !level || neededCount <= 0) {
    return null;
  }

  const getCompetencyDisplayName = (comp: string) => {
    const names: Record<string, string> = {
      reading: 'Comprensión Lectora',
      writing: 'Expresión Escrita',
      listening: 'Comprensión Auditiva',
      speaking: 'Expresión Oral',
      grammar: 'Gramática',
      vocabulary: 'Vocabulario',
    };
    return names[comp] || comp;
  };

  if (data.available === 0) {
    return (
      <div className="flex items-center gap-2 text-xs text-red-400 mt-1">
        <AlertTriangle className="w-3 h-3" />
        <span>No hay preguntas disponibles para {getCompetencyDisplayName(competency)} nivel {level}</span>
      </div>
    );
  }

  if (!data.isAvailable) {
    return (
      <div className="flex items-center gap-2 text-xs text-orange-400 mt-1">
        <AlertTriangle className="w-3 h-3" />
        <span>
          Solo {data.available} pregunta{data.available !== 1 ? 's' : ''} disponible{data.available !== 1 ? 's' : ''}
          (máximo permitido: {data.maxAllowed})
        </span>
      </div>
    );
  }

  if (data.remaining < 5 && data.remaining >= 0) {
    return (
      <div className="flex items-center gap-2 text-xs text-yellow-400 mt-1">
        <Info className="w-3 h-3" />
        <span>
          ✓ {data.available} disponibles, quedarían {data.remaining} restantes
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-xs text-green-400 mt-1">
      <CheckCircle className="w-3 h-3" />
      <span>✓ {data.available} preguntas disponibles</span>
    </div>
  );
};

export default QuestionAvailabilityIndicator;