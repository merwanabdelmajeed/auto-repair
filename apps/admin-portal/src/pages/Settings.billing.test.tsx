import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Settings from './Settings';
import { getBilling, startCheckout, openBillingPortal } from '../api/billing';

const mockUser = { userId: 'me', role: 'TENANT_OWNER', email: 'me@shop.com' };
vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ user: mockUser, isAuthenticated: true, isLoading: false, login: vi.fn(), completeNewPassword: vi.fn(), logout: vi.fn() }),
}));
vi.mock('../api/adminUsers', () => ({ listAdminUsers: vi.fn().mockResolvedValue([]), inviteAdminUser: vi.fn(), updateAdminUser: vi.fn(), deleteAdminUser: vi.fn() }));
vi.mock('../api/locations', () => ({ listLocations: vi.fn().mockResolvedValue([]), createLocation: vi.fn(), updateLocation: vi.fn(), deleteLocation: vi.fn() }));
vi.mock('../api/tenant', () => ({
  getTenant: vi.fn().mockResolvedValue({ tenantId: 't1', name: 'Shop', email: 'x@x.com', plan: 'STARTER', status: 'ACTIVE' }),
  updateTenant: vi.fn(),
}));
vi.mock('../api/billing', () => ({ getBilling: vi.fn(), startCheckout: vi.fn(), openBillingPortal: vi.fn() }));

function billing(overrides: Record<string, unknown> = {}) {
  return { status: 'none', currentPeriodEnd: null, cancelAtPeriodEnd: false, cancelAt: null, hasBillingAccount: false, trialDays: 0, ...overrides };
}

const assign = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  mockUser.role = 'TENANT_OWNER';
  window.history.replaceState(null, '', '/settings');
  Object.defineProperty(window, 'location', { configurable: true, value: { ...window.location, assign, search: '' } });
});

describe('Settings > Billing', () => {
  it('lets an unsubscribed owner start Stripe Checkout', async () => {
    vi.mocked(getBilling).mockResolvedValue(billing());
    vi.mocked(startCheckout).mockResolvedValue({ url: 'https://checkout.stripe.test/s/1' });
    render(<Settings />);

    await waitFor(() => expect(screen.getByText('Not subscribed')).toBeInTheDocument());
    expect(screen.queryByText('Manage billing')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Subscribe'));

    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://checkout.stripe.test/s/1'));
  });

  it('shows an active subscription with its renewal date and a Manage billing button', async () => {
    vi.mocked(getBilling).mockResolvedValue(billing({ status: 'active', currentPeriodEnd: '2026-12-01T12:00:00.000Z', hasBillingAccount: true }));
    vi.mocked(openBillingPortal).mockResolvedValue({ url: 'https://billing.stripe.test/p/1' });
    render(<Settings />);

    await waitFor(() => expect(screen.getByText('Active')).toBeInTheDocument());
    expect(screen.getByText('Renews on December 1, 2026')).toBeInTheDocument();
    expect(screen.queryByText('Subscribe')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Manage billing'));

    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://billing.stripe.test/p/1'));
  });

  it('shows a pending cancellation and a trial end date', async () => {
    vi.mocked(getBilling).mockResolvedValue(billing({ status: 'active', currentPeriodEnd: '2026-12-01T12:00:00.000Z', cancelAtPeriodEnd: true, hasBillingAccount: true }));
    const { unmount } = render(<Settings />);
    await waitFor(() => expect(screen.getByText('Cancels on December 1, 2026')).toBeInTheDocument());
    unmount();

    vi.mocked(getBilling).mockResolvedValue(billing({ status: 'trialing', currentPeriodEnd: '2026-12-01T12:00:00.000Z', hasBillingAccount: true }));
    render(<Settings />);
    await waitFor(() => expect(screen.getByText('Free until December 1, 2026, then renews monthly')).toBeInTheDocument());
    expect(screen.getByText('Free trial')).toBeInTheDocument();
  });

  it('warns about a failed payment', async () => {
    vi.mocked(getBilling).mockResolvedValue(billing({ status: 'past_due', hasBillingAccount: true }));
    render(<Settings />);
    await waitFor(() => expect(screen.getByText('Payment failed')).toBeInTheDocument());
    expect(screen.getByText(/last payment didn't go through/)).toBeInTheDocument();
    expect(screen.getByText('Manage billing')).toBeInTheDocument();
  });

  it('offers Subscribe again after cancelling', async () => {
    vi.mocked(getBilling).mockResolvedValue(billing({ status: 'canceled', hasBillingAccount: true }));
    render(<Settings />);
    await waitFor(() => expect(screen.getByText('Subscribe again')).toBeInTheDocument());
    expect(screen.getByText('Manage billing')).toBeInTheDocument();
  });

  it('confirms the payment while the webhook catches up after returning from Checkout', async () => {
    Object.defineProperty(window, 'location', { configurable: true, value: { ...window.location, assign, search: '?billing=success' } });
    vi.mocked(getBilling).mockResolvedValue(billing({ hasBillingAccount: true }));
    render(<Settings />);
    await waitFor(() => expect(screen.getByText(/Payment received/)).toBeInTheDocument());
  });

  it('shows an error when checkout cannot be started', async () => {
    vi.mocked(getBilling).mockResolvedValue(billing());
    vi.mocked(startCheckout).mockRejectedValue(new Error('down'));
    render(<Settings />);
    await waitFor(() => screen.getByText('Subscribe'));
    fireEvent.click(screen.getByText('Subscribe'));
    await waitFor(() => expect(screen.getByText('Could not start checkout. Please try again.')).toBeInTheDocument());
    expect(assign).not.toHaveBeenCalled();
  });

  it('offers a free trial with the first charge date', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-10-31T18:00:00'));
    vi.mocked(getBilling).mockResolvedValue(billing({ trialDays: 30 }));
    vi.mocked(startCheckout).mockResolvedValue({ url: 'https://checkout.stripe.test/s/1' });
    render(<Settings />);

    await waitFor(() => expect(screen.getByText('Start 30-day free trial')).toBeInTheDocument());
    expect(screen.getByText('November 30, 2026')).toBeInTheDocument();
    expect(screen.getByText(/30 days free/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Start 30-day free trial'));
    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://checkout.stripe.test/s/1'));
    vi.useRealTimers();
  });

  it('shows no trial offer once the shop has had a subscription', async () => {
    vi.mocked(getBilling).mockResolvedValue(billing({ status: 'canceled', hasBillingAccount: true, trialDays: 0 }));
    render(<Settings />);
    await waitFor(() => expect(screen.getByText('Subscribe again')).toBeInTheDocument());
    expect(screen.queryByText(/days free/)).not.toBeInTheDocument();
  });

  it('shows an error when billing fails to load', async () => {
    vi.mocked(getBilling).mockRejectedValue(new Error('down'));
    render(<Settings />);
    await waitFor(() => expect(screen.getByText('Failed to load billing.')).toBeInTheDocument());
  });

  it('shows status only (no buttons) to non-owners', async () => {
    mockUser.role = 'LOCATION_MANAGER';
    vi.mocked(getBilling).mockResolvedValue(billing({ status: 'active', hasBillingAccount: true }));
    render(<Settings />);
    await waitFor(() => expect(screen.getByText('Active')).toBeInTheDocument());
    expect(screen.getByText('Only the shop owner can change billing.')).toBeInTheDocument();
    expect(screen.queryByText('Manage billing')).not.toBeInTheDocument();
    expect(screen.queryByText('Subscribe')).not.toBeInTheDocument();
  });
});
