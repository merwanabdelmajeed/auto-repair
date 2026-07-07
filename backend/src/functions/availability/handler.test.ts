import type { APIGatewayProxyEvent } from 'aws-lambda';
import { mockClient } from 'aws-sdk-client-mock';
import { GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { db, TABLE } from '../../shared/utils/dynamodb.js';
import { UserRole } from '../../shared/types/index.js';
import { handler } from './handler';

const ddbMock = mockClient(db);

beforeEach(() => ddbMock.reset());

function fakeEvent(overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent {
  return {
    httpMethod: 'GET',
    queryStringParameters: { date: '2024-01-01', locationId: 'loc1' }, // 2024-01-01 is a Monday
    requestContext: {
      authorizer: {
        claims: {
          sub: 'customer-1',
          email: 'customer@shop.com',
          'custom:tenantId': 't1',
          'custom:role': UserRole.CUSTOMER,
        },
      },
    },
    ...overrides,
  } as unknown as APIGatewayProxyEvent;
}

describe('GET /availability', () => {
  it('rejects a missing or malformed date', async () => {
    const result = await handler(fakeEvent({ queryStringParameters: { locationId: 'loc1' } }));
    expect(result.statusCode).toBe(400);
  });

  it('rejects a missing locationId', async () => {
    const result = await handler(fakeEvent({ queryStringParameters: { date: '2024-01-01' } }));
    expect(result.statusCode).toBe(400);
  });

  it('falls back to default capacity when no CapacitySettings item exists', async () => {
    ddbMock.on(GetCommand).resolves({});
    ddbMock.on(QueryCommand, { TableName: TABLE.BLOCKED_TIMES }).resolves({ Items: [] });
    ddbMock.on(QueryCommand, { TableName: TABLE.APPOINTMENTS }).resolves({ Items: [] });

    const result = await handler(fakeEvent());

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body).data;
    expect(body.isOpen).toBe(true);
    expect(body.slots.length).toBeGreaterThan(0);
  });

  it('reports closed on a blocked date, using the stored CapacitySettings item', async () => {
    ddbMock.on(GetCommand).resolves({
      Item: {
        tenantId: 't1', locationId: 'loc1', slotDurationMinutes: 30, maxConcurrent: 2,
        operatingHours: { monday: { open: '09:00', close: '17:00' } }, updatedAt: 't',
      },
    });
    ddbMock.on(QueryCommand, { TableName: TABLE.BLOCKED_TIMES }).resolves({
      Items: [{ startDate: '2024-01-01', endDate: '2024-01-01', label: 'Holiday' }],
    });
    ddbMock.on(QueryCommand, { TableName: TABLE.APPOINTMENTS }).resolves({ Items: [] });

    const result = await handler(fakeEvent());

    const body = JSON.parse(result.body).data;
    expect(body).toEqual({ date: '2024-01-01', isOpen: false, blockedReason: 'Holiday', slots: [] });
  });

  it('reports closed on a day with no operating hours (Sunday)', async () => {
    ddbMock.on(GetCommand).resolves({});
    ddbMock.on(QueryCommand, { TableName: TABLE.BLOCKED_TIMES }).resolves({ Items: [] });
    ddbMock.on(QueryCommand, { TableName: TABLE.APPOINTMENTS }).resolves({ Items: [] });

    const result = await handler(fakeEvent({ queryStringParameters: { date: '2024-01-07', locationId: 'loc1' } }));

    const body = JSON.parse(result.body).data;
    expect(body.isOpen).toBe(false);
  });
});
