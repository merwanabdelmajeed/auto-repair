import type { APIGatewayProxyEvent } from 'aws-lambda';
import { mockClient } from 'aws-sdk-client-mock';
import { GetCommand, PutCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { TransactionCanceledException } from '@aws-sdk/client-dynamodb';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import { db } from '../../shared/utils/dynamodb.js';
import { UserRole } from '../../shared/types/index.js';
import { handler } from './plateHandler';

const ddbMock = mockClient(db);
const ssmMock = mockClient(SSMClient);

function fakeEvent(role: string, query: Record<string, string> | null = { plate: 'ABC123', state: 'CA' }): APIGatewayProxyEvent {
  return {
    httpMethod: 'GET',
    queryStringParameters: query,
    requestContext: {
      authorizer: { claims: { sub: 'u1', email: 'u@shop.com', 'custom:tenantId': 't1', 'custom:role': role } },
    },
  } as unknown as APIGatewayProxyEvent;
}
const customer = (query?: Record<string, string> | null) => handler(fakeEvent(UserRole.CUSTOMER, query));

// A CarAPI login JWT that won't expire during the test run.
const JWT = `h.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64')}.s`;
const VIN = '1HGCM82633A004352';
const nhtsa = { Results: [{ Make: 'HONDA', Model: 'Accord', ModelYear: '2003', Trim: 'EX-V6' }] };

const fetchSpy = jest.spyOn(global, 'fetch');
const respond = (status: number, body: unknown) =>
  Promise.resolve(new Response(typeof body === 'string' ? body : JSON.stringify(body), { status }));
const urls = () => fetchSpy.mock.calls.map(c => String(c[0]));
const carApiCalls = () => urls().filter(u => u.includes('carapi.app/api/license-plate'));

function mockFetch({ plate = respond(200, { vin: VIN }), decode = respond(200, nhtsa) }: { plate?: Promise<Response>; decode?: Promise<Response> } = {}) {
  fetchSpy.mockImplementation((input) => {
    const url = String(input);
    if (url.includes('/auth/login')) return respond(200, JWT);
    if (url.includes('license-plate')) return plate;
    return decode;
  });
}

function cancelled(codes: string[]) {
  return new TransactionCanceledException({
    message: 'cancelled', $metadata: {}, CancellationReasons: codes.map(Code => ({ Code })),
  });
}

beforeEach(() => {
  ddbMock.reset();
  ssmMock.reset();
  fetchSpy.mockReset();
  ssmMock.on(GetParameterCommand).resolves({ Parameter: { Value: 'x' } });
  ddbMock.on(GetCommand).resolves({});
  ddbMock.on(TransactWriteCommand).resolves({});
  ddbMock.on(PutCommand).resolves({});
});

afterAll(() => fetchSpy.mockRestore());

describe('GET /vehicles/plate — access and validation', () => {
  it.each([UserRole.TENANT_OWNER, UserRole.LOCATION_MANAGER, UserRole.SUPER_ADMIN])(
    'rejects %s — the paid lookup is customer-only',
    async (role) => {
      const result = await handler(fakeEvent(role));
      expect(result.statusCode).toBe(403);
      expect(fetchSpy).not.toHaveBeenCalled();
    },
  );

  it('validates the query before any paid call', async () => {
    expect((await customer(null)).statusCode).toBe(400);
    expect((await customer({ plate: 'ABC123', state: 'CAL' })).statusCode).toBe(400);
    expect((await customer({ plate: 'ABC123', state: 'C1' })).statusCode).toBe(400);
    const junk = await customer({ plate: 'TOOLONGPLATE9', state: 'CA' });
    expect(junk.statusCode).toBe(400);
    expect(JSON.parse(junk.body).error).toBe('License plates are 1–8 letters and numbers');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(ddbMock.commandCalls(TransactWriteCommand)).toHaveLength(0);
  });
});

describe('GET /vehicles/plate — cache', () => {
  it('answers a cached plate for free: no quota used, no CarAPI or NHTSA call', async () => {
    ddbMock.on(GetCommand).resolves({
      Item: { vin: VIN, details: { make: 'HONDA', model: 'Accord', year: '2003' }, expiresAt: Math.floor(Date.now() / 1000) + 100 },
    });
    const result = await customer({ plate: 'abc-123', state: 'ca' });
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).data).toEqual({ vin: VIN, make: 'HONDA', model: 'Accord', year: '2003' });
    expect(ddbMock.commandCalls(GetCommand)[0]!.args[0].input.Key).toEqual({ PK: 'TENANT#t1', SK: 'PLATE#CA#ABC123' });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(ddbMock.commandCalls(TransactWriteCommand)).toHaveLength(0);
  });

  it('answers a cached "not found" for free', async () => {
    ddbMock.on(GetCommand).resolves({ Item: { notFound: true, expiresAt: Math.floor(Date.now() / 1000) + 100 } });
    const result = await customer();
    expect(result.statusCode).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(ddbMock.commandCalls(TransactWriteCommand)).toHaveLength(0);
  });

  it('re-decodes a cached VIN via free NHTSA without paying CarAPI again', async () => {
    ddbMock.on(GetCommand).resolves({ Item: { vin: VIN, expiresAt: Math.floor(Date.now() / 1000) + 100 } });
    mockFetch();
    const result = await customer();
    expect(result.statusCode).toBe(200);
    expect(carApiCalls()).toHaveLength(0);
    expect(ddbMock.commandCalls(TransactWriteCommand)).toHaveLength(0);
    expect(ddbMock.commandCalls(PutCommand)[0]!.args[0].input.Item).toMatchObject({ vin: VIN, details: { make: 'HONDA' } });
  });

  it('ignores an expired cache entry that the TTL sweep has not removed yet', async () => {
    ddbMock.on(GetCommand).resolves({ Item: { notFound: true, expiresAt: Math.floor(Date.now() / 1000) - 1 } });
    mockFetch();
    expect((await customer()).statusCode).toBe(200);
    expect(carApiCalls()).toHaveLength(1);
  });
});

