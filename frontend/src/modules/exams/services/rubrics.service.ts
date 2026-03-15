import { api } from '../../../services/api.service';
import type { Rubric, RubricFilters } from '../types/rubrics.types';

export class RubricsService {
  private basePath = '/api/v1/rubrics';

  async getAll(filters?: RubricFilters): Promise<Rubric[]> {
    const params = new URLSearchParams();
    if (filters?.competency) params.append('competency', filters.competency);
    if (filters?.level) params.append('level', filters.level);
    if (filters?.scoringType) params.append('scoringType', filters.scoringType);
    if (filters?.isActive !== undefined) params.append('isActive', filters.isActive.toString());
    if (filters?.search) params.append('search', filters.search);

    const queryString = params.toString();
    const url = queryString ? `${this.basePath}?${queryString}` : this.basePath;

    const response = await api.get<{ data: { rubrics: Rubric[], total: number, page: number, totalPages: number } }>(url,{
      params: { isActive: true }
    });
    return response.data.rubrics;
  }

  async getById(id: string): Promise<Rubric> {
    const response = await api.get<{ data: Rubric }>(`${this.basePath}/${id}`);
    return response.data;
  }

  async getByCompetencyAndLevel(competency: string, level: string): Promise<Rubric[]> {
    const response = await api.get<{ data: Rubric[] }>(`${this.basePath}/competency/${competency}/level/${level}`);
    return response.data;
  }

  async create(rubricData: Omit<Rubric, '_id' | 'createdAt' | 'updatedAt'>): Promise<Rubric> {
    const response = await api.post<{ data: Rubric }>(this.basePath, rubricData);
    return response.data;
  }

  async update(id: string, rubricData: Partial<Rubric>): Promise<Rubric> {
    const response = await api.put<{ data: Rubric }>(`${this.basePath}/${id}`, rubricData);
    return response.data;
  }

  async delete(id: string): Promise<void> {
    await api.delete(`${this.basePath}/${id}`);
  }

  async clone(id: string, newName: string): Promise<Rubric> {
    const response = await api.post<{ data: Rubric }>(`${this.basePath}/${id}/clone`, { name: newName });
    return response.data;
  }

  async activate(id: string): Promise<Rubric> {
    const response = await api.patch<{ data: Rubric }>(`${this.basePath}/${id}/activate`);
    return response.data;
  }

  async deactivate(id: string): Promise<Rubric> {
    const response = await api.patch<{ data: Rubric }>(`${this.basePath}/${id}/deactivate`);
    return response.data;
  }
}

export const rubricsService = new RubricsService();
