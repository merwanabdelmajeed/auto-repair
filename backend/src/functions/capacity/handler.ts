import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { db, TABLE, queryAll } from '../../shared/utils/dynamodb.js';
import { extractTenantClaims, requireRole, UnauthorizedError, ForbiddenError } from '../../shared/middleware/tenant.js';
import { ok, badRequest, unauthorized, forbidden, serverError } from '../../shared/utils/response.js';
import { logger } from '../../shared/utils/logger.js';
import { UserRole, type CapacitySettings } from '../../shared/types/index.js';
import { DEFAULT_CAPACITY } from '../../shared/utils/availability.js';
import { publicTenantId } from '../../shared/utils/publicTenant.js';

// The tenant's first (oldest) location — what the customer app's single
// "Our Location" card represents when it doesn't name a location.
async function defaultLocationId(tenantId: string): Promise<string | undefined> {
  const items = await queryAll({
    TableName: TABLE.LOCATIONS,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
    ExpressionAttributeValues: { ':pk': `TENANT#${tenantId}`, ':skPrefix': 'LOCATION#' },
  });
  const sorted = [...items].sort((a, b) => String(a.createdAt ?? '').localeCompare(String(b.createdAt ?? '')));
  return sorted[0]?.locationId as string | undefined;
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const method = event.httpMethod;

    // GET /capacity — public (Auth: NONE), so the customer app can show
    // today's hours to guests. Operating hours aren't sensitive. Tenant comes
    // from the caller's token or ?tenantId=; locationId is optional and
    // defaults to the tenant's first location.
    if (method === 'GET') {
      const tenantId = publicTenantId(event);
      if (!tenantId) return badRequest('tenantId is required');
      const locationId = event.queryStringParameters?.locationId ?? await defaultLocationId(tenantId);
      if (!locationId) return badRequest('locationId query parameter is required');

      const result = await db.send(new GetCommand({
        TableName: TABLE.CAPACITY,
        Key: { PK: `TENANT#${tenantId}`, SK: `CAPACITY#${locationId}` },
      }));

      const item = result.Item;
      const settings: CapacitySettings = item ? {
        tenantId: item.tenantId as string,
        locationId: item.locationId as string,
        slotDurationMinutes: item.slotDurationMinutes as number,
        maxConcurrent: item.maxConcurrent as number,
        operatingHours: item.operatingHours as CapacitySettings['operatingHours'],
        updatedAt: item.updatedAt as string,
      } : { tenantId, locationId, ...DEFAULT_CAPACITY, updatedAt: new Date().toISOString() };

      return ok(settings);
    }

    const claims = extractTenantClaims(event);
    const { tenantId } = claims;

    if (method === 'PUT') {
      requireRole(claims, UserRole.SUPER_ADMIN, UserRole.TENANT_OWNER, UserRole.LOCATION_MANAGER);

      const body = JSON.parse(event.body ?? '{}') as Partial<CapacitySettings>;
      const { locationId, slotDurationMinutes, maxConcurrent, operatingHours } = body;

      if (!locationId) return badRequest('locationId is required');
      if (slotDurationMinutes !== undefined && (typeof slotDurationMinutes !== 'number' || slotDurationMinutes < 15 || slotDurationMinutes > 480)) {
        return badRequest('slotDurationMinutes must be between 15 and 480');
      }
      if (maxConcurrent !== undefined && (typeof maxConcurrent !== 'number' || maxConcurrent < 1 || maxConcurrent > 20)) {
        return badRequest('maxConcurrent must be between 1 and 20');
      }

      const existing = await db.send(new GetCommand({
        TableName: TABLE.CAPACITY,
        Key: { PK: `TENANT#${tenantId}`, SK: `CAPACITY#${locationId}` },
      }));

      const current = existing.Item ? {
        slotDurationMinutes: existing.Item.slotDurationMinutes as number,
        maxConcurrent: existing.Item.maxConcurrent as number,
        operatingHours: existing.Item.operatingHours as CapacitySettings['operatingHours'],
      } : DEFAULT_CAPACITY;

      const updated: CapacitySettings = {
        tenantId,
        locationId,
        slotDurationMinutes: slotDurationMinutes ?? current.slotDurationMinutes,
        maxConcurrent: maxConcurrent ?? current.maxConcurrent,
        operatingHours: operatingHours ?? current.operatingHours,
        updatedAt: new Date().toISOString(),
      };

      await db.send(new PutCommand({
        TableName: TABLE.CAPACITY,
        Item: { PK: `TENANT#${tenantId}`, SK: `CAPACITY#${locationId}`, ...updated },
      }));

      return ok(updated);
    }

    return badRequest('Unknown route');
  } catch (e) {
    if (e instanceof UnauthorizedError) return unauthorized(e.message);
    if (e instanceof ForbiddenError) return forbidden(e.message);
    logger.error('Unhandled error in capacity handler', { error: e });
    return serverError();
  }
};
