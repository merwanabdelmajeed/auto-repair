import { mockClient } from 'aws-sdk-client-mock';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import { getStripe, getWebhookSecret, resetStripeCache } from './stripe';

const ssmMock = mockClient(SSMClient);

beforeEach(() => {
  ssmMock.reset();
  resetStripeCache();
});

describe('stripe credentials', () => {
  it('builds the client from the SSM secret key once per container', async () => {
    ssmMock.on(GetParameterCommand, { Name: '/autorepair/stripe-secret-key' }).resolves({ Parameter: { Value: 'sk_test_dummy' } });
    const a = await getStripe();
    const b = await getStripe();
    expect(typeof a.webhooks.constructEvent).toBe('function');
    expect(typeof a.checkout.sessions.create).toBe('function');
    expect(b).toBe(a);
    expect(ssmMock.commandCalls(GetParameterCommand)).toHaveLength(1);
    expect(ssmMock.commandCalls(GetParameterCommand)[0].args[0].input).toMatchObject({ WithDecryption: true });
  });

  it('reads and caches the webhook signing secret', async () => {
    ssmMock.on(GetParameterCommand, { Name: '/autorepair/stripe-webhook-secret' }).resolves({ Parameter: { Value: 'whsec_dummy' } });
    expect(await getWebhookSecret()).toBe('whsec_dummy');
    expect(await getWebhookSecret()).toBe('whsec_dummy');
    expect(ssmMock.commandCalls(GetParameterCommand)).toHaveLength(1);
  });

  it('fails loudly when a parameter is missing', async () => {
    ssmMock.on(GetParameterCommand).resolves({ Parameter: {} });
    await expect(getWebhookSecret()).rejects.toThrow('/autorepair/stripe-webhook-secret is empty');
  });
});
