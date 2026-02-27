import React from 'react';
import { Button } from '@/components/atoms/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/atoms/card';
import { Badge } from '@/components/atoms/badge';
import { Progress } from '@/components/atoms/progress';
import { 
  ChevronLeft, 
  ChevronRight, 
  Timer, 
  CheckCircle, 
  Circle,
  BookOpen, 
  PenTool, 
  Headphones, 
  Mic, 
  Languages, 
  FileText 
} from 'lucide-react';
import QuestionRenderer from './QuestionRenderer';
import type { 
  QuestionSection, 
  SectionProgress 
} from '../types/sectionedExam';
import { calculateSectionCompletion, getSectionDisplayName } from '../types/sectionedExam';
import type { Competency } from '@/modules/exams/types';

// Icon mapping for each competency
const competencyIcons: { [key in Competency]: React.ReactNode } = {
  reading: <BookOpen className="w-5 h-5" />,
  writing: <PenTool className="w-5 h-5" />,
  listening: <Headphones className="w-5 h-5" />,
  speaking: <Mic className="w-5 h-5" />,
  grammar: <Languages className="w-5 h-5" />,
  vocabulary: <FileText className="w-5 h-5" />
};

// Color schemes for each competency
const competencyColors: { [key in Competency]: string } = {
  reading: 'from-blue-500 to-cyan-500',
  writing: 'from-purple-500 to-pink-500', 
  listening: 'from-green-500 to-emerald-500',
  speaking: 'from-orange-500 to-amber-500',
  grammar: 'from-indigo-500 to-blue-500',
  vocabulary: 'from-teal-500 to-cyan-500'
};

const competencyBorderColors: { [key in Competency]: string } = {
  reading: 'border-blue-500/30',
  writing: 'border-purple-500/30', 
  listening: 'border-green-500/30',
  speaking: 'border-orange-500/30',
  grammar: 'border-indigo-500/30',
  vocabulary: 'border-teal-500/30'
};

const competencyBgColors: { [key in Competency]: string } = {
  reading: 'bg-blue-500/10',
  writing: 'bg-purple-500/10', 
  listening: 'bg-green-500/10',
  speaking: 'bg-orange-500/10',
  grammar: 'bg-indigo-500/10',
  vocabulary: 'bg-teal-500/10'
};

interface SectionedQuestionRendererProps {
  section: QuestionSection;
  progress: SectionProgress;
  answers: { [questionId: string]: any };
  onAnswerChange: (questionId: string, value: any) => void;
  onNavigateQuestion: (direction: 'prev' | 'next') => void;
  sectionTimeRemaining?: number | null; // time remaining for this specific section
  disabled?: boolean;
}

