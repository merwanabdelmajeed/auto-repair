import { api } from './client';

export interface CustomerAddress {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
}

export interface Customer {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  address?: CustomerAddress | null;
  status: string;
  createdAt: string;
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

// Admin edits a customer's phone and/or address. Phone: non-empty string,
// no validation (customers may share a number). Address: null clears it.
export interface CustomerUpdate {
  phone?: string;
  address?: CustomerAddress | null;
}

export const updateCustomer = (customerId: string, patch: CustomerUpdate) =>
  api.patch<{ userId: string } & CustomerUpdate>(`/customers/${encodeURIComponent(customerId)}`, patch);

export const listCustomers = (cursor?: string | null, limit = 25) =>
  api.get<Page<Customer>>(`/customers?limit=${limit}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
