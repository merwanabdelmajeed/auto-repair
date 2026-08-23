import type { APIGatewayProxyEvent } from 'aws-lambda';
import { mockClient } from 'aws-sdk-client-mock';
import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
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
