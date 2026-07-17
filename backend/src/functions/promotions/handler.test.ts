import type { APIGatewayProxyEvent } from 'aws-lambda';
import { mockClient } from 'aws-sdk-client-mock';
import { QueryCommand, GetCommand, PutCommand, UpdateCommand, DeleteCommand, BatchGetCommand } from '@aws-sdk/lib-dynamodb';
import { db, TABLE } from '../../shared/utils/dynamodb.js';
import { UserRole } from '../../shared/types/index.js';
import * as notify from '../../shared/utils/notify.js';
import { handler } from './handler';

const ddbMock = mockClient(db);

beforeEach(() => {
  ddbMock.reset();
  jest.restoreAllMocks();
});

function fakeEvent(overrides: Partial<APIGatewayProxyEvent> & { claims?: Record<string, string> } = {}): APIGatewayProxyEvent {
  const { claims, ...rest } = overrides;
  return {
    httpMethod: 'GET',
    body: null,
    pathParameters: null,
    queryStringParameters: null,
    resource: '/promotions',
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

function activePromo(overrides: Record<string, unknown> = {}) {
  return {
    promoId: 'p1', tenantId: 't1', code: 'SAVE10', description: '10% off', type: 'percent', value: 10,
    expiresAt: null, maxUses: null, usedCount: 0, isActive: true, createdAt: 'c',
    ...overrides,
  };
}

describe('GET /promotions/validate', () => {
  function validateEvent(query: Record<string, string> | null, claims?: Record<string, string>) {
    return fakeEvent({ pathParameters: { promoId: 'validate' }, queryStringParameters: query, claims });
  }

  it('rejects a missing code', async () => {
    const result = await handler(validateEvent(null));
    expect(result.statusCode).toBe(400);
  });

  it('returns 404 when the code does not exist or is inactive', async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [] });
    const result = await handler(validateEvent({ code: 'NOPE' }));
    expect(result.statusCode).toBe(404);
  });

  it('rejects an expired code', async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [activePromo({ expiresAt: '2020-01-01T00:00:00.000Z' })] });
    const result = await handler(validateEvent({ code: 'SAVE10' }));
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toMatch(/expired/i);
  });

  it('rejects a code that hit its usage limit', async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [activePromo({ maxUses: 5, usedCount: 5 })] });
    const result = await handler(validateEvent({ code: 'SAVE10' }));
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toMatch(/usage limit/i);
  });

  it('rejects a code the customer already used', async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [activePromo()] });
    ddbMock.on(GetCommand).resolves({ Item: { appliedAt: 'x' } });
    const result = await handler(validateEvent({ code: 'SAVE10' }, { 'custom:role': UserRole.CUSTOMER }));
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toMatch(/already used/i);
  });

  it('returns the limited promo fields on success', async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [activePromo()] });
    ddbMock.on(GetCommand).resolves({});
    const result = await handler(validateEvent({ code: 'save10' }));
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).data).toEqual({ promoId: 'p1', code: 'SAVE10', description: '10% off', type: 'percent', value: 10 });
  });
});

describe('GET /promotions', () => {
  it('returns every promo (active or not) to admins', async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [activePromo(), activePromo({ promoId: 'p2', isActive: false })] });
    const result = await handler(fakeEvent());
    expect(JSON.parse(result.body).data).toHaveLength(2);
  });

  it('filters customers to valid, unused promos with a reduced field set', async () => {
    ddbMock.on(QueryCommand).resolves({
      Items: [
        activePromo({ promoId: 'p1' }), // valid
        activePromo({ promoId: 'p2', isActive: false }), // inactive — filtered out
        activePromo({ promoId: 'p3', expiresAt: '2020-01-01T00:00:00.000Z' }), // expired — filtered out
        activePromo({ promoId: 'p4', maxUses: 1, usedCount: 1 }), // exhausted — filtered out
      ],
    });
    ddbMock.on(BatchGetCommand).resolves({ Responses: { [TABLE.PROMOTIONS]: [{ SK: 'PROMO_USAGE#p1#customer-1' }] } });

    const result = await handler(fakeEvent({ claims: { sub: 'customer-1', 'custom:role': UserRole.CUSTOMER } }));

    // p1 was valid but already used (per BatchGet) — so the final list is empty
    expect(JSON.parse(result.body).data).toEqual([]);
  });

  it('returns an empty list without a BatchGet call when there are no valid promos', async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [activePromo({ isActive: false })] });
    const result = await handler(fakeEvent({ claims: { 'custom:role': UserRole.CUSTOMER } }));
    expect(JSON.parse(result.body).data).toEqual([]);
    expect(ddbMock.commandCalls(BatchGetCommand)).toHaveLength(0);
  });
});

