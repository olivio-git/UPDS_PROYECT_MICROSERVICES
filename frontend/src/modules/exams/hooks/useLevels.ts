import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { levelsService, type LevelsFilters } from '../services/levels.service';
import type { MCERLevelDefinition } from '../types/levels.types';

export const useLevels = (filters?: LevelsFilters) => {
  const [levels, setLevels] = useState<MCERLevelDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Cargar niveles
  const loadLevels = async (customFilters?: LevelsFilters) => {
    setIsLoading(true);
    setIsError(false);
    try {
      const filtersToUse = customFilters || filters;
      const data = await levelsService.getAll(filtersToUse);
      setLevels(data);
    } catch (error: any) {
      setIsError(true);
      setErrorMessage(error.message || 'Error al cargar los niveles');
      console.error('Error loading levels:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Crear nivel
  const createLevel = async (levelData: Omit<MCERLevelDefinition, '_id' | 'createdAt' | 'updatedAt'>): Promise<boolean> => {
    try {
      const newLevel = await levelsService.create(levelData);
      setLevels(prev => [...prev, newLevel]);
      return true;
    } catch (error: any) {
      toast.error(error.message || 'Error al crear el nivel');
      return false;
    }
  };

  // Actualizar nivel
  const updateLevel = async (id: string, levelData: Partial<MCERLevelDefinition>): Promise<boolean> => {
    try {
      const updatedLevel = await levelsService.update(id, levelData);
      setLevels(prev => prev.map(level => 
        level._id === id ? updatedLevel : level
      ));
      return true;
    } catch (error: any) {
      toast.error(error.message || 'Error al actualizar el nivel');
      return false;
    }
  };

  // Eliminar nivel
  const deleteLevel = async (id: string): Promise<boolean> => {
    try {
      await levelsService.delete(id);
      setLevels(prev => prev.filter(level => level._id !== id));
      return true;
    } catch (error: any) {
      toast.error(error.message || 'Error al eliminar el nivel');
      return false;
    }
  };

  // Activar nivel
  const activateLevel = async (id: string): Promise<boolean> => {
    try {
      const updatedLevel = await levelsService.activate(id);
      setLevels(prev => prev.map(level => 
        level._id === id ? updatedLevel : level
      ));
      return true;
    } catch (error: any) {
      toast.error(error.message || 'Error al activar el nivel');
      return false;
    }
  };

  // Desactivar nivel
  const deactivateLevel = async (id: string): Promise<boolean> => {
    try {
      const updatedLevel = await levelsService.deactivate(id);
      setLevels(prev => prev.map(level => 
        level._id === id ? updatedLevel : level
      ));
      return true;
    } catch (error: any) {
      toast.error(error.message || 'Error al desactivar el nivel');
      return false;
    }
  };

  // Refrescar datos
  const refreshLevels = (customFilters?: LevelsFilters) => {
    loadLevels(customFilters);
  };

  // Cargar datos iniciales
  useEffect(() => {
    loadLevels();
  }, []);

  // Recargar cuando cambien los filtros
  useEffect(() => {
    if (filters) {
      loadLevels();
    }
  }, [filters?.isActive, filters?.search]);

  return {
    levels,
    isLoading,
    isError,
    errorMessage,
    refreshLevels,
    loadLevels,
    createLevel,
    updateLevel,
    deleteLevel,
    activateLevel,
    deactivateLevel,
  };
};