const SectionedQuestionRenderer: React.FC<SectionedQuestionRendererProps> = ({
  section,
  progress,
  answers,
  onAnswerChange,
  onNavigateQuestion,
  sectionTimeRemaining,
  disabled = false
}) => {
  const currentQuestion = section.questions[progress.currentQuestionIndex];
  const isFirstQuestion = progress.currentQuestionIndex === 0;
  const isLastQuestion = progress.currentQuestionIndex === section.questions.length - 1;
  const completion = calculateSectionCompletion(progress);

  // Format time utility
  const formatTime = (seconds: number | null): string => {
    if (!seconds || seconds < 0) return '--:--';
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  if (!currentQuestion) {
    return (
      <Card className="bg-gray-800/20 border-gray-700/30">
        <CardContent className="text-center py-8">
          <p className="text-gray-300">No hay preguntas disponibles en esta sección</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <Card className={`border-2 ${competencyBorderColors[section.competency]} ${competencyBgColors[section.competency]}`}>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`
                flex items-center justify-center w-12 h-12 rounded-xl
                bg-gradient-to-r ${competencyColors[section.competency]}
              `}>
                <div className="text-white">
                  {competencyIcons[section.competency]}
                </div>
              </div>
              <div>
                <CardTitle className="text-xl text-white mb-1">
                  {getSectionDisplayName(section.competency)}
                </CardTitle>
                <div className="flex items-center gap-4 text-sm text-gray-300">
                  <span>Sección {section.order}</span>
                  <span>•</span>
                  <span>{section.questionCount} preguntas</span>
                  <span>•</span>
                  <span>Peso: {section.weight}%</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {sectionTimeRemaining !== null && (
                <div className="flex items-center gap-2 px-3 py-2 bg-gray-700/50 rounded-lg">
                  <Timer className="w-4 h-4 text-blue-400" />
                  <span className="font-mono text-blue-400">
                    {formatTime(sectionTimeRemaining)}
                  </span>
                </div>
              )}
              <Badge variant="outline" className="text-white border-gray-600">
                {completion}% completado
              </Badge>
            </div>
          </div>

          {/* Section Progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-300">Progreso de la sección</span>
              <span className="text-white font-medium">
                {progress.completed}/{section.questionCount} preguntas
              </span>
            </div>
            <Progress value={completion} className="h-2" />
          </div>

          {/* Section Instructions */}
          {section.instructions && (
            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg mt-4">
              <p className="text-sm text-blue-200">
                <strong>Instrucciones:</strong> {section.instructions}
              </p>
            </div>
          )}
        </CardHeader>
      </Card>

      {/* Question Navigation Header */}
      <Card className="bg-gray-800/20 border-gray-700/30">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 bg-blue-600 text-white rounded-full text-sm font-semibold">
                {progress.currentQuestionIndex + 1}
              </div>
              <div>
                <p className="font-medium text-white">
                  Pregunta {progress.currentQuestionIndex + 1} de {section.questionCount}
                </p>
                <p className="text-sm text-gray-400">
                  {currentQuestion.competency} • {currentQuestion.type}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                onClick={() => onNavigateQuestion('prev')}
                disabled={isFirstQuestion || disabled}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <ChevronLeft className="h-4 w-4" />
                Anterior
              </Button>

              <Button
                onClick={() => onNavigateQuestion('next')}
                disabled={isLastQuestion || disabled}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                Siguiente
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Question Content */}
      <Card className="bg-gray-800/20 border-gray-700/30">
        <CardContent className="p-6">
          <QuestionRenderer
            question={currentQuestion}
            answer={answers[currentQuestion._id || currentQuestion.id]}
            onChange={onAnswerChange}
          />
        </CardContent>
      </Card>

      {/* Question Grid Navigator */}
      <Card className="bg-gray-800/20 border-gray-700/30">
        <CardHeader>
          <CardTitle className="text-lg text-white">Navegación de Preguntas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-2">
            {section.questions.map((question, index) => {
              const questionId = question._id || question.id;
              const hasAnswer = answers[questionId] && (
                answers[questionId].text ||
                answers[questionId].selectedOptions?.length ||
                answers[questionId].answer !== undefined ||
                answers[questionId].file ||
                answers[questionId].audioBlob
              );
              const isCurrent = index === progress.currentQuestionIndex;

              return (
                <Button
                  key={questionId}
                  onClick={() => {
                    // Navigate to this question within the section
                    // This would need to be handled by the parent component
                    console.log('Navigate to question', index);
                  }}
                  disabled={disabled}
                  variant={isCurrent ? "default" : hasAnswer ? "secondary" : "outline"}
                  size="sm"
                  className={`
                    relative w-10 h-10 p-0 text-sm font-medium
                    ${isCurrent ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-gray-900' : ''}
                    ${hasAnswer && !isCurrent ? 'bg-green-600/20 border-green-500/30 text-green-300 hover:bg-green-600/30' : ''}
                  `}
                >
                  {index + 1}
                  {hasAnswer && (
                    <div className="absolute -top-1 -right-1">
                      <CheckCircle className="w-3 h-3 text-green-400" />
                    </div>
                  )}
                </Button>
              );
            })}
          </div>
          
          <div className="flex items-center gap-4 mt-4 text-sm text-gray-400">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-600 rounded"></div>
              <span>Pregunta actual</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-600/50 border border-green-500/50 rounded"></div>
              <span>Respondida</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 border border-gray-600 rounded"></div>
              <span>Sin responder</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SectionedQuestionRenderer;