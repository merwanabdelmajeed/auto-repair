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

describe('GET /dashboard', () => {
  it('rejects non-admin roles', async () => {
    const result = await handler(fakeEvent({ claims: { 'custom:role': UserRole.CUSTOMER } }));
    expect(result.statusCode).toBe(403);
  });

  it('excludes cancelled appointments from totals and counts bookings for the requested localDate', async () => {
    ddbMock.on(QueryCommand, { TableName: TABLE.USERS }).resolves({ Count: 5 });
    ddbMock.on(QueryCommand, { TableName: TABLE.VEHICLES }).resolves({ Count: 3 });
    ddbMock.on(QueryCommand, { TableName: TABLE.APPOINTMENTS }).resolves({
      Items: [
        { status: 'confirmed', scheduledAt: '2026-07-06T10:00:00.000Z' },
        { status: 'cancelled', scheduledAt: '2026-07-06T11:00:00.000Z' },
        { status: 'completed', scheduledAt: '2026-06-01T09:00:00.000Z' },
      ],
    });

    const result = await handler(fakeEvent({ queryStringParameters: { localDate: '2026-07-06' } }));

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body).data;
    expect(body).toEqual({
      totalCustomers: 5,
      totalVehicles: 3,
      totalAppointments: 2, // cancelled excluded
      bookingsToday: 1,
    });
  });

  it('filters the customer count query to role=CUSTOMER, excluding admin/location-manager USER# records', async () => {
    ddbMock.on(QueryCommand, { TableName: TABLE.USERS }).resolves({ Count: 0 });
    ddbMock.on(QueryCommand, { TableName: TABLE.VEHICLES }).resolves({ Count: 0 });
    ddbMock.on(QueryCommand, { TableName: TABLE.APPOINTMENTS }).resolves({ Items: [] });

    await handler(fakeEvent());

    const usersCall = ddbMock.commandCalls(QueryCommand)
      .map(c => c.args[0].input)
      .find(input => input.TableName === TABLE.USERS);
    expect(usersCall?.FilterExpression).toBe('#role = :customer');
    expect(usersCall?.ExpressionAttributeValues).toMatchObject({ ':customer': 'CUSTOMER' });
  });

  it('falls back to the server UTC date when localDate is missing or malformed', async () => {
    ddbMock.on(QueryCommand, { TableName: TABLE.USERS }).resolves({ Count: 0 });
    ddbMock.on(QueryCommand, { TableName: TABLE.VEHICLES }).resolves({ Count: 0 });
    ddbMock.on(QueryCommand, { TableName: TABLE.APPOINTMENTS }).resolves({ Items: [] });

    const result = await handler(fakeEvent({ queryStringParameters: { localDate: 'not-a-date' } }));

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).data.bookingsToday).toBe(0);
  });
});
