import { api } from './client';

export interface Location {
  locationId: string;
  tenantId: string;
  name: string;
  address: string;
  phone?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const listLocations = () => api.get<Location[]>('/locations');
