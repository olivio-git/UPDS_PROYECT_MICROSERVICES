import { Button } from '@/components/atoms/button';
import { Card, CardContent } from '@/components/atoms/card';
import type { Question } from '@/modules/exams/types';
import { AlertTriangle, CheckCircle2, Loader2, PanelLeftClose, PanelLeftOpen, Save } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
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
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
            answers[questionId].audioBlob ||
            answers[questionId].audioUrl
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
  const currentSectionIndex = sections.findIndex(s => s.id === currentSectionId);

  // Compute navigator sections with per-question states (no intermediate state lag)
  const navigatorSections = React.useMemo(() => {
    console.log('🗂️ [SectionedExamRenderer] sections:', sections.map(s => ({ id: s.id, competency: s.competency, qCount: s.questions?.length, questionCount: s.questionCount })));
    return sections.map(section => {
    const questionStates = section.questions.map(question => {
      const questionId = question._id || question.id;
      const ans = answers[questionId];
      return {
        id: questionId,
        answered: !!(ans && (
          ans.text ||
          ans.selectedOptions?.length ||
          ans.answer !== undefined ||
          ans.file ||
          ans.audioBlob ||
          ans.audioUrl
        )),
      };
    });
    const completed = questionStates.filter(q => q.answered).length;
    console.log(`  → section "${section.competency}": questionStates.length=${questionStates.length}, questionCount=${section.questionCount}`);
    return {
      id: section.id,
      name: section.section,
      competency: section.competency,
      answered: completed,
      total: section.questionCount,
      progress: section.questionCount > 0 ? completed / section.questionCount : 0,
      questionStates,
    };
  });
  }, [sections, answers]);

  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Jump directly to a specific question in a specific section
  const handleQuestionJump = useCallback((sectionIdx: number, questionIdx: number) => {
    const targetSection = sections[sectionIdx];
    if (!targetSection) return;
    setCurrentSectionId(targetSection.id);
    setSectionProgress(prev => ({
      ...prev,
      [targetSection.id]: { ...prev[targetSection.id], currentQuestionIndex: questionIdx },
    }));
  }, [sections]);

  // Auto-save on each answer — debounced 1.5s after last change
  const handleAnswerChange = useCallback((questionId: string, answer: any) => {
    onAnswerChange(questionId, answer);
    if (onSave) {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => { onSave(); }, 1500);
    }
  }, [onAnswerChange, onSave]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, []);

  // Navigate to specific question within current section
  const handleQuestionSelect = useCallback((questionIndex: number) => {
    setSectionProgress(prev => ({
      ...prev,
      [currentSectionId]: { ...prev[currentSectionId], currentQuestionIndex: questionIndex },
    }));
  }, [currentSectionId]);

  // Handle section change
  const handleSectionChange = useCallback((sectionIndex: number) => {
    if (!allowSectionJumping && disabled) {
      toast.error('No puedes cambiar de sección en este momento');
      return;
    }
    const section = sections[sectionIndex];
    if (section) setCurrentSectionId(section.id);
  }, [allowSectionJumping, disabled, sections]);

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
      <Card>
        <CardContent className="text-center py-12">
          <Loader2 className="animate-spin mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Cargando examen...</p>
        </CardContent>
      </Card>
    );
  }

  // Empty state
  if (!sections.length) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <AlertTriangle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No hay preguntas disponibles para este examen</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {/* Action bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Sidebar toggle */}
          {showSectionOverview && (
            <button
              onClick={() => setSidebarOpen(v => !v)}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              title={sidebarOpen ? 'Ocultar panel' : 'Mostrar panel'}
            >
              {sidebarOpen
                ? <PanelLeftClose className="w-4 h-4" />
                : <PanelLeftOpen className="w-4 h-4" />
              }
            </button>
          )}
          <AutoSaveIndicator />
          {autoSaveStatus === 'idle' && (
            <span className="text-xs text-muted-foreground hidden sm:inline">Guardado automático</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {onSave && !showFinishConfirm && (
            <Button
              onClick={async () => { if (onSave) await onSave(); }}
              disabled={autoSaveStatus === 'saving' || disabled}
              variant="outline"
              size="sm"
              className="gap-1.5"
            >
              {autoSaveStatus === 'saving'
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <Save className="h-3.5 w-3.5" />
              }
              Guardar avance
            </Button>
          )}
          {!showFinishConfirm ? (
            <Button
              onClick={() => setShowFinishConfirm(true)}
              disabled={loading || disabled}
              size="sm"
              className="bg-red-600 hover:bg-red-700 text-white gap-2 px-5"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Entregar Examen
            </Button>
          ) : (
            <div className="flex items-center gap-2 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg px-3 py-1.5">
              <span className="text-xs font-medium text-red-700 dark:text-red-400 hidden sm:inline">
                ¿Seguro?
              </span>
              <Button
                onClick={handleFinishExam}
                disabled={loading}
                size="sm"
                className="bg-red-600 hover:bg-red-700 text-white h-7 px-3 text-xs gap-1"
              >
                {loading
                  ? <Loader2 className="h-3 w-3 animate-spin" />
                  : <CheckCircle2 className="h-3 w-3" />
                }
                Sí, entregar
              </Button>
              <button
                onClick={() => setShowFinishConfirm(false)}
                className="text-xs text-muted-foreground hover:text-foreground underline"
              >
                Cancelar
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main layout: sidebar + question area */}
      <div className="flex flex-col md:flex-row gap-3 items-start">
        {/* Sidebar — section navigator with accordion questions */}
        {showSectionOverview && sidebarOpen && (
          <div className="w-full md:w-52 md:shrink-0 md:sticky md:top-4">
            <SectionNavigator
              sections={navigatorSections}
              currentSectionIndex={currentSectionIndex}
              currentQuestionIndex={currentSectionProgress?.currentQuestionIndex ?? 0}
              onSectionChange={handleSectionChange}
              onQuestionJump={handleQuestionJump}
            />
          </div>
        )}

        {/* Question area */}
        <div className="flex-1 min-w-0 space-y-3">
          {currentSection && currentSectionProgress && (
            <SectionedQuestionRenderer
              section={currentSection}
              progress={currentSectionProgress}
              answers={answers}
              onAnswerChange={handleAnswerChange}
              onNavigateQuestion={handleQuestionNavigation}
              onQuestionSelect={handleQuestionSelect}
              sectionTimeRemaining={sectionTimeRemaining[currentSectionId]}
              disabled={disabled}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default SectionedExamRenderer;