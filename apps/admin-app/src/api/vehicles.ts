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

export const listVehicles = () => api.get<Vehicle[]>('/vehicles');
