import { api } from './client';

export interface AnalyticsSummary {
  totalBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  pendingBookings: number;
  totalRevenue: number;
  avgServiceMinutes: number;
  uniqueCustomers: number;
  newCustomers: number;
  returningCustomers: number;
}

export interface DayData {
  date: string;
  bookings: number;
  completed: number;
  revenue: number;
}

export interface ServiceData {
  serviceId: string;
  serviceName: string;
  bookings: number;
  completed: number;
  revenue: number;
  durationMinutes: number;
}

export interface AnalyticsResponse {
  summary: AnalyticsSummary;
  byDay: DayData[];
  byService: ServiceData[];
  byStatus: Record<string, number>;
}

export const getAnalytics = (startDate: string, endDate: string) =>
  api.get<AnalyticsResponse>(`/analytics?startDate=${startDate}&endDate=${endDate}`);
