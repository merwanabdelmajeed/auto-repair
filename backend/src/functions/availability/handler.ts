import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { db, TABLE } from '../../shared/utils/dynamodb.js';
import { extractTenantClaims, UnauthorizedError, ForbiddenError } from '../../shared/middleware/tenant.js';
import { ok, badRequest, unauthorized, forbidden, serverError } from '../../shared/utils/response.js';
import { type CapacitySettings } from '../../shared/types/index.js';
import { computeAvailability, DEFAULT_CAPACITY } from '../../shared/utils/availability.js';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const claims = extractTenantClaims(event);
    const { tenantId } = claims;

    const date = event.queryStringParameters?.date;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return badRequest('date query parameter is required (YYYY-MM-DD)');
    }

    const [capacityResult, blockedResult, apptResult] = await Promise.all([
      db.send(new GetCommand({
        TableName: TABLE.CAPACITY,
        Key: { PK: `TENANT#${tenantId}`, SK: 'CAPACITY#DEFAULT' },
      })),
      db.send(new QueryCommand({
        TableName: TABLE.BLOCKED_TIMES,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        ExpressionAttributeValues: { ':pk': `TENANT#${tenantId}`, ':skPrefix': 'BLOCKED#' },
      })),
      db.send(new QueryCommand({
        TableName: TABLE.APPOINTMENTS,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        FilterExpression: 'begins_with(scheduledAt, :date)',
        ExpressionAttributeValues: {
          ':pk': `TENANT#${tenantId}`,
          ':skPrefix': 'APPT#',
          ':date': date,
        },
      })),
    ]);

    const capacity: CapacitySettings = capacityResult.Item ? {
      tenantId: capacityResult.Item.tenantId as string,
      slotDurationMinutes: capacityResult.Item.slotDurationMinutes as number,
      maxConcurrent: capacityResult.Item.maxConcurrent as number,
      operatingHours: capacityResult.Item.operatingHours as CapacitySettings['operatingHours'],
      updatedAt: capacityResult.Item.updatedAt as string,
    } : { tenantId, ...DEFAULT_CAPACITY, updatedAt: new Date().toISOString() };

    const blockedTimes = (blockedResult.Items ?? []).map(i => ({
      startDate: i.startDate as string,
      endDate: i.endDate as string,
      label: i.label as string,
    }));

    const appointments = (apptResult.Items ?? []).map(i => ({
      scheduledAt: i.scheduledAt as string,
      status: i.status as string,
    }));

    return ok(computeAvailability(date, capacity, blockedTimes, appointments));
  } catch (e) {
    if (e instanceof UnauthorizedError) return unauthorized(e.message);
    if (e instanceof ForbiddenError) return forbidden(e.message);
    console.error(e);
    return serverError();
  }
};
