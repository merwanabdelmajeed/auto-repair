import { api } from './client';

export interface BlockedTime {
  blockedTimeId: string;
  tenantId: string;
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

export const listBlockedTimes = () => api.get<BlockedTime[]>('/blocked-times');
export const createBlockedTime = (data: BlockedTimeInput) => api.post<BlockedTime>('/blocked-times', data);
export const deleteBlockedTime = (blockedTimeId: string) =>
  api.delete<{ blockedTimeId: string }>(`/blocked-times/${blockedTimeId}`);
