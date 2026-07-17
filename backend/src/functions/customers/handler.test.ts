import type { APIGatewayProxyEvent } from 'aws-lambda';
import { createHash } from 'node:crypto';
import { mockClient } from 'aws-sdk-client-mock';
import { QueryCommand, DeleteCommand, UpdateCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { CognitoIdentityProviderClient, AdminDeleteUserCommand } from '@aws-sdk/client-cognito-identity-provider';
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

function fakeEvent(overrides: Partial<APIGatewayProxyEvent> & { claims?: Record<string, string> } = {}): APIGatewayProxyEvent {
  const { claims, ...rest } = overrides;
  return {
    httpMethod: 'GET',
    queryStringParameters: null,
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

describe('GET /customers', () => {
  it('rejects customers themselves from listing customers', async () => {
    const result = await handler(fakeEvent({ claims: { 'custom:role': UserRole.CUSTOMER } }));

    expect(result.statusCode).toBe(403);
  });

  it('returns a paginated, role-filtered customer list', async () => {
    ddbMock.on(QueryCommand, { TableName: TABLE.USERS }).resolves({
      Items: [
        { userId: 'c1', email: 'c1@shop.com', firstName: 'A', lastName: 'B', status: 'ACTIVE', createdAt: 't' },
      ],
    });

    const result = await handler(fakeEvent());

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.data.items).toEqual([
      { userId: 'c1', email: 'c1@shop.com', firstName: 'A', lastName: 'B', phone: null, status: 'ACTIVE', createdAt: 't' },
    ]);
    const call = ddbMock.commandCalls(QueryCommand)[0]?.args[0].input;
    expect(call?.ExpressionAttributeValues).toMatchObject({ ':customer': 'CUSTOMER' });
  });

  it('caps the requested page limit at 100', async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [] });

    await handler(fakeEvent({ queryStringParameters: { limit: '9999' } }));

    const call = ddbMock.commandCalls(QueryCommand)[0]?.args[0].input;
    expect(call?.Limit).toBe(100);
  });
});

