// Student components exports

// Existing components
export { default as NextExam } from './NextExam';
export { default as QuestionRenderer } from './QuestionRenderer';

// New sectioned exam components
export { default as SectionNavigator } from './SectionNavigator';
export { default as SectionedQuestionRenderer } from './SectionedQuestionRenderer';
export { default as SectionedExamRenderer } from './SectionedExamRenderer';
export { default as SectionedExamExample } from './SectionedExamExample';

// Export types
export type { 
  QuestionSection,
  SectionProgress,
  SectionNavigatorProps,
  SectionedExamData,
  SectionConfig
} from '../types/sectionedExam';

// Export utilities
export {
  groupQuestionsIntoSections,
  initializeSectionProgress,
  calculateSectionCompletion,
  getSectionDisplayName,
  DEFAULT_SECTION_CONFIG
} from '../types/sectionedExam';