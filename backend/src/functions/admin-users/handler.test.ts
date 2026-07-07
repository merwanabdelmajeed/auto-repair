import type { APIGatewayProxyEvent } from 'aws-lambda';
import { mockClient } from 'aws-sdk-client-mock';
import { GetCommand, PutCommand, QueryCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminDisableUserCommand,
  AdminDeleteUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { db, TABLE } from '../../shared/utils/dynamodb.js';
import { UserRole } from '../../shared/types/index.js';
import { handler } from './handler';

const ddbMock = mockClient(db);
const cognitoMock = mockClient(CognitoIdentityProviderClient);

beforeEach(() => {
  ddbMock.reset();
  cognitoMock.reset();
  process.env.USER_POOL_ID = 'pool1';
});

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

describe('POST /admin-users (invite)', () => {
  it('rejects an invalid role without making any AWS calls', async () => {
    const result = await handler(fakeEvent({
      httpMethod: 'POST',
      body: JSON.stringify({ email: 'x@y.com', role: 'CUSTOMER' }),
    }));

    expect(result.statusCode).toBe(400);
    expect(ddbMock.calls()).toHaveLength(0);
    expect(cognitoMock.calls()).toHaveLength(0);
  });

  it('requires at least one locationId for a LOCATION_MANAGER invite', async () => {
    const result = await handler(fakeEvent({
      httpMethod: 'POST',
      body: JSON.stringify({ email: 'x@y.com', role: 'LOCATION_MANAGER', locationIds: [] }),
    }));

    expect(result.statusCode).toBe(400);
    expect(ddbMock.calls()).toHaveLength(0);
  });

  it('rejects a locationId that does not belong to this tenant', async () => {
    ddbMock.on(QueryCommand, { TableName: TABLE.LOCATIONS }).resolves({ Items: [{ locationId: 'loc-real' }] });

    const result = await handler(fakeEvent({
      httpMethod: 'POST',
      body: JSON.stringify({ email: 'x@y.com', role: 'LOCATION_MANAGER', locationIds: ['loc-fake'] }),
    }));

    expect(result.statusCode).toBe(400);
    expect(cognitoMock.calls()).toHaveLength(0);
  });

  it('creates the Cognito user and writes a matching USER# record on success', async () => {
    ddbMock.on(QueryCommand, { TableName: TABLE.LOCATIONS }).resolves({ Items: [{ locationId: 'loc-real' }] });
    cognitoMock.on(AdminCreateUserCommand).resolves({ User: { Attributes: [{ Name: 'sub', Value: 'new-user-sub' }] } });
    ddbMock.on(PutCommand).resolves({});

    const result = await handler(fakeEvent({
      httpMethod: 'POST',
      body: JSON.stringify({ email: 'new@shop.com', role: 'LOCATION_MANAGER', locationIds: ['loc-real'] }),
    }));

    expect(result.statusCode).toBe(201);
    const createCall = cognitoMock.commandCalls(AdminCreateUserCommand)[0]?.args[0].input;
    const attrs = Object.fromEntries((createCall?.UserAttributes ?? []).map(a => [a.Name, a.Value]));
    expect(attrs['custom:tenantId']).toBe('t1');
    expect(attrs['custom:role']).toBe('LOCATION_MANAGER');
    expect(attrs['custom:userType']).toBe('ADMIN');

    const putCall = ddbMock.commandCalls(PutCommand)[0]?.args[0].input;
    expect((putCall?.Item as Record<string, unknown>)?.userId).toBe('new-user-sub');
  });
});

describe('PATCH /admin-users/{userId}', () => {
  it('blocks a self-lockout attempt without making any AWS calls', async () => {
    const result = await handler(fakeEvent({
      httpMethod: 'PATCH',
      pathParameters: { userId: 'owner-1' }, // same as the caller's own sub
      body: JSON.stringify({ status: 'INACTIVE' }),
    }));

    expect(result.statusCode).toBe(400);
    expect(ddbMock.calls()).toHaveLength(0);
    expect(cognitoMock.calls()).toHaveLength(0);
  });

  it('returns 404 and makes no Cognito calls when the target does not belong to this tenant', async () => {
    // Regression test: previously the Cognito Admin* calls fired before this
    // tenant-scoped lookup, so a user sub from a different tenant (but the same
    // shared Cognito User Pool) could still be disabled/re-roled.
    ddbMock.on(GetCommand).resolves({ Item: undefined });

    const result = await handler(fakeEvent({
      httpMethod: 'PATCH',
      pathParameters: { userId: 'other-tenant-user' },
      body: JSON.stringify({ status: 'INACTIVE' }),
    }));

    expect(result.statusCode).toBe(404);
    expect(cognitoMock.calls()).toHaveLength(0);
  });

  it('returns 404 without any Cognito call when the target exists but is not an admin-managed role (e.g. a customer)', async () => {
    ddbMock.on(GetCommand).resolves({ Item: { userId: 'cust-1', role: UserRole.CUSTOMER } });

    const result = await handler(fakeEvent({
      httpMethod: 'PATCH',
      pathParameters: { userId: 'cust-1' },
      body: JSON.stringify({ status: 'INACTIVE' }),
    }));

    expect(result.statusCode).toBe(404);
    expect(cognitoMock.calls()).toHaveLength(0);
  });

  it('disables the Cognito user and updates DynamoDB when the target is a valid same-tenant admin', async () => {
    ddbMock.on(GetCommand).resolves({ Item: { userId: 'mgr-1', role: UserRole.LOCATION_MANAGER } });
    cognitoMock.on(AdminDisableUserCommand).resolves({});
    ddbMock.on(UpdateCommand).resolves({});

    const result = await handler(fakeEvent({
      httpMethod: 'PATCH',
      pathParameters: { userId: 'mgr-1' },
      body: JSON.stringify({ status: 'INACTIVE' }),
    }));

    expect(result.statusCode).toBe(200);
    expect(cognitoMock.commandCalls(AdminDisableUserCommand)).toHaveLength(1);
  });

  // Regression tests for a real bug: DynamoDB's UpdateItem rejects the entire
  // request with a ValidationException if ExpressionAttributeNames declares a
  // name that isn't referenced in the UpdateExpression (or if the object is
  // empty) — the Cognito call had already succeeded by that point, so the user
  // saw a false "failed to update" error despite the Cognito side effect landing.
  // aws-sdk-client-mock doesn't replicate that DynamoDB validation, so these
  // assert on the exact shape sent instead.
  it('a status-only update sends ExpressionAttributeNames with only #status, not an unused #role', async () => {
    ddbMock.on(GetCommand).resolves({ Item: { userId: 'mgr-1', role: UserRole.LOCATION_MANAGER } });
    cognitoMock.on(AdminDisableUserCommand).resolves({});
    ddbMock.on(UpdateCommand).resolves({});

    await handler(fakeEvent({
      httpMethod: 'PATCH',
      pathParameters: { userId: 'mgr-1' },
      body: JSON.stringify({ status: 'INACTIVE' }),
    }));

    const updateInput = ddbMock.commandCalls(UpdateCommand)[0]?.args[0].input;
    expect(updateInput?.ExpressionAttributeNames).toEqual({ '#status': 'status' });
  });

  it('a role-only update sends ExpressionAttributeNames with only #role, not an unused #status', async () => {
    ddbMock.on(GetCommand).resolves({ Item: { userId: 'mgr-1', role: UserRole.LOCATION_MANAGER } });
    cognitoMock.on(AdminDisableUserCommand).resolves({});
    ddbMock.on(UpdateCommand).resolves({});

    await handler(fakeEvent({
      httpMethod: 'PATCH',
      pathParameters: { userId: 'mgr-1' },
      body: JSON.stringify({ role: 'TENANT_OWNER' }),
    }));

    const updateInput = ddbMock.commandCalls(UpdateCommand)[0]?.args[0].input;
    expect(updateInput?.ExpressionAttributeNames).toEqual({ '#role': 'role' });
  });

  it('a locationIds-only update omits ExpressionAttributeNames entirely rather than sending an empty object', async () => {
    ddbMock.on(GetCommand).resolves({ Item: { userId: 'mgr-1', role: UserRole.LOCATION_MANAGER } });
    ddbMock.on(UpdateCommand).resolves({});

    await handler(fakeEvent({
      httpMethod: 'PATCH',
      pathParameters: { userId: 'mgr-1' },
      body: JSON.stringify({ locationIds: ['loc1'] }),
    }));

    const updateInput = ddbMock.commandCalls(UpdateCommand)[0]?.args[0].input;
    expect(updateInput).not.toHaveProperty('ExpressionAttributeNames');
  });
});

describe('DELETE /admin-users/{userId}', () => {
  it('blocks a self-delete attempt without making any AWS calls', async () => {
    const result = await handler(fakeEvent({
      httpMethod: 'DELETE',
      pathParameters: { userId: 'owner-1' },
    }));

    expect(result.statusCode).toBe(400);
    expect(ddbMock.calls()).toHaveLength(0);
    expect(cognitoMock.calls()).toHaveLength(0);
  });

  it('is forbidden for a LOCATION_MANAGER caller', async () => {
    const result = await handler(fakeEvent({
      httpMethod: 'DELETE',
      pathParameters: { userId: 'mgr-2' },
      claims: { 'custom:role': UserRole.LOCATION_MANAGER },
    }));

    expect(result.statusCode).toBe(403);
    expect(cognitoMock.calls()).toHaveLength(0);
  });

  it('returns 404 and makes no Cognito call when the target does not belong to this tenant', async () => {
    ddbMock.on(GetCommand).resolves({ Item: undefined });

    const result = await handler(fakeEvent({
      httpMethod: 'DELETE',
      pathParameters: { userId: 'other-tenant-user' },
    }));

    expect(result.statusCode).toBe(404);
    expect(cognitoMock.calls()).toHaveLength(0);
  });

  it('returns 404 without any Cognito call when the target is not an admin-managed role', async () => {
    ddbMock.on(GetCommand).resolves({ Item: { userId: 'cust-1', role: UserRole.CUSTOMER } });

    const result = await handler(fakeEvent({
      httpMethod: 'DELETE',
      pathParameters: { userId: 'cust-1' },
    }));

    expect(result.statusCode).toBe(404);
    expect(cognitoMock.calls()).toHaveLength(0);
  });

  it('deletes the Cognito user and the DynamoDB record for a valid same-tenant location manager', async () => {
    ddbMock.on(GetCommand).resolves({ Item: { userId: 'mgr-1', role: UserRole.LOCATION_MANAGER } });
    cognitoMock.on(AdminDeleteUserCommand).resolves({});
    ddbMock.on(DeleteCommand).resolves({});

    const result = await handler(fakeEvent({
      httpMethod: 'DELETE',
      pathParameters: { userId: 'mgr-1' },
    }));

    expect(result.statusCode).toBe(200);
    expect(cognitoMock.commandCalls(AdminDeleteUserCommand)[0]?.args[0].input).toMatchObject({ UserPoolId: 'pool1', Username: 'mgr-1' });
    expect(ddbMock.commandCalls(DeleteCommand)[0]?.args[0].input).toMatchObject({
      TableName: TABLE.USERS,
      Key: { PK: 'TENANT#t1', SK: 'USER#mgr-1' },
    });
  });

  it('allows a TENANT_OWNER to delete another TENANT_OWNER (co-owner)', async () => {
    ddbMock.on(GetCommand).resolves({ Item: { userId: 'owner-2', role: UserRole.TENANT_OWNER } });
    cognitoMock.on(AdminDeleteUserCommand).resolves({});
    ddbMock.on(DeleteCommand).resolves({});

    const result = await handler(fakeEvent({
      httpMethod: 'DELETE',
      pathParameters: { userId: 'owner-2' },
    }));

    expect(result.statusCode).toBe(200);
  });

  it('returns 404 when Cognito reports the user does not exist', async () => {
    ddbMock.on(GetCommand).resolves({ Item: { userId: 'mgr-1', role: UserRole.LOCATION_MANAGER } });
    cognitoMock.on(AdminDeleteUserCommand).rejects(Object.assign(new Error('User does not exist.'), { name: 'UserNotFoundException' }));

    const result = await handler(fakeEvent({
      httpMethod: 'DELETE',
      pathParameters: { userId: 'mgr-1' },
    }));

    expect(result.statusCode).toBe(404);
    expect(ddbMock.commandCalls(DeleteCommand)).toHaveLength(0);
  });
});
