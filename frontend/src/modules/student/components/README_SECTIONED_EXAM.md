# Sectioned Exam Navigation System

This implementation provides a comprehensive system for organizing and navigating exam questions by sections/competencies (Reading, Listening, Speaking, Writing, Grammar, Vocabulary).

## Components Overview

### 1. SectionNavigator
Main navigation component showing all sections with progress indicators, time estimates, and section switching functionality.

**Features:**
- Tab-based section navigation
- Progress indicators for each section
- Time remaining display
- Section overview panel
- Cosmic theme styling
- Competency-specific icons and colors

### 2. SectionedQuestionRenderer
Enhanced question renderer specifically designed for sectioned exams.

**Features:**
- Section header with competency information
- Question navigation within sections
- Progress tracking per section
- Question grid navigator
- Integration with existing QuestionRenderer

### 3. SectionedExamRenderer
Main component that orchestrates the entire sectioned exam experience.

**Features:**
- Automatic question grouping by competency
- State management for sections and progress
- Integration with existing exam hooks
- Auto-save functionality
- Section timing management

### 4. Enhanced QuestionRenderer
Updated version of the existing QuestionRenderer with additional props for better integration.

## Usage

### Basic Implementation

```tsx
import { SectionedExamRenderer } from '@/modules/student/components';

const MyExamComponent = () => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<{ [questionId: string]: any }>({});
  
  const handleAnswerChange = (questionId: string, answer: any) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
  };

  const handleSave = async () => {
    // Your save logic here
  };

  const handleFinish = async () => {
    // Your finish logic here
  };

  return (
    <SectionedExamRenderer
      questions={questions}
      answers={answers}
      onAnswerChange={handleAnswerChange}
      onSave={handleSave}
      onFinish={handleFinish}
      timeRemaining={3600} // 1 hour
      showSectionOverview={true}
      allowSectionJumping={true}
    />
  );
};
```

### Integration with ExamRunner

To integrate with the existing ExamRunner component:

```tsx
// In ExamRunner.tsx
import { SectionedExamRenderer } from '@/modules/student/components';

// Replace the existing QuestionRenderer with:
<SectionedExamRenderer
  questions={questions}
  answers={answers}
  onAnswerChange={updateAnswer}
  onSave={performManualSave}
  onFinish={endSession}
  timeRemaining={timeRemaining}
  autoSaveStatus={autoSaveStatus}
  disabled={!isActive}
/>
```

### Custom Section Configuration

```tsx
import { DEFAULT_SECTION_CONFIG } from '@/modules/student/components';

const customConfig = {
  ...DEFAULT_SECTION_CONFIG,
  reading: {
    ...DEFAULT_SECTION_CONFIG.reading,
    duration: 45, // 45 minutes instead of default 30
    weight: 30    // 30% instead of default 25%
  }
};

<SectionedExamRenderer
  questions={questions}
  customSectionConfig={customConfig}
  // ... other props
/>
```

## Data Structure

### Question Requirements

Questions must include the `competency` field to be properly grouped:

```typescript
interface Question {
  _id: string;
  competency: 'reading' | 'writing' | 'listening' | 'speaking' | 'grammar' | 'vocabulary';
  type: QuestionType;
  content: QuestionContent;
  // ... other fields
}
```

### Section Structure

Questions are automatically grouped into sections:

```typescript
interface QuestionSection {
  id: string;                    // Same as competency
  section: string;               // Display name
  competency: Competency;        // Competency type
  duration: number;              // Estimated duration in minutes
  questionCount: number;         // Number of questions in section
  weight: number;                // Percentage weight in final score
  questions: Question[];         // Questions in this section
  order: number;                 // Display order
  instructions?: string;         // Section-specific instructions
}
```

## Styling and Theming

The components use a cosmic theme with competency-specific colors:

- **Reading**: Blue to Cyan gradient
- **Writing**: Purple to Pink gradient  
- **Listening**: Green to Emerald gradient
- **Speaking**: Orange to Amber gradient
- **Grammar**: Indigo to Blue gradient
- **Vocabulary**: Teal to Cyan gradient

### Customizing Colors

To customize the color scheme, modify the `competencyColors`, `competencyBorderColors`, and `competencyBgColors` constants in the component files.

## State Management

### Progress Tracking

Each section maintains its own progress state:

```typescript
interface SectionProgress {
  sectionId: string;
  completed: number;           // Number of answered questions
  total: number;              // Total questions in section
  timeSpent: number;          // Time spent in seconds
  currentQuestionIndex: number; // Current question within section
  answers: { [questionId: string]: any }; // Local answer cache
}
```

### Navigation State

The system tracks:
- Current active section
- Progress for all sections  
- Time remaining (global and per-section)
- Answer states

## Accessibility Features

- Keyboard navigation support
- Screen reader friendly
- High contrast mode compatible
- Focus management
- ARIA labels and descriptions

## Performance Considerations

- Questions are grouped once and memoized
- Progress calculations are optimized
- Large question sets are handled efficiently
- Lazy loading friendly (sections can be loaded separately)

## Testing

Use the `SectionedExamExample` component to test the implementation:

```tsx
import { SectionedExamExample } from '@/modules/student/components';

// In your test route or component
<SectionedExamExample examId="test-exam" sessionId="test-session" />
```

## Migration from Existing Implementation

1. **Update imports**: Replace `QuestionRenderer` with `SectionedExamRenderer`
2. **Add competency field**: Ensure all questions have the `competency` field
3. **Update state management**: Use the new sectioned progress structure
4. **Test navigation**: Verify section switching and progress tracking work correctly

## Browser Compatibility

- Modern browsers (Chrome 70+, Firefox 70+, Safari 12+, Edge 79+)
- Progressive Web App compatible
- Mobile responsive design
- Touch navigation support

## Future Enhancements

Planned improvements:
- Section-specific timers
- Advanced progress analytics
- Section scoring and feedback
- Export/import of section configurations
- Real-time collaboration features