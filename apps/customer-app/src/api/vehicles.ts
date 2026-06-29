import { api } from './client';

export interface Vehicle {
  vehicleId: string;
  make: string;
  model: string;
  trim: string | null;
  year: number;
  licensePlate: string | null;
  color: string;
  vin?: string | null;
}

export interface CreateVehicleInput {
  make: string;
  model: string;
  trim?: string;
  year: number;
  licensePlate?: string;
  color: string;
  vin?: string;
}

export const listVehicles = () => api.get<Vehicle[]>('/vehicles');
export const createVehicle = (data: CreateVehicleInput) => api.post<Vehicle>('/vehicles', data);
export const deleteVehicle = (vehicleId: string) => api.delete<{ vehicleId: string }>(`/vehicles/${vehicleId}`);
