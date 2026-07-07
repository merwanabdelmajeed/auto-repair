import type { APIGatewayProxyEvent } from 'aws-lambda';
import { mockClient } from 'aws-sdk-client-mock';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { db, TABLE } from '../../shared/utils/dynamodb.js';
import { UserRole } from '../../shared/types/index.js';
import { handler } from './handler';

const ddbMock = mockClient(db);

beforeEach(() => ddbMock.reset());

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
