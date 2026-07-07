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
    queryStringParameters: { startDate: '2026-01-01', endDate: '2026-01-02' },
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

describe('GET /analytics', () => {
  it('rejects non-admin callers', async () => {
    const result = await handler(fakeEvent({ claims: { 'custom:role': UserRole.CUSTOMER } }));
    expect(result.statusCode).toBe(403);
  });

  it('rejects missing or malformed date params', async () => {
    expect((await handler(fakeEvent({ queryStringParameters: null }))).statusCode).toBe(400);
    expect((await handler(fakeEvent({ queryStringParameters: { startDate: '01/01/2026', endDate: '2026-01-02' } }))).statusCode).toBe(400);
  });

  it('aggregates bookings, revenue, and new-vs-returning customers over the date range', async () => {
    ddbMock.on(QueryCommand, { TableName: TABLE.APPOINTMENTS }).resolves({
      Items: [
        { scheduledAt: '2026-01-01T10:00:00.000Z', status: 'completed', serviceId: 's1', customerId: 'c1' },
        { scheduledAt: '2026-01-02T10:00:00.000Z', status: 'cancelled', serviceId: 's1', customerId: 'c2' },
        // Historical appointment for c2, before the range — makes c2 a "returning" customer
        { scheduledAt: '2025-12-01T10:00:00.000Z', status: 'completed', serviceId: 's1', customerId: 'c2' },
        // Outside the requested range — must be excluded entirely
        { scheduledAt: '2026-02-01T10:00:00.000Z', status: 'pending', serviceId: 's1', customerId: 'c3' },
      ],
    });
    ddbMock.on(QueryCommand, { TableName: TABLE.SERVICES }).resolves({
      Items: [{ serviceId: 's1', name: 'Oil Change', price: 100, durationMinutes: 30 }],
    });

    const result = await handler(fakeEvent());

    expect(result.statusCode).toBe(200);
    const data = JSON.parse(result.body).data;
    expect(data.summary).toEqual({
      totalBookings: 2,
      completedBookings: 1,
      cancelledBookings: 1,
      pendingBookings: 0,
      totalRevenue: 100,
      avgServiceMinutes: 30,
      uniqueCustomers: 2,
      newCustomers: 1, // c1 only — c2 has history before the range
      returningCustomers: 1,
    });
    expect(data.byDay).toEqual([
      { date: '2026-01-01', bookings: 1, completed: 1, revenue: 100 },
      { date: '2026-01-02', bookings: 1, completed: 0, revenue: 0 },
    ]);
    expect(data.byService).toEqual([
      { serviceId: 's1', serviceName: 'Oil Change', bookings: 2, completed: 1, revenue: 100, durationMinutes: 30 },
    ]);
    expect(data.byStatus).toEqual({ completed: 1, cancelled: 1 });
  });

  it('handles a period with zero completed appointments without dividing by zero', async () => {
    ddbMock.on(QueryCommand, { TableName: TABLE.APPOINTMENTS }).resolves({
      Items: [{ scheduledAt: '2026-01-01T10:00:00.000Z', status: 'pending', serviceId: 's1', customerId: 'c1' }],
    });
    ddbMock.on(QueryCommand, { TableName: TABLE.SERVICES }).resolves({ Items: [] });

    const result = await handler(fakeEvent());

    expect(JSON.parse(result.body).data.summary.avgServiceMinutes).toBe(0);
  });
});
