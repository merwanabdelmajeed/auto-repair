import { api } from './client';

export type DayName = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export interface DayHours {
  open: string;
  close: string;
  lastAppointment?: string;
}

export interface CapacitySettings {
  tenantId: string;
  locationId: string;
  slotDurationMinutes: number;
  maxConcurrent: number;
  operatingHours: Record<DayName, DayHours | null>;
  updatedAt: string;
}

export const getCapacity = (locationId: string) =>
  api.get<CapacitySettings>(`/capacity?locationId=${encodeURIComponent(locationId)}`);
export const updateCapacity = (locationId: string, data: Partial<CapacitySettings>) =>
  api.put<CapacitySettings>('/capacity', { ...data, locationId });
