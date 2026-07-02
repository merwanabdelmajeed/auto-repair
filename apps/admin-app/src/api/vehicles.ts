import { api } from './client';

export interface Vehicle {
  vehicleId: string;
  customerId: string;
  make: string;
  model: string;
  year: number;
  licensePlate: string;
  color: string;
  vin?: string;
  createdAt: string;
}

export interface UpdateVehicleInput {
  licensePlate?: string;
  vin?: string;
}

export const listVehicles = () => api.get<Vehicle[]>('/vehicles');
export const updateVehicle = (vehicleId: string, data: UpdateVehicleInput) =>
  api.put<Vehicle>(`/vehicles/${vehicleId}`, data);
