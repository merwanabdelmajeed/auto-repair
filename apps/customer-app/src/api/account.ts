import { api } from './client';

export const deleteAccount = () => api.delete<{ deleted: boolean }>('/customers/me');
