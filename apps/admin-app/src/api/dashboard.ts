import { api } from './client';

export interface DashboardSummary {
  totalCustomers: number;
  totalVehicles: number;
  totalAppointments: number;
  bookingsToday: number;
}

export const getDashboardSummary = () => {
  const d = new Date();
  const localDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return api.get<DashboardSummary>(`/dashboard/summary?localDate=${localDate}`);
};
