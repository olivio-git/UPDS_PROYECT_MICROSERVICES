import { api } from '../../../services/api.service';
import type { MCERLevelDefinition } from '../types/levels.types';

interface LevelsFilters {
  isActive?: boolean;
  search?: string;
}

export class LevelsService {
  private basePath = '/api/v1/levels';

  async getAll(filters?: LevelsFilters): Promise<MCERLevelDefinition[]> {
    const params: Record<string, any> = {};

    // Solo agregar isActive si tiene un valor booleano específico
    if (filters?.isActive !== undefined) {
      params.isActive = filters.isActive;
    }

    if (filters?.search) {
      params.search = filters.search;
    }
    console.log(filters)
    const response = await api.get<{ data: { levels: MCERLevelDefinition[], total: number, page: number, totalPages: number } }>(
      this.basePath,
      { params }
    );
    console.log(response.data);
    return response.data.levels;
  }

  async getById(id: string): Promise<MCERLevelDefinition> {
    const response = await api.get<{ data: MCERLevelDefinition }>(`${this.basePath}/id/${id}`);
    return response.data;
  }

  async create(levelData: Omit<MCERLevelDefinition, '_id' | 'createdAt' | 'updatedAt'>): Promise<MCERLevelDefinition> {
    const response = await api.post<{ data: MCERLevelDefinition }>(this.basePath, levelData);
    return response.data;
  }

  async update(id: string, levelData: Partial<MCERLevelDefinition>): Promise<MCERLevelDefinition> {
    const response = await api.put<{ data: MCERLevelDefinition }>(`${this.basePath}/id/${id}`, levelData);
    return response.data;
  }

  async delete(id: string): Promise<void> {
    await api.delete(`${this.basePath}/id/${id}`);
  }

  async activate(id: string): Promise<MCERLevelDefinition> {
    const response = await api.patch<{ data: MCERLevelDefinition }>(`${this.basePath}/id/${id}/activate`);
    return response.data;
  }

  async deactivate(id: string): Promise<MCERLevelDefinition> {
    const response = await api.patch<{ data: MCERLevelDefinition }>(`${this.basePath}/id/${id}/deactivate`);
    return response.data;
  }
}

export const levelsService = new LevelsService();
export type { LevelsFilters };
