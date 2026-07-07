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

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export const listCustomers = (cursor?: string | null, limit = 25) =>
  api.get<Page<Customer>>(`/customers?limit=${limit}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
