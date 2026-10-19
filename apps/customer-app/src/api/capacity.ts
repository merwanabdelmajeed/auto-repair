import { api } from './client';
import { DEFAULT_TENANT_ID } from '../constants';

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

// Public route, so it works for guests too. tenantId is always sent (the
// backend prefers the JWT's tenant when signed in); with no locationId the
// backend returns the shop's first location's hours.
export const getCapacity = () => api.get<CapacitySettings>(`/capacity?tenantId=${DEFAULT_TENANT_ID}`);
