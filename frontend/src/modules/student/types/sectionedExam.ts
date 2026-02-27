// Types for sectioned exam navigation

import type { Question, Competency } from '@/modules/exams/types';

export interface QuestionSection {
  id: string;
  section: string;
  competency: Competency;
  duration: number; // in minutes
  questionCount: number;
  weight: number; // percentage weight in final score
  questions: Question[];
  order: number;
  instructions?: string;
  estimatedTime?: number; // in minutes
}

export interface SectionProgress {
  sectionId: string;
  completed: number;
  total: number;
  timeSpent: number; // in seconds
  currentQuestionIndex: number;
  answers: { [questionId: string]: any };
}

export interface SectionNavigatorProps {
  sections: QuestionSection[];
  currentSection: string;
  progress: { [sectionId: string]: SectionProgress };
  onSectionChange: (sectionId: string) => void;
  timeRemaining?: number | null; // in seconds, null if unlimited
  showScores?: boolean;
  disabled?: boolean;
}

export interface SectionedExamData {
  examId: string;
  sessionId: string;
  sections: QuestionSection[];
  totalDuration: number; // in minutes
  totalQuestions: number;
  totalWeight: number; // should be 100
  currentSection: string;
  progress: { [sectionId: string]: SectionProgress };
  timeRemaining?: number | null;
}

// For transforming flat questions array to sectioned structure
export interface SectionConfig {
  competency: Competency;
  duration: number;
  weight: number;
  estimatedTime?: number;
  instructions?: string;
}

export const DEFAULT_SECTION_CONFIG: { [key in Competency]: SectionConfig } = {
  reading: {
    competency: 'reading',
    duration: 30,
    weight: 25,
    estimatedTime: 25,
    instructions: 'Lee cuidadosamente cada texto y responde las preguntas correspondientes.'
  },
  writing: {
    competency: 'writing',
    duration: 45,
    weight: 25,
    estimatedTime: 40,
    instructions: 'Desarrolla tus respuestas de manera clara y coherente.'
  },
  listening: {
    competency: 'listening',
    duration: 25,
    weight: 25,
    estimatedTime: 20,
    instructions: 'Escucha atentamente cada audio antes de responder. Puedes reproducir cada audio hasta 2 veces.'
  },
  speaking: {
    competency: 'speaking',
    duration: 20,
    weight: 25,
    estimatedTime: 15,
    instructions: 'Graba tu respuesta de forma clara. Puedes volver a grabar si es necesario.'
  },
  grammar: {
    competency: 'grammar',
    duration: 20,
    weight: 15,
    estimatedTime: 18,
    instructions: 'Completa o selecciona las opciones correctas según las reglas gramaticales.'
  },
  vocabulary: {
    competency: 'vocabulary',
    duration: 15,
    weight: 10,
    estimatedTime: 12,
    instructions: 'Selecciona o completa con el vocabulario más apropiado.'
  }
};

// Utility function to group questions by competency into sections
export function groupQuestionsIntoSections(
  questions: Question[],
  customConfigs?: Partial<{ [key in Competency]: SectionConfig }>
): QuestionSection[] {
  const configs = { ...DEFAULT_SECTION_CONFIG, ...customConfigs };
  const questionsByCompetency = questions.reduce((acc, question) => {
    const competency = question.competency;
    if (!acc[competency]) {
      acc[competency] = [];
    }
    acc[competency].push(question);
    return acc;
  }, {} as { [key in Competency]: Question[] });

  const sections: QuestionSection[] = [];
  let order = 1;

  Object.entries(questionsByCompetency).forEach(([competency, sectionQuestions]) => {
    const config = configs[competency as Competency];
    if (sectionQuestions.length > 0) {
      sections.push({
        id: competency,
        section: competency.charAt(0).toUpperCase() + competency.slice(1),
        competency: competency as Competency,
        duration: config.duration,
        questionCount: sectionQuestions.length,
        weight: config.weight,
        questions: sectionQuestions,
        order,
        instructions: config.instructions,
        estimatedTime: config.estimatedTime
      });
      order++;
    }
  });

  // Sort by the order they should appear
  const competencyOrder: Competency[] = ['listening', 'reading', 'grammar', 'vocabulary', 'writing', 'speaking'];
  sections.sort((a, b) => {
    const aIndex = competencyOrder.indexOf(a.competency);
    const bIndex = competencyOrder.indexOf(b.competency);
    return aIndex - bIndex;
  });

  // Update order after sorting
  sections.forEach((section, index) => {
    section.order = index + 1;
  });

  return sections;
}

// Utility function to initialize progress for all sections
export function initializeSectionProgress(sections: QuestionSection[]): { [sectionId: string]: SectionProgress } {
  return sections.reduce((acc, section) => {
    acc[section.id] = {
      sectionId: section.id,
      completed: 0,
      total: section.questionCount,
      timeSpent: 0,
      currentQuestionIndex: 0,
      answers: {}
    };
    return acc;
  }, {} as { [sectionId: string]: SectionProgress });
}

// Utility function to calculate completion percentage for a section
export function calculateSectionCompletion(progress: SectionProgress): number {
  if (progress.total === 0) return 100;
  return Math.round((progress.completed / progress.total) * 100);
}

// Utility function to get human-readable section name
export function getSectionDisplayName(competency: Competency): string {
  const names: { [key in Competency]: string } = {
    reading: 'Comprensión Lectora',
    writing: 'Expresión Escrita',
    listening: 'Comprensión Auditiva',
    speaking: 'Expresión Oral',
    grammar: 'Gramática',
    vocabulary: 'Vocabulario'
  };
  return names[competency];
}