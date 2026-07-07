import { api } from './client';

export type AdminRole = 'TENANT_OWNER' | 'LOCATION_MANAGER';

export interface AdminUser {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: AdminRole;
  locationIds: string[];
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
}

export interface InviteAdminUserInput {
  email: string;
  firstName?: string;
  lastName?: string;
  role: AdminRole;
  locationIds: string[];
}

export interface UpdateAdminUserInput {
  role?: AdminRole;
  locationIds?: string[];
  status?: 'ACTIVE' | 'INACTIVE';
}

export const listAdminUsers = () => api.get<AdminUser[]>('/admin-users');
export const inviteAdminUser = (data: InviteAdminUserInput) => api.post<AdminUser>('/admin-users', data);
export const updateAdminUser = (userId: string, data: UpdateAdminUserInput) =>
  api.patch<{ userId: string }>(`/admin-users/${userId}`, data);
export const deleteAdminUser = (userId: string) => api.delete<{ userId: string }>(`/admin-users/${userId}`);
