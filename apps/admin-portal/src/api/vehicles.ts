import { api } from './client';

export interface Vehicle {
  vehicleId: string;
  customerId: string;
  make: string;
  model: string;
  trim: string | null;
  year: number;
  licensePlate: string | null;
  color: string;
  vin?: string | null;
  createdAt: string;
}

export interface UpdateVehicleInput {
  licensePlate?: string | null;
  vin?: string | null;
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export const listVehicles = (cursor?: string | null, limit = 25) =>
  api.get<Page<Vehicle>>(`/vehicles?limit=${limit}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
export const updateVehicle = (vehicleId: string, data: UpdateVehicleInput) =>
  api.put<Vehicle>(`/vehicles/${vehicleId}`, data);
