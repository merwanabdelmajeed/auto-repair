import { api } from './client';

export interface BlockedTime {
  blockedTimeId: string;
  tenantId: string;
  locationId: string;
  label: string;
  startDate: string;
  endDate: string;
  createdAt: string;
}

export interface BlockedTimeInput {
  label: string;
  startDate: string;
  endDate: string;
}

export const listBlockedTimes = (locationId: string) =>
  api.get<BlockedTime[]>(`/blocked-times?locationId=${encodeURIComponent(locationId)}`);
export const createBlockedTime = (locationId: string, data: BlockedTimeInput) =>
  api.post<BlockedTime>('/blocked-times', { ...data, locationId });
export const deleteBlockedTime = (blockedTimeId: string) =>
  api.delete<{ blockedTimeId: string }>(`/blocked-times/${blockedTimeId}`);
