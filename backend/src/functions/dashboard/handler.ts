import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { db, TABLE } from '../../shared/utils/dynamodb.js';
import { extractTenantClaims, requireRole, UnauthorizedError, ForbiddenError } from '../../shared/middleware/tenant.js';
import { ok, unauthorized, forbidden, serverError } from '../../shared/utils/response.js';
import { UserRole } from '../../shared/types/index.js';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const claims = extractTenantClaims(event);
    requireRole(claims, UserRole.SUPER_ADMIN, UserRole.TENANT_OWNER, UserRole.LOCATION_MANAGER);

    const { tenantId } = claims;
    const pk = `TENANT#${tenantId}`;

    const [customersResult, vehiclesResult, appointmentsResult] = await Promise.all([
      db.send(new QueryCommand({
        TableName: TABLE.USERS,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        ExpressionAttributeValues: { ':pk': pk, ':skPrefix': 'USER#' },
        Select: 'COUNT',
      })),
      db.send(new QueryCommand({
        TableName: TABLE.VEHICLES,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        ExpressionAttributeValues: { ':pk': pk, ':skPrefix': 'VEHICLE#' },
        Select: 'COUNT',
      })),
      db.send(new QueryCommand({
        TableName: TABLE.APPOINTMENTS,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        ExpressionAttributeValues: { ':pk': pk, ':skPrefix': 'APPT#' },
      })),
    ]);

    const allAppointments = appointmentsResult.Items ?? [];
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
      totalCustomers: customersResult.Count ?? 0,
      totalVehicles: vehiclesResult.Count ?? 0,
      totalAppointments: activeAppointments.length,
      bookingsToday,
    });
  } catch (e) {
    if (e instanceof UnauthorizedError) return unauthorized(e.message);
    if (e instanceof ForbiddenError) return forbidden(e.message);
    console.error(e);
    return serverError();
  }
};
