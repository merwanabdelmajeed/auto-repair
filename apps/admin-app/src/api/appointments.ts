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
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

// Admin callers get a paginated response; this client is admin-only, so it
// always hits that branch of GET /appointments.
export const listAppointments = (cursor?: string | null, limit = 25) =>
  api.get<Page<Appointment>>(`/appointments?limit=${limit}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
export const updateAppointmentStatus = (appointmentId: string, status: AppointmentStatus) =>
  api.patch<{ appointmentId: string; status: AppointmentStatus }>(
    `/appointments/${appointmentId}/status`,
    { status },
  );
export const applyPromo = (promoId: string, customerId: string, appointmentId: string) =>
  api.post<{ applied: boolean }>(`/promotions/${promoId}/apply`, { customerId, appointmentId });
