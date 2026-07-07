import type { APIGatewayProxyEvent } from 'aws-lambda';
import { mockClient } from 'aws-sdk-client-mock';
import { QueryCommand, PutCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
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
    pathParameters: null,
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

describe('GET /blocked-times', () => {
  it('rejects non-admin callers', async () => {
    const result = await handler(fakeEvent({ claims: { 'custom:role': UserRole.CUSTOMER } }));
    expect(result.statusCode).toBe(403);
  });

  it('rejects a missing locationId', async () => {
    const result = await handler(fakeEvent({ queryStringParameters: null }));
    expect(result.statusCode).toBe(400);
  });

  it('returns blocked times for the location', async () => {
    ddbMock.on(QueryCommand).resolves({
      Items: [{ blockedTimeId: 'b1', tenantId: 't1', locationId: 'loc1', label: 'Holiday', startDate: '2026-12-25', endDate: '2026-12-25', createdAt: 'c' }],
    });
    const result = await handler(fakeEvent());
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).data).toHaveLength(1);
  });
});

describe('POST /blocked-times', () => {
  function postEvent(body: Record<string, unknown>) {
    return fakeEvent({ httpMethod: 'POST', body: JSON.stringify(body) });
  }

  it('rejects a missing locationId', async () => {
    const result = await handler(postEvent({ label: 'X', startDate: '2026-01-01', endDate: '2026-01-02' }));
    expect(result.statusCode).toBe(400);
  });

  it('rejects missing label/startDate/endDate', async () => {
    const result = await handler(postEvent({ locationId: 'loc1' }));
    expect(result.statusCode).toBe(400);
  });

  it('rejects malformed dates', async () => {
    const result = await handler(postEvent({ locationId: 'loc1', label: 'X', startDate: '01/01/2026', endDate: '2026-01-02' }));
    expect(result.statusCode).toBe(400);
  });

  it('rejects startDate after endDate', async () => {
    const result = await handler(postEvent({ locationId: 'loc1', label: 'X', startDate: '2026-01-05', endDate: '2026-01-01' }));
    expect(result.statusCode).toBe(400);
  });

  it('creates a blocked time', async () => {
    ddbMock.on(PutCommand).resolves({});
    const result = await handler(postEvent({ locationId: 'loc1', label: 'Holiday', startDate: '2026-12-25', endDate: '2026-12-25' }));
    expect(result.statusCode).toBe(201);
    expect(JSON.parse(result.body).data).toMatchObject({ label: 'Holiday', locationId: 'loc1' });
  });
});

describe('DELETE /blocked-times/{id}', () => {
  it('returns 404 when the blocked time does not exist', async () => {
    ddbMock.on(DeleteCommand).rejects(Object.assign(new Error('cond'), { name: 'ConditionalCheckFailedException' }));
    const result = await handler(fakeEvent({ httpMethod: 'DELETE', pathParameters: { blockedTimeId: 'b1' } }));
    expect(result.statusCode).toBe(404);
  });

  it('deletes an existing blocked time', async () => {
    ddbMock.on(DeleteCommand).resolves({});
    const result = await handler(fakeEvent({ httpMethod: 'DELETE', pathParameters: { blockedTimeId: 'b1' } }));
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).data).toEqual({ blockedTimeId: 'b1' });
  });

  it('rethrows unexpected errors as a 500', async () => {
    ddbMock.on(DeleteCommand).rejects(new Error('boom'));
    const result = await handler(fakeEvent({ httpMethod: 'DELETE', pathParameters: { blockedTimeId: 'b1' } }));
    expect(result.statusCode).toBe(500);
  });
});

it('returns 400 for an unknown route', async () => {
  const result = await handler(fakeEvent({ httpMethod: 'PATCH' as never }));
  expect(result.statusCode).toBe(400);
});
