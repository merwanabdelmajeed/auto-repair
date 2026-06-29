import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { QueryCommand, PutCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { db, TABLE } from '../../shared/utils/dynamodb.js';
import { extractTenantClaims, requireRole, UnauthorizedError, ForbiddenError } from '../../shared/middleware/tenant.js';
import { ok, created, badRequest, notFound, unauthorized, forbidden, serverError } from '../../shared/utils/response.js';
import { UserRole } from '../../shared/types/index.js';

const ADMIN_ROLES = [UserRole.SUPER_ADMIN, UserRole.TENANT_OWNER, UserRole.LOCATION_MANAGER];

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const claims = extractTenantClaims(event);
    const { tenantId } = claims;
    const method = event.httpMethod;
    const serviceId = event.pathParameters?.serviceId;

    // GET /services — all authenticated users
    if (method === 'GET') {
      const result = await db.send(new QueryCommand({
        TableName: TABLE.SERVICES,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        ExpressionAttributeValues: { ':pk': `TENANT#${tenantId}`, ':skPrefix': 'SERVICE#' },
      }));
      const services = (result.Items ?? []).map(i => ({
        serviceId: i.serviceId as string,
        name: i.name as string,
        description: i.description as string,
        durationMinutes: i.durationMinutes as number,
        isActive: i.isActive as boolean,
        createdAt: i.createdAt as string,
        updatedAt: i.updatedAt as string,
      }));
      return ok(services);
    }

    // POST /services — admin only
    if (method === 'POST') {
      requireRole(claims, ...ADMIN_ROLES);
      const body = JSON.parse(event.body ?? '{}') as Record<string, unknown>;
      const { name, description, durationMinutes } = body;
      if (!name || durationMinutes === undefined) {
        return badRequest('name and durationMinutes are required');
      }
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const item = {
        PK: `TENANT#${tenantId}`,
        SK: `SERVICE#${id}`,
        serviceId: id,
        tenantId,
        name,
        description: description ?? '',
        durationMinutes: Number(durationMinutes),
        isActive: true,
        createdAt: now,
        updatedAt: now,
      };
      await db.send(new PutCommand({ TableName: TABLE.SERVICES, Item: item }));
      return created(item);
    }

    // PUT /services/{serviceId} — admin only
    if (method === 'PUT' && serviceId) {
      requireRole(claims, ...ADMIN_ROLES);
      const body = JSON.parse(event.body ?? '{}') as Record<string, unknown>;
      const { name, description, durationMinutes, isActive } = body;
      if (!name || durationMinutes === undefined) {
        return badRequest('name and durationMinutes are required');
      }
      try {
        await db.send(new UpdateCommand({
          TableName: TABLE.SERVICES,
          Key: { PK: `TENANT#${tenantId}`, SK: `SERVICE#${serviceId}` },
          UpdateExpression: 'SET #n = :name, description = :desc, durationMinutes = :dur, isActive = :active, updatedAt = :now',
          ExpressionAttributeNames: { '#n': 'name' },
          ExpressionAttributeValues: {
            ':name': name,
            ':desc': description ?? '',
            ':dur': Number(durationMinutes),
            ':active': isActive ?? true,
            ':now': new Date().toISOString(),
          },
          ConditionExpression: 'attribute_exists(PK)',
        }));
      } catch (e) {
        if (e instanceof Error && e.name === 'ConditionalCheckFailedException') return notFound('Service not found');
        throw e;
      }
      return ok({ serviceId });
    }

    // DELETE /services/{serviceId} — admin only
    if (method === 'DELETE' && serviceId) {
      requireRole(claims, UserRole.SUPER_ADMIN, UserRole.TENANT_OWNER);
      await db.send(new DeleteCommand({
        TableName: TABLE.SERVICES,
        Key: { PK: `TENANT#${tenantId}`, SK: `SERVICE#${serviceId}` },
      }));
      return ok({ serviceId });
    }

    return badRequest('Unknown route');
  } catch (e) {
    if (e instanceof UnauthorizedError) return unauthorized(e.message);
    if (e instanceof ForbiddenError) return forbidden(e.message);
    console.error(e);
    return serverError();
  }
};
