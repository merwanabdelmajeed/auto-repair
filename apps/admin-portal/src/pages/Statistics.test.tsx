import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Statistics from './Statistics';
import { getAnalytics } from '../api/analytics';

vi.mock('../api/analytics', () => ({ getAnalytics: vi.fn() }));

function analyticsResponse(overrides: Partial<Awaited<ReturnType<typeof getAnalytics>>> = {}) {
  return {
    summary: { totalBookings: 10, completedBookings: 6, cancelledBookings: 2, pendingBookings: 2, totalRevenue: 500, uniqueCustomers: 5, newCustomers: 2, returningCustomers: 3 },
    byDay: [{ date: '2026-01-01', bookings: 3, completed: 2, revenue: 100 }],
    byService: [{ serviceId: 's1', serviceName: 'Oil Change', bookings: 6, completed: 4, revenue: 300 }],
    byStatus: { completed: 6, pending: 2, cancelled: 2 },
    ...overrides,
  };
}

beforeEach(() => vi.clearAllMocks());

describe('Statistics', () => {
  it('loads 30-day analytics by default and renders KPIs', async () => {
    vi.mocked(getAnalytics).mockResolvedValue(analyticsResponse());

    render(<Statistics />);

    await waitFor(() => expect(screen.getByText('10')).toBeInTheDocument());
    expect(screen.getByText('Oil Change')).toBeInTheDocument();
    // Revenue is not shown in the admin — no dollar amount should render.
    expect(screen.queryByText(/\$\d/)).not.toBeInTheDocument();
    expect(screen.queryByText('Revenue')).not.toBeInTheDocument();
  });

  it('reloads analytics for a different period when a period button is clicked', async () => {
    vi.mocked(getAnalytics).mockResolvedValue(analyticsResponse());
    render(<Statistics />);
    await waitFor(() => expect(getAnalytics).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByText('7 Days'));

    await waitFor(() => expect(getAnalytics).toHaveBeenCalledTimes(2));
  });

  it('shows an error message when the load fails', async () => {
    vi.mocked(getAnalytics).mockRejectedValue(new Error('network down'));
    render(<Statistics />);
    await waitFor(() => expect(screen.getByText('Failed to load analytics data.')).toBeInTheDocument());
  });

  it('shows empty-state messages when there are no bookings in the period', async () => {
    vi.mocked(getAnalytics).mockResolvedValue(analyticsResponse({
      summary: { totalBookings: 0, completedBookings: 0, cancelledBookings: 0, pendingBookings: 0, totalRevenue: 0, uniqueCustomers: 0, newCustomers: 0, returningCustomers: 0 },
      byDay: [], byService: [], byStatus: {},
    }));

    render(<Statistics />);

    await waitFor(() => expect(screen.getAllByText('No bookings in this period')).toHaveLength(2));
  });

  it('triggers a CSV download when Export CSV is clicked', async () => {
    vi.mocked(getAnalytics).mockResolvedValue(analyticsResponse());
    const createObjectURL = vi.fn().mockReturnValue('blob:fake');
    const revokeObjectURL = vi.fn();
    globalThis.URL.createObjectURL = createObjectURL;
    globalThis.URL.revokeObjectURL = revokeObjectURL;

    render(<Statistics />);
    await waitFor(() => screen.getByText('↓ Export CSV'));

    fireEvent.click(screen.getByText('↓ Export CSV'));

    expect(createObjectURL).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake');
  });
});
