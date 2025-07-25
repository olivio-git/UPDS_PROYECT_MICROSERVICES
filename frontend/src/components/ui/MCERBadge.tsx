import { Badge } from '@/components/atoms/badge';

export type MCERLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

interface MCERBadgeProps {
  level: MCERLevel;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function MCERBadge({ level, className = '', size = 'md' }: MCERBadgeProps) {
  const levelConfig = {
    A1: {
      label: 'A1 - Acceso',
      description: 'Principiante',
      colorClass: 'bg-level-a1 text-slate-800',
      dotClass: 'bg-cyan-500'
    },
    A2: {
      label: 'A2 - Plataforma',
      description: 'Básico',
      colorClass: 'bg-level-a2 text-slate-800',
      dotClass: 'bg-cyan-600'
    },
    B1: {
      label: 'B1 - Umbral',
      description: 'Intermedio',
      colorClass: 'bg-level-b1 text-slate-800',
      dotClass: 'bg-green-500'
    },
    B2: {
      label: 'B2 - Avanzado',
      description: 'Intermedio Alto',
      colorClass: 'bg-level-b2 text-slate-800',
      dotClass: 'bg-green-600'
    },
    C1: {
      label: 'C1 - Dominio Operativo',
      description: 'Avanzado',
      colorClass: 'bg-level-c1 text-slate-800',
      dotClass: 'bg-yellow-500'
    },
    C2: {
      label: 'C2 - Maestría',
      description: 'Nativo',
      colorClass: 'bg-level-c2 text-slate-800',
      dotClass: 'bg-orange-500'
    }
  };

  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-2'
  };

  const config = levelConfig[level];

  return (
    <Badge 
      className={`
        ${config.colorClass} 
        ${sizeClasses[size]} 
        font-medium border-0 inline-flex items-center gap-1.5
        ${className}
      `}
      title={`${config.label} - ${config.description}`}
    >
      <div className={`w-2 h-2 rounded-full ${config.dotClass}`} />
      {level}
    </Badge>
  );
}

interface CompetencyIndicatorProps {
  competency: 'listening' | 'reading' | 'writing' | 'speaking';
  score?: number;
  level?: MCERLevel;
  className?: string;
}

export function CompetencyIndicator({ 
  competency, 
  score, 
  level, 
  className = '' 
}: CompetencyIndicatorProps) {
  const competencyConfig = {
    listening: {
      label: 'Comprensión Auditiva',
      icon: '🎧',
      colorClass: 'bg-listening text-slate-800',
      borderClass: 'border-purple-300'
    },
    reading: {
      label: 'Comprensión Lectora',
      icon: '📖',
      colorClass: 'bg-reading text-slate-800',
      borderClass: 'border-blue-300'
    },
    writing: {
      label: 'Expresión Escrita',
      icon: '✍️',
      colorClass: 'bg-writing text-slate-800',
      borderClass: 'border-green-300'
    },
    speaking: {
      label: 'Expresión Oral',
      icon: '🗣️',
      colorClass: 'bg-speaking text-slate-800',
      borderClass: 'border-orange-300'
    }
  };

  const config = competencyConfig[competency];

  return (
    <div className={`
      inline-flex items-center gap-2 px-3 py-2 rounded-lg border-2
      ${config.colorClass} ${config.borderClass}
      ${className}
    `}>
      <span className="text-lg">{config.icon}</span>
      <div className="flex flex-col">
        <span className="font-medium text-sm">{config.label}</span>
        <div className="flex items-center gap-2 text-xs">
          {score && <span>Puntaje: {score}%</span>}
          {level && <MCERBadge level={level} size="sm" />}
        </div>
      </div>
    </div>
  );
}
