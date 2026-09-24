import { authSDK } from '@/services/sdk-simple-auth';
import axios from 'axios';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { ApiResponse, Exam, ExamFilters } from '../types';
import { EXAM_SERVICE_URL } from '@/lib/serviceUrls';

const API_BASE_URL = EXAM_SERVICE_URL;


/**
 * Pulls the backend's own message out of a failed request so the teacher sees
 * the Spanish explanation (e.g. section weights) instead of "status code 400".
 * Zod validation errors put the useful text in `errors[0].message`.
 */
const getApiErrorMessage = (body: unknown, fallback: string): string => {
  if (body && typeof body === 'object') {
    const { message, errors } = body as { message?: unknown; errors?: Array<{ message?: unknown }> };
    const detail = Array.isArray(errors) ? errors[0]?.message : undefined;
    if (typeof detail === 'string' && detail) return detail;
    if (typeof message === 'string' && message) return message;
  }
  return fallback;
};

export const useExams = () => {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [filters, setFilters] = useState<ExamFilters>({});

  const getAuthToken = () => {
    return authSDK.getAccessToken() || '';
  };

  const fetchExams = useCallback(async (page = 1, filterParams = filters) => {
    try {
      setLoading(true);
      setError(null);

      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: '10',
        ...filterParams
      } as any);

      const response = await axios.get(`${API_BASE_URL}/api/v1/exams?${queryParams}`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`
        }
      });

      if (response.status !== 200) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const data: ApiResponse<{
        exams: Exam[];
        total: number;
        page: number;
        totalPages: number;
      }> = response.data;

      if (data.success && data.data) {
        setExams(data.data.exams);
        setTotalItems(data.data.total);
        setCurrentPage(data.data.page);
        setTotalPages(data.data.totalPages);
      } else {
        throw new Error(data.message || 'Error al cargar exámenes');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      setError(errorMessage);
      console.error('Error fetching exams:', err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const createExam = async (examData: Partial<Exam>): Promise<Exam | null> => {
    console.log(examData);
    try {
      setLoading(true);
      
      const response = await axios.post(`${API_BASE_URL}/api/v1/exams`,examData,{
        headers: {
          'Authorization': `Bearer ${authSDK.getAccessToken()}`,
          'Content-Type': 'application/json'
        }
      });
      if (response.status !== 200 && response.status !== 201) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const data: ApiResponse<Exam> = await response.data;

      if (data.success && data.data) {
        toast.success('Examen creado exitosamente');
        await fetchExams(currentPage); // Recargar la lista
        return data.data;
      } else {
        throw new Error(data.message || 'Error al crear examen');
      }
    } catch (err) {
      const fallback = err instanceof Error ? err.message : 'Error desconocido';
      const errorMessage = axios.isAxiosError(err)
        ? getApiErrorMessage(err.response?.data, fallback)
        : fallback;
      toast.error(errorMessage);
      console.error('Error creating exam:', err);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const updateExam = async (id: string, examData: Partial<Exam>): Promise<Exam | null> => {
    try {
      setLoading(true);
      
      const response = await axios.put(`${API_BASE_URL}/api/v1/exams/${id}`, examData, {
        headers: {
          'Authorization': `Bearer ${authSDK.getAccessToken()}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.status !== 200) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const data: ApiResponse<Exam> = await response.data;

      if (data.success && data.data) {
        toast.success('Examen actualizado exitosamente');
        await fetchExams(currentPage); // Recargar la lista
        return data.data;
      } else {
        throw new Error(data.message || 'Error al actualizar examen');
      }
    } catch (err) {
      const fallback = err instanceof Error ? err.message : 'Error desconocido';
      const errorMessage = axios.isAxiosError(err)
        ? getApiErrorMessage(err.response?.data, fallback)
        : fallback;
      toast.error(errorMessage);
      console.error('Error updating exam:', err);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const deleteExam = async (id: string): Promise<boolean> => {
    try {
      setLoading(true);
      
      const response = await fetch(`${API_BASE_URL}/api/v1/exams/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const data: ApiResponse<void> = await response.json();

      if (data.success) {
        toast.success('Examen eliminado exitosamente');
        await fetchExams(currentPage); // Recargar la lista
        return true;
      } else {
        throw new Error(data.message || 'Error al eliminar examen');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      toast.error(errorMessage);
      console.error('Error deleting exam:', err);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const getExamById = async (id: string): Promise<Exam | null> => {
    try {
      setLoading(true);
      
      const response = await fetch(`${API_BASE_URL}/api/v1/exams/${id}`, {
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const data: ApiResponse<Exam> = await response.json();

      if (data.success && data.data) {
        return data.data;
      } else {
        throw new Error(data.message || 'Error al obtener examen');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      setError(errorMessage);
      console.error('Error getting exam:', err);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const cloneExam = async (id: string): Promise<Exam | null> => {
    try {
      setLoading(true);
      
      const response = await fetch(`${API_BASE_URL}/api/v1/exams/${id}/clone`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(getApiErrorMessage(body, `Error ${response.status}: ${response.statusText}`));
      }

      const data: ApiResponse<Exam> = await response.json();

      if (data.success && data.data) {
        toast.success('Examen clonado exitosamente');
        await fetchExams(currentPage); // Recargar la lista
        return data.data;
      } else {
        throw new Error(data.message || 'Error al clonar examen');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      toast.error(errorMessage);
      console.error('Error cloning exam:', err);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const generateQuestions = async (examId: string, candidateId: string): Promise<any[] | null> => {
    try {
      setLoading(true);
      
      const response = await fetch(`${API_BASE_URL}/api/v1/exams/${examId}/generate-questions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ candidateId })
      });

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const data: ApiResponse<any[]> = await response.json();

      if (data.success && data.data) {
        return data.data;
      } else {
        throw new Error(data.message || 'Error al generar preguntas');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      toast.error(errorMessage);
      console.error('Error generating questions:', err);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const changePage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      fetchExams(page);
    }
  };

  const applyFilters = (newFilters: ExamFilters) => {
    setFilters(newFilters);
    setCurrentPage(1);
    fetchExams(1, newFilters);
  };

  const clearFilters = () => {
    setFilters({});
    setCurrentPage(1);
    fetchExams(1, {});
  };

  // Cargar exámenes al montar el hook
  useEffect(() => {
    fetchExams();
  }, []);

  return {
    exams,
    loading,
    error,
    currentPage,
    totalPages,
    totalItems,
    filters,
    // Acciones
    loadExams: fetchExams,
    createExam,
    updateExam,
    deleteExam,
    getExamById,
    cloneExam,
    generateQuestions,
    changePage,
    applyFilters,
    clearFilters
  };
};