describe('GET /vehicles/plate — daily quotas', () => {
  it('reserves one lookup on both the customer and tenant counters before paying', async () => {
    mockFetch();
    const result = await customer();
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).data).toEqual({ vin: VIN, make: 'HONDA', model: 'Accord', year: '2003', trim: 'EX-V6' });

    const [user, tenant] = ddbMock.commandCalls(TransactWriteCommand)[0]!.args[0].input.TransactItems!;
    expect(user!.Update!.Key).toEqual({ PK: 'TENANT#t1', SK: expect.stringMatching(/^USAGE#\d{4}-\d{2}-\d{2}#USER#u1$/) });
    expect(user!.Update!.ExpressionAttributeValues![':limit']).toBe(3);
    expect(tenant!.Update!.Key).toEqual({ PK: 'TENANT#t1', SK: expect.stringMatching(/^USAGE#\d{4}-\d{2}-\d{2}$/) });
    expect(tenant!.Update!.ExpressionAttributeValues![':limit']).toBe(50);

    // Cached for next time.
    const cached = ddbMock.commandCalls(PutCommand)[0]!.args[0].input.Item!;
    expect(cached).toMatchObject({ PK: 'TENANT#t1', SK: 'PLATE#CA#ABC123', vin: VIN, details: { make: 'HONDA' } });
    expect(cached.expiresAt).toBeGreaterThan(Date.now() / 1000 + 300 * 86400);
  });

  it("returns 429 without paying when the customer's daily limit is used up", async () => {
    ddbMock.on(TransactWriteCommand).rejects(cancelled(['ConditionalCheckFailed', 'None']));
    const result = await customer();
    expect(result.statusCode).toBe(429);
    expect(JSON.parse(result.body).error).toBe("You've used today's 3 plate lookups. Enter the VIN instead, or try again tomorrow.");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns 429 without paying when the shop's daily cap is reached", async () => {
    ddbMock.on(TransactWriteCommand).rejects(cancelled(['None', 'ConditionalCheckFailed']));
    const result = await customer();
    expect(result.statusCode).toBe(429);
    expect(JSON.parse(result.body).error).toBe('Plate lookup is unavailable for the rest of today. Enter the VIN instead.');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('500s on an unexpected quota-store error, still without paying', async () => {
    ddbMock.on(TransactWriteCommand).rejects(new Error('dynamo down'));
    expect((await customer()).statusCode).toBe(500);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('GET /vehicles/plate — CarAPI outcomes', () => {
  it('caches a plate CarAPI has no VIN for, so repeats are free', async () => {
    mockFetch({ plate: respond(404, 'not found') });
    const result = await customer();
    expect(result.statusCode).toBe(400);
    expect(ddbMock.commandCalls(PutCommand)[0]!.args[0].input.Item).toMatchObject({ notFound: true });
  });

  it('treats a 200 with no VIN as not found too', async () => {
    mockFetch({ plate: respond(200, { vin: null }) });
    expect((await customer()).statusCode).toBe(400);
    expect(ddbMock.commandCalls(PutCommand)[0]!.args[0].input.Item).toMatchObject({ notFound: true });
  });

  it('does not cache a CarAPI outage (the plate may be fine)', async () => {
    mockFetch({ plate: respond(500, 'boom') });
    const result = await customer();
    expect(result.statusCode).toBe(503);
    expect(ddbMock.commandCalls(PutCommand)).toHaveLength(0);
  });

  it('keeps the paid VIN when NHTSA cannot decode it', async () => {
    mockFetch({ decode: respond(503, 'down') });
    const result = await customer();
    expect(result.statusCode).toBe(400);
    const cached = ddbMock.commandCalls(PutCommand)[0]!.args[0].input.Item!;
    expect(cached.vin).toBe(VIN);
    expect(cached.details).toBeUndefined();
  });

  it('still returns the vehicle if writing the cache fails', async () => {
    mockFetch();
    ddbMock.on(PutCommand).rejects(new Error('throttled'));
    expect((await customer()).statusCode).toBe(200);
  });
});
