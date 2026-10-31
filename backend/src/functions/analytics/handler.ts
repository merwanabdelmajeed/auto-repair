import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { TABLE, queryAll } from '../../shared/utils/dynamodb.js';
import { authenticate, requireRole, UnauthorizedError, ForbiddenError } from '../../shared/middleware/tenant.js';
import { ok, badRequest, unauthorized, forbidden, serverError } from '../../shared/utils/response.js';
import { logger } from '../../shared/utils/logger.js';
import { UserRole } from '../../shared/types/index.js';

const ADMIN_ROLES = [UserRole.SUPER_ADMIN, UserRole.TENANT_OWNER, UserRole.LOCATION_MANAGER];

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const claims = await authenticate(event);
    requireRole(claims, ...ADMIN_ROLES);
    const { tenantId } = claims;

    const params = event.queryStringParameters ?? {};
    const { startDate, endDate } = params;
    if (
      !startDate || !endDate ||
      !/^\d{4}-\d{2}-\d{2}$/.test(startDate) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(endDate)
    ) {
      return badRequest('startDate and endDate (YYYY-MM-DD) are required');
    }

    const pk = `TENANT#${tenantId}`;

    const [allAppts, services, customers] = await Promise.all([
      queryAll({
        TableName: TABLE.APPOINTMENTS,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
        ExpressionAttributeValues: { ':pk': pk, ':prefix': 'APPT#' },
      }),
      queryAll({
        TableName: TABLE.SERVICES,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
        ExpressionAttributeValues: { ':pk': pk, ':prefix': 'SERVICE#' },
      }),
      // Registered customers, independent of bookings — admins have USER#
      // rows too, so filter on role (same as the dashboard count).
      queryAll({
        TableName: TABLE.USERS,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
        FilterExpression: '#role = :customer',
        ProjectionExpression: 'createdAt',
        ExpressionAttributeNames: { '#role': 'role' },
        ExpressionAttributeValues: { ':pk': pk, ':prefix': 'USER#', ':customer': 'CUSTOMER' },
      }),
    ]);

    const priceMap = new Map<string, number>();
    const nameMap = new Map<string, string>();
    for (const svc of services) {
      const sid = svc.serviceId as string;
      priceMap.set(sid, typeof svc.price === 'number' ? svc.price : 0);
      nameMap.set(sid, svc.name as string);
    }

    const periodAppts = allAppts.filter(a => {
      const d = (a.scheduledAt as string | undefined)?.slice(0, 10) ?? '';
      return d >= startDate && d <= endDate;
    });

    const historicalCustomerIds = new Set(
      allAppts
        .filter(a => ((a.scheduledAt as string | undefined)?.slice(0, 10) ?? '') < startDate)
        .map(a => a.customerId as string)
    );

    const completed = periodAppts.filter(a => a.status === 'completed');
    const cancelled = periodAppts.filter(a => a.status === 'cancelled');

    const totalRevenue = completed.reduce(
      (sum, a) => sum + (priceMap.get(a.serviceId as string) ?? 0), 0
    );

    const uniqueCustomerIds = new Set(periodAppts.map(a => a.customerId as string));
    const newCustomers = [...uniqueCustomerIds].filter(id => !historicalCustomerIds.has(id)).length;
    const newSignups = customers.filter(c => {
      const d = (c.createdAt as string | undefined)?.slice(0, 10) ?? '';
      return d >= startDate && d <= endDate;
    }).length;

    // Daily breakdown — one entry per calendar day in the range
    const byDay: Array<{ date: string; bookings: number; completed: number; revenue: number }> = [];
    const cursor = new Date(startDate + 'T12:00:00Z');
    const rangeEnd = new Date(endDate + 'T12:00:00Z');
    while (cursor <= rangeEnd) {
      const dateStr = cursor.toISOString().slice(0, 10);
      const dayAppts = periodAppts.filter(
        a => (a.scheduledAt as string | undefined)?.slice(0, 10) === dateStr
      );
      const dayCompleted = dayAppts.filter(a => a.status === 'completed');
      byDay.push({
        date: dateStr,
        bookings: dayAppts.length,
        completed: dayCompleted.length,
        revenue: dayCompleted.reduce((s, a) => s + (priceMap.get(a.serviceId as string) ?? 0), 0),
      });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    // Per-service breakdown
    const svcAgg = new Map<string, {
      serviceName: string; bookings: number; completed: number; revenue: number;
    }>();
    for (const a of periodAppts) {
      const sid = a.serviceId as string;
      const svcName = (a.serviceName as string | undefined) ?? nameMap.get(sid) ?? sid;
      if (!svcAgg.has(sid)) {
        svcAgg.set(sid, { serviceName: svcName, bookings: 0, completed: 0, revenue: 0 });
      }
      const entry = svcAgg.get(sid)!;
      entry.bookings++;
      if (a.status === 'completed') {
        entry.completed++;
        entry.revenue += priceMap.get(sid) ?? 0;
      }
    }
    const byService = [...svcAgg.entries()]
      .map(([serviceId, v]) => ({ serviceId, ...v }))
      .sort((a, b) => b.bookings - a.bookings);

    // Status counts
    const byStatus: Record<string, number> = {};
    for (const a of periodAppts) {
      const s = (a.status as string) ?? 'unknown';
      byStatus[s] = (byStatus[s] ?? 0) + 1;
    }

    return ok({
      summary: {
        totalBookings: periodAppts.length,
        completedBookings: completed.length,
        cancelledBookings: cancelled.length,
        pendingBookings: periodAppts.length - completed.length - cancelled.length,
        totalRevenue,
        uniqueCustomers: uniqueCustomerIds.size,
        newCustomers,
        returningCustomers: uniqueCustomerIds.size - newCustomers,
        totalCustomers: customers.length,
        newSignups,
      },
      byDay,
      byService,
      byStatus,
    });
  } catch (e) {
    if (e instanceof UnauthorizedError) return unauthorized(e.message);
    if (e instanceof ForbiddenError) return forbidden(e.message);
    logger.error('Unhandled error in analytics handler', { error: e });
    return serverError();
  }
};
