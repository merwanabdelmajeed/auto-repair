import { mockClient } from 'aws-sdk-client-mock';
import { GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { db } from './dynamodb.js';
import {
  createNotification, sendPush, getPushToken, notifyUser, getTenantAdminUserIds, notifyAdmins, getCustomersWithTokens,
} from './notify.js';

const ddbMock = mockClient(db);
const originalFetch = global.fetch;

beforeEach(() => {
  ddbMock.reset();
  global.fetch = jest.fn();
});

afterEach(() => {
  global.fetch = originalFetch;
});

describe('createNotification', () => {
  it('writes a notification scoped to the recipient user', async () => {
    ddbMock.on(PutCommand).resolves({});

    await createNotification({ tenantId: 't1', userId: 'u1', type: 'appointment_confirmed', title: 'T', body: 'B', appointmentId: 'a1' });

    const item = ddbMock.commandCalls(PutCommand)[0]?.args[0].input.Item as Record<string, unknown>;
    expect(item).toMatchObject({ PK: 'USER#u1', tenantId: 't1', title: 'T', body: 'B', appointmentId: 'a1', read: false });
  });

  it('omits appointmentId/promoId when not provided', async () => {
    ddbMock.on(PutCommand).resolves({});

    await createNotification({ tenantId: 't1', userId: 'u1', type: 'promotion_new', title: 'T', body: 'B' });

    const item = ddbMock.commandCalls(PutCommand)[0]?.args[0].input.Item as Record<string, unknown>;
    expect(item.appointmentId).toBeUndefined();
    expect(item.promoId).toBeUndefined();
  });
});

describe('sendPush', () => {
  it('logs an error and returns when Expo responds with a non-OK HTTP status', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 500, text: async () => 'server error' });

    await expect(sendPush('token', 'Title', 'Body')).resolves.toBeUndefined();
  });

  it('logs a ticket error when Expo accepts the request but the ticket reports failure', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ data: { status: 'error', message: 'DeviceNotRegistered' } }),
    });

    await expect(sendPush('token', 'Title', 'Body')).resolves.toBeUndefined();
  });

  it('succeeds when the ticket reports ok', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ data: { status: 'ok' } }),
    });

    await expect(sendPush('token', 'Title', 'Body', { type: 'promotion_new' })).resolves.toBeUndefined();
  });
});

describe('getPushToken', () => {
  it('returns null when the user has no token on file', async () => {
    ddbMock.on(GetCommand).resolves({ Item: {} });
    await expect(getPushToken('t1', 'u1')).resolves.toBeNull();
  });

  it('returns the stored token', async () => {
    ddbMock.on(GetCommand).resolves({ Item: { expoPushToken: 'expo-1' } });
    await expect(getPushToken('t1', 'u1')).resolves.toBe('expo-1');
  });
});

describe('notifyUser', () => {
  it('creates the notification and sends a push when a token is passed explicitly', async () => {
    ddbMock.on(PutCommand).resolves({});
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ data: { status: 'ok' } }) });

    await notifyUser({ tenantId: 't1', userId: 'u1', type: 'appointment_confirmed', title: 'T', body: 'B', expoPushToken: 'expo-1' });

    expect(ddbMock.commandCalls(PutCommand)).toHaveLength(1);
    expect(global.fetch).toHaveBeenCalledWith('https://exp.host/--/api/v2/push/send', expect.anything());
  });

  it('skips the push entirely when expoPushToken is explicitly null', async () => {
    ddbMock.on(PutCommand).resolves({});

    await notifyUser({ tenantId: 't1', userId: 'u1', type: 'appointment_confirmed', title: 'T', body: 'B', expoPushToken: null });

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('looks up the token from DynamoDB when none is passed', async () => {
    ddbMock.on(PutCommand).resolves({});
    ddbMock.on(GetCommand).resolves({ Item: { expoPushToken: 'looked-up-token' } });
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ data: { status: 'ok' } }) });

    await notifyUser({ tenantId: 't1', userId: 'u1', type: 'appointment_confirmed', title: 'T', body: 'B' });

    expect(global.fetch).toHaveBeenCalled();
  });

  it('swallows push failures without throwing', async () => {
    ddbMock.on(PutCommand).resolves({});
    (global.fetch as jest.Mock).mockRejectedValue(new Error('network down'));

    await expect(notifyUser({ tenantId: 't1', userId: 'u1', type: 'appointment_confirmed', title: 'T', body: 'B', expoPushToken: 'expo-1' }))
      .resolves.toBeUndefined();
  });
});

describe('getTenantAdminUserIds', () => {
  it('filters to admin roles only', async () => {
    ddbMock.on(QueryCommand).resolves({
      Items: [
        { userId: 'owner-1', role: 'TENANT_OWNER' },
        { userId: 'mgr-1', role: 'LOCATION_MANAGER' },
        { userId: 'cust-1', role: 'CUSTOMER' },
      ],
    });

    await expect(getTenantAdminUserIds('t1')).resolves.toEqual(['owner-1', 'mgr-1']);
  });
});

describe('notifyAdmins', () => {
  it('fans out a separate notification to every admin, isolating one failure from the rest', async () => {
    ddbMock.on(QueryCommand).resolves({
      Items: [{ userId: 'owner-1', role: 'TENANT_OWNER' }, { userId: 'mgr-1', role: 'LOCATION_MANAGER' }],
    });
    ddbMock.on(GetCommand).resolves({ Item: {} });
    ddbMock.on(PutCommand)
      .resolvesOnce({})
      .rejects(new Error('write failed for second admin'));

    await expect(notifyAdmins('t1', { type: 'admin_new_booking', title: 'T', body: 'B' })).resolves.toBeUndefined();

    expect(ddbMock.commandCalls(PutCommand)).toHaveLength(2);
  });
});

describe('getCustomersWithTokens', () => {
  it('returns only CUSTOMER-role users with their token or null', async () => {
    ddbMock.on(QueryCommand).resolves({
      Items: [{ userId: 'c1', expoPushToken: 'tok-1' }, { userId: 'c2' }],
    });

    await expect(getCustomersWithTokens('t1')).resolves.toEqual([
      { userId: 'c1', expoPushToken: 'tok-1' },
      { userId: 'c2', expoPushToken: null },
    ]);
  });
});
