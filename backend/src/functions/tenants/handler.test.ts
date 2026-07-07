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

describe('GET /tenants/me', () => {
  it('rejects non-admin callers', async () => {
    const result = await handler(fakeEvent({ claims: { 'custom:role': UserRole.CUSTOMER } }));
    expect(result.statusCode).toBe(403);
  });

  it('returns 404 when no tenant profile exists yet', async () => {
    ddbMock.on(GetCommand).resolves({});
    const result = await handler(fakeEvent());
    expect(result.statusCode).toBe(404);
  });

  it('returns the tenant profile, allowing a location manager to read it', async () => {
    ddbMock.on(GetCommand).resolves({
      Item: { tenantId: 't1', name: 'Shop', email: 'shop@x.com', plan: 'STARTER', status: 'ACTIVE', createdAt: 'c', updatedAt: 'u' },
    });

    const result = await handler(fakeEvent({ claims: { 'custom:role': UserRole.LOCATION_MANAGER } }));

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).data).toMatchObject({ tenantId: 't1', name: 'Shop' });
  });
});

describe('PUT /tenants/me', () => {
  it('rejects a location manager (owner-only route)', async () => {
    const result = await handler(fakeEvent({
      httpMethod: 'PUT',
      body: JSON.stringify({ name: 'New Name' }),
      claims: { 'custom:role': UserRole.LOCATION_MANAGER },
    }));
    expect(result.statusCode).toBe(403);
  });

  it('rejects a missing name', async () => {
    const result = await handler(fakeEvent({ httpMethod: 'PUT', body: JSON.stringify({}) }));
    expect(result.statusCode).toBe(400);
  });

  it('creates a new profile with defaults when none existed', async () => {
    ddbMock.on(GetCommand).resolves({});
    ddbMock.on(PutCommand).resolves({});

    const result = await handler(fakeEvent({
      httpMethod: 'PUT',
      body: JSON.stringify({ name: 'Shop Name' }),
    }));

    expect(result.statusCode).toBe(200);
    const item = ddbMock.commandCalls(PutCommand)[0]?.args[0].input.Item as Record<string, unknown>;
    expect(item).toMatchObject({ name: 'Shop Name', plan: 'STARTER', status: 'ACTIVE', email: 'owner@shop.com' });
  });

  it('preserves existing plan/status/createdAt/email when updating', async () => {
    ddbMock.on(GetCommand).resolves({
      Item: { tenantId: 't1', email: 'orig@x.com', plan: 'ENTERPRISE', status: 'SUSPENDED', createdAt: 'orig-created' },
    });
    ddbMock.on(PutCommand).resolves({});

    await handler(fakeEvent({ httpMethod: 'PUT', body: JSON.stringify({ name: 'Updated' }) }));

    const item = ddbMock.commandCalls(PutCommand)[0]?.args[0].input.Item as Record<string, unknown>;
    expect(item).toMatchObject({ plan: 'ENTERPRISE', status: 'SUSPENDED', createdAt: 'orig-created', email: 'orig@x.com' });
  });

  it('returns 400 for an unknown method', async () => {
    const result = await handler(fakeEvent({ httpMethod: 'DELETE' }));
    expect(result.statusCode).toBe(400);
  });
});
