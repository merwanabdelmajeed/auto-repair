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

export const listVehicles = () => api.get<Vehicle[]>('/vehicles');
export const updateVehicle = (vehicleId: string, data: UpdateVehicleInput) =>
  api.put<Vehicle>(`/vehicles/${vehicleId}`, data);
