import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SubscriptionCard from './SubscriptionCard';
import { getBilling, startCheckout, openBillingPortal } from '../api/billing';

const mockUser = { userId: 'me', role: 'TENANT_OWNER', email: 'me@shop.com' };
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ user: mockUser }) }));
vi.mock('../api/billing', () => ({ getBilling: vi.fn(), startCheckout: vi.fn(), openBillingPortal: vi.fn() }));

function billing(overrides: Record<string, unknown> = {}) {
  return { status: 'none', currentPeriodEnd: null, cancelAtPeriodEnd: false, hasBillingAccount: false, trialDays: 0, ...overrides };
}

const assign = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  mockUser.role = 'TENANT_OWNER';
  Object.defineProperty(window, 'location', { configurable: true, value: { ...window.location, assign } });
});

describe('SubscriptionCard', () => {
  it('invites an unsubscribed owner to start the free trial', async () => {
    vi.mocked(getBilling).mockResolvedValue(billing({ trialDays: 30 }));
    vi.mocked(startCheckout).mockResolvedValue({ url: 'https://checkout.stripe.test/s/1' });
    render(<SubscriptionCard />);

    await waitFor(() => expect(screen.getByText('Not subscribed')).toBeInTheDocument());
    expect(screen.getByText('30 days free, then billed monthly.')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Start 30-day free trial'));
    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://checkout.stripe.test/s/1'));
  });

  it('shows an active subscription with its renewal date and Manage billing', async () => {
    vi.mocked(getBilling).mockResolvedValue(billing({ status: 'active', currentPeriodEnd: '2026-11-30T22:25:56.000Z', hasBillingAccount: true }));
    vi.mocked(openBillingPortal).mockResolvedValue({ url: 'https://billing.stripe.test/p/1' });
    render(<SubscriptionCard />);

    await waitFor(() => expect(screen.getByText('Active')).toBeInTheDocument());
    expect(screen.getByText(/^Renews on November 30, 2026$/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Manage billing'));
    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://billing.stripe.test/p/1'));
  });

  it('shows the trial end date during a trial', async () => {
    vi.mocked(getBilling).mockResolvedValue(billing({ status: 'trialing', currentPeriodEnd: '2026-11-30T22:25:56.000Z', hasBillingAccount: true }));
    render(<SubscriptionCard />);
    await waitFor(() => expect(screen.getByText('Free trial')).toBeInTheDocument());
    expect(screen.getByText(/^Trial ends November 30, 2026$/)).toBeInTheDocument();
  });

  it('highlights a failed payment with an Update payment method action', async () => {
    vi.mocked(getBilling).mockResolvedValue(billing({ status: 'past_due', hasBillingAccount: true }));
    vi.mocked(openBillingPortal).mockResolvedValue({ url: 'https://billing.stripe.test/p/1' });
    render(<SubscriptionCard />);

    await waitFor(() => expect(screen.getByText('Payment failed')).toBeInTheDocument());
    expect(screen.getByText(/last payment didn't go through/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Update payment method'));
    await waitFor(() => expect(assign).toHaveBeenCalled());
  });

  it('offers Subscribe again after cancelling', async () => {
    vi.mocked(getBilling).mockResolvedValue(billing({ status: 'canceled', hasBillingAccount: true }));
    render(<SubscriptionCard />);
    await waitFor(() => expect(screen.getByText('Subscribe again')).toBeInTheDocument());
  });

  it('shows an error if Stripe cannot be reached', async () => {
    vi.mocked(getBilling).mockResolvedValue(billing());
    vi.mocked(startCheckout).mockRejectedValue(new Error('down'));
    render(<SubscriptionCard />);
    await waitFor(() => screen.getByText('Subscribe'));
    fireEvent.click(screen.getByText('Subscribe'));
    await waitFor(() => expect(screen.getByText('Could not open billing. Please try again.')).toBeInTheDocument());
  });

  it('shows status only to non-owners', async () => {
    mockUser.role = 'LOCATION_MANAGER';
    vi.mocked(getBilling).mockResolvedValue(billing({ status: 'active', hasBillingAccount: true }));
    render(<SubscriptionCard />);
    await waitFor(() => expect(screen.getByText('Active')).toBeInTheDocument());
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders nothing when billing cannot be loaded (e.g. not deployed yet)', async () => {
    vi.mocked(getBilling).mockRejectedValue(new Error('404'));
    const { container } = render(<SubscriptionCard />);
    await waitFor(() => expect(getBilling).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});
