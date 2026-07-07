import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { PutCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { db, TABLE, queryAll } from '../../shared/utils/dynamodb.js';
import { extractTenantClaims, requireRole, UnauthorizedError, ForbiddenError } from '../../shared/middleware/tenant.js';
import { ok, created, badRequest, notFound, unauthorized, forbidden, serverError } from '../../shared/utils/response.js';
import { logger } from '../../shared/utils/logger.js';
import { UserRole } from '../../shared/types/index.js';

const ADMIN_ROLES = [UserRole.SUPER_ADMIN, UserRole.TENANT_OWNER, UserRole.LOCATION_MANAGER];

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const claims = extractTenantClaims(event);
    const { tenantId } = claims;
    const method = event.httpMethod;
    const blockedTimeId = event.pathParameters?.blockedTimeId;

    if (method === 'GET') {
      requireRole(claims, ...ADMIN_ROLES);
      const locationId = event.queryStringParameters?.locationId;
      if (!locationId) return badRequest('locationId query parameter is required');
      const items = await queryAll({
        TableName: TABLE.BLOCKED_TIMES,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        FilterExpression: 'locationId = :locId',
        ExpressionAttributeValues: { ':pk': `TENANT#${tenantId}`, ':skPrefix': 'BLOCKED#', ':locId': locationId },
        ScanIndexForward: true,
      });
      return ok(items.map(toBlockedTime));
    }

    if (method === 'POST') {
      requireRole(claims, ...ADMIN_ROLES);
      const body = JSON.parse(event.body ?? '{}') as Record<string, unknown>;
      const { locationId, label, startDate, endDate } = body;

      if (!locationId) return badRequest('locationId is required');
      if (!label || !startDate || !endDate) return badRequest('label, startDate, and endDate are required');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate as string) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate as string)) {
        return badRequest('startDate and endDate must be YYYY-MM-DD');
      }
      if ((startDate as string) > (endDate as string)) return badRequest('startDate must be on or before endDate');

      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const item = {
        PK: `TENANT#${tenantId}`,
        SK: `BLOCKED#${id}`,
        blockedTimeId: id,
        tenantId,
        locationId,
        label,
        startDate,
        endDate,
        createdAt: now,
      };

      await db.send(new PutCommand({ TableName: TABLE.BLOCKED_TIMES, Item: item }));
      return created(toBlockedTime(item));
    }

    if (method === 'DELETE' && blockedTimeId) {
      requireRole(claims, ...ADMIN_ROLES);
      try {
        await db.send(new DeleteCommand({
          TableName: TABLE.BLOCKED_TIMES,
          Key: { PK: `TENANT#${tenantId}`, SK: `BLOCKED#${blockedTimeId}` },
          ConditionExpression: 'attribute_exists(PK)',
        }));
      } catch (e) {
        if (e instanceof Error && e.name === 'ConditionalCheckFailedException') return notFound('Blocked time not found');
        throw e;
      }
      return ok({ blockedTimeId });
    }

    return badRequest('Unknown route');
  } catch (e) {
    if (e instanceof UnauthorizedError) return unauthorized(e.message);
    if (e instanceof ForbiddenError) return forbidden(e.message);
    logger.error('Unhandled error in blocked-times handler', { error: e });
    return serverError();
  }
};

function toBlockedTime(i: Record<string, unknown>) {
  return {
    blockedTimeId: i.blockedTimeId,
    tenantId: i.tenantId,
    locationId: i.locationId,
    label: i.label,
    startDate: i.startDate,
    endDate: i.endDate,
    createdAt: i.createdAt,
  };
}
