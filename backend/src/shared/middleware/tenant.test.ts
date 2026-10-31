import type { APIGatewayProxyEvent } from 'aws-lambda';
import { extractTenantClaims, authenticate, requireRole, scopeToTenant, UnauthorizedError, ForbiddenError } from './tenant';
import { getUserRecord } from './userRecord';
import { UserRole } from '../types/index.js';

const mockGetUserRecord = jest.mocked(getUserRecord);

function fakeEvent(claims: Record<string, string> | undefined): APIGatewayProxyEvent {
  return {
    requestContext: claims ? { authorizer: { claims } } : {},
  } as unknown as APIGatewayProxyEvent;
}

describe('extractTenantClaims', () => {
  it('throws UnauthorizedError when there are no claims at all', () => {
    expect(() => extractTenantClaims(fakeEvent(undefined))).toThrow(UnauthorizedError);
  });

  it('throws UnauthorizedError when tenantId or sub is missing', () => {
    expect(() => extractTenantClaims(fakeEvent({ email: 'a@b.com' }))).toThrow('Incomplete claims');
    expect(() => extractTenantClaims(fakeEvent({ 'custom:tenantId': 't1' }))).toThrow('Incomplete claims');
  });

  it('defaults role to CUSTOMER and userType to CUSTOMER when absent', () => {
    const claims = extractTenantClaims(fakeEvent({ 'custom:tenantId': 't1', sub: 'u1' }));
    expect(claims.role).toBe(UserRole.CUSTOMER);
    expect(claims.userType).toBe('CUSTOMER');
  });

  it('splits custom:locationIds on commas, treating an empty string as no locations', () => {
    expect(extractTenantClaims(fakeEvent({ 'custom:tenantId': 't1', sub: 'u1', 'custom:locationIds': '' })).locationIds).toEqual([]);
    expect(extractTenantClaims(fakeEvent({ 'custom:tenantId': 't1', sub: 'u1', 'custom:locationIds': 'loc1,loc2' })).locationIds).toEqual(['loc1', 'loc2']);
  });

  it('maps every claim correctly on the happy path, including given_name/family_name -> firstName/lastName', () => {
    const claims = extractTenantClaims(fakeEvent({
      sub: 'u1',
      email: 'owner@shop.com',
      given_name: 'Jane',
      family_name: 'Doe',
      'custom:tenantId': 't1',
      'custom:locationIds': 'loc1',
      'custom:role': UserRole.TENANT_OWNER,
      'custom:userType': 'ADMIN',
    }));
    expect(claims).toEqual({
      userId: 'u1',
      email: 'owner@shop.com',
      firstName: 'Jane',
      lastName: 'Doe',
      tenantId: 't1',
      locationIds: ['loc1'],
      role: UserRole.TENANT_OWNER,
      userType: 'ADMIN',
    });
  });
});

describe('requireRole', () => {
  const claims = extractTenantClaims(fakeEvent({ 'custom:tenantId': 't1', sub: 'u1', 'custom:role': UserRole.LOCATION_MANAGER }));

  it('does not throw when the role is in the allowed list', () => {
    expect(() => requireRole(claims, UserRole.TENANT_OWNER, UserRole.LOCATION_MANAGER)).not.toThrow();
  });

  it('throws ForbiddenError with the role in the message when not allowed', () => {
    expect(() => requireRole(claims, UserRole.TENANT_OWNER)).toThrow(ForbiddenError);
    expect(() => requireRole(claims, UserRole.TENANT_OWNER)).toThrow(/LOCATION_MANAGER/);
  });
});

describe('scopeToTenant', () => {
  it('does not throw when the tenantId matches', () => {
    const claims = extractTenantClaims(fakeEvent({ 'custom:tenantId': 't1', sub: 'u1' }));
    expect(() => scopeToTenant('t1', claims)).not.toThrow();
  });

  it('does not throw on a tenant mismatch when the caller is SUPER_ADMIN', () => {
    const claims = extractTenantClaims(fakeEvent({ 'custom:tenantId': 't1', sub: 'u1', 'custom:role': UserRole.SUPER_ADMIN }));
    expect(() => scopeToTenant('other-tenant', claims)).not.toThrow();
  });

  it('throws UnauthorizedError on a tenant mismatch for a non-super-admin', () => {
    const claims = extractTenantClaims(fakeEvent({ 'custom:tenantId': 't1', sub: 'u1', 'custom:role': UserRole.TENANT_OWNER }));
    expect(() => scopeToTenant('other-tenant', claims)).toThrow(UnauthorizedError);
  });
});

describe('authenticate', () => {
  const adminClaims = {
    'custom:tenantId': 't1', sub: 'admin-1', 'custom:userType': 'ADMIN',
    'custom:role': UserRole.TENANT_OWNER, 'custom:locationIds': 'loc1',
  };

  it('skips the USERS lookup for customers', async () => {
    const claims = await authenticate(fakeEvent({ 'custom:tenantId': 't1', sub: 'c1', 'custom:role': UserRole.CUSTOMER }));
    expect(claims.userId).toBe('c1');
    expect(mockGetUserRecord).not.toHaveBeenCalled();
  });

  it('looks up admins by their own tenant and sub and passes when the row is ACTIVE', async () => {
    mockGetUserRecord.mockResolvedValueOnce({ status: 'ACTIVE', role: UserRole.TENANT_OWNER, locationIds: ['loc1'] });
    const claims = await authenticate(fakeEvent(adminClaims));
    expect(mockGetUserRecord).toHaveBeenCalledWith('t1', 'admin-1');
    expect(claims.role).toBe(UserRole.TENANT_OWNER);
  });

  it('rejects an admin whose USERS row was deleted, even though the token is still valid', async () => {
    mockGetUserRecord.mockResolvedValueOnce(undefined);
    await expect(authenticate(fakeEvent(adminClaims))).rejects.toThrow(UnauthorizedError);
  });

  it('rejects an admin whose USERS row is INACTIVE', async () => {
    mockGetUserRecord.mockResolvedValueOnce({ status: 'INACTIVE', role: UserRole.TENANT_OWNER });
    await expect(authenticate(fakeEvent(adminClaims))).rejects.toThrow('Account is no longer active');
  });

  it('also checks callers with an admin role but no userType claim', async () => {
    mockGetUserRecord.mockResolvedValueOnce(undefined);
    const { 'custom:userType': _omit, ...noUserType } = adminClaims;
    await expect(authenticate(fakeEvent(noUserType))).rejects.toThrow(UnauthorizedError);
  });

  it('takes role and locationIds from the row, not the possibly-stale token', async () => {
    mockGetUserRecord.mockResolvedValueOnce({ status: 'ACTIVE', role: UserRole.LOCATION_MANAGER, locationIds: ['loc2'] });
    const claims = await authenticate(fakeEvent(adminClaims));
    expect(claims.role).toBe(UserRole.LOCATION_MANAGER);
    expect(claims.locationIds).toEqual(['loc2']);
  });

  it("falls back to the token's role and locationIds when the row lacks them", async () => {
    mockGetUserRecord.mockResolvedValueOnce({ status: 'ACTIVE' });
    const claims = await authenticate(fakeEvent(adminClaims));
    expect(claims.role).toBe(UserRole.TENANT_OWNER);
    expect(claims.locationIds).toEqual(['loc1']);
  });
});
