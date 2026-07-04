import { api } from './client';

export type DayName = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export interface DayHours {
  open: string;
  close: string;
  lastAppointment?: string;
}

export interface CapacitySettings {
  tenantId: string;
  slotDurationMinutes: number;
  maxConcurrent: number;
  operatingHours: Record<DayName, DayHours | null>;
  updatedAt: string;
}

export const getCapacity = () => api.get<CapacitySettings>('/capacity');
