import React, { useState, useCallback } from 'react';
import { toast } from 'sonner';
import SectionedExamRenderer from './SectionedExamRenderer';
import type { Question, Competency } from '@/modules/exams/types';

// Example questions data
const createExampleQuestions = (): Question[] => [
  // Reading questions
  {
    _id: '1',
    type: 'multiple_choice',
    competency: 'reading',
    level: 'B1',
    difficulty: 3,
    content: {
      question: 'According to the text, what is the main advantage of renewable energy?',
      instructions: 'Read the passage and select the best answer.',
      options: [
        { id: 'a', text: 'It is cheaper than fossil fuels', isCorrect: false },
        { id: 'b', text: 'It produces no greenhouse gases', isCorrect: true },
        { id: 'c', text: 'It is more reliable', isCorrect: false },
        { id: 'd', text: 'It requires less maintenance', isCorrect: false }
      ],
      context: 'Renewable energy sources like solar and wind power are becoming increasingly popular because they produce no greenhouse gases and help combat climate change.'
    },
    points: 2,
    metadata: {
      topic: 'Environment',
      estimatedTime: 120
    },
    isActive: true
  },
  {
    _id: '2',
    type: 'true_false',
    competency: 'reading',
    level: 'B1',
    difficulty: 2,
    content: {
      question: 'Solar panels work only during sunny days.',
      instructions: 'Based on the text, determine if this statement is true or false.'
    },
    points: 1,
    metadata: {
      topic: 'Technology',
      estimatedTime: 60
    },
    isActive: true
  },
  
  // Listening questions
  {
    _id: '3',
    type: 'audio_response',
    competency: 'listening',
    level: 'B2',
    difficulty: 4,
    content: {
      question: 'Listen to the conversation and describe what happened.',
      instructions: 'You will hear a conversation between two people. After listening, record your summary.',
      expectedResponseType: 'paragraph',
      mediaUrl: '/audio/conversation1.mp3'
    },
    points: 5,
    metadata: {
      topic: 'Daily Life',
      estimatedTime: 300
    },
    isActive: true
  },
  {
    _id: '4',
    type: 'multiple_choice',
    competency: 'listening',
    level: 'B2',
    difficulty: 3,
    content: {
      question: 'What did the woman suggest?',
      instructions: 'Listen to the audio and choose the correct answer.',
      options: [
        { id: 'a', text: 'Going to the movies', isCorrect: false },
        { id: 'b', text: 'Having dinner at a restaurant', isCorrect: true },
        { id: 'c', text: 'Staying at home', isCorrect: false },
        { id: 'd', text: 'Going shopping', isCorrect: false }
      ],
      mediaUrl: '/audio/conversation2.mp3'
    },
    points: 3,
    metadata: {
      topic: 'Entertainment',
      estimatedTime: 180
    },
    isActive: true
  },

  // Writing questions
  {
    _id: '5',
    type: 'essay',
    competency: 'writing',
    level: 'B2',
    difficulty: 5,
    content: {
      question: 'Write an essay about the impact of social media on modern communication.',
      instructions: 'Write a 250-300 word essay discussing both positive and negative aspects of social media communication. Use specific examples to support your points.'
    },
    points: 15,
    metadata: {
      topic: 'Technology and Society',
      estimatedTime: 1800 // 30 minutes
    },
    isActive: true
  },
  {
    _id: '6',
    type: 'open_text',
    competency: 'writing',
    level: 'B1',
    difficulty: 3,
    content: {
      question: 'Write a short email to your friend inviting them to your birthday party.',
      instructions: 'Include the date, time, location, and any special instructions.'
    },
    points: 8,
    metadata: {
      topic: 'Personal Communication',
      estimatedTime: 600 // 10 minutes
    },
    isActive: true
  },

  // Speaking questions
  {
    _id: '7',
    type: 'audio_response',
    competency: 'speaking',
    level: 'B2',
    difficulty: 4,
    content: {
      question: 'Describe your ideal vacation destination.',
      instructions: 'Record a 2-minute description of where you would like to go on vacation and explain why.',
      expectedResponseType: 'paragraph'
    },
    points: 10,
    metadata: {
      topic: 'Travel',
      estimatedTime: 240
    },
    isActive: true
  },

  // Grammar questions
  {
    _id: '8',
    type: 'fill_blanks',
    competency: 'grammar',
    level: 'B1',
    difficulty: 3,
    content: {
      question: 'Complete the sentences with the correct verb forms.',
      template: 'If I ___ (have) more time, I ___ (study) another language.',
      instructions: 'Use the correct conditional forms of the verbs in parentheses.'
    },
    points: 4,
    metadata: {
      topic: 'Conditionals',
      estimatedTime: 180
    },
    isActive: true
  },
  {
    _id: '9',
    type: 'multiple_choice',
    competency: 'grammar',
    level: 'B1',
    difficulty: 2,
    content: {
      question: 'Choose the correct preposition: "She arrived ___ the airport at 6 PM."',
      options: [
        { id: 'a', text: 'in', isCorrect: false },
        { id: 'b', text: 'at', isCorrect: true },
        { id: 'c', text: 'on', isCorrect: false },
        { id: 'd', text: 'by', isCorrect: false }
      ]
    },
    points: 2,
    metadata: {
      topic: 'Prepositions',
      estimatedTime: 90
    },
    isActive: true
  },

  // Vocabulary questions
  {
    _id: '10',
    type: 'matching',
    competency: 'vocabulary',
    level: 'B1',
    difficulty: 3,
    content: {
      question: 'Match the words with their definitions.',
      instructions: 'Select the correct definition for each word.',
      items: [
        { id: 'word1', content: 'Procrastinate', matchingPair: 'To delay or postpone tasks' },
        { id: 'word2', content: 'Meticulous', matchingPair: 'Very careful and precise' },
        { id: 'word3', content: 'Ubiquitous', matchingPair: 'Present everywhere' },
        { id: 'word4', content: 'Eloquent', matchingPair: 'Fluent and persuasive in speaking' }
      ]
    },
    points: 6,
    metadata: {
      topic: 'Advanced Vocabulary',
      estimatedTime: 240
    },
    isActive: true
  }
];

