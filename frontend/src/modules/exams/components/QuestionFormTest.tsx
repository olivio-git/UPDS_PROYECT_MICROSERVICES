import React from 'react';
import QuestionFormRefactored from '../QuestionFormRefactored';
import type { Question } from '../../types';

// Datos de ejemplo para testing
const sampleQuestion: Question = {
  _id: 'sample-id',
  type: 'multiple_choice',
  competency: 'reading',
  level: 'B1',
  difficulty: 3,
  content: {
    question: '¿Cuál es la forma correcta del presente simple para "he/she/it"?',
    instructions: 'Selecciona la opción correcta',
    options: [
      { id: '1', text: 'go', isCorrect: false },
      { id: '2', text: 'goes', isCorrect: true },
      { id: '3', text: 'going', isCorrect: false },
      { id: '4', text: 'went', isCorrect: false }
    ],
    correctAnswer: '2'
  },
  points: 2,
  metadata: {
    topic: 'Gramática',
    subtopic: 'Present Simple',
    tags: ['grammar', 'present', 'third-person'],
    estimatedTime: 2
  },
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

const QuestionFormTest: React.FC = () => {
  const [mode, setMode] = React.useState<'create' | 'edit'>('create');
  const [currentQuestion, setCurrentQuestion] = React.useState<Question | null>(null);

  const handleSaved = () => {
    console.log('Question saved successfully!');
    alert('¡Pregunta guardada exitosamente!');
  };

  const handleCancel = () => {
    console.log('Form cancelled');
    setCurrentQuestion(null);
  };

  const loadSampleQuestion = () => {
    setCurrentQuestion(sampleQuestion);
    setMode('edit');
  };

  const createNewQuestion = () => {
    setCurrentQuestion(null);
    setMode('create');
  };

  return (
    <div className="min-h-screen bg-gray-900 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-4">
            Test del Formulario de Preguntas Refactorizado
          </h1>
          
          <div className="flex gap-4 mb-6">
            <button
              onClick={createNewQuestion}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              Crear Nueva Pregunta
            </button>
            <button
              onClick={loadSampleQuestion}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
            >
              Editar Pregunta de Ejemplo
            </button>
          </div>

          <div className="text-sm text-gray-400 mb-4">
            Modo actual: <span className="text-blue-400 font-semibold">
              {mode === 'create' ? 'Crear nueva pregunta' : 'Editar pregunta existente'}
            </span>
          </div>
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-lg p-1">
          <QuestionFormRefactored
            question={currentQuestion}
            onSaved={handleSaved}
            onCancel={handleCancel}
          />
        </div>

        {/* Panel de información para desarrollo */}
        <div className="mt-8 p-4 bg-gray-800 border border-gray-700 rounded-lg">
          <h3 className="text-lg font-semibold text-white mb-3">Información de Desarrollo</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="text-blue-400 font-medium mb-2">Componentes Separados:</h4>
              <ul className="text-gray-300 space-y-1">
                <li>✅ QuestionMetadata - Tipo, competencia, nivel</li>
                <li>✅ QuestionContent - Pregunta e instrucciones</li>
                <li>✅ QuestionOptions - Opciones múltiples</li>
                <li>✅ QuestionSpecialTypes - Fill blanks, matching, etc.</li>
                <li>✅ QuestionMultimedia - Audio e imágenes</li>
                <li>✅ QuestionTags - Etiquetas y metadatos</li>
                <li>✅ QuestionActions - Botones de acción</li>
              </ul>
            </div>
            <div>
              <h4 className="text-green-400 font-medium mb-2">Mejoras Implementadas:</h4>
              <ul className="text-gray-300 space-y-1">
                <li>✅ Validación mejorada de archivos</li>
                <li>✅ Hook personalizado useQuestionForm</li>
                <li>✅ Manejo de errores más robusto</li>
                <li>✅ Limpieza automática de URLs</li>
                <li>✅ Debug y logging mejorados</li>
                <li>✅ Componentes reutilizables</li>
                <li>✅ Estado compartido optimizado</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Instrucciones de testing */}
        <div className="mt-4 p-4 bg-blue-900/20 border border-blue-700 rounded-lg">
          <h4 className="text-blue-400 font-medium mb-2">Instrucciones de Testing:</h4>
          <ol className="text-gray-300 space-y-1 text-sm ml-4">
            <li>1. Prueba crear una nueva pregunta desde cero</li>
            <li>2. Prueba editar la pregunta de ejemplo</li>
            <li>3. Cambia el tipo de pregunta y observa los campos</li>
            <li>4. Intenta subir archivos de audio e imagen</li>
            <li>5. Verifica la validación de campos requeridos</li>
            <li>6. Prueba las etiquetas sugeridas</li>
          </ol>
        </div>
      </div>
    </div>
  );
};

export default QuestionFormTest;
