import axios, { type AxiosInstance } from 'axios';
import { authSDK } from './sdk-simple-auth';

class ApiService {
  private api: AxiosInstance;
  private baseURL: string;

  constructor() {
    this.baseURL = import.meta.env.VITE_EXAM_SERVICE_URL || 'http://localhost:3003';
    this.api = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Interceptor para agregar token automáticamente
    this.api.interceptors.request.use(
      (config) => {
        const token = authSDK.getAccessToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Interceptor para manejar respuestas
    // this.api.interceptors.response.use(
    //   (response) => response,
    //   (error) => {
    //     if (error.response?.status === 401) {
    //       authSDK.logout();
    //       window.location.href = '/login';
    //     }
    //     return Promise.reject(error);
    //   }
    // );
  }

  // Métodos HTTP básicos
  async get<T>(url: string, config?: any): Promise<T> {
    const response = await this.api.get(url, config);
    return response.data;
  }

  async post<T>(url: string, data?: any, config?: any): Promise<T> {
    const response = await this.api.post(url, data, config);
    return response.data;
  }

  async put<T>(url: string, data?: any, config?: any): Promise<T> {
    const response = await this.api.put(url, data, config);
    return response.data;
  }

  async patch<T>(url: string, data?: any, config?: any): Promise<T> {
    const response = await this.api.patch(url, data, config);
    return response.data;
  }

  async delete<T>(url: string, config?: any): Promise<T> {
    const response = await this.api.delete(url, config);
    return response.data;
  }
}

export const api = new ApiService();