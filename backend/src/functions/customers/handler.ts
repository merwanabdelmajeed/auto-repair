import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { TABLE, queryPage } from '../../shared/utils/dynamodb.js';
import { extractTenantClaims, requireRole, UnauthorizedError, ForbiddenError } from '../../shared/middleware/tenant.js';
import { paginated, unauthorized, forbidden, serverError } from '../../shared/utils/response.js';
import { logger } from '../../shared/utils/logger.js';
import { UserRole } from '../../shared/types/index.js';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const claims = extractTenantClaims(event);
    requireRole(claims, UserRole.SUPER_ADMIN, UserRole.TENANT_OWNER, UserRole.LOCATION_MANAGER);

    const { tenantId } = claims;
    const cursor = event.queryStringParameters?.cursor ?? null;
    const limit = Math.min(Number(event.queryStringParameters?.limit ?? 25) || 25, 100);

    const { items, nextCursor } = await queryPage({
      TableName: TABLE.USERS,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      // Admin/location-manager users now have real USER# records too (Phase 9
      // invite flow) — without this filter they'd show up in the Customers list.
      FilterExpression: '#role = :customer',
      ExpressionAttributeNames: { '#role': 'role' },
      ExpressionAttributeValues: { ':pk': `TENANT#${tenantId}`, ':skPrefix': 'USER#', ':customer': 'CUSTOMER' },
      limit,
      cursor,
    });

    const customers = items.map(i => ({
      userId: i.userId as string,
      email: i.email as string,
      firstName: (i.firstName as string) ?? '',
      lastName: (i.lastName as string) ?? '',
      phone: (i.phone as string) ?? null,
      status: i.status as string,
      createdAt: i.createdAt as string,
    }));

    return paginated(customers, nextCursor);
  } catch (e) {
    if (e instanceof UnauthorizedError) return unauthorized(e.message);
    if (e instanceof ForbiddenError) return forbidden(e.message);
    logger.error('Unhandled error in customers handler', { error: e });
    return serverError();
  }
};
