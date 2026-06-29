import { api } from './client';

export type DayName = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export interface DayHours {
  open: string;
  close: string;
}

export interface CapacitySettings {
  tenantId: string;
  slotDurationMinutes: number;
  maxConcurrent: number;
  operatingHours: Record<DayName, DayHours | null>;
  updatedAt: string;
}

export const getCapacity = () => api.get<CapacitySettings>('/capacity');
export const updateCapacity = (data: Partial<CapacitySettings>) => api.put<CapacitySettings>('/capacity', data);
