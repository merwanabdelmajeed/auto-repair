export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  TENANT_OWNER = 'TENANT_OWNER',
  LOCATION_MANAGER = 'LOCATION_MANAGER',
  CUSTOMER = 'CUSTOMER',
}

export type UserType = 'ADMIN' | 'CUSTOMER';

export interface JwtClaims {
  sub: string;
  email: string;
  'custom:tenantId': string;
  'custom:locationIds': string;
  'custom:role': UserRole;
  'custom:userType': UserType;
}

export interface ExtractedClaims {
  userId: string;
  email: string;
  tenantId: string;
  locationIds: string[];
  role: UserRole;
  userType: UserType;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface Tenant {
  tenantId: string;
  name: string;
  email: string;
  plan: 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';
  status: 'ACTIVE' | 'SUSPENDED' | 'CANCELLED';
  createdAt: string;
  updatedAt: string;
}

export interface User {
  userId: string;
  tenantId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  userType: UserType;
  locationIds: string[];
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  updatedAt: string;
}
