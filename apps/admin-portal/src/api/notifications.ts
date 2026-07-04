import { api } from './client';

export interface AppNotification {
  notifId: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  appointmentId: string | null;
  promoId: string | null;
}

export const getNotifications = () => api.get<AppNotification[]>('/notifications');
export const markRead = (notifId: string) => api.put<{ notifId: string }>(`/notifications/${notifId}/read`, {});
