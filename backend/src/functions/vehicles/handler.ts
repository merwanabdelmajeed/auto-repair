import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { PutCommand, DeleteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { db, TABLE, queryAll } from '../../shared/utils/dynamodb.js';
import { extractTenantClaims, requireRole, UnauthorizedError, ForbiddenError } from '../../shared/middleware/tenant.js';
import { ok, created, badRequest, unauthorized, forbidden, notFound, serverError } from '../../shared/utils/response.js';
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
        // Admins see all vehicles for the tenant
        const items = await queryAll({
          TableName: TABLE.VEHICLES,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
          ExpressionAttributeValues: { ':pk': `TENANT#${tenantId}`, ':skPrefix': 'VEHICLE#' },
        });
        return ok(items.map(toVehicle));
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

    // POST /vehicles — customers register their own vehicles
    if (method === 'POST') {
      requireRole(claims, UserRole.CUSTOMER);
      const body = JSON.parse(event.body ?? '{}') as Record<string, unknown>;
      const { make, model, year, licensePlate, color, vin, trim } = body;
      if (!make || !model || !year || !color) {
        return badRequest('make, model, year, and color are required');
      }
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const item = {
        PK: `TENANT#${tenantId}`,
        SK: `VEHICLE#${id}`,
        GSI1PK: `CUSTOMER#${userId}`,
        GSI1SK: `VEHICLE#${id}`,
        vehicleId: id,
        tenantId,
        customerId: userId,
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

    // PUT /vehicles/{vehicleId} — admins update licensePlate and/or VIN
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
