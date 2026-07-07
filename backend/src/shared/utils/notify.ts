import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { db, TABLE, queryAll } from './dynamodb.js';
import { logger } from './logger.js';

export type NotifType =
  | 'appointment_confirmed'
  | 'appointment_cancelled'
  | 'appointment_completed'
  | 'appointment_reminder_24h'
  | 'appointment_reminder_2h'
  | 'promotion_new'
  | 'admin_new_booking'
  | 'admin_appointment_cancelled';

interface NotifyOpts {
  tenantId: string;
  userId: string;
  type: NotifType;
  title: string;
  body: string;
  appointmentId?: string;
  promoId?: string;
  // Pass token to skip the extra DB lookup (use null to skip push entirely)
  expoPushToken?: string | null;
}

export async function createNotification(opts: NotifyOpts): Promise<void> {
  const notifId = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.send(new PutCommand({
    TableName: TABLE.NOTIFICATIONS,
    Item: {
      PK: `USER#${opts.userId}`,
      SK: `NOTIF#${now}#${notifId}`,
      GSI1PK: `TENANT#${opts.tenantId}`,
      GSI1SK: `USER#${opts.userId}#${now}`,
      notifId,
      userId: opts.userId,
      tenantId: opts.tenantId,
      type: opts.type,
      title: opts.title,
      body: opts.body,
      read: false,
      createdAt: now,
      ...(opts.appointmentId ? { appointmentId: opts.appointmentId } : {}),
      ...(opts.promoId ? { promoId: opts.promoId } : {}),
    },
  }));
}

export async function sendPush(token: string, title: string, body: string, data?: Record<string, unknown>): Promise<void> {
  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ to: token, sound: 'default', title, body, data: data ?? {} }),
  });

  if (!res.ok) {
    logger.error('Expo push send failed (HTTP error)', { status: res.status, body: await res.text() });
    return;
  }

  // A 200 here only means Expo *accepted the request* — it does not mean the
  // notification will actually be delivered. Per-notification success/failure
  // comes back as a "ticket" in the response body (e.g. DeviceNotRegistered,
  // InvalidCredentials, MismatchSenderId), which we must inspect separately.
  const json = (await res.json().catch(() => null)) as { data?: { status: string; message?: string; details?: unknown } } | null;
  const ticket = json?.data;
  if (ticket?.status === 'error') {
    logger.error('Expo push send failed (ticket error)', { message: ticket.message, details: ticket.details, token });
  } else {
    logger.info('Expo push send accepted', { ticketStatus: ticket?.status, token });
  }
}

export async function getPushToken(tenantId: string, userId: string): Promise<string | null> {
  const result = await db.send(new GetCommand({
    TableName: TABLE.USERS,
    Key: { PK: `TENANT#${tenantId}`, SK: `USER#${userId}` },
  }));
  return (result.Item?.expoPushToken as string | undefined) ?? null;
}

export async function notifyUser(opts: NotifyOpts): Promise<void> {
  await createNotification(opts);
  const token = opts.expoPushToken !== undefined
    ? opts.expoPushToken
    : await getPushToken(opts.tenantId, opts.userId);
  if (token) {
    // Awaited so the Lambda's response doesn't return (and freeze the environment)
    // before this in-flight fetch to Expo's push service completes.
    await sendPush(token, opts.title, opts.body, {
      type: opts.type,
      ...(opts.appointmentId ? { appointmentId: opts.appointmentId } : {}),
      ...(opts.promoId ? { promoId: opts.promoId } : {}),
    }).catch(err => logger.error('Push failed', { error: err, userId: opts.userId, type: opts.type }));
  }
}

const ADMIN_ROLE_NAMES = new Set(['SUPER_ADMIN', 'TENANT_OWNER', 'LOCATION_MANAGER']);

// Admin users now get a real DynamoDB USER# record at invite time (Phase 9's
// admin-users invite Lambda writes it directly, since AdminCreateUser'd users
// never fire PostConfirmation_ConfirmSignUp), so this is a plain DynamoDB
// query — no more paginating/filtering Cognito's ListUsers client-side.
export async function getTenantAdminUserIds(tenantId: string): Promise<string[]> {
  const items = await queryAll({
    TableName: TABLE.USERS,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
    ExpressionAttributeValues: { ':pk': `TENANT#${tenantId}`, ':skPrefix': 'USER#' },
  });
  return items
    .filter(i => ADMIN_ROLE_NAMES.has(i.role as string))
    .map(i => i.userId as string);
}

// Admin app now registers push tokens the same way the customer app does
// (see apps/admin-app/src/hooks/usePushNotifications.ts), so notifyUser's
// normal getPushToken lookup applies here too — no override needed.
export async function notifyAdmins(tenantId: string, opts: Omit<NotifyOpts, 'userId' | 'tenantId'>): Promise<void> {
  const adminIds = await getTenantAdminUserIds(tenantId);
  await Promise.all(adminIds.map(userId =>
    notifyUser({ ...opts, tenantId, userId })
      .catch(err => logger.error('Admin notification failed', { error: err, userId, tenantId }))
  ));
}

export async function getCustomersWithTokens(tenantId: string): Promise<Array<{ userId: string; expoPushToken: string | null }>> {
  const items = await queryAll({
    TableName: TABLE.USERS,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
    FilterExpression: '#role = :customer',
    ExpressionAttributeNames: { '#role': 'role' },
    ExpressionAttributeValues: {
      ':pk': `TENANT#${tenantId}`,
      ':skPrefix': 'USER#',
      ':customer': 'CUSTOMER',
    },
  });
  return items.map(u => ({
    userId: u.userId as string,
    expoPushToken: (u.expoPushToken as string | undefined) ?? null,
  }));
}
