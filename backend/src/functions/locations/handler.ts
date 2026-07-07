import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { db, TABLE, queryAll } from '../../shared/utils/dynamodb.js';
import { extractTenantClaims, requireRole, UnauthorizedError, ForbiddenError } from '../../shared/middleware/tenant.js';
import { ok, created, badRequest, notFound, unauthorized, forbidden, serverError } from '../../shared/utils/response.js';
import { logger } from '../../shared/utils/logger.js';
import { UserRole, type Location } from '../../shared/types/index.js';

const OWNER_ROLES = [UserRole.SUPER_ADMIN, UserRole.TENANT_OWNER];

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const claims = extractTenantClaims(event);
    const { tenantId } = claims;
    const method = event.httpMethod;
    const locationId = event.pathParameters?.locationId;

    // GET /locations — any authenticated role; customers only see active locations
    if (method === 'GET' && !locationId) {
      const items = await queryAll({
        TableName: TABLE.LOCATIONS,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        ExpressionAttributeValues: { ':pk': `TENANT#${tenantId}`, ':skPrefix': 'LOCATION#' },
      });
      const locations = items
        .map(toLocation)
        .filter(loc => claims.role !== UserRole.CUSTOMER || loc.isActive);
      return ok(locations);
    }

    // POST /locations — owner only
    if (method === 'POST') {
      requireRole(claims, ...OWNER_ROLES);
      const body = JSON.parse(event.body ?? '{}') as Record<string, unknown>;
      const { name, address, phone } = body;
      if (!name || !address) return badRequest('name and address are required');

      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const item: Record<string, unknown> = {
        PK: `TENANT#${tenantId}`,
        SK: `LOCATION#${id}`,
        locationId: id,
        tenantId,
        name,
        address,
        ...(phone ? { phone } : {}),
        isActive: true,
        createdAt: now,
        updatedAt: now,
      };
      await db.send(new PutCommand({ TableName: TABLE.LOCATIONS, Item: item }));
      return created(toLocation(item));
    }

    // PUT /locations/{locationId} — owner only
    if (method === 'PUT' && locationId) {
      requireRole(claims, ...OWNER_ROLES);
      const body = JSON.parse(event.body ?? '{}') as Record<string, unknown>;
      const { name, address, phone, isActive } = body;
      if (!name || !address) return badRequest('name and address are required');

      try {
        await db.send(new UpdateCommand({
          TableName: TABLE.LOCATIONS,
          Key: { PK: `TENANT#${tenantId}`, SK: `LOCATION#${locationId}` },
          UpdateExpression: 'SET #n = :name, address = :address, phone = :phone, isActive = :active, updatedAt = :now',
          ExpressionAttributeNames: { '#n': 'name' },
          ExpressionAttributeValues: {
            ':name': name,
            ':address': address,
            ':phone': phone ?? null,
            ':active': isActive ?? true,
            ':now': new Date().toISOString(),
          },
          ConditionExpression: 'attribute_exists(PK)',
        }));
      } catch (e) {
        if (e instanceof Error && e.name === 'ConditionalCheckFailedException') return notFound('Location not found');
        throw e;
      }
      return ok({ locationId });
    }

    // DELETE /locations/{locationId} — owner only, soft-deactivate
    if (method === 'DELETE' && locationId) {
      requireRole(claims, ...OWNER_ROLES);

      const items = await queryAll({
        TableName: TABLE.LOCATIONS,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        ExpressionAttributeValues: { ':pk': `TENANT#${tenantId}`, ':skPrefix': 'LOCATION#' },
      });
      const activeCount = items.filter(i => i.isActive === true).length;
      const target = items.find(i => i.locationId === locationId);
      if (!target) return notFound('Location not found');
      if (target.isActive === true && activeCount <= 1) {
        return badRequest('Cannot deactivate the only active location');
      }

      await db.send(new UpdateCommand({
        TableName: TABLE.LOCATIONS,
        Key: { PK: `TENANT#${tenantId}`, SK: `LOCATION#${locationId}` },
        UpdateExpression: 'SET isActive = :false, updatedAt = :now',
        ExpressionAttributeValues: { ':false': false, ':now': new Date().toISOString() },
      }));
      return ok({ locationId });
    }

    return badRequest('Unknown route');
  } catch (e) {
    if (e instanceof UnauthorizedError) return unauthorized(e.message);
    if (e instanceof ForbiddenError) return forbidden(e.message);
    logger.error('Unhandled error in locations handler', { error: e });
    return serverError();
  }
};

function toLocation(i: Record<string, unknown>): Location {
  return {
    locationId: i.locationId as string,
    tenantId: i.tenantId as string,
    name: i.name as string,
    address: i.address as string,
    phone: (i.phone as string | undefined) ?? undefined,
    isActive: i.isActive as boolean,
    createdAt: i.createdAt as string,
    updatedAt: i.updatedAt as string,
  };
}
