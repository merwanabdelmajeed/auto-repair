import type { APIGatewayProxyEvent } from 'aws-lambda';
import { UserRole, type ExtractedClaims, type UserType } from '../types/index.js';
import { getUserRecord } from './userRecord.js';

export class UnauthorizedError extends Error {
  constructor(message = 'Missing or invalid authentication') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends Error {
  constructor(message = 'Insufficient permissions') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export function extractTenantClaims(event: APIGatewayProxyEvent): ExtractedClaims {
  const claims = event.requestContext?.authorizer?.claims as Record<string, string> | undefined;

  if (!claims) throw new UnauthorizedError();

  const tenantId = claims['custom:tenantId'];
  const userId = claims['sub'];
  const email = claims['email'];
  const firstName = claims['given_name'] ?? '';
  const lastName = claims['family_name'] ?? '';
  const rawLocationIds = claims['custom:locationIds'] ?? '';
  // Default to CUSTOMER when role is absent (self-registered users don't have role set in Cognito)
  const role = (claims['custom:role'] as UserRole) || UserRole.CUSTOMER;
  const userType = (claims['custom:userType'] as UserType) || 'CUSTOMER';

  if (!tenantId || !userId) throw new UnauthorizedError('Incomplete claims');

  const locationIds = rawLocationIds ? rawLocationIds.split(',').filter(Boolean) : [];

  return { userId, email, firstName, lastName, tenantId, locationIds, role, userType };
}

// The API Gateway Cognito authorizer only checks the ID token's signature and
// expiry — a token issued before an admin was deleted, deactivated or re-roled
// stays valid for up to IdTokenValidity (1h). So for admin callers, the USERS
// row (which admin-users DELETE/PATCH keep in step with Cognito) is the source
// of truth: no ACTIVE row → 401, and role/locationIds come from the row, not
// the possibly-stale token. Customers skip the lookup: they can only touch
// their own data, and they delete themselves (which signs them out).
export async function authenticate(event: APIGatewayProxyEvent): Promise<ExtractedClaims> {
  const claims = extractTenantClaims(event);
  if (claims.role === UserRole.CUSTOMER && claims.userType !== 'ADMIN') return claims;

  const record = await getUserRecord(claims.tenantId, claims.userId);
  if (!record || record.status !== 'ACTIVE') {
    throw new UnauthorizedError('Account is no longer active');
  }
  return {
    ...claims,
    role: record.role ?? claims.role,
    locationIds: record.locationIds ?? claims.locationIds,
  };
}

export function requireRole(claims: ExtractedClaims, ...allowed: UserRole[]): void {
  if (!allowed.includes(claims.role)) {
    throw new ForbiddenError(`Role ${claims.role} is not permitted for this action`);
  }
}

export function scopeToTenant(tenantId: string, claims: ExtractedClaims): void {
  if (claims.role !== UserRole.SUPER_ADMIN && claims.tenantId !== tenantId) {
    throw new UnauthorizedError('Tenant mismatch');
  }
}
