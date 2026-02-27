import React from 'react';
import type { Question } from '../types';
import {
  QuestionMetadata,
  QuestionContent,
  QuestionOptions,
  QuestionSpecialTypes,
  QuestionMultimedia,
  QuestionTags,
  QuestionActions,
} from './question-form';
import { useQuestionForm } from './question-form/useQuestionForm';

interface Props {
  question: Question | null;
  onCancel: () => void;
  onSaved: () => void;
}

const QuestionFormRefactored: React.FC<Props> = ({ question, onCancel, onSaved }) => {
  const {
    formData,
    setFormData,
    audioFile,
    setAudioFile,
    imageFile,
    setImageFile,
    isSubmitting,
    handleSubmit,
    handleCancel,
    canSave,
    isEditing,
  } = useQuestionForm({ question, onCancel, onSaved });

  // Clase base para inputs
  const baseInputClass =
    'bg-gray-800/50 border-gray-600 text-white placeholder-gray-400 border-[0.5px] focus:border-blue-500 focus:ring-0 rounded-lg';

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSubmit();
  };

  return (
    <form onSubmit={handleFormSubmit} className="space-y-6">
      {/* Metadatos - Tipo, competencia, nivel, dificultad */}
      <QuestionMetadata
        formData={formData}
        onChange={setFormData}
        baseInputClass={baseInputClass}
      />

      {/* Contenido - Pregunta, instrucciones, contexto */}
      <QuestionContent
        formData={formData}
        onChange={setFormData}
        baseInputClass={baseInputClass}
      />

      {/* Opciones para multiple choice y true/false */}
      <QuestionOptions
        formData={formData}
        onChange={setFormData}
        baseInputClass={baseInputClass}
      />

      {/* Tipos especiales - Fill blanks, matching, ordering, etc. */}
      <QuestionSpecialTypes
        formData={formData}
        onChange={setFormData}
        baseInputClass={baseInputClass}
      />

      {/* Multimedia - Audio e imágenes */}
      <QuestionMultimedia
        formData={formData}
        onChange={setFormData}
        baseInputClass={baseInputClass}
        audioFile={audioFile}
        imageFile={imageFile}
        onAudioChange={setAudioFile}
        onImageChange={setImageFile}
      />

      {/* Etiquetas */}
      <QuestionTags
        formData={formData}
        onChange={setFormData}
        baseInputClass={baseInputClass}
      />

      {/* Acciones - Guardar/Cancelar */}
      <QuestionActions
        isEditing={isEditing}
        onCancel={handleCancel}
        onSubmit={handleSubmit}
        isLoading={isSubmitting}
        canSave={canSave}
      />
    </form>
  );
};

export default QuestionFormRefactored;
