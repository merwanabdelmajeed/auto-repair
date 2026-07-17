import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { PutCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { db, TABLE, queryAll } from '../../shared/utils/dynamodb.js';
import { extractTenantClaims, requireRole, UnauthorizedError, ForbiddenError } from '../../shared/middleware/tenant.js';
import { ok, created, badRequest, notFound, unauthorized, forbidden, serverError } from '../../shared/utils/response.js';
import { logger } from '../../shared/utils/logger.js';
import { UserRole } from '../../shared/types/index.js';

const ADMIN_ROLES = [UserRole.SUPER_ADMIN, UserRole.TENANT_OWNER, UserRole.LOCATION_MANAGER];

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const method = event.httpMethod;
    const serviceId = event.pathParameters?.serviceId;

    // GET /services — public (no Cognito authorizer on this route; see
    // template.yaml). Lets customer-app show the service catalog before
    // someone creates an account. Uses the JWT's tenantId when a real
    // session is present, otherwise falls back to ?tenantId= so a guest
    // browsing the app still sees the right tenant's services.
    if (method === 'GET') {
      const tenantId = event.requestContext?.authorizer?.claims
        ? extractTenantClaims(event).tenantId
        : event.queryStringParameters?.tenantId;
      if (!tenantId) return badRequest('tenantId is required');

      const items = await queryAll({
        TableName: TABLE.SERVICES,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        ExpressionAttributeValues: { ':pk': `TENANT#${tenantId}`, ':skPrefix': 'SERVICE#' },
      });
      const services = items.map(i => ({
        serviceId: i.serviceId as string,
        name: i.name as string,
        description: i.description as string,
        durationMinutes: i.durationMinutes as number,
        price: i.price as number | undefined,
        isActive: i.isActive as boolean,
        createdAt: i.createdAt as string,
        updatedAt: i.updatedAt as string,
      }));
      return ok(services);
    }

    // Everything below requires a real authenticated admin.
    const claims = extractTenantClaims(event);
    const { tenantId } = claims;

    // POST /services — admin only
    if (method === 'POST') {
      requireRole(claims, ...ADMIN_ROLES);
      const body = JSON.parse(event.body ?? '{}') as Record<string, unknown>;
      const { name, description, durationMinutes, price } = body;
      if (!name || durationMinutes === undefined) {
        return badRequest('name and durationMinutes are required');
      }
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const item: Record<string, unknown> = {
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
      if (price !== undefined && price !== null) item.price = Number(price);
      await db.send(new PutCommand({ TableName: TABLE.SERVICES, Item: item }));
      return created(item);
    }

    // PUT /services/{serviceId} — admin only
    if (method === 'PUT' && serviceId) {
      requireRole(claims, ...ADMIN_ROLES);
      const body = JSON.parse(event.body ?? '{}') as Record<string, unknown>;
      const { name, description, durationMinutes, isActive, price } = body;
      if (!name || durationMinutes === undefined) {
        return badRequest('name and durationMinutes are required');
      }
      const hasPriceUpdate = price !== undefined;
      try {
        await db.send(new UpdateCommand({
          TableName: TABLE.SERVICES,
          Key: { PK: `TENANT#${tenantId}`, SK: `SERVICE#${serviceId}` },
          UpdateExpression: `SET #n = :name, description = :desc, durationMinutes = :dur, isActive = :active, updatedAt = :now${hasPriceUpdate ? ', price = :price' : ''}`,
          ExpressionAttributeNames: { '#n': 'name' },
          ExpressionAttributeValues: {
            ':name': name,
            ':desc': description ?? '',
            ':dur': Number(durationMinutes),
            ':active': isActive ?? true,
            ':now': new Date().toISOString(),
            ...(hasPriceUpdate && { ':price': price === null ? undefined : Number(price) }),
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
    logger.error('Unhandled error in services handler', { error: e });
    return serverError();
  }
};
