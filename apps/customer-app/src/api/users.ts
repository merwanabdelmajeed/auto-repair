import { api } from './client';
import type { Address } from '../utils/address';

export interface MyProfile {
  firstName: string;
  lastName: string;
  phone: string | null;
  address: Address | null;
}

// The DynamoDB USERS record, not the Cognito token, is the source of truth for
// the phone: it's never synced back to Cognito, and a shop admin can edit it.
export const getMyProfile = () => api.get<MyProfile>('/users/me');

// Persists name, phone and address to the DynamoDB USERS record (the admin
// Customers list reads them from there). The client updates the name in
// Cognito separately via CognitoService.updateProfile; this keeps the two in
// sync. A null address clears it.
export const updateMyProfile = (firstName: string, lastName: string, phone: string, address: Address | null) =>
  api.put<MyProfile>('/users/me', { firstName, lastName, phone, address });
