import { api } from './client';

export type AppointmentStatus = 'pending' | 'confirmed' | 'in-progress' | 'completed' | 'cancelled';

export interface Appointment {
  appointmentId: string;
  customerId: string;
  customerEmail: string;
  customerName: string;
  vehicleId: string;
  serviceId: string;
  scheduledAt: string;
  status: AppointmentStatus;
  notes?: string;
  promoCode: string | null;
  promoId: string | null;
  promoApplied: boolean;
  serviceName: string;
  vehicleSummary: string;
  createdAt: string;
  updatedAt: string;
}

export const listAppointments = () => api.get<Appointment[]>('/appointments');
export const updateAppointmentStatus = (appointmentId: string, status: AppointmentStatus) =>
  api.patch<{ appointmentId: string; status: AppointmentStatus }>(
    `/appointments/${appointmentId}/status`,
    { status },
  );
export const applyPromo = (promoId: string, customerId: string, appointmentId: string) =>
  api.post<{ applied: boolean }>(`/promotions/${promoId}/apply`, { customerId, appointmentId });
