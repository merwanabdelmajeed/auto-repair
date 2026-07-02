import { GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { db, TABLE } from './dynamodb.js';

export type NotifType =
  | 'appointment_confirmed'
  | 'appointment_cancelled'
  | 'appointment_completed'
  | 'appointment_reminder_24h'
  | 'appointment_reminder_2h'
  | 'promotion_new';

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
  if (!res.ok) console.error('Expo push send failed:', await res.text());
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
    sendPush(token, opts.title, opts.body, {
      type: opts.type,
      ...(opts.appointmentId ? { appointmentId: opts.appointmentId } : {}),
      ...(opts.promoId ? { promoId: opts.promoId } : {}),
    }).catch(err => console.error('Push failed:', err));
  }
}

export async function getCustomersWithTokens(tenantId: string): Promise<Array<{ userId: string; expoPushToken: string | null }>> {
  const result = await db.send(new QueryCommand({
    TableName: TABLE.USERS,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
    FilterExpression: '#role = :customer',
    ExpressionAttributeNames: { '#role': 'role' },
    ExpressionAttributeValues: {
      ':pk': `TENANT#${tenantId}`,
      ':skPrefix': 'USER#',
      ':customer': 'CUSTOMER',
    },
  }));
  return (result.Items ?? []).map(u => ({
    userId: u.userId as string,
    expoPushToken: (u.expoPushToken as string | undefined) ?? null,
  }));
}
