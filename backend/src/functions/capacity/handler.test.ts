import type { APIGatewayProxyEvent } from 'aws-lambda';
import { mockClient } from 'aws-sdk-client-mock';
import { GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { db, TABLE } from '../../shared/utils/dynamodb.js';
import { UserRole } from '../../shared/types/index.js';
import { handler } from './handler';

const ddbMock = mockClient(db);

beforeEach(() => ddbMock.reset());

function fakeEvent(overrides: Partial<APIGatewayProxyEvent> & { claims?: Record<string, string> } = {}): APIGatewayProxyEvent {
  const { claims, ...rest } = overrides;
  return {
    httpMethod: 'GET',
    body: null,
    queryStringParameters: { locationId: 'loc1' },
    requestContext: {
      authorizer: {
        claims: {
          sub: 'owner-1',
          email: 'owner@shop.com',
          'custom:tenantId': 't1',
          'custom:role': UserRole.TENANT_OWNER,
          ...(claims ?? {}),
        },
      },
    },
    ...rest,
  } as unknown as APIGatewayProxyEvent;
}

// GET is a public route (Auth: NONE): no authorizer claims, tenant from the
// bearer token or ?tenantId=.
function bearer(tenantId: string) {
  const payload = Buffer.from(JSON.stringify({ 'custom:tenantId': tenantId })).toString('base64url');
  return `h.${payload}.s`;
}
function publicGet(query: Record<string, string> | null, headers: Record<string, string> = {}): APIGatewayProxyEvent {
  return { httpMethod: 'GET', body: null, queryStringParameters: query, headers, requestContext: {} } as unknown as APIGatewayProxyEvent;
}

describe('GET /capacity', () => {
  it('rejects a request with no tenant (no token, no ?tenantId=)', async () => {
    const result = await handler(publicGet({ locationId: 'loc1' }));
    expect(result.statusCode).toBe(400);
  });

  it('serves a guest via ?tenantId=, defaulting to the tenant\'s first location', async () => {
    ddbMock.on(QueryCommand).resolves({
      Items: [
        { locationId: 'loc-new', createdAt: '2026-02-01' },
        { locationId: 'loc-old', createdAt: '2026-01-01' },
      ],
    });
    ddbMock.on(GetCommand).resolves({
      Item: { tenantId: 't1', locationId: 'loc-old', slotDurationMinutes: 30, maxConcurrent: 2, operatingHours: { monday: { open: '07:00', close: '17:30' } }, updatedAt: 'u' },
    });
    const result = await handler(publicGet({ tenantId: 't1' }));
    expect(result.statusCode).toBe(200);
    expect(ddbMock.commandCalls(GetCommand)[0]!.args[0].input.Key).toEqual({ PK: 'TENANT#t1', SK: 'CAPACITY#loc-old' });
    expect(JSON.parse(result.body).data.operatingHours.monday).toEqual({ open: '07:00', close: '17:30' });
  });

  it('prefers the caller\'s token tenant over ?tenantId=, and honors an explicit locationId', async () => {
    ddbMock.on(GetCommand).resolves({});
    await handler(publicGet({ tenantId: 'other', locationId: 'loc1' }, { Authorization: bearer('t1') }));
    expect(ddbMock.commandCalls(QueryCommand)).toHaveLength(0);
    expect(ddbMock.commandCalls(GetCommand)[0]!.args[0].input.Key).toEqual({ PK: 'TENANT#t1', SK: 'CAPACITY#loc1' });
  });

  it('rejects when the tenant has no locations and none was given', async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [] });
    const result = await handler(publicGet({ tenantId: 't1' }));
    expect(result.statusCode).toBe(400);
  });

  it('returns default capacity when no settings are stored yet', async () => {
    ddbMock.on(GetCommand).resolves({});
    const result = await handler(publicGet({ locationId: 'loc1' }, { Authorization: bearer('t1') }));
    const body = JSON.parse(result.body).data;
    expect(body.slotDurationMinutes).toBe(30);
    expect(body.maxConcurrent).toBe(2);
  });

  it('returns stored settings when present', async () => {
    ddbMock.on(GetCommand).resolves({
      Item: { tenantId: 't1', locationId: 'loc1', slotDurationMinutes: 45, maxConcurrent: 3, operatingHours: {}, updatedAt: 'u' },
    });
    const result = await handler(publicGet({ locationId: 'loc1' }, { authorization: `Bearer ${bearer('t1')}` }));
    expect(JSON.parse(result.body).data.slotDurationMinutes).toBe(45);
  });
});

describe('PUT /capacity', () => {
  function putEvent(body: Record<string, unknown>, claims?: Record<string, string>) {
    return fakeEvent({ httpMethod: 'PUT', body: JSON.stringify(body), claims });
  }

  it('rejects non-admin callers', async () => {
    const result = await handler(putEvent({ locationId: 'loc1' }, { 'custom:role': UserRole.CUSTOMER }));
    expect(result.statusCode).toBe(403);
  });

  it('rejects a missing locationId', async () => {
    const result = await handler(putEvent({}));
    expect(result.statusCode).toBe(400);
  });

  it('rejects an out-of-range slotDurationMinutes', async () => {
    const result = await handler(putEvent({ locationId: 'loc1', slotDurationMinutes: 5 }));
    expect(result.statusCode).toBe(400);
  });

  it('rejects an out-of-range maxConcurrent', async () => {
    const result = await handler(putEvent({ locationId: 'loc1', maxConcurrent: 50 }));
    expect(result.statusCode).toBe(400);
  });

  it('merges partial updates onto existing settings', async () => {
    ddbMock.on(GetCommand).resolves({
      Item: { slotDurationMinutes: 45, maxConcurrent: 3, operatingHours: { monday: { open: '08:00', close: '16:00' } } },
    });
    ddbMock.on(PutCommand).resolves({});

    const result = await handler(putEvent({ locationId: 'loc1', maxConcurrent: 5 }));

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body).data;
    expect(body.slotDurationMinutes).toBe(45); // preserved from existing
    expect(body.maxConcurrent).toBe(5); // updated
  });

  it('falls back to default operating hours when creating settings for the first time', async () => {
    ddbMock.on(GetCommand).resolves({});
    ddbMock.on(PutCommand).resolves({});

    const result = await handler(putEvent({ locationId: 'loc1', slotDurationMinutes: 60 }));

    const body = JSON.parse(result.body).data;
    expect(body.maxConcurrent).toBe(2); // DEFAULT_CAPACITY fallback
  });
});
