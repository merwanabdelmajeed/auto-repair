import { mockClient } from 'aws-sdk-client-mock';
import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { db } from './dynamodb.js';
import {
  createNotification, sendPush, getPushTokens, removePushToken, notifyUser, getTenantAdminUserIds, notifyAdmins, getCustomersWithTokens,
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
  it('returns ok (retryable) when Expo responds with a non-OK HTTP status', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 500, text: async () => 'server error' });

    await expect(sendPush('token', 'Title', 'Body')).resolves.toBe('ok');
  });

  it('returns invalid when the ticket reports DeviceNotRegistered', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ data: { status: 'error', message: 'not registered', details: { error: 'DeviceNotRegistered' } } }),
    });

    await expect(sendPush('token', 'Title', 'Body')).resolves.toBe('invalid');
  });

  it('returns ok (retryable) for other ticket errors', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ data: { status: 'error', message: 'rate limited', details: { error: 'MessageRateExceeded' } } }),
    });

    await expect(sendPush('token', 'Title', 'Body')).resolves.toBe('ok');
  });

  it('succeeds when the ticket reports ok', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ data: { status: 'ok' } }),
    });

    await expect(sendPush('token', 'Title', 'Body', { type: 'promotion_new' })).resolves.toBe('ok');
  });
});

describe('getPushTokens', () => {
  it('returns an empty array when the user has no tokens on file', async () => {
    ddbMock.on(GetCommand).resolves({ Item: {} });
    await expect(getPushTokens('t1', 'u1')).resolves.toEqual([]);
  });

  it('returns every stored token (one per device)', async () => {
    ddbMock.on(GetCommand).resolves({ Item: { pushTokens: new Set(['expo-android', 'expo-ios']) } });
    await expect(getPushTokens('t1', 'u1')).resolves.toEqual(expect.arrayContaining(['expo-android', 'expo-ios']));
  });
});

describe('removePushToken', () => {
  it('deletes only the given token from the set', async () => {
    ddbMock.on(UpdateCommand).resolves({});

    await removePushToken('t1', 'u1', 'stale-token');

    const call = ddbMock.commandCalls(UpdateCommand)[0]?.args[0].input;
    expect(call?.UpdateExpression).toContain('DELETE pushTokens');
    expect(call?.ExpressionAttributeValues).toMatchObject({ ':tokenSet': new Set(['stale-token']) });
  });
});

describe('notifyUser', () => {
  it('creates the notification and sends a push to every device when tokens are passed explicitly', async () => {
    ddbMock.on(PutCommand).resolves({});
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ data: { status: 'ok' } }) });

    await notifyUser({ tenantId: 't1', userId: 'u1', type: 'appointment_confirmed', title: 'T', body: 'B', expoPushTokens: ['expo-android', 'expo-ios'] });

    expect(ddbMock.commandCalls(PutCommand)).toHaveLength(1);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('skips the push entirely when expoPushTokens is explicitly null', async () => {
    ddbMock.on(PutCommand).resolves({});

    await notifyUser({ tenantId: 't1', userId: 'u1', type: 'appointment_confirmed', title: 'T', body: 'B', expoPushTokens: null });

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('looks up tokens from DynamoDB when none are passed', async () => {
    ddbMock.on(PutCommand).resolves({});
    ddbMock.on(GetCommand).resolves({ Item: { pushTokens: new Set(['looked-up-token']) } });
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ data: { status: 'ok' } }) });

    await notifyUser({ tenantId: 't1', userId: 'u1', type: 'appointment_confirmed', title: 'T', body: 'B' });

    expect(global.fetch).toHaveBeenCalled();
  });

  it('removes a token that Expo reports as no longer registered', async () => {
    ddbMock.on(PutCommand).resolves({});
    ddbMock.on(UpdateCommand).resolves({});
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ data: { status: 'error', details: { error: 'DeviceNotRegistered' } } }),
    });

    await notifyUser({ tenantId: 't1', userId: 'u1', type: 'appointment_confirmed', title: 'T', body: 'B', expoPushTokens: ['dead-token'] });

    const call = ddbMock.commandCalls(UpdateCommand)[0]?.args[0].input;
    expect(call?.ExpressionAttributeValues).toMatchObject({ ':tokenSet': new Set(['dead-token']) });
  });

  it('swallows push failures without throwing', async () => {
    ddbMock.on(PutCommand).resolves({});
    (global.fetch as jest.Mock).mockRejectedValue(new Error('network down'));

    await expect(notifyUser({ tenantId: 't1', userId: 'u1', type: 'appointment_confirmed', title: 'T', body: 'B', expoPushTokens: ['expo-1'] }))
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
  it('returns only CUSTOMER-role users with their tokens (empty array when none)', async () => {
    ddbMock.on(QueryCommand).resolves({
      Items: [{ userId: 'c1', pushTokens: new Set(['tok-1', 'tok-2']) }, { userId: 'c2' }],
    });

    await expect(getCustomersWithTokens('t1')).resolves.toEqual([
      { userId: 'c1', pushTokens: expect.arrayContaining(['tok-1', 'tok-2']) },
      { userId: 'c2', pushTokens: [] },
    ]);
  });
});
