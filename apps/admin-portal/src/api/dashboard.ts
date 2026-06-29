import { api } from './client';

export interface DashboardSummary {
  totalCustomers: number;
  totalVehicles: number;
  totalAppointments: number;
  bookingsToday: number;
}

export const getDashboardSummary = () => {
  // Pass local date so Lambda (which runs in UTC) counts "today" correctly for the admin's timezone
  const localDate = new Date().toLocaleDateString('en-CA'); // gives YYYY-MM-DD
  return api.get<DashboardSummary>(`/dashboard/summary?localDate=${localDate}`);
};
