import { useCallback, useState } from 'react';
import { examService } from '../../../services/examService';

interface QuestionAvailabilityData {
  available: number;
  needed: number;
  isAvailable: boolean;
  remaining: number;
  maxAllowed: number;
}

interface QuestionAvailability {
  [key: string]: QuestionAvailabilityData; // key format: "${competency}-${level}"
}

interface QuestionStatsCache {
  [key: string]: Record<string, number>; // competency -> level -> count
}

export const useQuestionAvailability = () => {
  const [availability, setAvailability] = useState<QuestionAvailability>({});
  const [loading, setLoading] = useState(false);
  const [statsCache, setStatsCache] = useState<QuestionStatsCache>({});

  // Función para obtener estadísticas y guardar en cache
  const fetchStats = useCallback(async (level: string) => {
    if (statsCache[level]) {
      return statsCache[level];
    }

    try {
      const response = await examService.getQuestionStats({ level });
      if (response.success && response.data) {
        const competencyStats: Record<string, number> = {};

        // Convertir la respuesta en estructura fácil de usar
        Object.entries(response.data.byCompetency).forEach(([competency, levels]) => {
          const levelData = levels as Record<string, number>;
          competencyStats[competency] = levelData[level] || 0;
        });

        // Actualizar cache
        setStatsCache(prev => ({
          ...prev,
          [level]: competencyStats
        }));

        return competencyStats;
      }
    } catch (error) {
      console.error('Error fetching question stats:', error);
    }

    return {};
  }, [statsCache]);

  // Función principal para verificar disponibilidad
  const checkAvailability = useCallback(async (
    competency: string,
    level: string,
    neededCount: number
  ): Promise<{ available: number; isAvailable: boolean; maxAllowed: number }> => {
    if (!competency || !level || neededCount <= 0) {
      return { available: 0, isAvailable: false, maxAllowed: 0 };
    }

    setLoading(true);
    try {
      const competencyStats = await fetchStats(level);
      const available = competencyStats[competency] || 0;
      const isAvailable = available >= neededCount;
      const maxAllowed = available;

      const key = `${competency}-${level}`;
      setAvailability(prev => ({
        ...prev,
        [key]: {
          available,
          needed: neededCount,
          isAvailable,
          remaining: available - neededCount,
          maxAllowed
        }
      }));

      return { available, isAvailable, maxAllowed };
    } catch (error) {
      console.error('Error checking availability:', error);
      return { available: 0, isAvailable: false, maxAllowed: 0 };
    } finally {
      setLoading(false);
    }
  }, [fetchStats]);

  // Función para verificar múltiples secciones a la vez
  const checkMultipleSections = useCallback(async (
    sections: Array<{ competency: string; level: string; questionCount: number }>
  ) => {
    setLoading(true);
    try {
      const results = await Promise.all(
        sections.map(section =>
          checkAvailability(section.competency, section.level, section.questionCount)
        )
      );
      return results;
    } finally {
      setLoading(false);
    }
  }, [checkAvailability]);

  // Función para limpiar la validación de una sección específica
  const clearSectionValidation = useCallback((competency: string, level: string) => {
    const key = `${competency}-${level}`;
    setAvailability(prev => {
      const newState = { ...prev };
      delete newState[key];
      return newState;
    });
  }, []);

  // Función para limpiar todas las validaciones
  const clearAllValidations = useCallback(() => {
    setAvailability({});
  }, []);

  // Función para obtener el límite máximo para una competencia y nivel
  const getMaxAllowed = useCallback(async (competency: string, level: string): Promise<number> => {
    if (!competency || !level) return 0;

    try {
      const competencyStats = await fetchStats(level);
      return competencyStats[competency] || 0;
    } catch (error) {
      console.error('Error getting max allowed:', error);
      return 0;
    }
  }, [fetchStats]);

  // Función para invalidar cache (útil cuando se crean/eliminan preguntas)
  const invalidateCache = useCallback(() => {
    setStatsCache({});
    setAvailability({});
  }, []);

  return {
    // Estado
    availability,
    loading,

    // Acciones principales
    checkAvailability,
    checkMultipleSections,
    getMaxAllowed,

    // Utilidades
    clearSectionValidation,
    clearAllValidations,
    invalidateCache,

    // Cache para optimización
    statsCache
  };
};