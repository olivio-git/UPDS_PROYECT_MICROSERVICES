import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { examService } from '../../../services/examService';
import type { ExamSession } from '../types';

interface UseSessionsState {
  sessions: ExamSession[];
  loading: boolean;
  error: string | null;
  totalPages: number;
  totalItems: number;
  currentPage: number;
}

interface SessionFilters {
  status?: string;
  examId?: string;
  startDate?: string;
  endDate?: string;
  q?: string; // Para búsqueda por texto
  sortBy?: string; // Campo por el cual ordenar
  sortOrder?: 'asc' | 'desc'; // Dirección del ordenamiento
}

export const useSessions = (initialFilters?: SessionFilters) => {
  const [state, setState] = useState<UseSessionsState>({
    sessions: [],
    loading: false,
    error: null,
    totalPages: 0,
    totalItems: 0,
    currentPage: 1,
  });

  const [filters, setFilters] = useState<SessionFilters>(initialFilters || {});
  const [pagination, setPagination] = useState({ page: 1, limit: 10 });

  // Cargar sesiones
  const loadSessions = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const response = await examService.getSessions(filters, pagination); 
      if (response.success && response.data) {
        setState(prev => ({
          ...prev,
          sessions: response.data?.sessions ?? [],
          totalPages: response.data?.totalPages ?? 0,
          totalItems: response.data?.total ?? 0,
          currentPage: response.data?.page ?? 1,
          // sort
          loading: false,
        }));
      }
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error.message || 'Error al cargar las sesiones',
      }));
      toast.error('Error al cargar las sesiones');
    }
  }, [filters, pagination]);

  // Actualizar una sesión específica sin perder paginación
  const updateSessionStatus = useCallback((sessionId: string, newStatus: 'scheduled' | 'in_progress' | 'completed' | 'cancelled') => {
    setState(prev => ({
      ...prev,
      sessions: prev.sessions.map(session => 
        session._id === sessionId 
          ? { ...session, status: newStatus }
          : session
      )
    }));
  }, []);

  // Crear sesión
  const createSession = async (session: Partial<ExamSession>) => {
    try {
      const response = await examService.createSession(session);
      
      if (response.success) {
        toast.success('Sesión creada exitosamente');
        await loadSessions();
        return response.data;
      }
    } catch (error: any) {
      toast.error(error.message || 'Error al crear la sesión');
      throw error;
    }
  };

  // Actualizar sesión
  const updateSession = async (id: string, updates: Partial<ExamSession>) => {
    try {
      console.log('Updating session with ID:', id, 'and updates:', updates);
      const response = await examService.updateSession(id, updates);
      
      if (response.success) {
        toast.success('Sesión actualizada exitosamente');
        await loadSessions();
        return response.data;
      }
    } catch (error: any) {
      toast.error(error.message || 'Error al actualizar la sesión');
      throw error;
    }
  };

  // Iniciar sesión
  const startSession = async (sessionId: string) => {
    try {
      const response = await examService.startSession(sessionId);
      
      if (response.success) {
        toast.success('Sesión iniciada exitosamente');
        await loadSessions();
        return response.data;
      }
    } catch (error: any) {
      toast.error(error.message || 'Error al iniciar la sesión');
      throw error;
    }
  };

  // Finalizar sesión
  const endSession = async (sessionId: string) => {
    try {
      const response = await examService.endSession(sessionId);
      
      if (response.success) {
        toast.success('Sesión finalizada exitosamente');
        await loadSessions();
        return response.data;
      }
    } catch (error: any) {
      toast.error(error.message || 'Error al finalizar la sesión');
      throw error;
    }
  };

  // Agregar candidatos
  const addCandidatesToSession = async (sessionId: string, candidateIds: string[]) => {
    try { 
      const response = await examService.addCandidatesToSession(sessionId, candidateIds);
      
      if (response.success) {
        toast.success('Candidatos agregados exitosamente');
        await loadSessions();
        return response.data;
      }
    } catch (error: any) {
      throw error;
    }
  };
  const removeCandidatesFromSession = async (sessionId: string, candidateIds: string[]) => {
    try {
      const response = await examService.removeCandidatesFromSession(sessionId, candidateIds);

      if (response.success) {
        toast.success('Candidatos removidos exitosamente');
        await loadSessions();
        return response.data;
      }
    } catch (error: any) {
      toast.error(error.message || 'Error al remover candidatos');
      throw error;
    }
  };

  // Agregar proctors
  const addProctorsToSession = async (sessionId: string, proctorIds: string[]) => {
    try { 
      console.log(proctorIds)
      const response = await examService.addProctorsToSession(sessionId, proctorIds);
      
      if (response.success) {
        toast.success('Proctors agregados exitosamente');
        await loadSessions();
        return response.data;
      }
    } catch (error: any) {
      toast.error(error.message || 'Error al agregar proctors');
      throw error;
    }
  };

  // Remover proctors
  const removeProctorsFromSession = async (sessionId: string, proctorIds: string[]) => {
    try {
      const response = await examService.removeProctorsFromSession(sessionId, proctorIds);

      if (response.success) {
        toast.success('Proctors removidos exitosamente');
        await loadSessions();
        return response.data;
      }
    } catch (error: any) {
      toast.error(error.message || 'Error al remover proctors');
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
  const applyFilters = (newFilters: SessionFilters) => {
    setFilters(newFilters);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  // Limpiar filtros
  const clearFilters = () => {
    setFilters({});
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  // Cargar sesiones al montar y cuando cambien filtros/paginación
  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  return {
    // Estado
    sessions: state.sessions,
    loading: state.loading,
    error: state.error,
    totalPages: state.totalPages,
    totalItems: state.totalItems,
    currentPage: state.currentPage,
    
    // Filtros y paginación
    filters,
    pagination,
    
    // Acciones
    loadSessions,
    createSession,
    updateSession,
    updateSessionStatus,
    startSession,
    endSession,
    addCandidatesToSession,
    removeCandidatesFromSession,
    addProctorsToSession,
    removeProctorsFromSession,
    // Control de paginación
    changePage,
    changeLimit,
    
    // Control de filtros
    applyFilters,
    clearFilters,
  };
};
