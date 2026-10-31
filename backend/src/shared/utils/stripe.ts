import Stripe from 'stripe';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';

// Stripe credentials live in SSM Parameter Store (SecureString), per
// environment — test keys for dev, live keys for prod. Fetched once per
// Lambda container. See backend/docs/stripe-billing.md for setup.
const SECRET_KEY_PARAM = process.env.STRIPE_SECRET_KEY_PARAM ?? '/autorepair/stripe-secret-key';
const WEBHOOK_SECRET_PARAM = process.env.STRIPE_WEBHOOK_SECRET_PARAM ?? '/autorepair/stripe-webhook-secret';

const ssm = new SSMClient({});
let client: Stripe | null = null;
let webhookSecret: string | null = null;

async function readParam(name: string): Promise<string> {
  const res = await ssm.send(new GetParameterCommand({ Name: name, WithDecryption: true }));
  const value = res.Parameter?.Value;
  if (!value) throw new Error(`SSM parameter ${name} is empty`);
  return value;
}

export async function getStripe(): Promise<Stripe> {
  if (!client) client = new Stripe(await readParam(SECRET_KEY_PARAM));
  return client;
}

export async function getWebhookSecret(): Promise<string> {
  if (!webhookSecret) webhookSecret = await readParam(WEBHOOK_SECRET_PARAM);
  return webhookSecret;
}

// Test-only: drop the per-container cache.
export function resetStripeCache(): void {
  client = null;
  webhookSecret = null;
}
