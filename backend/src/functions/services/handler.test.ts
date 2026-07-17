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

function fakeBearerHeader(tenantId: string): string {
  const payload = Buffer.from(JSON.stringify({ 'custom:tenantId': tenantId })).toString('base64');
  return `Bearer header.${payload}.signature`;
}

describe('GET /services', () => {
  // This route has Auth: Authorizer NONE (template.yaml) — API Gateway never
  // populates requestContext.authorizer.claims here, even for authenticated
  // callers with a real token. The handler reads tenantId straight off the
  // bearer token's payload instead (see tenantIdFromUnverifiedBearerToken).
  it('is readable by an authenticated caller via their bearer token, no query param needed', async () => {
    ddbMock.on(QueryCommand).resolves({
      Items: [{ serviceId: 's1', name: 'Oil Change', description: '', isActive: true, createdAt: 'c', updatedAt: 'u' }],
    });
    const result = await handler({
      httpMethod: 'GET',
      pathParameters: null,
      requestContext: {},
      queryStringParameters: null,
      headers: { Authorization: fakeBearerHeader('t1') },
    } as unknown as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).data).toHaveLength(1);
    const call = ddbMock.commandCalls(QueryCommand)[0]?.args[0].input;
    expect(call?.ExpressionAttributeValues).toMatchObject({ ':pk': 'TENANT#t1' });
  });

  it('is readable by a guest (no JWT) via a ?tenantId= query param', async () => {
    ddbMock.on(QueryCommand).resolves({
      Items: [{ serviceId: 's1', name: 'Oil Change', description: '', isActive: true, createdAt: 'c', updatedAt: 'u' }],
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

  it('prefers the bearer token tenant over a mismatched ?tenantId= query param', async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [] });
    await handler({
      httpMethod: 'GET',
      pathParameters: null,
      requestContext: {},
      queryStringParameters: { tenantId: 'someone-elses-tenant' },
      headers: { Authorization: fakeBearerHeader('t1') },
    } as unknown as APIGatewayProxyEvent);

    const call = ddbMock.commandCalls(QueryCommand)[0]?.args[0].input;
    expect(call?.ExpressionAttributeValues).toMatchObject({ ':pk': 'TENANT#t1' });
  });

  it('falls back to the query param when the bearer token has no usable payload', async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [] });
    await handler({
      httpMethod: 'GET',
      pathParameters: null,
      requestContext: {},
      queryStringParameters: { tenantId: 't1' },
      headers: { Authorization: 'Bearer not-a-real-jwt' },
    } as unknown as APIGatewayProxyEvent);

    const call = ddbMock.commandCalls(QueryCommand)[0]?.args[0].input;
    expect(call?.ExpressionAttributeValues).toMatchObject({ ':pk': 'TENANT#t1' });
  });
});

describe('POST /services', () => {
  function postEvent(body: Record<string, unknown>, claims?: Record<string, string>) {
    return fakeEvent({ httpMethod: 'POST', body: JSON.stringify(body), claims });
  }

  it('rejects non-admin callers', async () => {
    const result = await handler(postEvent({ name: 'X' }, { 'custom:role': UserRole.CUSTOMER }));
    expect(result.statusCode).toBe(403);
  });

  it('rejects missing name', async () => {
    const result = await handler(postEvent({}));
    expect(result.statusCode).toBe(400);
  });

  it('creates a service, price omitted when not provided', async () => {
    ddbMock.on(PutCommand).resolves({});
    const result = await handler(postEvent({ name: 'Oil Change' }));
    expect(result.statusCode).toBe(201);
    const item = ddbMock.commandCalls(PutCommand)[0]?.args[0].input.Item as Record<string, unknown>;
    expect(item.price).toBeUndefined();
  });

  it('creates a service with a price when provided', async () => {
    ddbMock.on(PutCommand).resolves({});
    await handler(postEvent({ name: 'Oil Change', price: 49.99 }));
    const item = ddbMock.commandCalls(PutCommand)[0]?.args[0].input.Item as Record<string, unknown>;
    expect(item.price).toBe(49.99);
  });
});

describe('PUT /services/{serviceId}', () => {
  function putEvent(body: Record<string, unknown>) {
    return fakeEvent({ httpMethod: 'PUT', pathParameters: { serviceId: 's1' }, body: JSON.stringify(body) });
  }

  it('rejects missing name', async () => {
    const result = await handler(putEvent({}));
    expect(result.statusCode).toBe(400);
  });

  it('returns 404 when the service does not exist', async () => {
    ddbMock.on(UpdateCommand).rejects(Object.assign(new Error('cond'), { name: 'ConditionalCheckFailedException' }));
    const result = await handler(putEvent({ name: 'X' }));
    expect(result.statusCode).toBe(404);
  });

  it('updates a service, including clearing price via null', async () => {
    ddbMock.on(UpdateCommand).resolves({});
    const result = await handler(putEvent({ name: 'X', price: null }));
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
