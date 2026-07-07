import { api } from './client';

export interface TimeSlot {
  time: string;
  available: boolean;
  booked: number;
}

export interface AvailabilityResult {
  date: string;
  isOpen: boolean;
  blockedReason?: string;
  slots: TimeSlot[];
}

export const getAvailability = (date: string, locationId: string) =>
  api.get<AvailabilityResult>(`/availability?date=${date}&locationId=${encodeURIComponent(locationId)}`);
