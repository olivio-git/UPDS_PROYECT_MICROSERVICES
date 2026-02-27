import React from 'react';
import { Badge } from '@/components/atoms/badge';
import { Card, CardContent } from '@/components/atoms/card';
import { Progress } from '@/components/atoms/progress';
import {
  Clock,
  CheckCircle,
  Circle,
  Timer,
  BookOpen,
  PenTool,
  Headphones,
  Mic,
  Languages,
  FileText,
  AlertCircle,
  Play
} from 'lucide-react';

interface SectionStat {
  id: string;
  name: string;
  competency: string;
  answered: number;
  total: number;
  progress: number;
}

interface SectionNavigatorProps {
  sections: SectionStat[];
  currentSectionIndex: number;
  onSectionChange: (sectionIndex: number) => void;
  className?: string;
}

// Icon mapping for each competency
const competencyIcons: { [key: string]: React.ComponentType<{ className?: string }> } = {
  reading: BookOpen,
  writing: PenTool,
  listening: Headphones,
  speaking: Mic,
  grammar: Languages,
  vocabulary: FileText,
  general: Play
};

// Color schemes for each competency
const competencyColors: { [key: string]: string } = {
  reading: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  writing: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  listening: 'bg-green-500/20 text-green-300 border-green-500/30',
  speaking: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  grammar: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
  vocabulary: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
  general: 'bg-gray-500/20 text-gray-300 border-gray-500/30'
};

export const SectionNavigator: React.FC<SectionNavigatorProps> = ({
  sections,
  currentSectionIndex,
  onSectionChange,
  className = ''
}) => {
  return (
    <Card className={`bg-box backdrop-blur-sm border border-line ${className}`}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <BookOpen className="h-5 w-5 text-blue-400" />
          <h3 className="text-white font-semibold">Secciones del Examen</h3>
        </div>

        <div className="space-y-3 md:space-y-3 lg:space-y-3 xl:space-y-3">
          <div className="flex md:flex-col gap-3 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0">
            {sections.map((section, index) => {
              const Icon = competencyIcons[section.competency] || Play;
              const colorClass = competencyColors[section.competency] || competencyColors.general;
              const isActive = index === currentSectionIndex;
              const isCompleted = section.answered === section.total;
              const isStarted = section.answered > 0;

              return (
                <div
                  key={section.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-all duration-200 flex-shrink-0 min-w-[240px] md:min-w-0 md:w-full ${
                    isActive
                      ? 'bg-blue-500/20 border-blue-500/50 shadow-lg'
                      : 'bg-slate-800/50 border-slate-700 hover:bg-slate-700/50 hover:border-slate-600'
                  }`}
                  onClick={() => onSectionChange(index)}
                >
                <div className="flex flex-col gap-2 mb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <Icon className={`h-4 w-4 flex-shrink-0 ${isActive ? 'text-blue-400' : 'text-gray-400'}`} />
                      <span className={`font-medium truncate ${isActive ? 'text-white' : 'text-gray-300'}`} title={section.name}>
                        {section.name}
                      </span>
                    </div>

                    {isCompleted ? (
                      <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                    ) : isStarted ? (
                      <Timer className="h-4 w-4 text-yellow-400 flex-shrink-0" />
                    ) : (
                      <Circle className={`h-4 w-4 flex-shrink-0 ${
                        isActive ? 'text-blue-400' : 'text-gray-500'
                      }`} />
                    )}
                  </div>

                  <div className="flex justify-center">
                    <Badge className={`${colorClass} text-xs px-2 py-1`}>
                      {section.competency}
                    </Badge>
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className={`${isActive ? 'text-gray-200' : 'text-gray-400'}`}>
                    {section.answered} / {section.total} preguntas
                  </span>
                  <span className={`${isActive ? 'text-gray-200' : 'text-gray-400'}`}>
                    {Math.round(section.progress * 100)}%
                  </span>
                </div>

                <Progress
                  value={section.progress * 100}
                  className="mt-2 h-2"
                />
              </div>
            );
          })}
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-700">
          <div className="flex items-center justify-between text-sm text-gray-400">
            <span>Progreso Total</span>
            <span>{sections.reduce((sum, s) => sum + s.answered, 0)} / {sections.reduce((sum, s) => sum + s.total, 0)} preguntas</span>
          </div>
          <Progress
            value={sections.length > 0 ? (sections.reduce((sum, s) => sum + s.answered, 0) / sections.reduce((sum, s) => sum + s.total, 0)) * 100 : 0}
            className="mt-1 h-2"
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default SectionNavigator;