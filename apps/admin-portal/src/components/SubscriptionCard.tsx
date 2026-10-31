import React, { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { getBilling, startCheckout, openBillingPortal, type BillingStatus } from '../api/billing';
import { LIVE_BILLING, statusDisplay, isPaymentProblem, billingDetail, subscribeLabel } from '../utils/billingStatus';

const OWNER_ROLES = new Set(['SUPER_ADMIN', 'TENANT_OWNER']);

// Dashboard strip showing the shop's platform subscription, with the owner's
// main action (start/subscribe or manage). Full details live in Settings →
// Billing. Renders nothing if billing can't be loaded, so an environment
// without the billing API deployed just doesn't show it.
export default function SubscriptionCard() {
  const { user } = useAuth();
  const isOwner = !!user && OWNER_ROLES.has(user.role);
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getBilling().then(setBilling).catch(() => setBilling(null));
  }, []);

  if (!billing) return null;

  const status = billing.status;
  const display = statusDisplay(status);
  const live = LIVE_BILLING.has(status);
  const problem = isPaymentProblem(status);
  const detail = billingDetail(billing);

  async function goTo(fetchUrl: () => Promise<{ url: string }>) {
    setRedirecting(true);
    setError('');
    try {
      window.location.assign((await fetchUrl()).url);
    } catch {
      setError('Could not open billing. Please try again.');
      setRedirecting(false);
    }
  }

  const btn: React.CSSProperties = {
    padding: '9px 18px', border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '13px',
    cursor: redirecting ? 'not-allowed' : 'pointer', opacity: redirecting ? 0.7 : 1, whiteSpace: 'nowrap',
  };

  return (
    <div
      data-testid="subscription-card"
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap',
        backgroundColor: problem ? 'rgba(239,68,68,0.06)' : 'var(--color-surface)',
        border: `1px solid ${problem ? 'rgba(239,68,68,0.3)' : 'var(--color-border)'}`,
        borderRadius: '12px', padding: '14px 20px', marginBottom: '20px', boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
        <span style={{ fontSize: '22px' }}>💳</span>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-primary)' }}>Subscription</span>
            <span style={{ fontSize: '12px', fontWeight: 700, padding: '3px 10px', borderRadius: '100px', color: display.color, backgroundColor: display.bg }}>{display.label}</span>
          </div>
          <div style={{ fontSize: '13px', color: problem ? 'var(--color-error)' : 'var(--color-text-secondary)', marginTop: '3px' }}>
            {problem
              ? "The last payment didn't go through. Update the payment method to keep your subscription."
              : detail || (!live && billing.trialDays > 0 ? `${billing.trialDays} days free, then billed monthly.` : '')}
          </div>
          {error && <div style={{ fontSize: '12px', color: 'var(--color-error)', marginTop: '4px' }}>{error}</div>}
        </div>
      </div>
      {isOwner && (
        live ? (
          <button onClick={() => void goTo(openBillingPortal)} disabled={redirecting} style={{ ...btn, backgroundColor: problem ? 'var(--color-error)' : 'transparent', color: problem ? 'white' : 'var(--color-primary)', border: problem ? 'none' : '1px solid var(--color-border)' }}>
            {problem ? 'Update payment method' : 'Manage billing'}
          </button>
        ) : (
          <button onClick={() => void goTo(startCheckout)} disabled={redirecting} style={{ ...btn, backgroundColor: 'var(--color-secondary)', color: 'var(--color-primary)' }}>
            {redirecting ? 'Opening…' : subscribeLabel(billing)}
          </button>
        )
      )}
    </div>
  );
}
