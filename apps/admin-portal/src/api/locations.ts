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

export interface LocationInput {
  name: string;
  address: string;
  phone?: string;
  isActive?: boolean;
}

export const listLocations = () => api.get<Location[]>('/locations');
export const createLocation = (data: LocationInput) => api.post<Location>('/locations', data);
export const updateLocation = (locationId: string, data: LocationInput) =>
  api.put<{ locationId: string }>(`/locations/${locationId}`, data);
export const deleteLocation = (locationId: string) =>
  api.delete<{ locationId: string }>(`/locations/${locationId}`);
