import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import type Stripe from 'stripe';
import { ok, badRequest, serverError } from '../../shared/utils/response.js';
import { logger } from '../../shared/utils/logger.js';
import { getStripe, getWebhookSecret } from '../../shared/utils/stripe.js';
import { saveSubscription } from '../../shared/utils/billing.js';
import { notifyBillingChange } from '../../shared/utils/billingAlerts.js';

const SUBSCRIPTION_EVENTS = new Set([
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'customer.subscription.paused',
  'customer.subscription.resumed',
]);

// POST /billing/webhook — called by Stripe, not by users, so there's no
// Cognito auth on this route; every request is authenticated by verifying
// Stripe's signature over the raw body instead.
//
// Events can arrive out of order or more than once, so rather than trusting
// the payload's snapshot, each one re-fetches the subscription from Stripe
// and saves its current state — idempotent by construction.
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const signature = Object.entries(event.headers ?? {})
    .find(([k]) => k.toLowerCase() === 'stripe-signature')?.[1];
  if (!signature || !event.body) return badRequest('Missing signature or body');
  const rawBody = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;

  let stripeEvent: Stripe.Event;
  let stripe: Stripe;
  try {
    stripe = await getStripe();
    stripeEvent = stripe.webhooks.constructEvent(rawBody, signature, await getWebhookSecret());
  } catch (e) {
    logger.warn('Rejected Stripe webhook', { error: e });
    return badRequest('Invalid signature');
  }

  try {
    let subscriptionId: string | null = null;
    let tenantId: string | null = null;

    if (stripeEvent.type === 'checkout.session.completed') {
      const session = stripeEvent.data.object;
      if (session.mode === 'subscription' && session.subscription) {
        subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
        tenantId = session.client_reference_id;
      }
    } else if (SUBSCRIPTION_EVENTS.has(stripeEvent.type)) {
      const sub = stripeEvent.data.object as Stripe.Subscription;
      subscriptionId = sub.id;
      tenantId = sub.metadata?.tenantId ?? null;
    }

    if (subscriptionId) {
      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      tenantId = tenantId ?? sub.metadata?.tenantId ?? null;
      if (!tenantId) {
        // Not one of ours (e.g. created by hand in the dashboard) — ack so Stripe stops retrying.
        logger.warn('Stripe subscription has no tenantId metadata', { subscriptionId, type: stripeEvent.type });
      } else {
        const { before, after } = await saveSubscription(tenantId, sub);
        await notifyBillingChange(tenantId, before, after);
        logger.info('Saved subscription state', { tenantId, status: sub.status, type: stripeEvent.type });
      }
    }

    return ok({ received: true });
  } catch (e) {
    // 5xx makes Stripe retry the delivery later.
    logger.error('Failed to process Stripe webhook', { error: e, type: stripeEvent.type });
    return serverError();
  }
};
