import type Stripe from 'stripe';
import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { db, TABLE } from './dynamodb.js';

// A tenant's subscription to the platform. Kept in its own TENANTS row
// (SK 'BILLING'), not on the PROFILE row — PUT /tenants/me rewrites the
// whole profile item and would wipe billing fields stored there.
export interface BillingRecord {
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  // Stripe's subscription status: active, trialing, past_due, unpaid,
  // canceled, incomplete, incomplete_expired, paused. 'none' = never subscribed.
  status: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
  updatedAt?: string;
}

// Statuses where the tenant already has a live subscription, so starting a
// second Checkout would double-bill them.
export const LIVE_STATUSES = new Set(['active', 'trialing', 'past_due', 'unpaid', 'paused']);

const key = (tenantId: string) => ({ PK: `TENANT#${tenantId}`, SK: 'BILLING' });

export async function getBilling(tenantId: string): Promise<BillingRecord> {
  const res = await db.send(new GetCommand({ TableName: TABLE.TENANTS, Key: key(tenantId) }));
  const i = res.Item;
  if (!i) return { status: 'none' };
  return {
    stripeCustomerId: i.stripeCustomerId as string | undefined,
    stripeSubscriptionId: i.stripeSubscriptionId as string | undefined,
    status: (i.status as string | undefined) ?? 'none',
    currentPeriodEnd: i.currentPeriodEnd as string | undefined,
    cancelAtPeriodEnd: i.cancelAtPeriodEnd as boolean | undefined,
    updatedAt: i.updatedAt as string | undefined,
  };
}

export async function saveCustomerId(tenantId: string, stripeCustomerId: string): Promise<void> {
  await db.send(new UpdateCommand({
    TableName: TABLE.TENANTS,
    Key: key(tenantId),
    UpdateExpression: 'SET stripeCustomerId = :c, #status = if_not_exists(#status, :none), updatedAt = :now',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: { ':c': stripeCustomerId, ':none': 'none', ':now': new Date().toISOString() },
  }));
}

// Snapshot a Stripe subscription onto the tenant's billing row.
export async function saveSubscription(tenantId: string, sub: Stripe.Subscription): Promise<void> {
  // Billing periods live on subscription items in current Stripe API versions.
  const periodEnd = sub.items.data[0]?.current_period_end;
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
  await db.send(new UpdateCommand({
    TableName: TABLE.TENANTS,
    Key: key(tenantId),
    UpdateExpression: 'SET stripeCustomerId = :c, stripeSubscriptionId = :s, #status = :st, currentPeriodEnd = :pe, cancelAtPeriodEnd = :cancel, updatedAt = :now',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: {
      ':c': customerId,
      ':s': sub.id,
      ':st': sub.status,
      ':pe': periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      ':cancel': sub.cancel_at_period_end,
      ':now': new Date().toISOString(),
    },
  }));
}
