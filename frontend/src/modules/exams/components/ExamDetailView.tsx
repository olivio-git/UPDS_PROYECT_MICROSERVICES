import { Button } from '@/components/atoms/button';
import { ArrowLeft, Award, BookOpen, Clock, Edit, Settings, Target } from 'lucide-react';
import React from 'react';
import type { Exam } from '../types';

interface ExamDetailViewProps {
  exam: Exam;
  onBack: () => void;
  onEdit: () => void;
}

const ExamDetailView: React.FC<ExamDetailViewProps> = ({ exam, onBack, onEdit }) => {
  const getExamTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      placement: "Nivelación",
      progress: "Progreso", 
      final: "Final",
      practice: "Práctica"
    };
    return labels[type] || type;
  };

  const getExamTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      placement: "text-blue-400 bg-blue-900/20 border-blue-800/30",
      progress: "text-green-400 bg-green-900/20 border-green-800/30",
      final: "text-red-400 bg-red-900/20 border-red-800/30",
      practice: "text-yellow-400 bg-yellow-900/20 border-yellow-800/30"
    };
    return colors[type] || "text-muted-foreground bg-muted/50 border-border";
  };

  const getCompetencyLabel = (competency: string) => {
    const labels: Record<string, string> = {
      reading: "Comprensión Lectora",
      writing: "Expresión Escrita",
      listening: "Comprensión Auditiva",
      speaking: "Expresión Oral",
      grammar: "Gramática",
      vocabulary: "Vocabulario"
    };
    return labels[competency] || competency;
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4"> 
        <Button
            variant="outline"
            onClick={onBack}
            className="px-3 py-2 bg-dark-light border border-line rounded-lg text-foreground hover:bg-dark-light/80 flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver
          </Button>
          <div>
            <h2 className="text-xl font-semibold text-foreground">Detalles del examen</h2>
            <p className="text-sm text-muted-foreground">ID: {exam.name}</p>
          </div>
          </div>

        <Button
          onClick={onEdit}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center"
        >
          <Edit className="w-4 h-4 mr-2" />
          Editar Examen
        </Button>
      </div>

      {/* Información general */}
      <div className="bg-box border border-line rounded-xl p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-blue-400" />
          Información General
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">Tipo</label>
            <span className={`inline-flex px-3 py-1 text-sm font-medium border rounded-lg ${getExamTypeColor(exam.type)}`}>
              {getExamTypeLabel(exam.type)}
            </span>
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">Nivel Objetivo</label>
            <span className="inline-flex px-3 py-1 text-sm font-medium bg-purple-900/20 text-purple-400 border border-purple-800/30 rounded-lg">
              {exam.targetLevel}
            </span>
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">Estado</label>
            <div className="flex items-center gap-2">
              {exam.isTemplate && (
                <span className="inline-flex px-3 py-1 text-sm font-medium bg-orange-900/20 text-orange-400 border border-orange-800/30 rounded-lg">
                  Plantilla
                </span>
              )}
              <span className={`inline-flex px-3 py-1 text-sm font-medium border rounded-lg ${
                exam.isActive
                  ? "bg-green-900/20 text-green-400 border-green-800/30"
                  : "bg-muted/50 text-muted-foreground border-border"
              }`}>
                {exam.isActive ? "Activo" : "Inactivo"}
              </span>
            </div>
          </div>
                {/* 
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">Puntaje Mínimo</label>
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-yellow-400" />
              <span className="text-foreground font-medium">{exam.structure.passingScore}%</span>
            </div>
          </div>
              */}
        </div>

        {exam.description && (
          <div className="mt-6">
            <label className="block text-sm font-medium text-muted-foreground mb-2">Descripción</label>
            <p className="text-foreground/80 leading-relaxed">{exam.description}</p>
          </div>
        )}
      </div>

      {/* Estadísticas rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-box border border-line rounded-xl p-6 text-center">
          <div className="w-12 h-12 bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-3">
            <BookOpen className="w-6 h-6 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-foreground mb-1">
            {exam.structure.sections?.length || 0}
          </div>
          <div className="text-sm text-muted-foreground">Secciones</div>
        </div>

        <div className="bg-box border border-line rounded-xl p-6 text-center">
          <div className="w-12 h-12 bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-3">
            <Target className="w-6 h-6 text-green-400" />
          </div>
          <div className="text-2xl font-bold text-foreground mb-1">
            {exam.questionPool?.length || 0}
          </div>
          <div className="text-sm text-muted-foreground">Preguntas</div>
        </div>

        <div className="bg-box border border-line rounded-xl p-6 text-center">
          <div className="w-12 h-12 bg-purple-900/20 rounded-full flex items-center justify-center mx-auto mb-3">
            <Award className="w-6 h-6 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-foreground mb-1">
            {exam.structure.totalPoints || 0}
          </div>
          <div className="text-sm text-muted-foreground">Puntos Totales</div>
        </div>

        <div className="bg-box border border-line rounded-xl p-6 text-center">
          <div className="w-12 h-12 bg-yellow-900/20 rounded-full flex items-center justify-center mx-auto mb-3">
            <Clock className="w-6 h-6 text-yellow-400" />
          </div>
          <div className="text-2xl font-bold text-foreground mb-1">
            {formatDuration(exam.structure.totalDuration || 0)}
          </div>
          <div className="text-sm text-muted-foreground">Duración</div>
        </div>
      </div>

      {/* Secciones del examen */}
      <div className="bg-box border border-line rounded-xl p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Target className="w-5 h-5 text-green-400" />
          Secciones del Examen
        </h2>

        <div className="space-y-4">
          {exam.structure.sections?.map((section, index) => (
            <div key={section.id} className="bg-muted/50 rounded-lg p-4 border border-border">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-medium text-foreground">{section.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {getCompetencyLabel(section.competency)}
                  </p>
                </div>
                <span className="px-2 py-1 text-xs bg-blue-900/20 text-blue-400 border border-blue-800/30 rounded">
                  Sección {index + 1}
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Preguntas:</span>
                  <p className="text-foreground font-medium">{section.questionCount}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Puntos:</span>
                  <p className="text-foreground font-medium">{section.points}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Duración:</span>
                  <p className="text-foreground font-medium">{formatDuration(section.duration || 0)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Tipos:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {section.questionTypes?.map((type, idx) => (
                      <span key={idx} className="px-1.5 py-0.5 text-xs bg-muted text-foreground/80 rounded">
                        {type}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {section.instructions && (
                <div className="mt-3 pt-3 border-t border-border">
                  <span className="text-muted-foreground text-sm">Instrucciones:</span>
                  <p className="text-foreground/80 text-sm mt-1">{section.instructions}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Configuración */}
      <div className="bg-box border border-line rounded-xl p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Settings className="w-5 h-5 text-muted-foreground" />
          Configuración
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-foreground/80">Aleatorizar preguntas</span>
              <span className={`px-2 py-1 text-xs rounded ${
                exam.configuration.randomizeQuestions
                  ? "bg-green-900/20 text-green-400"
                  : "bg-muted/50 text-muted-foreground"
              }`}>
                {exam.configuration.randomizeQuestions ? "Sí" : "No"}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-foreground/80">Aleatorizar opciones</span>
              <span className={`px-2 py-1 text-xs rounded ${
                exam.configuration.randomizeOptions
                  ? "bg-green-900/20 text-green-400"
                  : "bg-muted/50 text-muted-foreground"
              }`}>
                {exam.configuration.randomizeOptions ? "Sí" : "No"}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-foreground/80">Mostrar resultados</span>
              <span className={`px-2 py-1 text-xs rounded ${
                exam.configuration.showResults
                  ? "bg-green-900/20 text-green-400"
                  : "bg-muted/50 text-muted-foreground"
              }`}>
                {exam.configuration.showResults ? "Sí" : "No"}
              </span>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-foreground/80">Permitir revisión</span>
              <span className={`px-2 py-1 text-xs rounded ${
                exam.configuration.allowReview
                  ? "bg-green-900/20 text-green-400"
                  : "bg-muted/50 text-muted-foreground"
              }`}>
                {exam.configuration.allowReview ? "Sí" : "No"}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-foreground/80">Máximo de intentos</span>
              <span className="px-2 py-1 text-xs bg-blue-900/20 text-blue-400 rounded">
                {exam.configuration.attemptsAllowed}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Metadatos */}
      {(exam.createdAt || exam.updatedAt) && (
        <div className="bg-box border border-line rounded-xl p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Metadatos</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            {exam.createdAt && (
              <div>
                <span className="text-muted-foreground">Fecha de creación:</span>
                <p className="text-foreground/80">
                  {new Date(exam.createdAt).toLocaleDateString('es-ES', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>
            )}
            
            {exam.updatedAt && (
              <div>
                <span className="text-muted-foreground">Última modificación:</span>
                <p className="text-foreground/80">
                  {new Date(exam.updatedAt).toLocaleDateString('es-ES', {
                    year: 'numeric',
                    month: 'long', 
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ExamDetailView;