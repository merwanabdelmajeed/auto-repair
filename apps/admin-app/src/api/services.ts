import { api } from './client';

export interface Service {
  serviceId: string;
  name: string;
  description: string;
  price?: number;
  isActive: boolean;
}

export interface ServiceInput {
  name: string;
  description: string;
  price?: number;
  isActive?: boolean;
}

export const listServices = () => api.get<Service[]>('/services');
export const createService = (data: ServiceInput) => api.post<Service>('/services', data);
export const updateService = (serviceId: string, data: ServiceInput) =>
  api.put<{ serviceId: string }>(`/services/${serviceId}`, data);
export const deleteService = (serviceId: string) =>
  api.delete<{ serviceId: string }>(`/services/${serviceId}`);
