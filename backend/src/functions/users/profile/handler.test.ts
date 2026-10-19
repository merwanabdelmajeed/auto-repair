import type { APIGatewayProxyEvent } from 'aws-lambda';
import { mockClient } from 'aws-sdk-client-mock';
import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { db, TABLE } from '../../../shared/utils/dynamodb.js';
import { UserRole } from '../../../shared/types/index.js';
import { handler } from './handler';

const ddbMock = mockClient(db);

beforeEach(() => ddbMock.reset());

function fakeEvent(overrides: Partial<APIGatewayProxyEvent> & { claims?: Record<string, string> }): APIGatewayProxyEvent {
  const { claims, ...rest } = overrides;
  return {
    httpMethod: 'PUT',
    body: JSON.stringify({ firstName: 'Jane', lastName: 'Doe' }),
    requestContext: {
      authorizer: {
        claims: {
          sub: 'user-1',
          email: 'user@shop.com',
          'custom:tenantId': 't1',
          'custom:role': UserRole.CUSTOMER,
          ...(claims ?? {}),
        },
      },
    },
    ...rest,
  } as unknown as APIGatewayProxyEvent;
}

describe('PUT /users/me', () => {
  it('rejects when firstName or lastName is missing', async () => {
    const result = await handler(fakeEvent({ body: JSON.stringify({ firstName: 'Jane' }) }));

    expect(result.statusCode).toBe(400);
    expect(ddbMock.commandCalls(UpdateCommand)).toHaveLength(0);
  });

  it('rejects when the names are blank/whitespace only', async () => {
    const result = await handler(fakeEvent({ body: JSON.stringify({ firstName: '  ', lastName: '  ' }) }));

    expect(result.statusCode).toBe(400);
    expect(ddbMock.commandCalls(UpdateCommand)).toHaveLength(0);
  });

  it('updates firstName/lastName on the caller\'s own USERS record', async () => {
    ddbMock.on(UpdateCommand).resolves({});

    const result = await handler(fakeEvent({ body: JSON.stringify({ firstName: '  Jane  ', lastName: '  Doe  ' }) }));

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toMatchObject({ success: true, data: { firstName: 'Jane', lastName: 'Doe' } });
    const call = ddbMock.commandCalls(UpdateCommand)[0]?.args[0].input;
    expect(call?.TableName).toBe(TABLE.USERS);
    expect(call?.Key).toEqual({ PK: 'TENANT#t1', SK: 'USER#user-1' });
    expect(call?.UpdateExpression).toContain('SET firstName = :f, lastName = :l');
    expect(call?.ConditionExpression).toBe('attribute_exists(PK)');
    // Trimmed before persisting.
    expect(call?.ExpressionAttributeValues).toMatchObject({ ':f': 'Jane', ':l': 'Doe' });
  });

  it('does not touch phone when the request omits it (admin app name edit)', async () => {
    ddbMock.on(UpdateCommand).resolves({});

    await handler(fakeEvent({}));

    const call = ddbMock.commandCalls(UpdateCommand)[0]?.args[0].input;
    expect(call?.UpdateExpression).not.toContain('phone');
    expect(call?.ExpressionAttributeValues).not.toHaveProperty(':phone');
    expect(call?.UpdateExpression).not.toContain('address');
  });

  it('updates the phone (trimmed, unvalidated) when sent', async () => {
    ddbMock.on(UpdateCommand).resolves({});

    const result = await handler(fakeEvent({ body: JSON.stringify({ firstName: 'Jane', lastName: 'Doe', phone: ' (949) 555-1234 ' }) }));

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).data).toEqual({ firstName: 'Jane', lastName: 'Doe', phone: '(949) 555-1234' });
    const call = ddbMock.commandCalls(UpdateCommand)[0]?.args[0].input;
    expect(call?.UpdateExpression).toContain('phone = :phone');
    expect(call?.ExpressionAttributeValues).toMatchObject({ ':phone': '(949) 555-1234' });
  });

  it('saves an address, or clears it when sent blank', async () => {
    ddbMock.on(UpdateCommand).resolves({});

    const saved = await handler(fakeEvent({ body: JSON.stringify({ firstName: 'Jane', lastName: 'Doe', address: { city: ' Irvine ' } }) }));
    expect(JSON.parse(saved.body).data).toEqual({ firstName: 'Jane', lastName: 'Doe', address: { city: 'Irvine' } });
    expect(ddbMock.commandCalls(UpdateCommand)[0]?.args[0].input.UpdateExpression).toContain('address = :address');

    const cleared = await handler(fakeEvent({ body: JSON.stringify({ firstName: 'Jane', lastName: 'Doe', address: null }) }));
    expect(JSON.parse(cleared.body).data).toEqual({ firstName: 'Jane', lastName: 'Doe', address: null });
    expect(ddbMock.commandCalls(UpdateCommand)[1]?.args[0].input.UpdateExpression).toMatch(/REMOVE address$/);
  });

  it('rejects an empty or non-string phone', async () => {
    for (const phone of ['   ', '', 5]) {
      const result = await handler(fakeEvent({ body: JSON.stringify({ firstName: 'Jane', lastName: 'Doe', phone }) }));
      expect(result.statusCode).toBe(400);
    }
    expect(ddbMock.commandCalls(UpdateCommand)).toHaveLength(0);
  });

  it('returns 404 when the user record does not exist', async () => {
    ddbMock.on(UpdateCommand).rejects(Object.assign(new Error('conditional'), { name: 'ConditionalCheckFailedException' }));

    const result = await handler(fakeEvent({}));

    expect(result.statusCode).toBe(404);
  });

  it('returns 500 on an unexpected DynamoDB error', async () => {
    ddbMock.on(UpdateCommand).rejects(new Error('boom'));

    const result = await handler(fakeEvent({}));

    expect(result.statusCode).toBe(500);
  });

  it('returns 401 when claims are missing', async () => {
    const result = await handler({ httpMethod: 'PUT', body: '{}', requestContext: {} } as unknown as APIGatewayProxyEvent);

    expect(result.statusCode).toBe(401);
  });
});

describe('GET /users/me', () => {
  it('returns the caller\'s own name, phone and address', async () => {
    const address = { line1: '1 Main St', city: 'Irvine' };
    ddbMock.on(GetCommand).resolves({ Item: { firstName: 'Jane', lastName: 'Doe', phone: '(949) 555-1234', address, email: 'x', role: 'CUSTOMER' } });

    const result = await handler(fakeEvent({ httpMethod: 'GET', body: null }));

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).data).toEqual({ firstName: 'Jane', lastName: 'Doe', phone: '(949) 555-1234', address });
    expect(ddbMock.commandCalls(GetCommand)[0]?.args[0].input.Key).toEqual({ PK: 'TENANT#t1', SK: 'USER#user-1' });
  });

  it('returns nulls for missing phone/address and empty names', async () => {
    ddbMock.on(GetCommand).resolves({ Item: {} });

    const result = await handler(fakeEvent({ httpMethod: 'GET', body: null }));

    expect(JSON.parse(result.body).data).toEqual({ firstName: '', lastName: '', phone: null, address: null });
  });

  it('returns 404 when the record is missing', async () => {
    ddbMock.on(GetCommand).resolves({});

    const result = await handler(fakeEvent({ httpMethod: 'GET', body: null }));

    expect(result.statusCode).toBe(404);
  });
});
