import type { APIGatewayProxyEvent } from 'aws-lambda';
import Stripe from 'stripe';
import { mockClient } from 'aws-sdk-client-mock';
import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { db, TABLE } from '../../shared/utils/dynamodb.js';
import { getStripe, getWebhookSecret } from '../../shared/utils/stripe.js';
import { handler } from './webhook';

jest.mock('../../shared/utils/stripe', () => ({ getStripe: jest.fn(), getWebhookSecret: jest.fn() }));

const ddbMock = mockClient(db);
const snsMock = mockClient(SNSClient);
const WEBHOOK_SECRET = 'whsec_test_dummy';
// A real Stripe client (dummy key — nothing here hits the network) so the
// real signature verification runs; only subscriptions.retrieve is stubbed.
const stripe = new Stripe('sk_test_dummy');
const retrieve = jest.fn();

beforeEach(() => {
  ddbMock.reset();
  snsMock.reset();
  retrieve.mockReset();
  (stripe as unknown as { subscriptions: { retrieve: jest.Mock } }).subscriptions = { retrieve } as never;
  jest.mocked(getStripe).mockResolvedValue(stripe);
  jest.mocked(getWebhookSecret).mockResolvedValue(WEBHOOK_SECRET);
});

function subscription(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sub_1', object: 'subscription', customer: 'cus_1', status: 'active',
    cancel_at_period_end: false, metadata: { tenantId: 't1' },
    items: { data: [{ current_period_end: 1796083200 }] }, // 2026-12-01T00:00:00Z
    ...overrides,
  };
}

function signedEvent(type: string, object: Record<string, unknown>, opts: { base64?: boolean; secret?: string } = {}): APIGatewayProxyEvent {
  const payload = JSON.stringify({ id: 'evt_1', object: 'event', type, data: { object } });
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret: opts.secret ?? WEBHOOK_SECRET });
  return {
    httpMethod: 'POST',
    headers: { 'Stripe-Signature': header },
    body: opts.base64 ? Buffer.from(payload).toString('base64') : payload,
    isBase64Encoded: !!opts.base64,
  } as unknown as APIGatewayProxyEvent;
}

function savedValues() {
  const calls = ddbMock.commandCalls(UpdateCommand);
  expect(calls).toHaveLength(1);
  const input = calls[0].args[0].input;
  expect(input.TableName).toBe(TABLE.TENANTS);
  expect(input.Key).toEqual({ PK: 'TENANT#t1', SK: 'BILLING' });
  return input.ExpressionAttributeValues;
}

describe('POST /billing/webhook', () => {
  it('rejects requests without a signature', async () => {
    const res = await handler({ httpMethod: 'POST', headers: {}, body: '{}' } as unknown as APIGatewayProxyEvent);
    expect(res.statusCode).toBe(400);
  });

  it('rejects a body signed with the wrong secret, without touching the database', async () => {
    const res = await handler(signedEvent('customer.subscription.updated', subscription(), { secret: 'whsec_attacker' }));
    expect(res.statusCode).toBe(400);
    expect(ddbMock.commandCalls(UpdateCommand)).toHaveLength(0);
  });

  it('saves the subscription after checkout completes, re-fetched from Stripe', async () => {
    retrieve.mockResolvedValue(subscription());
    const res = await handler(signedEvent('checkout.session.completed', {
      object: 'checkout.session', mode: 'subscription', subscription: 'sub_1', client_reference_id: 't1',
    }));

    expect(res.statusCode).toBe(200);
    expect(retrieve).toHaveBeenCalledWith('sub_1');
    expect(savedValues()).toMatchObject({
      ':c': 'cus_1', ':s': 'sub_1', ':st': 'active', ':pe': '2026-12-01T00:00:00.000Z', ':cancel': false,
    });
  });

  it('records a failed renewal (past_due) from a subscription update, using current Stripe state', async () => {
    // The event payload may be stale/out of order — the re-fetched state wins.
    retrieve.mockResolvedValue(subscription({ status: 'past_due' }));
    const res = await handler(signedEvent('customer.subscription.updated', subscription({ status: 'active' })));
    expect(res.statusCode).toBe(200);
    expect(savedValues()).toMatchObject({ ':st': 'past_due' });
  });

  it('records a cancellation and accepts a base64-encoded body', async () => {
    retrieve.mockResolvedValue(subscription({ status: 'canceled', customer: { id: 'cus_1' }, items: { data: [] } }));
    const res = await handler(signedEvent('customer.subscription.deleted', subscription(), { base64: true }));
    expect(res.statusCode).toBe(200);
    expect(savedValues()).toMatchObject({ ':st': 'canceled', ':c': 'cus_1', ':pe': null });
  });

  it('falls back to the fetched subscription metadata for the tenant', async () => {
    retrieve.mockResolvedValue(subscription());
    await handler(signedEvent('checkout.session.completed', {
      object: 'checkout.session', mode: 'subscription', subscription: { id: 'sub_1' }, client_reference_id: null,
    }));
    expect(savedValues()).toMatchObject({ ':s': 'sub_1' });
  });

  it('acks (200) but saves nothing for a subscription with no tenant', async () => {
    retrieve.mockResolvedValue(subscription({ metadata: {} }));
    const res = await handler(signedEvent('customer.subscription.updated', subscription({ metadata: {} })));
    expect(res.statusCode).toBe(200);
    expect(ddbMock.commandCalls(UpdateCommand)).toHaveLength(0);
  });

  it('ignores unrelated events and one-off (non-subscription) checkouts', async () => {
    expect((await handler(signedEvent('invoice.paid', { object: 'invoice' }))).statusCode).toBe(200);
    expect((await handler(signedEvent('checkout.session.completed', { object: 'checkout.session', mode: 'payment' }))).statusCode).toBe(200);
    expect(retrieve).not.toHaveBeenCalled();
    expect(ddbMock.commandCalls(UpdateCommand)).toHaveLength(0);
  });

  it('emails the platform owner when a renewal payment fails', async () => {
    process.env.BILLING_ALERT_TOPIC_ARN = 'arn:aws:sns:us-east-1:123:autorepair-alarms-dev';
    retrieve.mockResolvedValue(subscription({ status: 'past_due' }));
    ddbMock.on(UpdateCommand).resolves({ Attributes: { status: 'active', cancelAtPeriodEnd: false } });
    ddbMock.on(GetCommand).resolves({ Item: { name: 'Purrfect Auto' } });

    const res = await handler(signedEvent('customer.subscription.updated', subscription({ status: 'past_due' })));

    expect(res.statusCode).toBe(200);
    expect(snsMock.commandCalls(PublishCommand)[0].args[0].input.Subject).toBe('[AutoRepair billing] Payment failed: Purrfect Auto');
    delete process.env.BILLING_ALERT_TOPIC_ARN;
  });

  it('returns 500 (so Stripe retries) when saving fails', async () => {
    retrieve.mockResolvedValue(subscription());
    ddbMock.on(UpdateCommand).rejects(new Error('ddb down'));
    const res = await handler(signedEvent('customer.subscription.updated', subscription()));
    expect(res.statusCode).toBe(500);
  });
});
