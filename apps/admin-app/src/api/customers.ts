import { api } from './client';

export interface Customer {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
}

export const listCustomers = () => api.get<Customer[]>('/customers');
