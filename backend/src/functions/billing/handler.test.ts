import type { APIGatewayProxyEvent } from 'aws-lambda';
import { mockClient } from 'aws-sdk-client-mock';
import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { db, TABLE } from '../../shared/utils/dynamodb.js';
import { UserRole } from '../../shared/types/index.js';
import { getStripe } from '../../shared/utils/stripe.js';
import { handler } from './handler';

jest.mock('../../shared/utils/stripe', () => ({ getStripe: jest.fn() }));

const ddbMock = mockClient(db);

const fakeStripe = {
  customers: { create: jest.fn() },
  checkout: { sessions: { create: jest.fn() } },
  billingPortal: { sessions: { create: jest.fn() } },
};

beforeEach(() => {
  ddbMock.reset();
  jest.mocked(getStripe).mockResolvedValue(fakeStripe as never);
  fakeStripe.customers.create.mockResolvedValue({ id: 'cus_new' });
  fakeStripe.checkout.sessions.create.mockResolvedValue({ url: 'https://checkout.stripe.test/s/1' });
  fakeStripe.billingPortal.sessions.create.mockResolvedValue({ url: 'https://billing.stripe.test/p/1' });
});

function fakeEvent(method: string, resource: string, role: UserRole = UserRole.TENANT_OWNER): APIGatewayProxyEvent {
  return {
    httpMethod: method,
    resource,
    requestContext: {
      authorizer: {
        claims: { sub: 'owner-1', email: 'owner@shop.com', 'custom:tenantId': 't1', 'custom:role': role },
      },
    },
  } as unknown as APIGatewayProxyEvent;
}

function billingRow(item: Record<string, unknown> | undefined) {
  ddbMock.on(GetCommand, { TableName: TABLE.TENANTS, Key: { PK: 'TENANT#t1', SK: 'BILLING' } }).resolves({ Item: item });
}

describe('GET /billing', () => {
  it("reports 'none' for a shop that never subscribed", async () => {
    billingRow(undefined);
    const res = await handler(fakeEvent('GET', '/billing', UserRole.LOCATION_MANAGER));
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).data).toEqual({ status: 'none', currentPeriodEnd: null, cancelAtPeriodEnd: false, hasBillingAccount: false });
  });

  it('reports the saved subscription state', async () => {
    billingRow({ stripeCustomerId: 'cus_1', status: 'active', currentPeriodEnd: '2026-12-01T00:00:00.000Z', cancelAtPeriodEnd: true });
    const res = await handler(fakeEvent('GET', '/billing'));
    expect(JSON.parse(res.body).data).toEqual({ status: 'active', currentPeriodEnd: '2026-12-01T00:00:00.000Z', cancelAtPeriodEnd: true, hasBillingAccount: true });
  });

  it('rejects customers', async () => {
    const res = await handler(fakeEvent('GET', '/billing', UserRole.CUSTOMER));
    expect(res.statusCode).toBe(403);
  });
});

describe('POST /billing/checkout', () => {
  it('creates a Stripe customer once, saves it, and returns a subscription Checkout URL', async () => {
    billingRow(undefined);
    const res = await handler(fakeEvent('POST', '/billing/checkout'));

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).data).toEqual({ url: 'https://checkout.stripe.test/s/1' });
    expect(fakeStripe.customers.create).toHaveBeenCalledWith({ email: 'owner@shop.com', metadata: { tenantId: 't1' } });
    const update = ddbMock.commandCalls(UpdateCommand)[0].args[0].input;
    expect(update.Key).toEqual({ PK: 'TENANT#t1', SK: 'BILLING' });
    expect(update.ExpressionAttributeValues).toMatchObject({ ':c': 'cus_new' });
    expect(fakeStripe.checkout.sessions.create).toHaveBeenCalledWith(expect.objectContaining({
      mode: 'subscription',
      customer: 'cus_new',
      client_reference_id: 't1',
      subscription_data: { metadata: { tenantId: 't1' } },
    }));
  });

  it('reuses an existing Stripe customer (e.g. resubscribing after cancelling)', async () => {
    billingRow({ stripeCustomerId: 'cus_1', status: 'canceled' });
    await handler(fakeEvent('POST', '/billing/checkout'));
    expect(fakeStripe.customers.create).not.toHaveBeenCalled();
    expect(fakeStripe.checkout.sessions.create).toHaveBeenCalledWith(expect.objectContaining({ customer: 'cus_1' }));
  });

  it.each(['active', 'trialing', 'past_due'])('refuses a second subscription while %s', async status => {
    billingRow({ stripeCustomerId: 'cus_1', status });
    const res = await handler(fakeEvent('POST', '/billing/checkout'));
    expect(res.statusCode).toBe(409);
    expect(fakeStripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it('is owner-only', async () => {
    billingRow(undefined);
    const res = await handler(fakeEvent('POST', '/billing/checkout', UserRole.LOCATION_MANAGER));
    expect(res.statusCode).toBe(403);
  });

  it('fails cleanly when Stripe returns no URL', async () => {
    billingRow(undefined);
    fakeStripe.checkout.sessions.create.mockResolvedValue({ url: null });
    const res = await handler(fakeEvent('POST', '/billing/checkout'));
    expect(res.statusCode).toBe(500);
  });

  it('returns 500 when Stripe errors', async () => {
    billingRow(undefined);
    fakeStripe.customers.create.mockRejectedValue(new Error('stripe down'));
    const res = await handler(fakeEvent('POST', '/billing/checkout'));
    expect(res.statusCode).toBe(500);
  });
});

describe('POST /billing/portal', () => {
  it('returns a Customer Portal URL for a shop with a billing account', async () => {
    billingRow({ stripeCustomerId: 'cus_1', status: 'active' });
    const res = await handler(fakeEvent('POST', '/billing/portal'));
    expect(JSON.parse(res.body).data).toEqual({ url: 'https://billing.stripe.test/p/1' });
    expect(fakeStripe.billingPortal.sessions.create).toHaveBeenCalledWith(expect.objectContaining({ customer: 'cus_1' }));
  });

  it('asks the shop to subscribe first when there is no billing account', async () => {
    billingRow(undefined);
    const res = await handler(fakeEvent('POST', '/billing/portal'));
    expect(res.statusCode).toBe(400);
  });

  it('is owner-only', async () => {
    billingRow({ stripeCustomerId: 'cus_1', status: 'active' });
    const res = await handler(fakeEvent('POST', '/billing/portal', UserRole.LOCATION_MANAGER));
    expect(res.statusCode).toBe(403);
  });
});

it('rejects unknown routes', async () => {
  billingRow(undefined);
  const res = await handler(fakeEvent('DELETE', '/billing'));
  expect(res.statusCode).toBe(400);
});
