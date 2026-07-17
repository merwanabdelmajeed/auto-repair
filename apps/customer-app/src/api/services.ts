import { api } from './client';
import { DEFAULT_TENANT_ID } from '../constants';

export interface Service {
  serviceId: string;
  name: string;
  description: string;
  durationMinutes: number;
  isActive: boolean;
}

// tenantId is always included, even for a logged-in request — the backend
// prefers the JWT's tenantId when a session is present and only falls back
// to this query param for guest (unauthenticated) browsing.
export const listServices = () => api.get<Service[]>(`/services?tenantId=${DEFAULT_TENANT_ID}`);
