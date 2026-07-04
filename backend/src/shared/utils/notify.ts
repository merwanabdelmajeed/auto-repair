import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { CognitoIdentityProviderClient, ListUsersCommand } from '@aws-sdk/client-cognito-identity-provider';
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
  if (!res.ok) logger.error('Expo push send failed', { status: res.status, body: await res.text() });
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

const cognito = new CognitoIdentityProviderClient({});
const ADMIN_ROLE_NAMES = new Set(['SUPER_ADMIN', 'TENANT_OWNER', 'LOCATION_MANAGER']);

// Admin users have no corresponding DynamoDB USER# record today — they're
// created directly in Cognito (manually, pending the Phase 9 invite flow),
// not through a code path that writes one. So "which admins belong to this
// tenant" has to be answered by querying Cognito directly, not DynamoDB.
//
// Cognito's ListUsers Filter parameter only supports a small set of standard
// attributes (username, email, phone_number, etc.) — custom attributes like
// custom:tenantId and custom:role cannot be used there at all (it throws
// InvalidParameterException). So this fetches all users in the pool, paging
// through PaginationToken, and filters by tenantId + admin role client-side.
export async function getTenantAdminUserIds(tenantId: string): Promise<string[]> {
  const userPoolId = process.env.USER_POOL_ID;
  if (!userPoolId) return [];

  const adminIds: string[] = [];
  let paginationToken: string | undefined;
  do {
    const result = await cognito.send(new ListUsersCommand({
      UserPoolId: userPoolId,
      PaginationToken: paginationToken,
    }));
    for (const u of result.Users ?? []) {
      const userTenantId = u.Attributes?.find(a => a.Name === 'custom:tenantId')?.Value;
      const role = u.Attributes?.find(a => a.Name === 'custom:role')?.Value;
      const sub = u.Attributes?.find(a => a.Name === 'sub')?.Value;
      if (userTenantId === tenantId && role && ADMIN_ROLE_NAMES.has(role) && sub) {
        adminIds.push(sub);
      }
    }
    paginationToken = result.PaginationToken;
  } while (paginationToken);

  return adminIds;
}

// In-app only — admin app/portal don't register push tokens today.
export async function notifyAdmins(tenantId: string, opts: Omit<NotifyOpts, 'userId' | 'tenantId'>): Promise<void> {
  const adminIds = await getTenantAdminUserIds(tenantId);
  await Promise.all(adminIds.map(userId =>
    notifyUser({ ...opts, tenantId, userId, expoPushToken: null })
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
