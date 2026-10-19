import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { GetCommand, PutCommand, DeleteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { db, TABLE, queryAll, queryPage } from '../../shared/utils/dynamodb.js';
import { extractTenantClaims, requireRole, UnauthorizedError, ForbiddenError } from '../../shared/middleware/tenant.js';
import { ok, paginated, created, badRequest, unauthorized, forbidden, notFound, serverError } from '../../shared/utils/response.js';
import { logger } from '../../shared/utils/logger.js';
import { UserRole } from '../../shared/types/index.js';

const ADMIN_ROLES = [UserRole.SUPER_ADMIN, UserRole.TENANT_OWNER, UserRole.LOCATION_MANAGER];

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const claims = extractTenantClaims(event);
    const { tenantId, userId, role } = claims;
    const method = event.httpMethod;
    const vehicleId = event.pathParameters?.vehicleId;
    const isAdmin = ADMIN_ROLES.includes(role);

    // GET /vehicles
    if (method === 'GET') {
      if (isAdmin) {
        // Admins see all vehicles for the tenant, paginated
        const cursor = event.queryStringParameters?.cursor ?? null;
        const limit = Math.min(Number(event.queryStringParameters?.limit ?? 25) || 25, 100);
        const { items, nextCursor } = await queryPage({
          TableName: TABLE.VEHICLES,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
          ExpressionAttributeValues: { ':pk': `TENANT#${tenantId}`, ':skPrefix': 'VEHICLE#' },
          limit,
          cursor,
        });
        return paginated(items.map(toVehicle), nextCursor);
      } else {
        // Customers see their own vehicles via GSI1
        const items = await queryAll({
          TableName: TABLE.VEHICLES,
          IndexName: 'GSI1',
          KeyConditionExpression: 'GSI1PK = :gsi1pk',
          ExpressionAttributeValues: { ':gsi1pk': `CUSTOMER#${userId}` },
        });
        return ok(items.map(toVehicle));
      }
    }

    // POST /vehicles — a customer registers their own vehicle, or an admin
    // adds one for a customer (body.customerId). Admins add by VIN only — the
    // paid plate lookup is customer-only — so a VIN is required on that path.
    if (method === 'POST') {
      const body = JSON.parse(event.body ?? '{}') as Record<string, unknown>;
      const { make, model, year, licensePlate, color, vin, trim } = body;
      let ownerId: string;
      if (isAdmin) {
        const customerId = typeof body.customerId === 'string' ? body.customerId.trim() : '';
        if (!customerId) return badRequest('customerId is required');
        if (typeof vin !== 'string' || !vin.trim()) return badRequest('vin is required');
        // Must be a customer in the admin's own tenant — the key is built from
        // the admin's tenantId, so another tenant's customer is simply not found.
        const { Item: owner } = await db.send(new GetCommand({
          TableName: TABLE.USERS,
          Key: { PK: `TENANT#${tenantId}`, SK: `USER#${customerId}` },
        }));
        if (!owner || owner.role !== 'CUSTOMER') return notFound('Customer not found');
        ownerId = customerId;
      } else {
        requireRole(claims, UserRole.CUSTOMER);
        ownerId = userId;
      }
      if (!make || !model || !year || !color) {
        return badRequest('make, model, year, and color are required');
      }
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const item = {
        PK: `TENANT#${tenantId}`,
        SK: `VEHICLE#${id}`,
        GSI1PK: `CUSTOMER#${ownerId}`,
        GSI1SK: `VEHICLE#${id}`,
        vehicleId: id,
        tenantId,
        customerId: ownerId,
        make,
        model,
        year: Number(year),
        ...(trim ? { trim } : {}),
        ...(licensePlate ? { licensePlate } : {}),
        color,
        ...(vin ? { vin } : {}),
        createdAt: now,
        updatedAt: now,
      };
      await db.send(new PutCommand({ TableName: TABLE.VEHICLES, Item: item }));
      return created(toVehicle(item));
    }

    // PUT /vehicles/{vehicleId} — admins update licensePlate and/or VIN.
    // Year/make/model are deliberately not editable here: a VIN that decodes
    // to a different car is added as a new vehicle instead (so the old car's
    // service history stays attached to the right vehicle).
    if (method === 'PUT' && vehicleId) {
      if (!isAdmin) return forbidden('Admin access required');
      const body = JSON.parse(event.body ?? '{}') as Record<string, unknown>;
      const { licensePlate, vin } = body;
      const now = new Date().toISOString();
      const result = await db.send(new UpdateCommand({
        TableName: TABLE.VEHICLES,
        Key: { PK: `TENANT#${tenantId}`, SK: `VEHICLE#${vehicleId}` },
        ConditionExpression: 'attribute_exists(PK)',
        UpdateExpression: 'SET licensePlate = :lp, vin = :vin, updatedAt = :now',
        ExpressionAttributeValues: {
          ':lp': licensePlate ?? null,
          ':vin': vin ?? null,
          ':now': now,
        },
        ReturnValues: 'ALL_NEW',
      }));
      return ok(toVehicle(result.Attributes ?? {}));
    }

    // DELETE /vehicles/{vehicleId}
    if (method === 'DELETE' && vehicleId) {
      await db.send(new DeleteCommand({
        TableName: TABLE.VEHICLES,
        Key: { PK: `TENANT#${tenantId}`, SK: `VEHICLE#${vehicleId}` },
      }));
      return ok({ vehicleId });
    }

    return badRequest('Unknown route');
  } catch (e) {
    if (e instanceof UnauthorizedError) return unauthorized(e.message);
    if (e instanceof ForbiddenError) return forbidden(e.message);
    if ((e as { name?: string }).name === 'ConditionalCheckFailedException') return notFound('Vehicle not found');
    logger.error('Unhandled error in vehicles handler', { error: e });
    return serverError();
  }
};

function toVehicle(i: Record<string, unknown>) {
  return {
    vehicleId: i.vehicleId,
    tenantId: i.tenantId,
    customerId: i.customerId,
    make: i.make,
    model: i.model,
    trim: i.trim ?? null,
    year: i.year,
    licensePlate: i.licensePlate ?? null,
    color: i.color,
    vin: i.vin ?? null,
    createdAt: i.createdAt,
    updatedAt: i.updatedAt,
  };
}
