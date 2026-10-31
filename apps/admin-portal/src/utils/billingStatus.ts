import type { BillingStatus } from '../api/billing';

// Shared by Settings → Billing and the Dashboard subscription card.
export const STATUS_DISPLAY: Record<string, { label: string; color: string; bg: string }> = {
  none:               { label: 'Not subscribed',     color: 'var(--color-text-muted)', bg: 'rgba(148,163,184,0.12)' },
  active:             { label: 'Active',             color: '#16A34A',                 bg: 'rgba(34,197,94,0.1)' },
  trialing:           { label: 'Free trial',         color: '#2563EB',                 bg: 'rgba(59,130,246,0.1)' },
  past_due:           { label: 'Payment failed',     color: 'var(--color-error)',      bg: 'rgba(239,68,68,0.08)' },
  unpaid:             { label: 'Unpaid',             color: 'var(--color-error)',      bg: 'rgba(239,68,68,0.08)' },
  paused:             { label: 'Paused',             color: '#D97706',                 bg: 'rgba(245,158,11,0.1)' },
  incomplete:         { label: 'Payment incomplete', color: '#D97706',                 bg: 'rgba(245,158,11,0.1)' },
  incomplete_expired: { label: 'Not subscribed',     color: 'var(--color-text-muted)', bg: 'rgba(148,163,184,0.12)' },
  canceled:           { label: 'Canceled',           color: 'var(--color-text-muted)', bg: 'rgba(148,163,184,0.12)' },
};

// Statuses with a live subscription — mirrors the backend; Subscribe is hidden for these.
export const LIVE_BILLING = new Set(['active', 'trialing', 'past_due', 'unpaid', 'paused']);

export function statusDisplay(status: string) {
  return STATUS_DISPLAY[status] ?? { label: status, color: 'var(--color-text-muted)', bg: 'rgba(148,163,184,0.12)' };
}

export function isPaymentProblem(status: string) {
  return status === 'past_due' || status === 'unpaid';
}

export function fmtBillingDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

// "Renews on …" / "Cancels on …" / "Free until …, then renews monthly", or '' when there's no date to show.
export function billingDetail(billing: BillingStatus | null): string {
  if (!billing || !LIVE_BILLING.has(billing.status)) return '';
  if (billing.cancelAtPeriodEnd) {
    const end = billing.cancelAt ?? billing.currentPeriodEnd;
    return end ? `Cancels on ${fmtBillingDate(end)}` : '';
  }
  if (!billing.currentPeriodEnd) return '';
  const date = fmtBillingDate(billing.currentPeriodEnd);
  if (billing.status === 'trialing') return `Free until ${date}, then renews monthly`;
  if (billing.status === 'active') return `Renews on ${date}`;
  return '';
}

export function subscribeLabel(billing: BillingStatus | null): string {
  const trialDays = billing?.trialDays ?? 0;
  if (trialDays > 0) return `Start ${trialDays}-day free trial`;
  return billing?.status === 'canceled' ? 'Subscribe again' : 'Subscribe';
}
