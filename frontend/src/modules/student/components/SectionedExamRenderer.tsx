import { Button } from '@/components/atoms/button';
import { Card, CardContent } from '@/components/atoms/card';
import type { Question } from '@/modules/exams/types';
import { AlertTriangle, Loader2, Save } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import type {
  SectionProgress
} from '../types/sectionedExam';
import {
  groupQuestionsIntoSections,
  initializeSectionProgress
} from '../types/sectionedExam';
import SectionNavigator from './SectionNavigator';
import SectionedQuestionRenderer from './SectionedQuestionRenderer';

interface SectionedExamRendererProps {
  // Data
  questions: Question[];
  examId?: string;
  sessionId?: string;
  timeRemaining?: number | null;
  
  // Callbacks
  onAnswerChange: (questionId: string, answer: any) => void;
  onSave?: () => Promise<void>;
  onFinish?: () => Promise<void>;
  
  // State
  answers: { [questionId: string]: any };
  loading?: boolean;
  disabled?: boolean;
  autoSaveStatus?: 'idle' | 'saving' | 'saved' | 'error';
  
  // Configuration
  showSectionOverview?: boolean;
  allowSectionJumping?: boolean;
  customSectionConfig?: any;
}

const SectionedExamRenderer: React.FC<SectionedExamRendererProps> = ({
  questions,
  examId,
  sessionId,
  timeRemaining,
  onAnswerChange,
  onSave,
  onFinish,
  answers,
  loading = false,
  disabled = false,
  autoSaveStatus = 'idle',
  showSectionOverview = true,
  allowSectionJumping = true,
  customSectionConfig
}) => {
  // Group questions into sections
  const sections = React.useMemo(() => {
    if (!questions.length) return [];
    return groupQuestionsIntoSections(questions, customSectionConfig);
  }, [questions, customSectionConfig]);

  // Initialize state
  const [currentSectionId, setCurrentSectionId] = useState<string>('');
  const [sectionProgress, setSectionProgress] = useState<{ [sectionId: string]: SectionProgress }>({});
  const [sectionTimeRemaining, setSectionTimeRemaining] = useState<{ [sectionId: string]: number }>({});

  // Initialize progress when sections change
  useEffect(() => {
    if (sections.length > 0) {
      // Set first section as current if none selected
      if (!currentSectionId || !sections.find(s => s.id === currentSectionId)) {
        setCurrentSectionId(sections[0].id);
      }
      
      // Initialize progress for all sections
      setSectionProgress(prev => {
        const newProgress = initializeSectionProgress(sections);
        
        // Merge with existing progress, updating counts if questions changed
        const mergedProgress: { [sectionId: string]: SectionProgress } = {};
        sections.forEach(section => {
          const existingProgress = prev[section.id];
          mergedProgress[section.id] = {
            sectionId: section.id,
            completed: existingProgress?.completed || 0,
            total: section.questionCount,
            timeSpent: existingProgress?.timeSpent || 0,
            currentQuestionIndex: existingProgress?.currentQuestionIndex || 0,
            answers: existingProgress?.answers || {}
          };
        });
        
        return mergedProgress;
      });

      // Initialize section timing (if needed)
      setSectionTimeRemaining(prev => {
        const newTiming: { [sectionId: string]: number } = {};
        sections.forEach(section => {
          newTiming[section.id] = prev[section.id] || (section.duration * 60); // Convert minutes to seconds
        });
        return newTiming;
      });
    }
  }, [sections, currentSectionId]);

  // Calculate progress based on answers
  useEffect(() => {
    setSectionProgress(prev => {
      const updated = { ...prev };
      
      sections.forEach(section => {
        let completed = 0;
        section.questions.forEach(question => {
          const questionId = question._id || question.id;
          if (answers[questionId] && (
            answers[questionId].text ||
            answers[questionId].selectedOptions?.length ||
            answers[questionId].answer !== undefined ||
            answers[questionId].file ||
            answers[questionId].audioBlob
          )) {
            completed++;
          }
        });
        
        if (updated[section.id]) {
          updated[section.id].completed = completed;
          updated[section.id].answers = { ...answers };
        }
      });
      
      return updated;
    });
  }, [answers, sections]);

  // Get current section
  const currentSection = sections.find(s => s.id === currentSectionId);
  const currentSectionProgress = sectionProgress[currentSectionId];

  // Handle section change
  const handleSectionChange = useCallback((sectionId: string) => {
    if (!allowSectionJumping && disabled) {
      toast.error('No puedes cambiar de sección en este momento');
      return;
    }
    setCurrentSectionId(sectionId);
  }, [allowSectionJumping, disabled]);

  // Handle question navigation within section
  const handleQuestionNavigation = useCallback((direction: 'prev' | 'next') => {
    if (!currentSection || !currentSectionProgress) return;

    const currentIndex = currentSectionProgress.currentQuestionIndex;
    let newIndex = currentIndex;

    if (direction === 'prev' && currentIndex > 0) {
      newIndex = currentIndex - 1;
    } else if (direction === 'next' && currentIndex < currentSection.questions.length - 1) {
      newIndex = currentIndex + 1;
    } else if (direction === 'next' && currentIndex === currentSection.questions.length - 1) {
      // Try to move to next section
      const currentSectionIndex = sections.findIndex(s => s.id === currentSectionId);
      if (currentSectionIndex < sections.length - 1) {
        const nextSection = sections[currentSectionIndex + 1];
        setCurrentSectionId(nextSection.id);
        return; // Let useEffect handle the navigation
      }
    }

    if (newIndex !== currentIndex) {
      setSectionProgress(prev => ({
        ...prev,
        [currentSectionId]: {
          ...prev[currentSectionId],
          currentQuestionIndex: newIndex
        }
      }));
    }
  }, [currentSection, currentSectionProgress, sections, currentSectionId]);

  // Handle manual save
  const handleManualSave = useCallback(async () => {
    if (onSave) {
      try {
        await onSave();
        toast.success('Progreso guardado correctamente');
      } catch (error) {
        toast.error('Error al guardar el progreso');
      }
    }
  }, [onSave]);

  // Handle exam finish
  const handleFinishExam = useCallback(async () => {
    if (onFinish) {
      try {
        await onFinish();
        toast.success('Examen enviado correctamente');
      } catch (error) {
        toast.error('Error al enviar el examen');
      }
    }
  }, [onFinish]);

  // Auto-save status component
  const AutoSaveIndicator = () => {
    const getStatusConfig = () => {
      switch (autoSaveStatus) {
        case 'saving':
          return { 
            text: 'Guardando...', 
            color: 'text-blue-500', 
            bgColor: 'bg-blue-500/10', 
            icon: <Loader2 className="w-3 h-3 animate-spin" /> 
          };
        case 'saved':
          return { 
            text: 'Guardado', 
            color: 'text-green-500', 
            bgColor: 'bg-green-500/10', 
            icon: <Save className="w-3 h-3" /> 
          };
        case 'error':
          return { 
            text: 'Error al guardar', 
            color: 'text-red-500', 
            bgColor: 'bg-red-500/10', 
            icon: <AlertTriangle className="w-3 h-3" /> 
          };
        default:
          return null;
      }
    };

    const config = getStatusConfig();
    if (!config) return null;

    return (
      <div className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${config.color} ${config.bgColor}`}>
        {config.icon}
        {config.text}
      </div>
    );
  };

  // Loading state
  if (loading) {
    return (
      <Card className="bg-gray-800/20 border-gray-700/30">
        <CardContent className="text-center py-12">
          <Loader2 className="animate-spin mx-auto mb-4" />
          <p className="text-gray-300">Cargando examen...</p>
        </CardContent>
      </Card>
    );
  }

  // Empty state
  if (!sections.length) {
    return (
      <Card className="bg-gray-800/20 border-gray-700/30">
        <CardContent className="text-center py-12">
          <AlertTriangle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-300">No hay preguntas disponibles para este examen</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Action Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold text-white">Examen por Secciones</h2>
          <AutoSaveIndicator />
        </div>
        
        <div className="flex items-center gap-3">
          {onSave && (
            <Button
              onClick={handleManualSave}
              disabled={autoSaveStatus === 'saving' || disabled}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              {autoSaveStatus === 'saving' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Guardar
            </Button>
          )}
          
          {onFinish && (
            <Button
              onClick={handleFinishExam}
              disabled={loading || disabled}
              variant="destructive"
              size="sm"
              className="gap-2 text-white min-w-[140px]"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                'Finalizar Examen'
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Section Navigator */}
      {showSectionOverview && (
        <SectionNavigator
          sections={sections}
          currentSection={currentSectionId}
          progress={sectionProgress}
          onSectionChange={handleSectionChange}
          timeRemaining={timeRemaining}
          disabled={disabled}
        />
      )}

      {/* Current Section Question Renderer */}
      {currentSection && currentSectionProgress && (
        <SectionedQuestionRenderer
          section={currentSection}
          progress={currentSectionProgress}
          answers={answers}
          onAnswerChange={onAnswerChange}
          onNavigateQuestion={handleQuestionNavigation}
          sectionTimeRemaining={sectionTimeRemaining[currentSectionId]}
          disabled={disabled}
        />
      )}
    </div>
  );
};

export default SectionedExamRenderer;