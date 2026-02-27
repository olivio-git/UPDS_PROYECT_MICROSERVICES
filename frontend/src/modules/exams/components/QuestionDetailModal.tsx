import React from 'react';
import { X, Volume2, Image as ImageIcon, FileText, Clock, Hash } from 'lucide-react';
import type { Question } from './types';

interface QuestionDetailModalProps {
  question: Question;
  onClose: () => void;
  onEdit: () => void;
}

const QuestionDetailModal: React.FC<QuestionDetailModalProps> = ({ 
  question, 
  onClose, 
  onEdit 
}) => {
  const getQuestionTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      multiple_choice: "Opción Múltiple",
      true_false: "Verdadero/Falso", 
      open_text: "Texto Abierto",
      essay: "Ensayo",
      audio_response: "Respuesta de Audio",
      file_upload: "Subida de Archivo",
      listening: "Comprensión Auditiva",
      speaking: "Expresión Oral",
      reading: "Comprensión Lectora",
      writing: "Expresión Escrita"
    };
    return labels[type] || type;
  };

  const getDifficultyLabel = (difficulty: number) => {
    const labels = ['', 'Muy Fácil', 'Fácil', 'Medio', 'Difícil', 'Muy Difícil'];
    return labels[difficulty] || '';
  };

  const getDifficultyColor = (difficulty: number) => {
    if (difficulty <= 2) return "text-green-400 bg-green-900/20 border-green-800/30";
    if (difficulty <= 3) return "text-yellow-400 bg-yellow-900/20 border-yellow-800/30";
    if (difficulty <= 4) return "text-orange-400 bg-orange-900/20 border-orange-800/30";
    return "text-red-400 bg-red-900/20 border-red-800/30";
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-box border border-line rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-line">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-900/20 border border-blue-800/30">
              <FileText className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Detalles de la Pregunta</h2>
              <p className="text-sm text-gray-400">ID: {question._id}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onEdit}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Editar
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-dark-light rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          <div className="space-y-6">
            {/* Metadatos principales */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-dark-light border border-line rounded-lg p-4">
                <div className="text-sm text-gray-400 mb-1">Tipo</div>
                <div className="text-white font-medium">{getQuestionTypeLabel(question.type)}</div>
              </div>
              <div className="bg-dark-light border border-line rounded-lg p-4">
                <div className="text-sm text-gray-400 mb-1">Competencia</div>
                <div className="text-white font-medium capitalize">{question.competency}</div>
              </div>
              <div className="bg-dark-light border border-line rounded-lg p-4">
                <div className="text-sm text-gray-400 mb-1">Nivel</div>
                <span className="px-2 py-1 text-xs font-medium bg-blue-900/20 text-blue-400 border border-blue-800/30 rounded">
                  {question.level}
                </span>
              </div>
              <div className="bg-dark-light border border-line rounded-lg p-4">
                <div className="text-sm text-gray-400 mb-1">Dificultad</div>
                <span className={`px-2 py-1 text-xs font-medium border rounded ${getDifficultyColor(question.difficulty)}`}>
                  {getDifficultyLabel(question.difficulty)}
                </span>
              </div>
            </div>

            {/* Contenido de la pregunta */}
            <div className="bg-dark-light border border-line rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Contenido</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Pregunta</label>
                  <div className="bg-gray-800/50 border border-gray-600 rounded-lg p-4 text-gray-200">
                    {question.content.question}
                  </div>
                </div>

                {question.content.instructions && (
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Instrucciones</label>
                    <div className="bg-gray-800/50 border border-gray-600 rounded-lg p-4 text-gray-200">
                      {question.content.instructions}
                    </div>
                  </div>
                )}

                {question.content.context && (
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Contexto</label>
                    <div className="bg-gray-800/50 border border-gray-600 rounded-lg p-4 text-gray-200">
                      {question.content.context}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Opciones (si las tiene) */}
            {question.content.options && question.content.options.length > 0 && (
              <div className="bg-dark-light border border-line rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Opciones de Respuesta</h3>
                <div className="space-y-2">
                  {question.content.options.map((option, index) => (
                    <div 
                      key={option.id} 
                      className={`flex items-center gap-3 p-3 rounded-lg border ${
                        option.isCorrect 
                          ? 'bg-green-900/20 border-green-800/30 text-green-300' 
                          : 'bg-gray-800/50 border-gray-600 text-gray-200'
                      }`}
                    >
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold ${
                        option.isCorrect 
                          ? 'border-green-400 bg-green-400/20 text-green-400' 
                          : 'border-gray-500 text-gray-500'
                      }`}>
                        {String.fromCharCode(65 + index)}
                      </div>
                      <span className="flex-1">{option.text}</span>
                      {option.isCorrect && (
                        <span className="px-2 py-1 bg-green-600 text-white text-xs rounded">
                          Correcta
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Multimedia */}
            {question.content.mediaUrl && (
              <div className="bg-dark-light border border-line rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  {question.content.mediaType === 'audio' && <Volume2 className="w-5 h-5" />}
                  {question.content.mediaType === 'image' && <ImageIcon className="w-5 h-5" />}
                  Multimedia
                </h3>
                
                {question.content.mediaType === 'audio' && (
                  <div className="space-y-3">
                    <audio controls className="w-full">
                      <source src={question.content.mediaUrl} type="audio/mpeg" />
                      Tu navegador no soporta la reproducción de audio.
                    </audio>
                    <div className="text-sm text-gray-400">
                      Archivo de audio: {question.content.mediaUrl.split('/').pop()}
                    </div>
                  </div>
                )}

                {question.content.mediaType === 'image' && (
                  <div className="space-y-3">
                    <img 
                      src={question.content.mediaUrl} 
                      alt="Imagen de la pregunta" 
                      className="max-w-full h-auto rounded-lg border border-gray-600"
                    />
                    <div className="text-sm text-gray-400">
                      Imagen: {question.content.mediaUrl.split('/').pop()}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Metadatos adicionales */}
            <div className="bg-dark-light border border-line rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Información Adicional</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Puntos</label>
                  <div className="text-white">{question.points || 1}</div>
                </div>

                {question.metadata?.estimatedTime && (
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Tiempo estimado</label>
                    <div className="text-white flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {question.metadata.estimatedTime} minutos
                    </div>
                  </div>
                )}

                {question.metadata?.topic && (
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Tema</label>
                    <div className="text-white">{question.metadata.topic}</div>
                  </div>
                )}

                {question.metadata?.subtopic && (
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Subtema</label>
                    <div className="text-white">{question.metadata.subtopic}</div>
                  </div>
                )}
              </div>

              {/* Tags */}
              {question.metadata?.tags && question.metadata.tags.length > 0 && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-400 mb-2">Etiquetas</label>
                  <div className="flex flex-wrap gap-2">
                    {question.metadata.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="px-3 py-1 bg-gray-700 text-gray-300 rounded-full text-sm flex items-center gap-1"
                      >
                        <Hash className="w-3 h-3" />
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Estado */}
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-400 mb-1">Estado</label>
                <span className={`px-3 py-1 text-xs font-medium border rounded-lg ${
                  question.isActive
                    ? "bg-green-900/20 text-green-400 border-green-800/30"
                    : "bg-gray-900/20 text-gray-400 border-gray-800/30"
                }`}>
                  {question.isActive ? 'Activa' : 'Inactiva'}
                </span>
              </div>
            </div>

            {/* Estadísticas (si existen) */}
            {question.statistics && (
              <div className="bg-dark-light border border-line rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Estadísticas de Uso</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-400">{question.statistics.timesUsed || 0}</div>
                    <div className="text-sm text-gray-400">Veces usada</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-400">{question.statistics.averageScore || 0}%</div>
                    <div className="text-sm text-gray-400">Promedio de aciertos</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-yellow-400">{question.statistics.averageTime || 0}s</div>
                    <div className="text-sm text-gray-400">Tiempo promedio</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuestionDetailModal;
