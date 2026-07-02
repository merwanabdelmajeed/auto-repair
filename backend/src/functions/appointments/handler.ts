import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { QueryCommand, PutCommand, UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { db, TABLE } from '../../shared/utils/dynamodb.js';
import { extractTenantClaims, requireRole, UnauthorizedError, ForbiddenError } from '../../shared/middleware/tenant.js';
import { ok, created, badRequest, notFound, conflict, unauthorized, forbidden, serverError } from '../../shared/utils/response.js';
import { sendAppointmentStatusEmail } from '../../shared/utils/ses.js';
import { notifyUser } from '../../shared/utils/notify.js';
import { UserRole, type AppointmentStatus, type CapacitySettings } from '../../shared/types/index.js';
import { isSlotAvailable, DEFAULT_CAPACITY } from '../../shared/utils/availability.js';

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
        const result = await db.send(new QueryCommand({
          TableName: TABLE.APPOINTMENTS,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
          ExpressionAttributeValues: { ':pk': `TENANT#${tenantId}`, ':skPrefix': 'APPT#' },
          ScanIndexForward: false,
        }));
        return ok((result.Items ?? []).map(toAppointment));
      } else {
        // Customer sees own appointments via GSI1
        const result = await db.send(new QueryCommand({
          TableName: TABLE.APPOINTMENTS,
          IndexName: 'GSI1',
          KeyConditionExpression: 'GSI1PK = :gsi1pk',
          ExpressionAttributeValues: { ':gsi1pk': `CUSTOMER#${userId}` },
          ScanIndexForward: false,
        }));
        return ok((result.Items ?? []).map(toAppointment));
      }
    }

    // POST /appointments — customers create bookings
    if (method === 'POST') {
      requireRole(claims, UserRole.CUSTOMER);
      const body = JSON.parse(event.body ?? '{}') as Record<string, unknown>;
      const { vehicleId, serviceId, scheduledAt, notes, promoCode } = body;
      if (!vehicleId || !serviceId || !scheduledAt) {
        return badRequest('vehicleId, serviceId, and scheduledAt are required');
      }


      const scheduledDate = (scheduledAt as string).substring(0, 10);
      const scheduledTime = (scheduledAt as string).substring(11, 16);
      const normalizedCode = promoCode ? (promoCode as string).toUpperCase().trim() : null;

      // Fetch service, vehicle, capacity, blocked times, and existing appointments in parallel
      const [serviceResult, vehicleResult, capacityResult, blockedResult, existingAppts] = await Promise.all([
        db.send(new GetCommand({ TableName: TABLE.SERVICES, Key: { PK: `TENANT#${tenantId}`, SK: `SERVICE#${serviceId}` } })),
        db.send(new GetCommand({ TableName: TABLE.VEHICLES, Key: { PK: `TENANT#${tenantId}`, SK: `VEHICLE#${vehicleId}` } })),
        db.send(new GetCommand({ TableName: TABLE.CAPACITY, Key: { PK: `TENANT#${tenantId}`, SK: 'CAPACITY#DEFAULT' } })),
        db.send(new QueryCommand({
          TableName: TABLE.BLOCKED_TIMES,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
          ExpressionAttributeValues: { ':pk': `TENANT#${tenantId}`, ':skPrefix': 'BLOCKED#' },
        })),
        db.send(new QueryCommand({
          TableName: TABLE.APPOINTMENTS,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
          FilterExpression: 'begins_with(scheduledAt, :date)',
          ExpressionAttributeValues: { ':pk': `TENANT#${tenantId}`, ':skPrefix': 'APPT#', ':date': scheduledDate },
        })),
      ]);

      if (!serviceResult.Item) return notFound('Service not found');
      if (!vehicleResult.Item) return notFound('Vehicle not found');

      const capacity: CapacitySettings = capacityResult.Item ? {
        tenantId: capacityResult.Item.tenantId as string,
        slotDurationMinutes: capacityResult.Item.slotDurationMinutes as number,
        maxConcurrent: capacityResult.Item.maxConcurrent as number,
        operatingHours: capacityResult.Item.operatingHours as CapacitySettings['operatingHours'],
        updatedAt: capacityResult.Item.updatedAt as string,
      } : { tenantId, ...DEFAULT_CAPACITY, updatedAt: '' };

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
        const promoResult = await db.send(new QueryCommand({
          TableName: TABLE.PROMOTIONS,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
          FilterExpression: '#code = :code AND isActive = :true',
          ExpressionAttributeNames: { '#code': 'code' },
          ExpressionAttributeValues: { ':pk': `TENANT#${tenantId}`, ':skPrefix': 'PROMO#', ':code': normalizedCode, ':true': true },
        }));
        const promoItem = promoResult.Items?.[0];
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
        GSI2PK: `TENANT#${tenantId}`,
        GSI2SK: `STATUS#pending#${scheduledAt}`,
        appointmentId: id,
        tenantId,
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

      await db.send(new PutCommand({ TableName: TABLE.APPOINTMENTS, Item: item }));

      return created(toAppointment(item));
    }

    // PATCH /appointments/{appointmentId}/status — admin only
    if (method === 'PATCH' && appointmentId) {
      requireRole(claims, ...ADMIN_ROLES);
      const body = JSON.parse(event.body ?? '{}') as Record<string, unknown>;
      const { status } = body as { status: AppointmentStatus };
      if (!status || !VALID_STATUSES.includes(status)) {
        return badRequest(`status must be one of: ${VALID_STATUSES.join(', ')}`);
      }
      const now = new Date().toISOString();
      let updatedItem: Record<string, unknown> | undefined;
      try {
        const result = await db.send(new UpdateCommand({
          TableName: TABLE.APPOINTMENTS,
          Key: { PK: `TENANT#${tenantId}`, SK: `APPT#${appointmentId}` },
          UpdateExpression: 'SET #s = :status, GSI2SK = :gsi2sk, updatedAt = :now',
          ExpressionAttributeNames: { '#s': 'status' },
          ExpressionAttributeValues: {
            ':status': status,
            ':gsi2sk': `STATUS#${status}#`,
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

      // Fire-and-forget: email + push/in-app notification
      if (updatedItem?.customerEmail) {
        sendAppointmentStatusEmail({
          toEmail: updatedItem.customerEmail as string,
          customerName: (updatedItem.customerName as string) || (updatedItem.customerEmail as string),
          serviceName: updatedItem.serviceName as string,
          scheduledAt: updatedItem.scheduledAt as string,
          status,
        }).catch(err => console.error('SES send failed:', err));
      }
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
        }).catch(err => console.error('Notification failed:', err));
      }

      return ok({ appointmentId, status });
    }

    return badRequest('Unknown route');
  } catch (e) {
    if (e instanceof UnauthorizedError) return unauthorized(e.message);
    if (e instanceof ForbiddenError) return forbidden(e.message);
    console.error(e);
    return serverError();
  }
};

function toAppointment(i: Record<string, unknown>) {
  return {
    appointmentId: i.appointmentId,
    tenantId: i.tenantId,
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
