import React from 'react';
import { useExamSession } from './hooks/useExamSession';

// Simple test component to verify sectioned exam integration
const TestSectionedIntegration: React.FC = () => {
  const {
    // Basic state
    isActive,
    questions,
    answers,
    loading,
    error,
    
    // Sectioned exam properties
    sections,
    sectionProgress,
    currentSectionId,
    hasSections,
    currentSection,
    
    // Actions
    startSession,
    updateAnswer,
    navigateToSection
  } = useExamSession({
    sessionType: 'individual',
    onSessionStart: () => console.log('✅ Session started successfully'),
    onSessionEnd: () => console.log('✅ Session ended successfully'),
  });

  const testSectionedData = {
    sessionId: 'test-session-123',
    sections: [
      {
        section: 'Reading Comprehension',
        competency: 'reading',
        duration: 30,
        questionCount: 5,
        weight: 25,
        questions: [
          {
            _id: 'q1',
            type: 'multiple_choice',
            competency: 'reading',
            level: 'B1',
            difficulty: 3,
            content: {
              question: '¿Cuál es la idea principal del texto?',
              options: [
                { id: 'a', text: 'Opción A' },
                { id: 'b', text: 'Opción B' },
                { id: 'c', text: 'Opción C' }
              ]
            },
            isActive: true
          }
        ]
      },
      {
        section: 'Listening Comprehension',
        competency: 'listening',
        duration: 25,
        questionCount: 4,
        weight: 25,
        questions: [
          {
            _id: 'q2',
            type: 'multiple_choice',
            competency: 'listening',
            level: 'B1',
            difficulty: 3,
            content: {
              question: '¿Qué dice el audio sobre...?',
              options: [
                { id: 'a', text: 'Audio Opción A' },
                { id: 'b', text: 'Audio Opción B' }
              ]
            },
            isActive: true
          }
        ]
      }
    ]
  };

  const handleTestSectionedExam = () => {
    console.log('🧪 Testing sectioned exam integration...');
    
    // Simulate backend session-started event with sections data
    if ((window as any).testSectionedExamSession) {
      (window as any).testSectionedExamSession(testSectionedData);
    } else {
      console.warn('⚠️ Test function not available. This would normally be triggered by a socket event.');
    }
  };

  const handleTestAnswer = (questionId: string) => {
    updateAnswer(questionId, { selectedOptions: ['a'] });
    console.log('📝 Answer updated for question:', questionId);
  };

  const handleTestSectionNavigation = (sectionId: string) => {
    navigateToSection(sectionId);
    console.log('🧭 Navigated to section:', sectionId);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="bg-gray-100 p-4 rounded-lg">
        <h2 className="text-xl font-bold mb-4">Sectioned Exam Integration Test</h2>
        
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <strong>Session Active:</strong> {isActive ? '✅ Yes' : '❌ No'}
            </div>
            <div>
              <strong>Has Sections:</strong> {hasSections ? '✅ Yes' : '❌ No'}
            </div>
            <div>
              <strong>Sections Count:</strong> {sections.length}
            </div>
            <div>
              <strong>Questions Count:</strong> {questions.length}
            </div>
            <div>
              <strong>Current Section:</strong> {currentSectionId || 'None'}
            </div>
            <div>
              <strong>Loading:</strong> {loading ? '🔄 Yes' : '✅ No'}
            </div>
          </div>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              <strong>Error:</strong> {error}
            </div>
          )}

          <div className="space-x-2">
            <button
              onClick={handleTestSectionedExam}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              🧪 Test Sectioned Data
            </button>
            
            <button
              onClick={() => startSession('test-session-123')}
              className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
              disabled={loading}
            >
              ▶️ Start Session
            </button>
          </div>
        </div>
      </div>

      {sections.length > 0 && (
        <div className="bg-white p-4 rounded-lg border">
          <h3 className="text-lg font-semibold mb-3">📋 Sections</h3>
          <div className="space-y-2">
            {sections.map((section, index) => (
              <div 
                key={section.id}
                className={`p-3 rounded border ${
                  currentSectionId === section.id ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
                }`}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <strong>{section.section}</strong> ({section.competency})
                    <div className="text-sm text-gray-600">
                      {section.questionCount} questions • {section.duration}min • {section.weight}%
                    </div>
                  </div>
                  <button
                    onClick={() => handleTestSectionNavigation(section.id)}
                    className="bg-gray-200 px-3 py-1 rounded hover:bg-gray-300"
                  >
                    Navigate →
                  </button>
                </div>
                
                {sectionProgress[section.id] && (
                  <div className="mt-2 text-sm">
                    Progress: {sectionProgress[section.id].completed}/{sectionProgress[section.id].total} completed
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {questions.length > 0 && (
        <div className="bg-white p-4 rounded-lg border">
          <h3 className="text-lg font-semibold mb-3">❓ Questions</h3>
          <div className="space-y-2">
            {questions.slice(0, 3).map((question, index) => (
              <div key={question._id} className="p-2 border rounded">
                <div><strong>Q{index + 1}:</strong> {question.content.question}</div>
                <div className="text-sm text-gray-600">
                  Type: {question.type} | Competency: {question.competency}
                </div>
                <button
                  onClick={() => handleTestAnswer(question._id)}
                  className="bg-yellow-500 text-white px-2 py-1 rounded text-sm hover:bg-yellow-600 mt-1"
                >
                  Test Answer
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {Object.keys(answers).length > 0 && (
        <div className="bg-white p-4 rounded-lg border">
          <h3 className="text-lg font-semibold mb-3">📝 Answers</h3>
          <pre className="bg-gray-100 p-2 rounded text-sm overflow-x-auto">
            {JSON.stringify(answers, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

export default TestSectionedIntegration;