interface SectionedExamExampleProps {
  examId?: string;
  sessionId?: string;
}

const SectionedExamExample: React.FC<SectionedExamExampleProps> = ({
  examId = 'example-exam-123',
  sessionId = 'example-session-456'
}) => {
  // Example state
  const [questions] = useState<Question[]>(createExampleQuestions());
  const [answers, setAnswers] = useState<{ [questionId: string]: any }>({});
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [timeRemaining, setTimeRemaining] = useState<number>(3600); // 1 hour in seconds

  // Simulate time countdown
  React.useEffect(() => {
    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 0) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Handle answer change
  const handleAnswerChange = useCallback((questionId: string, answer: any) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }));
    
    console.log('Answer updated:', { questionId, answer });
    toast.success('Respuesta guardada', {
      duration: 1000
    });
  }, []);

  // Handle save
  const handleSave = useCallback(async () => {
    setAutoSaveStatus('saving');
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      console.log('Saving answers:', answers);
      setAutoSaveStatus('saved');
      
      // Reset status after a moment
      setTimeout(() => setAutoSaveStatus('idle'), 2000);
    } catch (error) {
      console.error('Save error:', error);
      setAutoSaveStatus('error');
      throw error;
    }
  }, [answers]);

  // Handle finish
  const handleFinish = useCallback(async () => {
    try {
      // Save first
      await handleSave();
      
      // Simulate finishing exam
      await new Promise(resolve => setTimeout(resolve, 500));
      
      console.log('Exam finished with answers:', answers);
      toast.success('Examen enviado correctamente');
      
      // In real implementation, navigate to results
      // navigate('/student/results');
    } catch (error) {
      console.error('Finish error:', error);
      throw error;
    }
  }, [answers, handleSave]);

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">
          Examen por Secciones - Demostración
        </h1>
        <p className="text-gray-400">
          Este es un ejemplo de cómo funciona el nuevo sistema de navegación por secciones/competencias
        </p>
      </div>

      <SectionedExamRenderer
        questions={questions}
        examId={examId}
        sessionId={sessionId}
        timeRemaining={timeRemaining}
        answers={answers}
        onAnswerChange={handleAnswerChange}
        onSave={handleSave}
        onFinish={handleFinish}
        autoSaveStatus={autoSaveStatus}
        showSectionOverview={true}
        allowSectionJumping={true}
      />

      {/* Debug Panel (only in example) */}
      <div className="mt-8 p-4 bg-gray-900/50 rounded-lg border border-gray-700">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">Estado de depuración (solo ejemplo)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <h4 className="text-gray-400 font-medium mb-2">Preguntas cargadas:</h4>
            <p className="text-gray-500">{questions.length} preguntas en {new Set(questions.map(q => q.competency)).size} secciones</p>
          </div>
          <div>
            <h4 className="text-gray-400 font-medium mb-2">Respuestas actuales:</h4>
            <p className="text-gray-500">{Object.keys(answers).length} respuestas guardadas</p>
          </div>
          <div>
            <h4 className="text-gray-400 font-medium mb-2">Estado de autoguardado:</h4>
            <p className="text-gray-500">{autoSaveStatus}</p>
          </div>
          <div>
            <h4 className="text-gray-400 font-medium mb-2">Tiempo restante:</h4>
            <p className="text-gray-500">{Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SectionedExamExample;