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

export const listVehicles = () => api.get<Vehicle[]>('/vehicles');
