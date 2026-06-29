import { api } from './client';

export interface Appointment {
  appointmentId: string;
  vehicleId: string;
  serviceId: string;
  scheduledAt: string;
  status: 'pending' | 'confirmed' | 'in-progress' | 'completed' | 'cancelled';
  notes?: string;
  promoCode: string | null;
  promoId: string | null;
  promoApplied: boolean;
  serviceName: string;
  vehicleSummary: string;
  createdAt: string;
}

export interface CreateAppointmentInput {
  vehicleId: string;
  serviceId: string;
  scheduledAt: string;
  notes?: string;
  promoCode?: string;
}

export const listAppointments = () => api.get<Appointment[]>('/appointments');
export const createAppointment = (data: CreateAppointmentInput) =>
  api.post<Appointment>('/appointments', data);
export const cancelAppointment = (appointmentId: string) =>
  api.patch<{ appointmentId: string; status: string }>(`/appointments/${appointmentId}/status`, {
    status: 'cancelled',
  });
