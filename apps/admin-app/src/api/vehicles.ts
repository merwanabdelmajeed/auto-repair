import { api } from './client';

export interface Vehicle {
  vehicleId: string;
  customerId: string;
  make: string;
  model: string;
  trim?: string;
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

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

// Admin callers get a paginated response ({ items, nextCursor }); this client
// is admin-only, so it always hits that branch of GET /vehicles.
export const listVehicles = (cursor?: string | null, limit = 25) =>
  api.get<Page<Vehicle>>(`/vehicles?limit=${limit}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
export const updateVehicle = (vehicleId: string, data: UpdateVehicleInput) =>
  api.put<Vehicle>(`/vehicles/${vehicleId}`, data);
