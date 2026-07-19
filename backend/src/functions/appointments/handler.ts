import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { QueryCommand, PutCommand, UpdateCommand, GetCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { db, TABLE, queryAll, queryPage } from '../../shared/utils/dynamodb.js';
import { extractTenantClaims, requireRole, UnauthorizedError, ForbiddenError } from '../../shared/middleware/tenant.js';
import { ok, paginated, created, badRequest, notFound, conflict, unauthorized, forbidden, serverError } from '../../shared/utils/response.js';
import { notifyUser, notifyAdmins } from '../../shared/utils/notify.js';
import { UserRole, type AppointmentStatus, type CapacitySettings } from '../../shared/types/index.js';
import { isSlotAvailable, DEFAULT_CAPACITY } from '../../shared/utils/availability.js';
import { logger } from '../../shared/utils/logger.js';

const ADMIN_ROLES = [UserRole.SUPER_ADMIN, UserRole.TENANT_OWNER, UserRole.LOCATION_MANAGER];
const VALID_STATUSES: AppointmentStatus[] = ['pending', 'confirmed', 'in-progress', 'completed', 'cancelled'];

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const claims = extractTenantClaims(event);
    const { tenantId, userId, email, firstName, lastName, role } = claims;
    const method = event.httpMethod;
    const appointmentId = event.pathParameters?.appointmentId;
    const isAdmin = ADMIN_ROLES.includes(role);

    // GET /appointments
    if (method === 'GET' && !appointmentId) {
      if (isAdmin) {
        const cursor = event.queryStringParameters?.cursor ?? null;
        const limit = Math.min(Number(event.queryStringParameters?.limit ?? 25) || 25, 100);
        const { items, nextCursor } = await queryPage({
          TableName: TABLE.APPOINTMENTS,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
          ExpressionAttributeValues: { ':pk': `TENANT#${tenantId}`, ':skPrefix': 'APPT#' },
          ScanIndexForward: false,
          limit,
          cursor,
        });
        return paginated(items.map(toAppointment), nextCursor);
      } else {
        // Customer sees own appointments via GSI1
        const items = await queryAll({
          TableName: TABLE.APPOINTMENTS,
          IndexName: 'GSI1',
          KeyConditionExpression: 'GSI1PK = :gsi1pk',
          ExpressionAttributeValues: { ':gsi1pk': `CUSTOMER#${userId}` },
          ScanIndexForward: false,
        });
        return ok(items.map(toAppointment));
      }
    }

    // POST /appointments — customers create bookings
    if (method === 'POST') {
      requireRole(claims, UserRole.CUSTOMER);
      const body = JSON.parse(event.body ?? '{}') as Record<string, unknown>;
      const { locationId, vehicleId, serviceId, scheduledAt, notes, promoCode } = body;
      if (!locationId || !vehicleId || !serviceId || !scheduledAt) {
        return badRequest('locationId, vehicleId, serviceId, and scheduledAt are required');
      }


      const scheduledDate = (scheduledAt as string).substring(0, 10);
      const scheduledTime = (scheduledAt as string).substring(11, 16);
      const normalizedCode = promoCode ? (promoCode as string).toUpperCase().trim() : null;

      // Fetch location, service, vehicle, capacity, blocked times, and existing appointments in parallel
      const [locationResult, serviceResult, vehicleResult, capacityResult, blockedResult, existingAppts] = await Promise.all([
        db.send(new GetCommand({ TableName: TABLE.LOCATIONS, Key: { PK: `TENANT#${tenantId}`, SK: `LOCATION#${locationId}` } })),
        db.send(new GetCommand({ TableName: TABLE.SERVICES, Key: { PK: `TENANT#${tenantId}`, SK: `SERVICE#${serviceId}` } })),
        db.send(new GetCommand({ TableName: TABLE.VEHICLES, Key: { PK: `TENANT#${tenantId}`, SK: `VEHICLE#${vehicleId}` } })),
        db.send(new GetCommand({ TableName: TABLE.CAPACITY, Key: { PK: `TENANT#${tenantId}`, SK: `CAPACITY#${locationId}` } })),
        db.send(new QueryCommand({
          TableName: TABLE.BLOCKED_TIMES,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
          FilterExpression: 'locationId = :locId',
          ExpressionAttributeValues: { ':pk': `TENANT#${tenantId}`, ':skPrefix': 'BLOCKED#', ':locId': locationId },
        })),
        db.send(new QueryCommand({
          TableName: TABLE.APPOINTMENTS,
          IndexName: 'GSI2',
          KeyConditionExpression: 'GSI2PK = :pk AND begins_with(GSI2SK, :date)',
          ExpressionAttributeValues: { ':pk': `LOCATION#${locationId}`, ':date': scheduledDate },
        })),
      ]);

      if (!locationResult.Item || locationResult.Item.isActive !== true) return notFound('Location not found');
      if (!serviceResult.Item) return notFound('Service not found');
      if (!vehicleResult.Item) return notFound('Vehicle not found');

      const capacity: CapacitySettings = capacityResult.Item ? {
        tenantId: capacityResult.Item.tenantId as string,
        locationId: capacityResult.Item.locationId as string,
        slotDurationMinutes: capacityResult.Item.slotDurationMinutes as number,
        maxConcurrent: capacityResult.Item.maxConcurrent as number,
        operatingHours: capacityResult.Item.operatingHours as CapacitySettings['operatingHours'],
        updatedAt: capacityResult.Item.updatedAt as string,
      } : { tenantId, locationId: locationId as string, ...DEFAULT_CAPACITY, updatedAt: '' };

      const blockedTimes = (blockedResult.Items ?? []).map(i => ({
        startDate: i.startDate as string,
        endDate: i.endDate as string,
        label: i.label as string,
      }));

      const appointments = (existingAppts.Items ?? []).map(i => ({
        scheduledAt: i.scheduledAt as string,
        status: i.status as string,
      }));

      if (!isSlotAvailable(scheduledDate, scheduledTime, capacity, blockedTimes, appointments)) {
        return conflict('Selected time slot is not available. Please choose a different time.');
      }

      // Validate promo code exists and is active (no price discount — customer presents in person)
      let promoId: string | null = null;
      if (normalizedCode) {
        const promoItems = await queryAll({
          TableName: TABLE.PROMOTIONS,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
          FilterExpression: '#code = :code AND isActive = :true',
          ExpressionAttributeNames: { '#code': 'code' },
          ExpressionAttributeValues: { ':pk': `TENANT#${tenantId}`, ':skPrefix': 'PROMO#', ':code': normalizedCode, ':true': true },
        });
        const promoItem = promoItems[0];
        if (!promoItem) return badRequest('Promo code is invalid or inactive');
        if (promoItem.expiresAt && new Date(promoItem.expiresAt as string) < new Date()) return badRequest('Promo code has expired');
        promoId = promoItem.promoId as string;

        // Check if this customer has already used this code
        const usageCheck = await db.send(new GetCommand({
          TableName: TABLE.PROMOTIONS,
          Key: { PK: `TENANT#${tenantId}`, SK: `PROMO_USAGE#${promoId}#${userId}` },
        }));
        if (usageCheck.Item) return badRequest('You have already used this promotion code');
      }

      const service = serviceResult.Item;
      const vehicle = vehicleResult.Item;
      const id = crypto.randomUUID();
      const now = new Date().toISOString();

      const item: Record<string, unknown> = {
        PK: `TENANT#${tenantId}`,
        SK: `APPT#${id}`,
        GSI1PK: `CUSTOMER#${userId}`,
        GSI1SK: `APPT#${scheduledAt}#${id}`,
        // GSI2SK is just scheduledAt (not status-prefixed) so date-range
        // queries can use begins_with(GSI2SK, date) directly. GSI2PK is
        // location-scoped (not tenant-scoped) so slot availability is
        // computed independently per location.
        GSI2PK: `LOCATION#${locationId}`,
        GSI2SK: scheduledAt,
        appointmentId: id,
        tenantId,
        locationId,
        customerId: userId,
        customerEmail: email,
        customerName: `${firstName} ${lastName}`.trim() || email,
        vehicleId,
        serviceId,
        scheduledAt,
        status: 'pending' as AppointmentStatus,
        notes: notes ?? '',
        promoCode: normalizedCode ?? null,
        promoId: promoId ?? null,
        promoApplied: false,
        serviceName: service.name as string,
        vehicleSummary: `${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.trim ? ' ' + vehicle.trim : ''}`,
        createdAt: now,
        updatedAt: now,
      };

      // Atomically claim a slot in the same transaction as the appointment write.
      // The isSlotAvailable check above is a fast pre-check (catches blocked
      // times/operating hours); this counter is what actually prevents two
      // concurrent bookings from both landing when only one slot is free.
      try {
        await db.send(new TransactWriteCommand({
          TransactItems: [
            {
              Update: {
                TableName: TABLE.APPOINTMENTS,
                Key: { PK: `TENANT#${tenantId}`, SK: `SLOTCOUNT#${locationId}#${scheduledAt}` },
                UpdateExpression: 'ADD #cnt :one',
                ConditionExpression: 'attribute_not_exists(#cnt) OR #cnt < :max',
                ExpressionAttributeNames: { '#cnt': 'count' },
                ExpressionAttributeValues: { ':one': 1, ':max': capacity.maxConcurrent },
              },
            },
            {
              Put: { TableName: TABLE.APPOINTMENTS, Item: item },
            },
          ],
        }));
      } catch (e) {
        if (e instanceof Error && e.name === 'TransactionCanceledException') {
          return conflict('Selected time slot is not available. Please choose a different time.');
        }
        throw e;
      }

      const timeStr = new Date(scheduledAt as string).toLocaleString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
      });
      await notifyAdmins(tenantId, {
        type: 'admin_new_booking',
        title: 'New Booking',
        body: `${item.customerName as string} booked ${item.serviceName as string} — ${timeStr}`,
        appointmentId: id,
      }).catch(err => logger.error('Admin new-booking notification failed', { error: err, appointmentId: id }));

      return created(toAppointment(item));
    }

    // PATCH /appointments/{appointmentId}/status — admins can set any valid
    // status; customers may only cancel their own appointment
    if (method === 'PATCH' && appointmentId) {
      const body = JSON.parse(event.body ?? '{}') as Record<string, unknown>;
      const { status } = body as { status: AppointmentStatus };
      if (!status || !VALID_STATUSES.includes(status)) {
        return badRequest(`status must be one of: ${VALID_STATUSES.join(', ')}`);
      }
      const now = new Date().toISOString();
      const before = await db.send(new GetCommand({
        TableName: TABLE.APPOINTMENTS,
        Key: { PK: `TENANT#${tenantId}`, SK: `APPT#${appointmentId}` },
      }));
      if (!before.Item) return notFound('Appointment not found');
      const previousStatus = before.Item.status as AppointmentStatus;

      if (!isAdmin) {
        if (status !== 'cancelled') return forbidden('Customers may only cancel their own appointments');
        if (before.Item.customerId !== userId) return forbidden('You can only cancel your own appointments');
      } else if (!before.Item.customerId) {
        // customerId is stripped when an account is deleted (see customers
        // handler) — the appointment is kept for the shop's own records, but
        // its status is frozen: there's no live customer to notify, and
        // notifyUser below would otherwise be called with userId undefined.
        return conflict('This appointment belongs to a deleted customer account and can no longer be updated.');
      }

      let updatedItem: Record<string, unknown> | undefined;
      try {
        const result = await db.send(new UpdateCommand({
          TableName: TABLE.APPOINTMENTS,
          Key: { PK: `TENANT#${tenantId}`, SK: `APPT#${appointmentId}` },
          UpdateExpression: 'SET #s = :status, updatedAt = :now',
          ExpressionAttributeNames: { '#s': 'status' },
          ExpressionAttributeValues: {
            ':status': status,
            ':now': now,
          },
          ConditionExpression: 'attribute_exists(PK)',
          ReturnValues: 'ALL_NEW',
        }));
        updatedItem = result.Attributes as Record<string, unknown> | undefined;
      } catch (e) {
        if (e instanceof Error && e.name === 'ConditionalCheckFailedException') return notFound('Appointment not found');
        throw e;
      }

      // Free up the slot counter when a booking is newly cancelled (best-effort —
      // if this fails, the counter stays elevated a bit longer, which under-books
      // rather than over-books, so it's not gated on the status change succeeding).
      if (status === 'cancelled' && previousStatus !== 'cancelled' && updatedItem?.scheduledAt) {
        db.send(new UpdateCommand({
          TableName: TABLE.APPOINTMENTS,
          Key: { PK: `TENANT#${tenantId}`, SK: `SLOTCOUNT#${updatedItem.locationId as string}#${updatedItem.scheduledAt as string}` },
          UpdateExpression: 'ADD #cnt :neg1',
          ExpressionAttributeNames: { '#cnt': 'count' },
          ExpressionAttributeValues: { ':neg1': -1 },
        })).catch(err => logger.error('Slot counter decrement failed', { error: err, appointmentId, scheduledAt: updatedItem?.scheduledAt }));
      }

      // Notify admins only when the customer cancels their own booking — an
      // admin cancelling it themselves doesn't need to be told about it.
      if (!isAdmin && status === 'cancelled' && previousStatus !== 'cancelled' && updatedItem) {
        const timeStr = new Date(updatedItem.scheduledAt as string).toLocaleString('en-US', {
          weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
        });
        await notifyAdmins(tenantId, {
          type: 'admin_appointment_cancelled',
          title: 'Appointment Cancelled',
          body: `${updatedItem.customerName as string} cancelled ${updatedItem.serviceName as string} — ${timeStr}`,
          appointmentId: appointmentId!,
        }).catch(err => logger.error('Admin cancellation notification failed', { error: err, appointmentId }));
      }

      // Fire-and-forget: push/in-app notification
      if (updatedItem && (status === 'confirmed' || status === 'cancelled' || status === 'completed')) {
        const timeStr = new Date(updatedItem.scheduledAt as string).toLocaleString('en-US', {
          weekday: 'short', month: 'short', day: 'numeric',
          hour: 'numeric', minute: '2-digit', hour12: true,
        });
        const titles: Partial<Record<AppointmentStatus, string>> = {
          confirmed:  'Appointment Confirmed',
          cancelled:  'Appointment Cancelled',
          completed:  'Your Vehicle Is Ready',
        };
        const bodies: Partial<Record<AppointmentStatus, string>> = {
          confirmed: `${updatedItem.serviceName as string} — ${timeStr}`,
          cancelled: `${updatedItem.serviceName as string} — ${timeStr}`,
          completed: `${updatedItem.serviceName as string} is complete. Come pick up your vehicle!`,
        };
        const types: Partial<Record<AppointmentStatus, 'appointment_confirmed' | 'appointment_cancelled' | 'appointment_completed'>> = {
          confirmed: 'appointment_confirmed',
          cancelled: 'appointment_cancelled',
          completed: 'appointment_completed',
        };
        await notifyUser({
          tenantId,
          userId: updatedItem.customerId as string,
          type: types[status]!,
          title: titles[status]!,
          body: bodies[status]!,
          appointmentId: appointmentId!,
        }).catch(err => logger.error('Notification failed', { error: err, appointmentId, status }));
      }

      return ok({ appointmentId, status });
    }

    return badRequest('Unknown route');
  } catch (e) {
    if (e instanceof UnauthorizedError) return unauthorized(e.message);
    if (e instanceof ForbiddenError) return forbidden(e.message);
    logger.error('Unhandled error in appointments handler', { error: e });
    return serverError();
  }
};

function toAppointment(i: Record<string, unknown>) {
  return {
    appointmentId: i.appointmentId,
    tenantId: i.tenantId,
    locationId: i.locationId,
    customerId: i.customerId,
    customerEmail: i.customerEmail,
    customerName: i.customerName ?? '',
    vehicleId: i.vehicleId,
    serviceId: i.serviceId,
    scheduledAt: i.scheduledAt,
    status: i.status,
    notes: i.notes,
    promoCode: i.promoCode ?? null,
    promoId: i.promoId ?? null,
    promoApplied: i.promoApplied ?? false,
    serviceName: i.serviceName,
    vehicleSummary: i.vehicleSummary,
    createdAt: i.createdAt,
    updatedAt: i.updatedAt,
  };
}
