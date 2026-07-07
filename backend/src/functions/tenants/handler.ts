import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { db, TABLE } from '../../shared/utils/dynamodb.js';
import { extractTenantClaims, requireRole, UnauthorizedError, ForbiddenError } from '../../shared/middleware/tenant.js';
import { ok, badRequest, notFound, unauthorized, forbidden, serverError } from '../../shared/utils/response.js';
import { logger } from '../../shared/utils/logger.js';
import { UserRole, type Tenant } from '../../shared/types/index.js';

const ADMIN_ROLES = [UserRole.SUPER_ADMIN, UserRole.TENANT_OWNER, UserRole.LOCATION_MANAGER];
const OWNER_ROLES = [UserRole.SUPER_ADMIN, UserRole.TENANT_OWNER];

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const claims = extractTenantClaims(event);
    requireRole(claims, ...ADMIN_ROLES);
    const { tenantId } = claims;
    const method = event.httpMethod;

    // GET /tenants/me — any admin role
    if (method === 'GET') {
      const result = await db.send(new GetCommand({
        TableName: TABLE.TENANTS,
        Key: { PK: `TENANT#${tenantId}`, SK: 'PROFILE' },
      }));
      if (!result.Item) return notFound('Tenant profile not found');
      return ok(toTenant(result.Item));
    }

    // PUT /tenants/me — owner only
    if (method === 'PUT') {
      requireRole(claims, ...OWNER_ROLES);
      const body = JSON.parse(event.body ?? '{}') as Record<string, unknown>;
      const { name, address, phone, contactEmail } = body;
      if (!name) return badRequest('name is required');

      const existing = await db.send(new GetCommand({
        TableName: TABLE.TENANTS,
        Key: { PK: `TENANT#${tenantId}`, SK: 'PROFILE' },
      }));
      const now = new Date().toISOString();
      const item: Record<string, unknown> = {
        PK: `TENANT#${tenantId}`,
        SK: 'PROFILE',
        tenantId,
        name,
        email: (existing.Item?.email as string | undefined) ?? claims.email,
        plan: (existing.Item?.plan as string | undefined) ?? 'STARTER',
        status: (existing.Item?.status as string | undefined) ?? 'ACTIVE',
        address: address ?? null,
        phone: phone ?? null,
        contactEmail: contactEmail ?? null,
        createdAt: (existing.Item?.createdAt as string | undefined) ?? now,
        updatedAt: now,
      };
      await db.send(new PutCommand({ TableName: TABLE.TENANTS, Item: item }));
      return ok(toTenant(item));
    }

    return badRequest('Unknown route');
  } catch (e) {
    if (e instanceof UnauthorizedError) return unauthorized(e.message);
    if (e instanceof ForbiddenError) return forbidden(e.message);
    logger.error('Unhandled error in tenants handler', { error: e });
    return serverError();
  }
};

function toTenant(i: Record<string, unknown>): Tenant {
  return {
    tenantId: i.tenantId as string,
    name: i.name as string,
    email: i.email as string,
    plan: i.plan as Tenant['plan'],
    status: i.status as Tenant['status'],
    address: (i.address as string | undefined) ?? undefined,
    phone: (i.phone as string | undefined) ?? undefined,
    contactEmail: (i.contactEmail as string | undefined) ?? undefined,
    createdAt: i.createdAt as string,
    updatedAt: i.updatedAt as string,
  };
}
