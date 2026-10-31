import { mockClient } from 'aws-sdk-client-mock';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { db } from './dynamodb.js';
import { alertFor, notifyBillingChange } from './billingAlerts';

const snsMock = mockClient(SNSClient);
const ddbMock = mockClient(db);
const TOPIC = 'arn:aws:sns:us-east-1:123:autorepair-alarms-dev';

beforeEach(() => {
  snsMock.reset();
  ddbMock.reset();
  process.env.BILLING_ALERT_TOPIC_ARN = TOPIC;
});
afterAll(() => { delete process.env.BILLING_ALERT_TOPIC_ARN; });

describe('alertFor', () => {
  const shop = 'Purrfect Auto';

  it.each([
    ['active', 'past_due', 'Payment failed: Purrfect Auto'],
    ['past_due', 'unpaid', 'Unpaid: Purrfect Auto'],
    ['active', 'canceled', 'Subscription ended: Purrfect Auto'],
    ['trialing', 'canceled', 'Subscription ended: Purrfect Auto'],
    ['past_due', 'active', 'Payment recovered: Purrfect Auto'],
    ['unpaid', 'active', 'Payment recovered: Purrfect Auto'],
  ])('%s → %s alerts "%s"', (was, now, subject) => {
    expect(alertFor(shop, { status: was }, { status: now })?.subject).toBe(subject);
  });

  it('alerts when a cancellation is scheduled, with the last active day', () => {
    const alert = alertFor(shop, { status: 'active', cancelAtPeriodEnd: false }, { status: 'active', cancelAtPeriodEnd: true, currentPeriodEnd: '2026-11-30T22:25:56.000Z' });
    expect(alert?.subject).toBe('Cancellation scheduled: Purrfect Auto');
    expect(alert?.body).toContain('until November 30, 2026');
  });

  it.each([
    ['a new subscription', undefined, { status: 'trialing' }],
    ['a normal renewal', { status: 'active' }, { status: 'active' }],
    ['a trial converting to paid', { status: 'trialing' }, { status: 'active' }],
    ['a re-delivered event (same state)', { status: 'past_due' }, { status: 'past_due' }],
    ['an already-scheduled cancellation', { status: 'active', cancelAtPeriodEnd: true }, { status: 'active', cancelAtPeriodEnd: true }],
    ['the cancellation being undone', { status: 'active', cancelAtPeriodEnd: true }, { status: 'active', cancelAtPeriodEnd: false }],
  ])('stays quiet for %s', (_label, before, after) => {
    expect(alertFor(shop, before, after)).toBeNull();
  });
});

describe('notifyBillingChange', () => {
  it('emails the alert via SNS, naming the shop from its profile', async () => {
    ddbMock.on(GetCommand).resolves({ Item: { name: 'Purrfect Auto' } });
    await notifyBillingChange('purrfect-17', { status: 'active' }, { status: 'past_due' });

    const input = snsMock.commandCalls(PublishCommand)[0].args[0].input;
    expect(input.TopicArn).toBe(TOPIC);
    expect(input.Subject).toBe('[AutoRepair billing] Payment failed: Purrfect Auto');
    expect(input.Message).toContain('Shop ID: purrfect-17');
  });

  it('falls back to the shop ID when the profile has no name or cannot be read', async () => {
    ddbMock.on(GetCommand).rejects(new Error('ddb down'));
    await notifyBillingChange('purrfect-17', { status: 'active' }, { status: 'canceled' });
    expect(snsMock.commandCalls(PublishCommand)[0].args[0].input.Subject).toBe('[AutoRepair billing] Subscription ended: purrfect-17');
  });

  it('sends nothing when there is no alert-worthy change', async () => {
    ddbMock.on(GetCommand).resolves({ Item: { name: 'Purrfect Auto' } });
    await notifyBillingChange('purrfect-17', { status: 'active' }, { status: 'active' });
    expect(snsMock.commandCalls(PublishCommand)).toHaveLength(0);
  });

  it('does nothing without a configured topic', async () => {
    delete process.env.BILLING_ALERT_TOPIC_ARN;
    await notifyBillingChange('purrfect-17', { status: 'active' }, { status: 'past_due' });
    expect(snsMock.commandCalls(PublishCommand)).toHaveLength(0);
  });

  it('never throws if the email fails to send', async () => {
    ddbMock.on(GetCommand).resolves({ Item: { name: 'Purrfect Auto' } });
    snsMock.on(PublishCommand).rejects(new Error('sns down'));
    await expect(notifyBillingChange('purrfect-17', { status: 'active' }, { status: 'past_due' })).resolves.toBeUndefined();
  });
});
