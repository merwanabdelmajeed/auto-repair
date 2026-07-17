import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { PutCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { db, TABLE, queryAll } from '../../shared/utils/dynamodb.js';
import { extractTenantClaims, requireRole, UnauthorizedError, ForbiddenError } from '../../shared/middleware/tenant.js';
import { ok, created, badRequest, notFound, unauthorized, forbidden, serverError } from '../../shared/utils/response.js';
import { logger } from '../../shared/utils/logger.js';
import { UserRole } from '../../shared/types/index.js';

const ADMIN_ROLES = [UserRole.SUPER_ADMIN, UserRole.TENANT_OWNER, UserRole.LOCATION_MANAGER];

// GET /services has Auth: Authorizer NONE (see template.yaml), so API Gateway
// never runs the Cognito authorizer on this route and event.requestContext.
// authorizer.claims is never populated — even for admin-portal/admin-app
// callers sending a real, valid token. This route's data (a tenant's service
// catalog) is meant to be publicly readable anyway — it's reachable via
// ?tenantId= with zero auth by design — so decoding (without re-verifying)
// a bearer token's payload to pull tenantId doesn't expose anything that
// isn't already exposed by the guest path.
function tenantIdFromUnverifiedBearerToken(event: APIGatewayProxyEvent): string | undefined {
  const header = event.headers?.Authorization ?? event.headers?.authorization;
  if (!header) return undefined;
  const token = header.replace(/^Bearer\s+/i, '');
  const payload = token.split('.')[1];
  if (!payload) return undefined;
  try {
    const json = Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    return (JSON.parse(json) as Record<string, string>)['custom:tenantId'];
  } catch {
    return undefined;
  }
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const method = event.httpMethod;
    const serviceId = event.pathParameters?.serviceId;

    // GET /services — public. Lets customer-app show the service catalog
    // before someone creates an account. Prefers the caller's own tenantId
    // (from a bearer token, if any) so authenticated admin/customer clients
    // don't have to pass ?tenantId= themselves; falls back to the query
    // param for guest browsing.
    if (method === 'GET') {
      const tenantId = tenantIdFromUnverifiedBearerToken(event) ?? event.queryStringParameters?.tenantId;
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
      const { name, description, price } = body;
      if (!name) {
        return badRequest('name is required');
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
      const { name, description, isActive, price } = body;
      if (!name) {
        return badRequest('name is required');
      }
      const hasPriceUpdate = price !== undefined;
      try {
        await db.send(new UpdateCommand({
          TableName: TABLE.SERVICES,
          Key: { PK: `TENANT#${tenantId}`, SK: `SERVICE#${serviceId}` },
          UpdateExpression: `SET #n = :name, description = :desc, isActive = :active, updatedAt = :now${hasPriceUpdate ? ', price = :price' : ''}`,
          ExpressionAttributeNames: { '#n': 'name' },
          ExpressionAttributeValues: {
            ':name': name,
            ':desc': description ?? '',
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
