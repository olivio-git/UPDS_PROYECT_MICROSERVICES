import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { examService } from '../../../services/examService';
import type { PaginationParams, Question, QuestionFilters } from '../types';

interface UseQuestionsState {
  questions: Question[];
  loading: boolean;
  error: string | null;
  totalPages: number;
  totalItems: number;
  currentPage: number;
}

export const useQuestions = (
  initialFilters?: QuestionFilters,
  initialPagination?: PaginationParams
) => {
  const [state, setState] = useState<UseQuestionsState>({
    questions: [],
    loading: false,
    error: null,
    totalPages: 0,
    totalItems: 0,
    currentPage: initialPagination?.page || 1,
  });

  const [filters, setFilters] = useState<QuestionFilters>(initialFilters || {});
  const [pagination, setPagination] = useState<PaginationParams>(
    initialPagination || { page: 1, limit: 10 }
  );

  // Cargar preguntas
  const loadQuestions = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const response = await examService.getQuestions(filters, pagination);
      if (response.success && response.data) {
        setState(prev => ({
          ...prev,
          questions: response.data?.questions ?? [], // Accede al array de preguntas
          totalPages: response.data?.totalPages ?? 0, // Accede a totalPages directamente desde `data`
          totalItems: response.data?.total ?? 0,      // Accede a total directamente desde `data`
          currentPage: response.data?.page ?? 1,      // Accede a page directamente desde `data`
          loading: false,
        }));
      }
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error.message || 'Error al cargar las preguntas',
      }));
      toast.error('Error al cargar las preguntas');
    }
  }, [filters, pagination]);

  // Crear pregunta
  const createQuestion = async (question: Partial<Question>) => {
    try {
      const response = await examService.createQuestion(question);
      
      if (response.success) {
        toast.success('Pregunta creada exitosamente');
        await loadQuestions(); // Recargar lista
        return response.data;
      }
    } catch (error: any) {
      toast.error(error.message || 'Error al crear la pregunta');
      throw error;
    }
  };

  // Crear pregunta con multimedia en una sola petición
  const createQuestionWithMedia = async (
    question: Partial<Question>,
    mediaFile?: File,
    mediaType?: 'audio' | 'image'
  ) => {
    try {
      const response = await examService.createQuestionWithMedia(question, mediaFile, mediaType);
      
      if (response.success) {
        toast.success(
          mediaFile 
            ? `Pregunta creada exitosamente con ${mediaType || 'multimedia'}`
            : 'Pregunta creada exitosamente'
        );
        await loadQuestions(); // Recargar lista
        return response.data;
      }
    } catch (error: any) {
      toast.error(error.message || 'Error al crear la pregunta con multimedia');
      throw error;
    }
  };
  // Crear pregunta con múltiples archivos multimedia
  const createQuestionWithMultipleMedia = async (
    question: Partial<Question>,
    mediaFiles?: { [itemIndex: number]: { audio?: File, image?: File } },
    mainMediaFile?: File,
    mainMediaType?: 'audio' | 'image'
  ) => {
    try {
      const response = await examService.createQuestionWithMultipleMedia(
        question, 
        mediaFiles, 
        mainMediaFile, 
        mainMediaType
      );
      
      if (response.success) {
        const mediaCount = Object.keys(mediaFiles || {}).length + (mainMediaFile ? 1 : 0);
        toast.success(
          `Pregunta creada exitosamente${mediaCount > 0 ? ` con ${mediaCount} archivo${mediaCount > 1 ? 's' : ''} multimedia` : ''}`
        );
        await loadQuestions(); // Recargar lista
        return response.data;
      }
    } catch (error: any) {
      toast.error(error.message || 'Error al crear la pregunta con multimedia');
      throw error;
    }
  };

  // Actualizar pregunta
  const updateQuestion = async (id: string, updates: Partial<Question>) => {
    try {
      const response = await examService.updateQuestion(id, updates);
      
      if (response.success) {
        toast.success('Pregunta actualizada exitosamente');
        await loadQuestions(); // Recargar lista
        return response.data;
      }
    } catch (error: any) {
      toast.error(error.message || 'Error al actualizar la pregunta');
      throw error;
    }
  };

  // Eliminar pregunta
  const deleteQuestion = async (id: string) => {
    try {
      const response = await examService.deleteQuestion(id);
      
      if (response.success) {
        toast.success('Pregunta eliminada exitosamente');
        await loadQuestions(); // Recargar lista
      }
    } catch (error: any) {
      toast.error(error.message || 'Error al eliminar la pregunta');
      throw error;
    }
  };

  // Subir audio
  const uploadAudio = async (questionId: string, file: File) => {
    try {
      const response = await examService.uploadQuestionAudio(questionId, file);
      
      if (response.success) {
        toast.success('Audio subido exitosamente');
        await loadQuestions(); // Recargar para actualizar URL
        return response.data;
      }
    } catch (error: any) {
      toast.error(error.message || 'Error al subir el audio');
      throw error;
    }
  };

  // Subir imagen
  const uploadImage = async (questionId: string, file: File) => {
    try {
      const response = await examService.uploadQuestionImage(questionId, file);
      
      if (response.success) {
        toast.success('Imagen subida exitosamente');
        await loadQuestions(); // Recargar para actualizar URL
        return response.data;
      }
    } catch (error: any) {
      toast.error(error.message || 'Error al subir la imagen');
      throw error;
    }
  };

  // Importar preguntas
  const importQuestions = async (file: File) => {
    try {
      const response = await examService.importQuestions(file);
      
      if (response.success) {
        toast.success(
          `Importación completada: ${response.data?.success} exitosas, ${response.data?.failed} fallidas`
        );
        await loadQuestions(); // Recargar lista
        return response.data;
      }
    } catch (error: any) {
      toast.error(error.message || 'Error al importar las preguntas');
      throw error;
    }
  };

  // Cambiar página
  const changePage = (page: number) => {
    setPagination(prev => ({ ...prev, page }));
  };

  // Cambiar límite
  const changeLimit = (limit: number) => {
    setPagination(prev => ({ ...prev, limit, page: 1 }));
  };

  // Aplicar filtros
  const applyFilters = (newFilters: QuestionFilters) => {
    setFilters(newFilters);
    setPagination(prev => ({ ...prev, page: 1 })); // Reset a primera página
  };

  // Limpiar filtros
  const clearFilters = () => {
    setFilters({});
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  // Cargar preguntas al montar y cuando cambien filtros/paginación
  useEffect(() => {
    loadQuestions();
  }, [filters, pagination]);

  return {
    // Estado
    questions: state.questions,
    loading: state.loading,
    error: state.error,
    totalPages: state.totalPages,
    totalItems: state.totalItems,
    currentPage: state.currentPage,
    
    // Filtros y paginación
    filters,
    pagination,
    
    // Acciones
    loadQuestions,
    createQuestion,
    createQuestionWithMedia,
    createQuestionWithMultipleMedia,
    updateQuestion,
    deleteQuestion,
    uploadAudio,
    uploadImage,
    importQuestions,
    
    // Control de paginación
    changePage,
    changeLimit,
    
    // Control de filtros
    applyFilters,
    clearFilters,
  };
};
