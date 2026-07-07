import { api } from './client';

export interface Tenant {
  tenantId: string;
  name: string;
  email: string;
  plan: 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';
  status: 'ACTIVE' | 'SUSPENDED' | 'CANCELLED';
  address?: string;
  phone?: string;
  contactEmail?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TenantInput {
  name: string;
  address?: string;
  phone?: string;
  contactEmail?: string;
}

export const getTenant = () => api.get<Tenant>('/tenants/me');
export const updateTenant = (data: TenantInput) => api.put<Tenant>('/tenants/me', data);
