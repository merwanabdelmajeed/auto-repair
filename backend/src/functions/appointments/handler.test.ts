import type { APIGatewayProxyEvent } from 'aws-lambda';
import { mockClient } from 'aws-sdk-client-mock';
import { GetCommand, QueryCommand, TransactWriteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { db, TABLE } from '../../shared/utils/dynamodb.js';
import { UserRole } from '../../shared/types/index.js';

jest.mock('../../shared/utils/notify.js', () => ({
  notifyAdmins: jest.fn().mockResolvedValue(undefined),
  notifyUser: jest.fn().mockResolvedValue(undefined),
}));

import { notifyAdmins } from '../../shared/utils/notify.js';
import { handler } from './handler';

const ddbMock = mockClient(db);

beforeEach(() => {
  ddbMock.reset();
  jest.clearAllMocks();
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
          sub: 'me',
          email: 'customer@shop.com',
          given_name: 'Test',
          family_name: 'Customer',
          'custom:tenantId': 't1',
          ...(claims ?? {}),
        },
      },
    },
    ...rest,
  } as unknown as APIGatewayProxyEvent;
}

function mockHappyPathReads() {
  ddbMock
    .on(GetCommand, { TableName: TABLE.LOCATIONS }).resolves({ Item: { locationId: 'loc1', isActive: true } })
    .on(GetCommand, { TableName: TABLE.SERVICES }).resolves({ Item: { name: 'Oil Change' } })
    .on(GetCommand, { TableName: TABLE.VEHICLES }).resolves({ Item: { year: 2020, make: 'Honda', model: 'Civic' } })
    .on(GetCommand, { TableName: TABLE.CAPACITY }).resolves({ Item: undefined })
    .on(QueryCommand, { TableName: TABLE.BLOCKED_TIMES }).resolves({ Items: [] })
    .on(QueryCommand, { TableName: TABLE.APPOINTMENTS, IndexName: 'GSI2' }).resolves({ Items: [] });
}

const BOOKING_BODY = {
  locationId: 'loc1',
  vehicleId: 'veh1',
  serviceId: 'svc1',
  scheduledAt: '2026-08-10T09:00:00.000Z', // 2026-08-10 is a Monday
};

describe('POST /appointments', () => {
  it('books successfully, claims a slot counter, and notifies admins', async () => {
    mockHappyPathReads();
    ddbMock.on(TransactWriteCommand).resolves({});

    const result = await handler(fakeEvent({ httpMethod: 'POST', body: JSON.stringify(BOOKING_BODY) }));

    expect(result.statusCode).toBe(201);
    const data = JSON.parse(result.body).data;
    expect(data.serviceName).toBe('Oil Change');
    expect(data.locationId).toBe('loc1');

    const transactCall = ddbMock.commandCalls(TransactWriteCommand)[0]?.args[0].input;
    expect(transactCall?.TransactItems).toHaveLength(2);
    expect(transactCall?.TransactItems?.[0]?.Update?.Key).toEqual({ PK: 'TENANT#t1', SK: 'SLOTCOUNT#loc1#2026-08-10T09:00:00.000Z' });
    expect(transactCall?.TransactItems?.[1]?.Put?.Item?.locationId).toBe('loc1');

    expect(notifyAdmins).toHaveBeenCalledTimes(1);
  });

  it('returns 409 when the slot transaction is cancelled (slot filled concurrently)', async () => {
    mockHappyPathReads();
    ddbMock.on(TransactWriteCommand).rejects(Object.assign(new Error('cancelled'), { name: 'TransactionCanceledException' }));

    const result = await handler(fakeEvent({ httpMethod: 'POST', body: JSON.stringify(BOOKING_BODY) }));

    expect(result.statusCode).toBe(409);
  });

  it('returns 400 without making any AWS calls when locationId is missing', async () => {
    const { locationId, ...bodyWithoutLocation } = BOOKING_BODY;
    const result = await handler(fakeEvent({ httpMethod: 'POST', body: JSON.stringify(bodyWithoutLocation) }));

    expect(result.statusCode).toBe(400);
    expect(ddbMock.calls()).toHaveLength(0);
  });

  it('returns 404 when the location is not active', async () => {
    mockHappyPathReads();
    ddbMock.on(GetCommand, { TableName: TABLE.LOCATIONS }).resolves({ Item: { locationId: 'loc1', isActive: false } });

    const result = await handler(fakeEvent({ httpMethod: 'POST', body: JSON.stringify(BOOKING_BODY) }));

    expect(result.statusCode).toBe(404);
  });
});

describe('PATCH /appointments/{id}/status', () => {
  function mockExistingAppointment(overrides: Record<string, unknown>) {
    ddbMock.on(GetCommand, { TableName: TABLE.APPOINTMENTS }).resolves({
      Item: {
        appointmentId: 'appt1',
        customerId: 'me',
        status: 'pending',
        scheduledAt: '2026-08-10T09:00:00.000Z',
        locationId: 'loc1',
        ...overrides,
      },
    });
  }

  it('forbids a customer from cancelling someone else\'s appointment', async () => {
    mockExistingAppointment({ customerId: 'someone-else' });

    const result = await handler(fakeEvent({
      httpMethod: 'PATCH',
      pathParameters: { appointmentId: 'appt1' },
      body: JSON.stringify({ status: 'cancelled' }),
    }));

    expect(result.statusCode).toBe(403);
  });

  it('lets a customer cancel their own appointment and decrements the slot counter', async () => {
    mockExistingAppointment({ customerId: 'me' });
    ddbMock.on(UpdateCommand).resolves({
      Attributes: {
        appointmentId: 'appt1', customerId: 'me', status: 'cancelled',
        scheduledAt: '2026-08-10T09:00:00.000Z', locationId: 'loc1',
        serviceName: 'Oil Change', customerName: 'Test Customer',
      },
    });

    const result = await handler(fakeEvent({
      httpMethod: 'PATCH',
      pathParameters: { appointmentId: 'appt1' },
      body: JSON.stringify({ status: 'cancelled' }),
    }));

    expect(result.statusCode).toBe(200);
    const decrementCall = ddbMock.commandCalls(UpdateCommand).find(
      c => (c.args[0].input.Key as { SK: string })?.SK === 'SLOTCOUNT#loc1#2026-08-10T09:00:00.000Z',
    );
    expect(decrementCall).toBeDefined();
    expect(decrementCall?.args[0].input.ExpressionAttributeValues).toEqual({ ':neg1': -1 });
  });

  it('lets an admin cancel any appointment regardless of owner', async () => {
    mockExistingAppointment({ customerId: 'someone-else' });
    ddbMock.on(UpdateCommand).resolves({
      Attributes: { appointmentId: 'appt1', customerId: 'someone-else', status: 'cancelled', scheduledAt: '2026-08-10T09:00:00.000Z', locationId: 'loc1' },
    });

    const result = await handler(fakeEvent({
      httpMethod: 'PATCH',
      pathParameters: { appointmentId: 'appt1' },
      body: JSON.stringify({ status: 'cancelled' }),
      claims: { 'custom:role': UserRole.TENANT_OWNER },
    }));

    expect(result.statusCode).toBe(200);
  });
});
