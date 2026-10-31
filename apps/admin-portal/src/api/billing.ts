import { api } from './client';

// The shop's subscription to the platform (Stripe). `status` is Stripe's
// subscription status, or 'none' if the shop never subscribed.
export interface BillingStatus {
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  hasBillingAccount: boolean;
}

export const getBilling = () => api.get<BillingStatus>('/billing');
// Both return a Stripe-hosted page to redirect the owner to.
export const startCheckout = () => api.post<{ url: string }>('/billing/checkout', {});
export const openBillingPortal = () => api.post<{ url: string }>('/billing/portal', {});
