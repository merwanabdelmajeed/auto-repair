import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { TABLE, queryAll, queryCount } from '../../shared/utils/dynamodb.js';
import { extractTenantClaims, requireRole, UnauthorizedError, ForbiddenError } from '../../shared/middleware/tenant.js';
import { ok, unauthorized, forbidden, serverError } from '../../shared/utils/response.js';
import { logger } from '../../shared/utils/logger.js';
import { UserRole } from '../../shared/types/index.js';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const claims = extractTenantClaims(event);
    requireRole(claims, UserRole.SUPER_ADMIN, UserRole.TENANT_OWNER, UserRole.LOCATION_MANAGER);

    const { tenantId } = claims;
    const pk = `TENANT#${tenantId}`;

    const [customerCount, vehicleCount, allAppointments] = await Promise.all([
      queryCount({
        TableName: TABLE.USERS,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        // Admin/location-manager users have real USER# records too (Phase 9
        // invite flow) — without this filter they'd inflate the customer count.
        FilterExpression: '#role = :customer',
        ExpressionAttributeNames: { '#role': 'role' },
        ExpressionAttributeValues: { ':pk': pk, ':skPrefix': 'USER#', ':customer': 'CUSTOMER' },
      }),
      queryCount({
        TableName: TABLE.VEHICLES,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        ExpressionAttributeValues: { ':pk': pk, ':skPrefix': 'VEHICLE#' },
      }),
      queryAll({
        TableName: TABLE.APPOINTMENTS,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        ExpressionAttributeValues: { ':pk': pk, ':skPrefix': 'APPT#' },
      }),
    ]);

    const activeAppointments = allAppointments.filter(a => a.status !== 'cancelled');

    // Use the local date sent by the frontend; Lambda always runs in UTC, which would give the wrong "today"
    const localDate = event.queryStringParameters?.localDate;
    const today = localDate && /^\d{4}-\d{2}-\d{2}$/.test(localDate)
      ? localDate
      : new Date().toISOString().slice(0, 10);

    const bookingsToday = activeAppointments.filter(a => {
      const scheduled = (a.scheduledAt as string | undefined)?.slice(0, 10);
      return scheduled === today;
    }).length;

    return ok({
      totalCustomers: customerCount,
      totalVehicles: vehicleCount,
      totalAppointments: activeAppointments.length,
      bookingsToday,
    });
  } catch (e) {
    if (e instanceof UnauthorizedError) return unauthorized(e.message);
    if (e instanceof ForbiddenError) return forbidden(e.message);
    logger.error('Unhandled error in dashboard handler', { error: e });
    return serverError();
  }
};
