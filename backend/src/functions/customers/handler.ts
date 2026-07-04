import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { TABLE, queryAll } from '../../shared/utils/dynamodb.js';
import { extractTenantClaims, requireRole, UnauthorizedError, ForbiddenError } from '../../shared/middleware/tenant.js';
import { ok, unauthorized, forbidden, serverError } from '../../shared/utils/response.js';
import { logger } from '../../shared/utils/logger.js';
import { UserRole } from '../../shared/types/index.js';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const claims = extractTenantClaims(event);
    requireRole(claims, UserRole.SUPER_ADMIN, UserRole.TENANT_OWNER, UserRole.LOCATION_MANAGER);

    const { tenantId } = claims;

    const items = await queryAll({
      TableName: TABLE.USERS,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: { ':pk': `TENANT#${tenantId}`, ':skPrefix': 'USER#' },
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

    return ok(customers);
  } catch (e) {
    if (e instanceof UnauthorizedError) return unauthorized(e.message);
    if (e instanceof ForbiddenError) return forbidden(e.message);
    logger.error('Unhandled error in customers handler', { error: e });
    return serverError();
  }
};
