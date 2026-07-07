import type { APIGatewayProxyEvent } from 'aws-lambda';
import { mockClient } from 'aws-sdk-client-mock';
import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
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

describe('GET /capacity', () => {
  it('rejects a missing locationId', async () => {
    const result = await handler(fakeEvent({ queryStringParameters: null }));
    expect(result.statusCode).toBe(400);
  });

  it('returns default capacity when no settings are stored yet', async () => {
    ddbMock.on(GetCommand).resolves({});
    const result = await handler(fakeEvent());
    const body = JSON.parse(result.body).data;
    expect(body.slotDurationMinutes).toBe(30);
    expect(body.maxConcurrent).toBe(2);
  });

  it('returns stored settings when present', async () => {
    ddbMock.on(GetCommand).resolves({
      Item: { tenantId: 't1', locationId: 'loc1', slotDurationMinutes: 45, maxConcurrent: 3, operatingHours: {}, updatedAt: 'u' },
    });
    const result = await handler(fakeEvent());
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
