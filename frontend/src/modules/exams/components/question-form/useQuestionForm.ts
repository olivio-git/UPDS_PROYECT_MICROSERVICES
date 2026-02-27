import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { useQuestions } from '../../hooks/useQuestions';
import type { Question } from '../../types';

interface UseQuestionFormProps {
  question: Question | null;
  onCancel: () => void;
  onSaved: () => void;
}

export const useQuestionForm = ({ question, onCancel, onSaved }: UseQuestionFormProps) => {
  const {
    createQuestion,
    updateQuestion,
    uploadAudio,
    uploadImage,
    createQuestionWithMedia,
  } = useQuestions();

  // Estados
  const [formData, setFormData] = useState<Partial<Question>>(getInitialFormData(question));
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form data cuando cambia la pregunta
  useEffect(() => {
    setFormData(getInitialFormData(question));
    setAudioFile(null);
    setImageFile(null);
  }, [question]);

  // Función para obtener datos iniciales del formulario
  function getInitialFormData(question: Question | null): Partial<Question> {
    if (question) {
      return {
        ...question,
        content: {
          question: question.content?.question || '',
          instructions: question.content?.instructions || '',
          context: question.content?.context || '',
          options: question.content?.options || [],
          correctAnswer: question.content?.correctAnswer || '',
          keywords: question.content?.keywords || [],
          mediaUrl: question.content?.mediaUrl || undefined,
          mediaType: question.content?.mediaType || 'audio',
          template: question.content?.template || '',
          blanks: question.content?.blanks || [],
          items: question.content?.items || [],
          promptAudioUrl: question.content?.promptAudioUrl || '',
          expectedResponseType: question.content?.expectedResponseType || 'sentence',
        },
        metadata: {
          topic: question.metadata?.topic || '',
          subtopic: question.metadata?.subtopic || '',
          tags: question.metadata?.tags || [],
          estimatedTime: question.metadata?.estimatedTime || undefined,
          points: question.metadata?.points || 1,
        },
        type: question.type || 'multiple_choice',
        competency: question.competency || 'reading',
        level: question.level || 'A1',
        difficulty: question.difficulty || 3,
        points: question.points || 1,
        isActive: question.isActive !== undefined ? question.isActive : true,
      };
    }

    return {
      type: 'multiple_choice',
      competency: 'reading',
      level: 'A1',
      difficulty: 3,
      content: {
        question: '',
        instructions: '',
        context: '',
        options: [],
        correctAnswer: '',
        keywords: [],
        mediaType: 'audio',
        template: '',
        blanks: [],
        items: [],
        promptAudioUrl: '',
        expectedResponseType: 'sentence',
      },
      points: 1,
      metadata: {
        topic: '',
        subtopic: '',
        tags: [],
        points: 1,
      },
      statistics: {
        timesUsed: 0,
        averageScore: 0,
        averageTime: 0,
      },
      isActive: true,
    };
  }

  // Validación de datos
  const validateQuestionData = useCallback((data: Partial<Question>) => {
    const errors: string[] = [];

    if (!data.content?.question?.trim()) {
      errors.push('La pregunta es requerida');
    }

    if (data.type === 'multiple_choice' && (!data.content?.options || data.content.options.length < 2)) {
      errors.push('Las preguntas de opción múltiple necesitan al menos 2 opciones');
    }

    if (data.type === 'true_false' && (!data.content?.options || data.content.options.length !== 2)) {
      errors.push('Las preguntas verdadero/falso necesitan exactamente 2 opciones');
    }

    if (data.competency === 'listening' && !data.content?.mediaUrl && !audioFile) {
      errors.push('Las preguntas de listening requieren audio');
    }

    if (data.type === 'fill_blanks' && !data.content?.template?.includes('___')) {
      errors.push('Las preguntas de completar espacios necesitan al menos un espacio marcado con ___');
    }

    if (data.type === 'matching' && (!data.content?.items || data.content.items.length < 2)) {
      errors.push('Las preguntas de emparejar necesitan al menos 2 elementos');
    }

    if (data.type === 'ordering' && (!data.content?.items || data.content.items.length < 3)) {
      errors.push('Las preguntas de ordenar necesitan al menos 3 elementos');
    }

    if (data.type === 'drag_drop' && (!data.content?.items || data.content.items.length < 2)) {
      errors.push('Las preguntas de arrastrar y soltar necesitan al menos 2 elementos');
    }

    if (data.type === 'audio_response' && !data.content?.expectedResponseType) {
      errors.push('Las preguntas de respuesta de audio necesitan especificar el tipo de respuesta esperada');
    }

    // Validar que haya al menos una respuesta correcta en opciones múltiples
    if (['multiple_choice', 'true_false'].includes(data.type as string)) {
      const hasCorrectAnswer = data.content?.options?.some(opt => opt.isCorrect);
      if (!hasCorrectAnswer) {
        errors.push('Debe seleccionar cuál es la respuesta correcta');
      }
    }

    return errors;
  }, [audioFile]);

  // Función para limpiar y preparar los datos antes del envío
  const prepareDataForSubmission = useCallback((data: Partial<Question>) => {
    const cleanedData = JSON.parse(JSON.stringify(data));

    // Limpiar campos vacíos
    if (cleanedData.content?.mediaUrl === '' || !cleanedData.content?.mediaUrl?.trim()) {
      delete cleanedData.content.mediaUrl;
    }

    if (!cleanedData.metadata?.estimatedTime || cleanedData.metadata.estimatedTime <= 0) {
      if (cleanedData.metadata) {
        delete cleanedData.metadata.estimatedTime;
      }
    }

    // Limpiar arrays vacíos
    if (cleanedData.content?.keywords?.length === 0) {
      cleanedData.content.keywords = [];
    }

    if (cleanedData.metadata?.tags?.length === 0) {
      cleanedData.metadata.tags = [];
    }

    return cleanedData;
  }, []);

  // Función principal para enviar el formulario
  const handleSubmit = useCallback(async () => {
    if (isSubmitting) return;

    try {
      setIsSubmitting(true);

      // Validar datos
      const validationErrors = validateQuestionData(formData);
      if (validationErrors.length > 0) {
        validationErrors.forEach(error => toast.error(error));
        return;
      }

      // Preparar datos para envío
      const cleanedData = prepareDataForSubmission(formData);
      let savedQuestion: Question | undefined;

      if (question?._id) {
        // Actualizar pregunta existente
        savedQuestion = await updateQuestion(question._id, cleanedData);

        // Subir archivos multimedia si hay
        if (savedQuestion?._id) {
          if (audioFile) {
            await uploadAudio(savedQuestion._id, audioFile);
          }
          if (imageFile) {
            await uploadImage(savedQuestion._id, imageFile);
          }
        }
      } else {
        // Crear nueva pregunta
        const mediaFile = audioFile || imageFile;

        if (mediaFile) {
          const mediaType = audioFile ? 'audio' : 'image';
          savedQuestion = await createQuestionWithMedia(cleanedData, mediaFile, mediaType);
        } else {
          savedQuestion = await createQuestion(cleanedData);
        }
      }

      // Éxito - llamar callback
      onSaved();

    } catch (error: any) {
      console.error('Error al guardar la pregunta:', error);
      const errorMessage = error?.response?.data?.message || error?.message || 'Error al guardar la pregunta';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    formData,
    audioFile,
    imageFile,
    question,
    isSubmitting,
    validateQuestionData,
    prepareDataForSubmission,
    updateQuestion,
    uploadAudio,
    uploadImage,
    createQuestionWithMedia,
    createQuestion,
    onSaved
  ]);

  // Verificar si se puede guardar
  const canSave = useCallback(() => {
    const errors = validateQuestionData(formData);
    return errors.length === 0;
  }, [formData, validateQuestionData]);

  return {
    // Estados
    formData,
    setFormData,
    audioFile,
    setAudioFile,
    imageFile,
    setImageFile,
    isSubmitting,

    // Funciones
    handleSubmit,
    handleCancel: onCancel,
    canSave: canSave(),

    // Helpers
    isEditing: !!question?._id,
  };
};
