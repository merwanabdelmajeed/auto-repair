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
  firstName: string;
  lastName: string;
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

export interface Service {
  serviceId: string;
  tenantId: string;
  name: string;
  description: string;
  durationMinutes: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Vehicle {
  vehicleId: string;
  tenantId: string;
  customerId: string;
  make: string;
  model: string;
  year: number;
  licensePlate: string;
  color: string;
  vin?: string;
  createdAt: string;
  updatedAt: string;
}

export type DayName = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export interface DayHours {
  open: string;
  close: string;
}

export interface CapacitySettings {
  tenantId: string;
  slotDurationMinutes: number;
  maxConcurrent: number;
  operatingHours: Record<DayName, DayHours | null>;
  updatedAt: string;
}

export interface BlockedTime {
  blockedTimeId: string;
  tenantId: string;
  label: string;
  startDate: string;
  endDate: string;
  createdAt: string;
}

export interface TimeSlot {
  time: string;
  available: boolean;
  booked: number;
}

export interface AvailabilityResult {
  date: string;
  isOpen: boolean;
  blockedReason?: string;
  slots: TimeSlot[];
}

export interface Promotion {
  promoId: string;
  tenantId: string;
  code: string;
  description: string;
  type: 'percent' | 'fixed';
  value: number;
  expiresAt: string | null;
  maxUses: number | null;
  usedCount: number;
  isActive: boolean;
  createdAt: string;
}

export type AppointmentStatus = 'pending' | 'confirmed' | 'in-progress' | 'completed' | 'cancelled';

export interface Appointment {
  appointmentId: string;
  tenantId: string;
  customerId: string;
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
  customerEmail: string;
  customerName: string;
  createdAt: string;
  updatedAt: string;
}