describe('DELETE /customers/me', () => {
  function deleteEvent(claims?: Record<string, string>) {
    return fakeEvent({
      httpMethod: 'DELETE',
      claims: { sub: 'cust-1', 'custom:tenantId': 't1', 'custom:role': UserRole.CUSTOMER, ...(claims ?? {}) },
    });
  }

  it('rejects non-customer roles (admins must not self-delete via this route)', async () => {
    const result = await handler(deleteEvent({ 'custom:role': UserRole.TENANT_OWNER }));
    expect(result.statusCode).toBe(403);
    expect(cognitoMock.calls()).toHaveLength(0);
  });

  it('anonymizes the caller\'s vehicles and appointments, hard-deletes notifications/user/Cognito, and writes a deletion audit record', async () => {
    ddbMock.on(QueryCommand, { TableName: TABLE.VEHICLES }).resolves({
      Items: [{ PK: 'TENANT#t1', SK: 'VEHICLE#v1' }, { PK: 'TENANT#t1', SK: 'VEHICLE#v2' }],
    });
    ddbMock.on(QueryCommand, { TableName: TABLE.APPOINTMENTS }).resolves({
      Items: [{ PK: 'TENANT#t1', SK: 'APPT#a1' }],
    });
    ddbMock.on(QueryCommand, { TableName: TABLE.NOTIFICATIONS }).resolves({
      Items: [{ PK: 'USER#cust-1', SK: 'NOTIF#n1' }],
    });
    ddbMock.on(UpdateCommand).resolves({});
    ddbMock.on(DeleteCommand).resolves({});
    ddbMock.on(PutCommand).resolves({});
    cognitoMock.on(AdminDeleteUserCommand).resolves({});

    const result = await handler(deleteEvent({ email: 'cust1@shop.com' }));

    expect(result.statusCode).toBe(200);

    const vehicleQuery = ddbMock.commandCalls(QueryCommand).find(c => c.args[0].input.TableName === TABLE.VEHICLES)?.args[0].input;
    expect(vehicleQuery?.ExpressionAttributeValues).toMatchObject({ ':gsi1pk': 'CUSTOMER#cust-1' });

    // Vehicles and appointments are anonymized in place, not deleted
    const updateCalls = ddbMock.commandCalls(UpdateCommand).map(c => c.args[0].input);
    expect(updateCalls).toEqual(expect.arrayContaining([
      expect.objectContaining({ Key: { PK: 'TENANT#t1', SK: 'VEHICLE#v1' }, UpdateExpression: expect.stringContaining('REMOVE GSI1PK, GSI1SK, customerId') }),
      expect.objectContaining({ Key: { PK: 'TENANT#t1', SK: 'VEHICLE#v2' }, UpdateExpression: expect.stringContaining('REMOVE GSI1PK, GSI1SK, customerId') }),
      expect.objectContaining({
        Key: { PK: 'TENANT#t1', SK: 'APPT#a1' },
        UpdateExpression: expect.stringContaining('customerName'),
        ExpressionAttributeValues: { ':deleted': 'Deleted Customer' },
      }),
    ]));

    // Notifications and the user record are still hard-deleted
    const deleteKeys = ddbMock.commandCalls(DeleteCommand).map(c => c.args[0].input.Key);
    expect(deleteKeys).toEqual(expect.arrayContaining([
      { PK: 'USER#cust-1', SK: 'NOTIF#n1' },
      { PK: 'TENANT#t1', SK: 'USER#cust-1' },
    ]));
    expect(deleteKeys).not.toEqual(expect.arrayContaining([{ PK: 'TENANT#t1', SK: 'VEHICLE#v1' }]));

    // A deletion audit record is written, hashed email only
    const auditItem = ddbMock.commandCalls(PutCommand)[0]?.args[0].input.Item as Record<string, unknown>;
    expect(auditItem).toMatchObject({
      PK: 'TENANT#t1',
      tenantId: 't1',
      deletedUserId: 'cust-1',
      method: 'self-service',
      vehicleCount: 2,
      appointmentCount: 1,
      emailHash: createHash('sha256').update('cust1@shop.com').digest('hex'),
    });
    expect(auditItem.SK).toEqual(expect.stringContaining('DELETION#'));
    expect(JSON.stringify(auditItem)).not.toContain('cust1@shop.com');

    const cognitoCall = cognitoMock.commandCalls(AdminDeleteUserCommand)[0]?.args[0].input;
    expect(cognitoCall).toEqual({ UserPoolId: 'pool1', Username: 'cust-1' });
  });

  it('deletes the user record and writes an audit entry even when there are no vehicles/appointments/notifications', async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [] });
    ddbMock.on(DeleteCommand).resolves({});
    ddbMock.on(PutCommand).resolves({});
    cognitoMock.on(AdminDeleteUserCommand).resolves({});

    const result = await handler(deleteEvent());

    expect(result.statusCode).toBe(200);
    expect(ddbMock.commandCalls(UpdateCommand)).toHaveLength(0);
    expect(ddbMock.commandCalls(DeleteCommand)).toHaveLength(1);
    expect(ddbMock.commandCalls(DeleteCommand)[0]?.args[0].input.Key).toEqual({ PK: 'TENANT#t1', SK: 'USER#cust-1' });
    expect(ddbMock.commandCalls(PutCommand)).toHaveLength(1);
  });

  it('stores a null emailHash when the caller has no email claim', async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [] });
    ddbMock.on(DeleteCommand).resolves({});
    ddbMock.on(PutCommand).resolves({});
    cognitoMock.on(AdminDeleteUserCommand).resolves({});

    await handler(deleteEvent({ email: '' }));

    const auditItem = ddbMock.commandCalls(PutCommand)[0]?.args[0].input.Item as Record<string, unknown>;
    expect(auditItem.emailHash).toBeNull();
  });

  it('returns 500 without calling Cognito when USER_POOL_ID is not configured', async () => {
    delete process.env.USER_POOL_ID;
    ddbMock.on(QueryCommand).resolves({ Items: [] });
    ddbMock.on(DeleteCommand).resolves({});

    const result = await handler(deleteEvent());

    expect(result.statusCode).toBe(500);
    expect(cognitoMock.calls()).toHaveLength(0);
  });
});
