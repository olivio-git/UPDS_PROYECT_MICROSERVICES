import React from 'react';
import { Button } from '@/components/atoms/button';
import {
  ChevronLeft,
  ChevronRight,
  Timer,
  BookOpen,
  PenTool,
  Headphones,
  Mic,
} from 'lucide-react';
import QuestionRenderer from './QuestionRenderer';
import type {
  QuestionSection,
  SectionProgress
} from '../types/sectionedExam';
import { getSectionDisplayName } from '../types/sectionedExam';
import type { Competency } from '@/modules/exams/types';

// Icon mapping for each competency
const competencyIcons: { [key in Competency]: React.ReactNode } = {
  reading: <BookOpen className="w-5 h-5" />,
  writing: <PenTool className="w-5 h-5" />,
  listening: <Headphones className="w-5 h-5" />,
  speaking: <Mic className="w-5 h-5" />,
};

// Color schemes for each competency
const competencyColors: { [key in Competency]: string } = {
  reading: 'from-blue-500 to-cyan-500',
  writing: 'from-purple-500 to-pink-500', 
  listening: 'from-green-500 to-emerald-500',
  speaking: 'from-orange-500 to-amber-500',
};



interface SectionedQuestionRendererProps {
  section: QuestionSection;
  progress: SectionProgress;
  answers: { [questionId: string]: any };
  onAnswerChange: (questionId: string, value: any) => void;
  onNavigateQuestion: (direction: 'prev' | 'next') => void;
  onQuestionSelect?: (questionIndex: number) => void; // kept for compatibility
  sectionTimeRemaining?: number | null;
  disabled?: boolean;
}

const SectionedQuestionRenderer: React.FC<SectionedQuestionRendererProps> = ({
  section,
  progress,
  answers,
  onAnswerChange,
  onNavigateQuestion,
  onQuestionSelect,
  sectionTimeRemaining,
  disabled = false,
}) => {
  const currentQuestion = section.questions[progress.currentQuestionIndex];
  const isFirstQuestion = progress.currentQuestionIndex === 0;
  const isLastQuestion = progress.currentQuestionIndex === section.questions.length - 1;

  const formatTime = (seconds: number | null): string => {
    if (!seconds || seconds < 0) return '--:--';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (!currentQuestion) {
    return (
      <div className="bg-card border border-border rounded-xl p-8 text-center">
        <p className="text-muted-foreground">No hay preguntas disponibles en esta sección</p>
      </div>
    );
  }

  const Icon = competencyIcons[section.competency];

  return (
    <div className="space-y-3">
      {/* Slim context strip: section info + question nav */}
      <div className="flex items-center justify-between bg-card border border-border rounded-xl px-4 py-3">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${competencyColors[section.competency]} flex items-center justify-center shrink-0`}>
            <div className="text-white scale-75">{Icon}</div>
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground leading-none mb-0.5">
              {getSectionDisplayName(section.competency)}
            </p>
            <p className="text-[11px] text-muted-foreground">
              Pregunta {progress.currentQuestionIndex + 1} de {section.questionCount}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {sectionTimeRemaining !== null && sectionTimeRemaining !== undefined && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 rounded-lg">
              <Timer className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
              <span className="font-mono text-xs font-semibold text-blue-600 dark:text-blue-400">
                {formatTime(sectionTimeRemaining)}
              </span>
            </div>
          )}
          <Button
            onClick={() => onNavigateQuestion('prev')}
            disabled={isFirstQuestion || disabled}
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            onClick={() => onNavigateQuestion('next')}
            disabled={isLastQuestion || disabled}
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Instructions */}
      {section.instructions && (
        <div className="px-4 py-2.5 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-xl text-sm text-blue-700 dark:text-blue-300">
          <strong>Instrucciones:</strong> {section.instructions}
        </div>
      )}

      {/* Question content */}
      <div className="bg-card border border-border rounded-xl p-6">
        <QuestionRenderer
          question={currentQuestion}
          answer={answers[currentQuestion._id || currentQuestion.id]}
          onChange={onAnswerChange}
        />
      </div>

    </div>
  );
};

export default SectionedQuestionRenderer;