describe('POST /promotions', () => {
  function postEvent(body: Record<string, unknown>, claims?: Record<string, string>) {
    return fakeEvent({ httpMethod: 'POST', body: JSON.stringify(body), claims });
  }

  it('rejects non-admins', async () => {
    const result = await handler(postEvent({ code: 'X', type: 'fixed', value: 5 }, { 'custom:role': UserRole.CUSTOMER }));
    expect(result.statusCode).toBe(403);
  });

  it('rejects missing required fields', async () => {
    expect((await handler(postEvent({}))).statusCode).toBe(400);
  });

  it('rejects an invalid type', async () => {
    const result = await handler(postEvent({ code: 'X', type: 'bogus', value: 5 }));
    expect(result.statusCode).toBe(400);
  });

  it('rejects a non-positive value', async () => {
    const result = await handler(postEvent({ code: 'X', type: 'fixed', value: -5 }));
    expect(result.statusCode).toBe(400);
  });

  it('rejects a percent value over 100', async () => {
    const result = await handler(postEvent({ code: 'X', type: 'percent', value: 150 }));
    expect(result.statusCode).toBe(400);
  });

  it('creates the promo, uppercases the code, and fans out a notification to customers', async () => {
    ddbMock.on(PutCommand).resolves({});
    jest.spyOn(notify, 'getCustomersWithTokens').mockResolvedValue([{ userId: 'c1', pushTokens: ['tok'] }]);
    const notifyUserSpy = jest.spyOn(notify, 'notifyUser').mockResolvedValue();

    const result = await handler(postEvent({ code: ' save20 ', type: 'percent', value: 20 }));

    expect(result.statusCode).toBe(201);
    expect(JSON.parse(result.body).data.code).toBe('SAVE20');
    expect(notifyUserSpy).toHaveBeenCalledWith(expect.objectContaining({ userId: 'c1', type: 'promotion_new' }));
  });

  it('still returns 201 even if the notification fan-out fails', async () => {
    ddbMock.on(PutCommand).resolves({});
    jest.spyOn(notify, 'getCustomersWithTokens').mockRejectedValue(new Error('fan-out broke'));

    const result = await handler(postEvent({ code: 'X', type: 'fixed', value: 5 }));

    expect(result.statusCode).toBe(201);
  });
});

describe('POST /promotions/{promoId}/apply', () => {
  function applyEvent(body: Record<string, unknown>) {
    return fakeEvent({ httpMethod: 'POST', pathParameters: { promoId: 'p1' }, resource: '/promotions/{promoId}/apply', body: JSON.stringify(body) });
  }

  it('rejects missing customerId/appointmentId', async () => {
    const result = await handler(applyEvent({}));
    expect(result.statusCode).toBe(400);
  });

  it('rejects a promo already applied to this customer', async () => {
    ddbMock.on(GetCommand).resolves({ Item: { appliedAt: '2026-01-05T00:00:00.000Z' } });
    const result = await handler(applyEvent({ customerId: 'c1', appointmentId: 'a1' }));
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toMatch(/2026-01-05/);
  });

  it('records usage, increments usedCount, and flags the appointment', async () => {
    ddbMock.on(GetCommand).resolves({});
    ddbMock.on(PutCommand).resolves({});
    ddbMock.on(UpdateCommand).resolves({});

    const result = await handler(applyEvent({ customerId: 'c1', appointmentId: 'a1' }));

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).data).toEqual({ applied: true });
    expect(ddbMock.commandCalls(UpdateCommand)).toHaveLength(2);
  });
});

describe('PUT /promotions/{promoId}', () => {
  function putEvent(body: Record<string, unknown>) {
    return fakeEvent({ httpMethod: 'PUT', pathParameters: { promoId: 'p1' }, body: JSON.stringify(body) });
  }

  it('requires a promoId', async () => {
    const result = await handler(fakeEvent({ httpMethod: 'PUT', body: '{}' }));
    expect(result.statusCode).toBe(400);
  });

  it('rejects an invalid type on update', async () => {
    const result = await handler(putEvent({ type: 'bogus' }));
    expect(result.statusCode).toBe(400);
  });

  it('rejects an empty update body', async () => {
    const result = await handler(putEvent({}));
    expect(result.statusCode).toBe(400);
  });

  it('returns 404 when the promo does not exist', async () => {
    ddbMock.on(UpdateCommand).rejects(Object.assign(new Error('cond'), { name: 'ConditionalCheckFailedException' }));
    const result = await handler(putEvent({ isActive: false }));
    expect(result.statusCode).toBe(404);
  });

  it('updates the promo and returns the new state', async () => {
    ddbMock.on(UpdateCommand).resolves({ Attributes: activePromo({ isActive: false }) });
    const result = await handler(putEvent({ isActive: false }));
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).data.isActive).toBe(false);
  });
});

describe('DELETE /promotions/{promoId}', () => {
  it('deletes the promo', async () => {
    ddbMock.on(DeleteCommand).resolves({});
    const result = await handler(fakeEvent({ httpMethod: 'DELETE', pathParameters: { promoId: 'p1' } }));
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).data).toEqual({ deleted: true });
  });
});

it('returns 400 for an unrecognized method/route', async () => {
  const result = await handler(fakeEvent({ httpMethod: 'PATCH' as never, pathParameters: { promoId: 'p1' } }));
  expect(result.statusCode).toBe(400);
});
