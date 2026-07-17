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
    body: JSON.stringify({ token: 'expo-token-123' }),
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

describe('PUT /users/push-token', () => {
  it('rejects when no token is provided', async () => {
    const result = await handler(fakeEvent({ body: JSON.stringify({}) }));

    expect(result.statusCode).toBe(400);
    expect(ddbMock.commandCalls(UpdateCommand)).toHaveLength(0);
  });

  it('rejects when token is not a string', async () => {
    const result = await handler(fakeEvent({ body: JSON.stringify({ token: 42 }) }));

    expect(result.statusCode).toBe(400);
  });

  it('adds the token to the caller\'s own user record without overwriting other devices\' tokens', async () => {
    ddbMock.on(UpdateCommand).resolves({});

    const result = await handler(fakeEvent({}));

    expect(result.statusCode).toBe(200);
    const call = ddbMock.commandCalls(UpdateCommand)[0]?.args[0].input;
    expect(call?.TableName).toBe(TABLE.USERS);
    expect(call?.Key).toEqual({ PK: 'TENANT#t1', SK: 'USER#user-1' });
    expect(call?.UpdateExpression).toContain('ADD pushTokens');
    expect(call?.ExpressionAttributeValues).toMatchObject({ ':tokenSet': new Set(['expo-token-123']) });
  });

  it('returns 401 when claims are missing', async () => {
    const result = await handler({ httpMethod: 'PUT', body: '{}', requestContext: {} } as unknown as APIGatewayProxyEvent);

    expect(result.statusCode).toBe(401);
  });
});
