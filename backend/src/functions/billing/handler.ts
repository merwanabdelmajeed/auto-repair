import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { authenticate, requireRole, UnauthorizedError, ForbiddenError } from '../../shared/middleware/tenant.js';
import { ok, badRequest, conflict, unauthorized, forbidden, serverError } from '../../shared/utils/response.js';
import { logger } from '../../shared/utils/logger.js';
import { getStripe } from '../../shared/utils/stripe.js';
import { getBilling, saveCustomerId, LIVE_STATUSES } from '../../shared/utils/billing.js';
import { UserRole } from '../../shared/types/index.js';

const ADMIN_ROLES = [UserRole.SUPER_ADMIN, UserRole.TENANT_OWNER, UserRole.LOCATION_MANAGER];
// Only the shop owner can start or change what the shop pays.
const OWNER_ROLES = [UserRole.SUPER_ADMIN, UserRole.TENANT_OWNER];

const PRICE_ID = process.env.STRIPE_PRICE_ID ?? '';
const PORTAL_URL = process.env.PORTAL_URL ?? '';

// The shop's subscription to the platform, paid to the platform owner's
// Stripe account (Stripe Billing + hosted Checkout/Customer Portal — card
// details never touch this backend). State changes arrive via webhook.ts.
//   GET  /billing           — any admin: current status
//   POST /billing/checkout  — owner: Stripe Checkout URL to start the subscription
//   POST /billing/portal    — owner: Stripe Customer Portal URL (card, invoices, cancel)
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const claims = await authenticate(event);
    requireRole(claims, ...ADMIN_ROLES);
    const { tenantId } = claims;
    const billing = await getBilling(tenantId);

    if (event.httpMethod === 'GET' && event.resource === '/billing') {
      return ok({
        status: billing.status,
        currentPeriodEnd: billing.currentPeriodEnd ?? null,
        cancelAtPeriodEnd: billing.cancelAtPeriodEnd ?? false,
        hasBillingAccount: !!billing.stripeCustomerId,
      });
    }

    if (event.httpMethod === 'POST' && event.resource === '/billing/checkout') {
      requireRole(claims, ...OWNER_ROLES);
      if (LIVE_STATUSES.has(billing.status)) return conflict('This shop already has a subscription');

      const stripe = await getStripe();
      let customerId = billing.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({ email: claims.email, metadata: { tenantId } });
        customerId = customer.id;
        await saveCustomerId(tenantId, customerId);
      }
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer: customerId,
        line_items: [{ price: PRICE_ID, quantity: 1 }],
        client_reference_id: tenantId,
        // Lets the webhook map subscription events back to the tenant.
        subscription_data: { metadata: { tenantId } },
        success_url: `${PORTAL_URL}/settings?billing=success`,
        cancel_url: `${PORTAL_URL}/settings?billing=cancelled`,
      });
      if (!session.url) return serverError('Stripe did not return a checkout URL');
      return ok({ url: session.url });
    }

    if (event.httpMethod === 'POST' && event.resource === '/billing/portal') {
      requireRole(claims, ...OWNER_ROLES);
      if (!billing.stripeCustomerId) return badRequest('No billing account yet — subscribe first');
      const stripe = await getStripe();
      const session = await stripe.billingPortal.sessions.create({
        customer: billing.stripeCustomerId,
        return_url: `${PORTAL_URL}/settings`,
      });
      return ok({ url: session.url });
    }

    return badRequest('Unknown route');
  } catch (e) {
    if (e instanceof UnauthorizedError) return unauthorized(e.message);
    if (e instanceof ForbiddenError) return forbidden(e.message);
    logger.error('Unhandled error in billing handler', { error: e });
    return serverError();
  }
};
