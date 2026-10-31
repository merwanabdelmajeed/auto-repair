import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { db, TABLE } from './dynamodb.js';
import { logger } from './logger.js';

// Emails the platform owner (via the stack's alerts SNS topic, which has
// their email subscribed) when a shop's subscription is heading toward not
// renewing — or recovers. Billing is status-only in the app; these emails
// are how the owner finds out to follow up.

const sns = new SNSClient({});

export interface SubscriptionState {
  status?: string;
  cancelAtPeriodEnd?: boolean;
  currentPeriodEnd?: string | null;
}

export interface BillingAlert {
  subject: string;
  body: string;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return 'the end of the current period';
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

// Only transitions alert, so a webhook that's re-delivered (same state) stays quiet.
export function alertFor(shop: string, before: SubscriptionState | undefined, after: SubscriptionState): BillingAlert | null {
  const was = before?.status;
  const now = after.status;

  if (now !== was) {
    if (now === 'past_due') return {
      subject: `Payment failed: ${shop}`,
      body: `${shop}'s subscription payment failed. Stripe will retry automatically and has emailed the shop owner a link to update their payment method.`,
    };
    if (now === 'unpaid') return {
      subject: `Unpaid: ${shop}`,
      body: `${shop}'s subscription is unpaid after Stripe's retries ran out. No further charges will be attempted until they update their payment method.`,
    };
    if (now === 'canceled') return {
      subject: `Subscription ended: ${shop}`,
      body: `${shop}'s subscription has ended and they will not be charged again. Their access is unchanged (billing is status-only).`,
    };
    if (now === 'active' && (was === 'past_due' || was === 'unpaid')) return {
      subject: `Payment recovered: ${shop}`,
      body: `${shop}'s subscription payment went through and the subscription is active again.`,
    };
  }

  if (after.cancelAtPeriodEnd && !before?.cancelAtPeriodEnd && now !== 'canceled') return {
    subject: `Cancellation scheduled: ${shop}`,
    body: `${shop} cancelled their subscription. It stays active until ${fmtDate(after.currentPeriodEnd)} and will not renew.`,
  };

  return null;
}

async function shopName(tenantId: string): Promise<string> {
  try {
    const res = await db.send(new GetCommand({ TableName: TABLE.TENANTS, Key: { PK: `TENANT#${tenantId}`, SK: 'PROFILE' } }));
    return (res.Item?.name as string | undefined) || tenantId;
  } catch {
    return tenantId;
  }
}

// Never throws: a missed email must not fail the webhook (the state is already
// saved, so a Stripe retry wouldn't re-send it anyway).
export async function notifyBillingChange(tenantId: string, before: SubscriptionState | undefined, after: SubscriptionState): Promise<void> {
  const topicArn = process.env.BILLING_ALERT_TOPIC_ARN;
  if (!topicArn) return;
  try {
    const alert = alertFor(await shopName(tenantId), before, after);
    if (!alert) return;
    await sns.send(new PublishCommand({
      TopicArn: topicArn,
      Subject: `[AutoRepair billing] ${alert.subject}`.slice(0, 100),
      Message: `${alert.body}\n\nShop ID: ${tenantId}\nStatus: ${after.status}\n\nDetails are in the Stripe dashboard → Customers.`,
    }));
    logger.info('Sent billing alert', { tenantId, subject: alert.subject });
  } catch (e) {
    logger.error('Failed to send billing alert', { error: e, tenantId });
  }
}
