import type { APIGatewayProxyEvent } from 'aws-lambda';
import { mockClient } from 'aws-sdk-client-mock';
import { QueryCommand, UpdateCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { db, TABLE } from '../../shared/utils/dynamodb.js';
import { UserRole } from '../../shared/types/index.js';
import { handler } from './handler';

const ddbMock = mockClient(db);

beforeEach(() => ddbMock.reset());

function fakeEvent(overrides: Partial<APIGatewayProxyEvent> & { claims?: Record<string, string> }): APIGatewayProxyEvent {
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

describe('GET /locations', () => {
  it('returns every location, including inactive, to admins', async () => {
    ddbMock.on(QueryCommand).resolves({
      Items: [{ locationId: 'loc1', isActive: true }, { locationId: 'loc2', isActive: false }],
    });
    const result = await handler(fakeEvent({}));
    expect(JSON.parse(result.body).data).toHaveLength(2);
  });

  it('filters out inactive locations for customers', async () => {
    ddbMock.on(QueryCommand).resolves({
      Items: [{ locationId: 'loc1', isActive: true }, { locationId: 'loc2', isActive: false }],
    });
    const result = await handler(fakeEvent({ claims: { 'custom:role': UserRole.CUSTOMER } }));
    const data = JSON.parse(result.body).data;
    expect(data).toHaveLength(1);
    expect(data[0].locationId).toBe('loc1');
  });
});

describe('POST /locations', () => {
  function postEvent(body: Record<string, unknown>, claims?: Record<string, string>) {
    return fakeEvent({ httpMethod: 'POST', body: JSON.stringify(body), claims });
  }

  it('rejects a location manager (owner-only route)', async () => {
    const result = await handler(postEvent({ name: 'Shop', address: '1 Main St' }, { 'custom:role': UserRole.LOCATION_MANAGER }));
    expect(result.statusCode).toBe(403);
  });

  it('rejects missing name/address', async () => {
    const result = await handler(postEvent({ name: 'Shop' }));
    expect(result.statusCode).toBe(400);
  });

  it('creates a location, phone omitted when absent', async () => {
    ddbMock.on(PutCommand).resolves({});
    const result = await handler(postEvent({ name: 'Shop', address: '1 Main St' }));
    expect(result.statusCode).toBe(201);
    expect(JSON.parse(result.body).data.phone).toBeUndefined();
  });

  it('creates a location including phone when provided', async () => {
    ddbMock.on(PutCommand).resolves({});
    const result = await handler(postEvent({ name: 'Shop', address: '1 Main St', phone: '555-1234' }));
    expect(JSON.parse(result.body).data.phone).toBe('555-1234');
  });
});

describe('PUT /locations/{id}', () => {
  function putEvent(body: Record<string, unknown>, claims?: Record<string, string>) {
    return fakeEvent({ httpMethod: 'PUT', pathParameters: { locationId: 'loc1' }, body: JSON.stringify(body), claims });
  }

  it('rejects a location manager (owner-only route)', async () => {
    const result = await handler(putEvent({ name: 'Shop', address: '1 Main St' }, { 'custom:role': UserRole.LOCATION_MANAGER }));
    expect(result.statusCode).toBe(403);
  });

  it('rejects missing name/address', async () => {
    const result = await handler(putEvent({}));
    expect(result.statusCode).toBe(400);
  });

  it('returns 404 when the location does not exist', async () => {
    ddbMock.on(UpdateCommand).rejects(Object.assign(new Error('cond'), { name: 'ConditionalCheckFailedException' }));
    const result = await handler(putEvent({ name: 'Shop', address: '1 Main St' }));
    expect(result.statusCode).toBe(404);
  });

  it('updates a location', async () => {
    ddbMock.on(UpdateCommand).resolves({});
    const result = await handler(putEvent({ name: 'Shop', address: '1 Main St', isActive: false }));
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).data).toEqual({ locationId: 'loc1' });
  });
});

describe('DELETE /locations/{id}', () => {
  it('returns 404 when the location does not exist', async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [{ locationId: 'other', isActive: true }] });
    const result = await handler(fakeEvent({ httpMethod: 'DELETE', pathParameters: { locationId: 'loc1' } }));
    expect(result.statusCode).toBe(404);
  });

  it('refuses to deactivate the only active location', async () => {
    ddbMock.on(QueryCommand, { TableName: TABLE.LOCATIONS }).resolves({
      Items: [{ locationId: 'loc1', isActive: true }],
    });

    const result = await handler(fakeEvent({ httpMethod: 'DELETE', pathParameters: { locationId: 'loc1' } }));

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toMatch(/only active location/i);
    expect(ddbMock.commandCalls(UpdateCommand)).toHaveLength(0);
  });

  it('deactivates a location when another active one still exists', async () => {
    ddbMock.on(QueryCommand, { TableName: TABLE.LOCATIONS }).resolves({
      Items: [
        { locationId: 'loc1', isActive: true },
        { locationId: 'loc2', isActive: true },
      ],
    });
    ddbMock.on(UpdateCommand).resolves({});

    const result = await handler(fakeEvent({ httpMethod: 'DELETE', pathParameters: { locationId: 'loc1' } }));

    expect(result.statusCode).toBe(200);
    const updateCall = ddbMock.commandCalls(UpdateCommand)[0]?.args[0].input;
    expect(updateCall?.ExpressionAttributeValues).toMatchObject({ ':false': false });
  });
});
