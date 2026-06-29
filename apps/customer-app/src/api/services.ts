import { api } from './client';

export interface Service {
  serviceId: string;
  name: string;
  description: string;
  durationMinutes: number;
  isActive: boolean;
}

export const listServices = () => api.get<Service[]>('/services');
