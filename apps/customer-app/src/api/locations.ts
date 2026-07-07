import { api } from './client';

export interface Location {
  locationId: string;
  name: string;
  address: string;
  phone?: string;
}

export const listLocations = () => api.get<Location[]>('/locations');
