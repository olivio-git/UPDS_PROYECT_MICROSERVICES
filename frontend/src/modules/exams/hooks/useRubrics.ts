import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { rubricsService } from '../services/rubrics.service';
import type { Rubric, RubricFilters } from '../types/rubrics.types';

export const useRubrics = () => {
  const [rubrics, setRubrics] = useState<Rubric[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [filters, setFilters] = useState<RubricFilters>({});
  const [selectedRubrics, setSelectedRubrics] = useState<string[]>([]);

  // Cargar rúbricas
  const loadRubrics = async (currentFilters?: RubricFilters) => {
    setIsLoading(true);
    setIsError(false);
    try {
      const data = await rubricsService.getAll(currentFilters || filters);
      setRubrics(data);
    } catch (error: any) {
      setIsError(true);
      setErrorMessage(error.message || 'Error al cargar las rúbricas');
      console.error('Error loading rubrics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Crear rúbrica
  const createRubric = async (rubricData: Omit<Rubric, '_id' | 'createdAt' | 'updatedAt'>): Promise<boolean> => {
    try {
      const newRubric = await rubricsService.create(rubricData);
      setRubrics(prev => [...prev, newRubric]);
      return true;
    } catch (error: any) {
      toast.error(error.message || 'Error al crear la rúbrica');
      return false;
    }
  };

  // Actualizar rúbrica
  const updateRubric = async (id: string, rubricData: Partial<Rubric>): Promise<boolean> => {
    try {
      const updatedRubric = await rubricsService.update(id, rubricData);
      setRubrics(prev => prev.map(rubric => 
        rubric._id === id ? updatedRubric : rubric
      ));
      return true;
    } catch (error: any) {
      toast.error(error.message || 'Error al actualizar la rúbrica');
      return false;
    }
  };

  // Eliminar rúbrica
  const deleteRubric = async (id: string): Promise<boolean> => {
    try {
      await rubricsService.delete(id);
      setRubrics(prev => prev.filter(rubric => rubric._id !== id));
      return true;
    } catch (error: any) {
      toast.error(error.message || 'Error al eliminar la rúbrica');
      return false;
    }
  };

  // Eliminar rúbricas seleccionadas
  const deleteSelectedRubrics = async (): Promise<boolean> => {
    try {
      const deletePromises = selectedRubrics.map(id => rubricsService.delete(id));
      await Promise.all(deletePromises);
      setRubrics(prev => prev.filter(rubric => !selectedRubrics.includes(rubric._id!)));
      setSelectedRubrics([]);
      toast.success(`${selectedRubrics.length} rúbrica(s) eliminada(s)`);
      return true;
    } catch (error: any) {
      toast.error(error.message || 'Error al eliminar las rúbricas');
      return false;
    }
  };

  // Clonar rúbrica
  const cloneRubric = async (id: string, newName: string): Promise<boolean> => {
    try {
      const clonedRubric = await rubricsService.clone(id, newName);
      setRubrics(prev => [...prev, clonedRubric]);
      return true;
    } catch (error: any) {
      toast.error(error.message || 'Error al clonar la rúbrica');
      return false;
    }
  };

  // Activar rúbrica
  const activateRubric = async (id: string): Promise<boolean> => {
    try {
      const updatedRubric = await rubricsService.activate(id);
      setRubrics(prev => prev.map(rubric => 
        rubric._id === id ? updatedRubric : rubric
      ));
      return true;
    } catch (error: any) {
      toast.error(error.message || 'Error al activar la rúbrica');
      return false;
    }
  };

  // Desactivar rúbrica
  const deactivateRubric = async (id: string): Promise<boolean> => {
    try {
      const updatedRubric = await rubricsService.deactivate(id);
      setRubrics(prev => prev.map(rubric => 
        rubric._id === id ? updatedRubric : rubric
      ));
      return true;
    } catch (error: any) {
      toast.error(error.message || 'Error al desactivar la rúbrica');
      return false;
    }
  };

  // Manejo de selección
  const selectRubric = (id: string, isSelected: boolean) => {
    if (isSelected) {
      setSelectedRubrics(prev => [...prev, id]);
    } else {
      setSelectedRubrics(prev => prev.filter(rubricId => rubricId !== id));
    }
  };

  const selectAllRubrics = (isSelected: boolean) => {
    if (isSelected) {
      setSelectedRubrics(rubrics.map(rubric => rubric._id!));
    } else {
      setSelectedRubrics([]);
    }
  };

  const clearSelection = () => {
    setSelectedRubrics([]);
  };

  // Refrescar datos
  const refreshRubrics = () => {
    loadRubrics();
  };

  // Actualizar filtros
  const updateFilters = (newFilters: RubricFilters) => {
    setFilters(newFilters);
    loadRubrics(newFilters);
  };

  // Cargar datos iniciales
  useEffect(() => {
    loadRubrics();
  }, []);

  return {
    rubrics,
    isLoading,
    isError,
    errorMessage,
    filters,
    setFilters: updateFilters,
    selectedRubrics,
    selectRubric,
    selectAllRubrics,
    clearSelection,
    refreshRubrics,
    createRubric,
    updateRubric,
    deleteRubric,
    deleteSelectedRubrics,
    cloneRubric,
    activateRubric,
    deactivateRubric,
  };
};