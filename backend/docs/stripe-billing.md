# Stripe billing (shop → platform subscription)

Branch: `feature/stripe-billing`. **Not deployed.** Every Stripe value in this
branch is a placeholder until a Stripe account exists.

The shop owner subscribes from **Settings → Billing** in the admin portal. Stripe
charges them monthly and pays out to the platform owner's bank account. Card and
bank details only ever go to Stripe's hosted pages. The backend stores Stripe IDs
and the subscription status, nothing else.

## How it fits together

| Piece | Where |
|---|---|
| `GET /billing`: status for any admin | `src/functions/billing/handler.ts` |
| `POST /billing/checkout`: Stripe Checkout URL (owner only) | same |
| `POST /billing/portal`: Stripe Customer Portal URL (owner only) | same |
| `POST /billing/webhook`: Stripe → us, verified by signature, no Cognito | `src/functions/billing/webhook.ts` |
| Billing state: TENANTS table, `PK=TENANT#<id>`, `SK=BILLING` | `src/shared/utils/billing.ts` |
| Stripe client and secrets from SSM | `src/shared/utils/stripe.ts` |
| Portal UI | `apps/admin-portal/src/pages/Settings.tsx` (`BillingSection`) |

Billing state is kept in its own `BILLING` row because `PUT /tenants/me`
rewrites the whole `PROFILE` row.

## Free trial

A shop's **first** subscription gets `TRIAL_DAYS` (30) free days, counted from
sign-up. Checkout still collects a card or bank account up front, and Stripe
charges it automatically on day 30. A shop that has ever had a subscription
(`stripeSubscriptionId` saved) gets no second trial. Set `TRIAL_DAYS` on
`BillingFunction` in `template.yaml`; `'0'` turns trials off. In Stripe, turn on
**Settings → Billing → Subscriptions and emails → trial-ending reminder**.

## Email alerts to the platform owner

Billing is status-only in the app: nothing gets locked. Instead, the webhook
emails the platform owner through the stack's alerts topic (`autorepair-alarms[-dev]`,
already subscribed to their email) when a shop's subscription changes:
**cancellation scheduled**, **payment failed**, **unpaid**, **subscription
ended**, or **payment recovered**. Only real transitions send an email, so a
re-delivered webhook stays quiet. The logic is in `src/shared/utils/billingAlerts.ts`.

## Placeholders to replace

| What | Placeholder | Where it lives |
|---|---|---|
| Stripe secret key | `sk_test_REPLACE_ME` (dev) / `sk_live_REPLACE_ME` (prod) | SSM `/autorepair/stripe-secret-key-dev`, `/autorepair/stripe-secret-key` |
| Webhook signing secret | `whsec_REPLACE_ME` | SSM `/autorepair/stripe-webhook-secret-dev`, `/autorepair/stripe-webhook-secret` |
| Monthly price ID | `price_REPLACE_WITH_TEST_PRICE_ID` / `price_REPLACE_WITH_LIVE_PRICE_ID` | `template.yaml` → `Mappings.EnvironmentMap.<env>.StripePriceId` |

The portal URLs (Stripe's return links) are already real values in the same
mapping:
- dev: `https://dev.d3ux26fye73l96.amplifyapp.com`
- prod: `https://main.d3erver6wxqmre.amplifyapp.com`

## Go-live checklist (dev first, using Stripe **test mode**)

1. **Stripe account.** Sign up, verify the business, and link the payout bank
   account. Under **Settings → Payment methods**, enable cards and, if wanted,
   **ACH Direct Debit** (cheaper for B2B: 0.8%, capped at $5).
2. **Product and price.** In **Product catalog**, create e.g. "Auto Repair Platform".
   Give it a recurring monthly price and copy the `price_…` ID into `StripePriceId`.
3. **Customer Portal.** Turn it on under **Settings → Billing → Customer portal**
   (allow updating payment methods, viewing invoices, cancelling).
4. **Secret key → SSM.** Store it as a SecureString. Replace the placeholder value:
   ```sh
   aws ssm put-parameter --region us-east-1 --type SecureString \
     --name /autorepair/stripe-secret-key-dev --value 'sk_test_REPLACE_ME'
   ```
5. **Deploy dev.** `sam build && sam deploy --config-env dev`.
   The stack output `BillingWebhookUrl` is the webhook endpoint.
6. **Webhook.** In **Developers → Webhooks**, add an endpoint with
   `BillingWebhookUrl` and these events:
   `checkout.session.completed`, `customer.subscription.created`,
   `customer.subscription.updated`, `customer.subscription.deleted`,
   `customer.subscription.paused`, `customer.subscription.resumed`.
   Copy its signing secret into SSM:
   ```sh
   aws ssm put-parameter --region us-east-1 --type SecureString \
     --name /autorepair/stripe-webhook-secret-dev --value 'whsec_REPLACE_ME'
   ```
7. **Test.** Subscribe from the dev portal with card `4242 4242 4242 4242`.
   Settings should show **Active** with a renewal date. Use card
   `4000 0000 0000 0341` (attaches, then fails on charge) to see **Payment failed**.
   Cancel from **Manage billing** to see **Cancels on …**.
8. **Prod.** Repeat steps 2–6 with **live** keys and `--config-env` omitted
   (bare `sam deploy` = prod). Use the prod parameter names without `-dev`.

Lambdas cache the SSM values per container, so after changing a key, redeploy
or wait for the containers to recycle.

## Not included yet (deliberately)

- **Locking unpaid shops.** `past_due` and `unpaid` only show a banner in Settings.
  A grace-period lockout of admin features would read the `BILLING` row in
  `authenticate()` or in the portal layout.
- **iOS admin app.** No purchase UI there on purpose: selling the subscription
  in-app could trigger Apple's in-app purchase rules. The web portal handles all billing.
- **Sales tax.** Stripe Tax (about 0.5%) can be enabled in the dashboard and
  `automatic_tax: { enabled: true }` added to the Checkout session.
- **CloudWatch alarms** for the two new Lambdas, like the others have.
