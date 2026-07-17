import type { APIGatewayProxyEvent } from 'aws-lambda';
import { mockClient } from 'aws-sdk-client-mock';
import { QueryCommand, PutCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
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

describe('GET /services', () => {
  it('is readable by any authenticated role, including customers', async () => {
    ddbMock.on(QueryCommand).resolves({
      Items: [{ serviceId: 's1', name: 'Oil Change', description: '', durationMinutes: 30, isActive: true, createdAt: 'c', updatedAt: 'u' }],
    });
    const result = await handler(fakeEvent({ claims: { 'custom:role': UserRole.CUSTOMER } }));
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).data).toHaveLength(1);
  });

  it('is readable by a guest (no JWT) via a ?tenantId= query param', async () => {
    ddbMock.on(QueryCommand).resolves({
      Items: [{ serviceId: 's1', name: 'Oil Change', description: '', durationMinutes: 30, isActive: true, createdAt: 'c', updatedAt: 'u' }],
    });
    const result = await handler({
      httpMethod: 'GET',
      pathParameters: null,
      requestContext: {},
      queryStringParameters: { tenantId: 't1' },
    } as unknown as APIGatewayProxyEvent);

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).data).toHaveLength(1);
    const call = ddbMock.commandCalls(QueryCommand)[0]?.args[0].input;
    expect(call?.ExpressionAttributeValues).toMatchObject({ ':pk': 'TENANT#t1' });
  });

  it('rejects a guest request with no ?tenantId= at all', async () => {
    const result = await handler({
      httpMethod: 'GET',
      pathParameters: null,
      requestContext: {},
      queryStringParameters: null,
    } as unknown as APIGatewayProxyEvent);

    expect(result.statusCode).toBe(400);
  });

  it('ignores a guest ?tenantId= when a real session is present, using the JWT tenant instead', async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [] });
    await handler(fakeEvent({ queryStringParameters: { tenantId: 'someone-elses-tenant' } }));

    const call = ddbMock.commandCalls(QueryCommand)[0]?.args[0].input;
    expect(call?.ExpressionAttributeValues).toMatchObject({ ':pk': 'TENANT#t1' });
  });
});

describe('POST /services', () => {
  function postEvent(body: Record<string, unknown>, claims?: Record<string, string>) {
    return fakeEvent({ httpMethod: 'POST', body: JSON.stringify(body), claims });
  }

  it('rejects non-admin callers', async () => {
    const result = await handler(postEvent({ name: 'X', durationMinutes: 30 }, { 'custom:role': UserRole.CUSTOMER }));
    expect(result.statusCode).toBe(403);
  });

  it('rejects missing name/durationMinutes', async () => {
    const result = await handler(postEvent({ name: 'X' }));
    expect(result.statusCode).toBe(400);
  });

  it('creates a service, price omitted when not provided', async () => {
    ddbMock.on(PutCommand).resolves({});
    const result = await handler(postEvent({ name: 'Oil Change', durationMinutes: 30 }));
    expect(result.statusCode).toBe(201);
    const item = ddbMock.commandCalls(PutCommand)[0]?.args[0].input.Item as Record<string, unknown>;
    expect(item.price).toBeUndefined();
  });

  it('creates a service with a price when provided', async () => {
    ddbMock.on(PutCommand).resolves({});
    await handler(postEvent({ name: 'Oil Change', durationMinutes: 30, price: 49.99 }));
    const item = ddbMock.commandCalls(PutCommand)[0]?.args[0].input.Item as Record<string, unknown>;
    expect(item.price).toBe(49.99);
  });
});

describe('PUT /services/{serviceId}', () => {
  function putEvent(body: Record<string, unknown>) {
    return fakeEvent({ httpMethod: 'PUT', pathParameters: { serviceId: 's1' }, body: JSON.stringify(body) });
  }

  it('rejects missing name/durationMinutes', async () => {
    const result = await handler(putEvent({}));
    expect(result.statusCode).toBe(400);
  });

  it('returns 404 when the service does not exist', async () => {
    ddbMock.on(UpdateCommand).rejects(Object.assign(new Error('cond'), { name: 'ConditionalCheckFailedException' }));
    const result = await handler(putEvent({ name: 'X', durationMinutes: 30 }));
    expect(result.statusCode).toBe(404);
  });

  it('updates a service, including clearing price via null', async () => {
    ddbMock.on(UpdateCommand).resolves({});
    const result = await handler(putEvent({ name: 'X', durationMinutes: 30, price: null }));
    expect(result.statusCode).toBe(200);
    const call = ddbMock.commandCalls(UpdateCommand)[0]?.args[0].input;
    expect(call?.ExpressionAttributeValues?.[':price']).toBeUndefined();
  });
});

describe('DELETE /services/{serviceId}', () => {
  it('rejects a location manager (owner/super-admin only)', async () => {
    const result = await handler(fakeEvent({
      httpMethod: 'DELETE', pathParameters: { serviceId: 's1' }, claims: { 'custom:role': UserRole.LOCATION_MANAGER },
    }));
    expect(result.statusCode).toBe(403);
  });

  it('deletes a service', async () => {
    ddbMock.on(DeleteCommand).resolves({});
    const result = await handler(fakeEvent({ httpMethod: 'DELETE', pathParameters: { serviceId: 's1' } }));
    expect(result.statusCode).toBe(200);
  });
});
