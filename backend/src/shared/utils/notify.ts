import { GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
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
  // Pass tokens to skip the extra DB lookup (use null/[] to skip push entirely)
  expoPushTokens?: string[] | null;
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

// Returns 'invalid' when Expo reports the token is permanently dead (app
// uninstalled, etc.) so the caller can stop storing it — everything else
// (including transient errors) is 'ok' to retry naturally on the next event.
export async function sendPush(token: string, title: string, body: string, data?: Record<string, unknown>): Promise<'ok' | 'invalid'> {
  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ to: token, sound: 'default', title, body, data: data ?? {} }),
  });

  if (!res.ok) {
    logger.error('Expo push send failed (HTTP error)', { status: res.status, body: await res.text() });
    return 'ok';
  }

  // A 200 here only means Expo *accepted the request* — it does not mean the
  // notification will actually be delivered. Per-notification success/failure
  // comes back as a "ticket" in the response body (e.g. DeviceNotRegistered,
  // InvalidCredentials, MismatchSenderId), which we must inspect separately.
  const json = (await res.json().catch(() => null)) as { data?: { status: string; message?: string; details?: { error?: string } } } | null;
  const ticket = json?.data;
  if (ticket?.status === 'error') {
    logger.error('Expo push send failed (ticket error)', { message: ticket.message, details: ticket.details, token });
    return ticket.details?.error === 'DeviceNotRegistered' ? 'invalid' : 'ok';
  }
  logger.info('Expo push send accepted', { ticketStatus: ticket?.status, token });
  return 'ok';
}

// A customer/admin can be signed in on more than one device (e.g. Android +
// iOS at once) — each registers its own token via PUT /users/push-token,
// so this is a set, not a single overwritten value.
export async function getPushTokens(tenantId: string, userId: string): Promise<string[]> {
  const result = await db.send(new GetCommand({
    TableName: TABLE.USERS,
    Key: { PK: `TENANT#${tenantId}`, SK: `USER#${userId}` },
  }));
  const tokens = result.Item?.pushTokens as Set<string> | undefined;
  return tokens ? Array.from(tokens) : [];
}

export async function removePushToken(tenantId: string, userId: string, token: string): Promise<void> {
  await db.send(new UpdateCommand({
    TableName: TABLE.USERS,
    Key: { PK: `TENANT#${tenantId}`, SK: `USER#${userId}` },
    UpdateExpression: 'DELETE pushTokens :tokenSet',
    ExpressionAttributeValues: { ':tokenSet': new Set([token]) },
  }));
}

export async function notifyUser(opts: NotifyOpts): Promise<void> {
  await createNotification(opts);
  const tokens = opts.expoPushTokens !== undefined
    ? (opts.expoPushTokens ?? [])
    : await getPushTokens(opts.tenantId, opts.userId);

  // Awaited so the Lambda's response doesn't return (and freeze the
  // environment) before these in-flight fetches to Expo's push service
  // complete — one per registered device, not just the most recent one.
  await Promise.all(tokens.map(token =>
    sendPush(token, opts.title, opts.body, {
      type: opts.type,
      ...(opts.appointmentId ? { appointmentId: opts.appointmentId } : {}),
      ...(opts.promoId ? { promoId: opts.promoId } : {}),
    })
      .then(result => result === 'invalid' ? removePushToken(opts.tenantId, opts.userId, token) : undefined)
      .catch(err => logger.error('Push failed', { error: err, userId: opts.userId, type: opts.type, token }))
  ));
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

export async function getCustomersWithTokens(tenantId: string): Promise<Array<{ userId: string; pushTokens: string[] }>> {
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
    pushTokens: u.pushTokens ? Array.from(u.pushTokens as Set<string>) : [],
  }));
}
