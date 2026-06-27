import type { APIGatewayProxyEvent } from 'aws-lambda';
import { UserRole, type ExtractedClaims, type UserType } from '../types/index.js';

export class UnauthorizedError extends Error {
  constructor(message = 'Missing or invalid authentication') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export function extractTenantClaims(event: APIGatewayProxyEvent): ExtractedClaims {
  const claims = event.requestContext?.authorizer?.claims as Record<string, string> | undefined;

  if (!claims) throw new UnauthorizedError();

  const tenantId = claims['custom:tenantId'];
  const role = claims['custom:role'] as UserRole;
  const userType = claims['custom:userType'] as UserType;
  const userId = claims['sub'];
  const email = claims['email'];
  const rawLocationIds = claims['custom:locationIds'] ?? '';

  if (!tenantId || !role || !userId) throw new UnauthorizedError('Incomplete claims');

  const locationIds = rawLocationIds ? rawLocationIds.split(',').filter(Boolean) : [];

  return { userId, email, tenantId, locationIds, role, userType };
}

export function requireRole(claims: ExtractedClaims, ...allowed: UserRole[]): void {
  if (!allowed.includes(claims.role)) {
    throw new UnauthorizedError(`Role ${claims.role} is not permitted for this action`);
  }
}

export function scopeToTenant(tenantId: string, claims: ExtractedClaims): void {
  if (claims.role !== UserRole.SUPER_ADMIN && claims.tenantId !== tenantId) {
    throw new UnauthorizedError('Tenant mismatch');
  }
}
