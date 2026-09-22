import { create } from 'zustand';
import type { QuestionSection, SectionProgress } from '@/modules/student/types/sectionedExam';

interface ExamState {
  // Session data
  currentSessionId: string | null;
  isActive: boolean;
  
  // Questions and sections
  questions: any[];
  sections: QuestionSection[];
  hasSections: boolean;
  
  // Progress
  answers: Record<string, any>;
  sectionProgress: { [sectionId: string]: SectionProgress };
  currentSectionId: string | null;
  
  // Timing
  timeRemaining: number | null;

  // Settings
  browserLockdown: boolean;

  // Actions
  setSessionData: (data: {
    sessionId: string;
    sections?: QuestionSection[];
    questions?: any[];
    timeRemaining?: number;
    isActive?: boolean;
    sessionType?: 'individual' | 'group';
    browserLockdown?: boolean;
  }) => void;
  
  addTimeExtension: (seconds: number) => void;

  setAnswer: (questionId: string, answer: any) => void;
  
  updateSectionProgress: (sectionId: string, updates: Partial<SectionProgress>) => void;
  
  setCurrentSection: (sectionId: string) => void;
  
  clearSession: () => void;
}

export const useExamStore = create<ExamState>((set) => ({
  // Initial state
  currentSessionId: null,
  isActive: false,
  questions: [],
  sections: [],
  hasSections: false,
  answers: {},
  sectionProgress: {},
  currentSectionId: null,
  timeRemaining: null,
  browserLockdown: false,

  // Actions
  setSessionData: (data) => {
    console.log('📦 [ExamStore] Setting session data:', data);
    
    const hasSections = data.sections && data.sections.length > 0;
    const sections = data.sections || [];
    const questions = data.questions || sections.flatMap(s => s.questions) || [];
    
    set({
      currentSessionId: data.sessionId,
      isActive: data.isActive !== undefined ? data.isActive : true,
      sections,
      questions,
      hasSections,
      currentSectionId: sections.length > 0 ? sections[0].id : null,
      timeRemaining: data.timeRemaining || null,
      browserLockdown: data.browserLockdown ?? false,
    });
  },

  addTimeExtension: (seconds) => {
    set((state) => ({
      timeRemaining: state.timeRemaining !== null ? state.timeRemaining + seconds : null,
    }));
  },

  setAnswer: (questionId, answer) => {
    set((state) => ({
      answers: {
        ...state.answers,
        [questionId]: answer
      }
    }));
  },

  updateSectionProgress: (sectionId, updates) => {
    set((state) => ({
      sectionProgress: {
        ...state.sectionProgress,
        [sectionId]: {
          ...state.sectionProgress[sectionId],
          ...updates
        }
      }
    }));
  },

  setCurrentSection: (sectionId) => {
    set({ currentSectionId: sectionId });
  },

  clearSession: () => {
    console.log('🧹 [ExamStore] Clearing session data');
    set({
      currentSessionId: null,
      isActive: false,
      questions: [],
      sections: [],
      hasSections: false,
      answers: {},
      sectionProgress: {},
      currentSectionId: null,
      timeRemaining: null,
      browserLockdown: false,
    });
  }
}));