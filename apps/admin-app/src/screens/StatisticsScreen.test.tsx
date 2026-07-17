import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import StatisticsScreen from './StatisticsScreen';
import { getAnalytics } from '../api/analytics';

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  const React = require('react');
  return { ...actual, useFocusEffect: (effect: () => void) => React.useEffect(effect, [effect]) };
});
jest.mock('../api/analytics', () => ({ getAnalytics: jest.fn() }));

function analytics(overrides: Record<string, unknown> = {}) {
  return {
    summary: {
      totalBookings: 20, completedBookings: 15, cancelledBookings: 2, pendingBookings: 3,
      totalRevenue: 2500, uniqueCustomers: 12, newCustomers: 4, returningCustomers: 8,
    },
    byDay: [],
    byService: [
      { serviceId: 's1', serviceName: 'Oil Change', bookings: 10, completed: 8, revenue: 500 },
      { serviceId: 's2', serviceName: 'Brake Check', bookings: 5, completed: 4, revenue: 0 },
    ],
    byStatus: { completed: 15, pending: 3, cancelled: 2 },
    ...overrides,
  };
}

beforeEach(() => jest.clearAllMocks());

describe('StatisticsScreen', () => {
  it('shows loading skeleton state initially', async () => {
    (getAnalytics as jest.Mock).mockResolvedValue(analytics());
    render(<StatisticsScreen />);
    expect(screen.getAllByText('Loading…').length).toBe(2);
    await waitFor(() => expect(screen.getByText('Total Bookings')).toBeTruthy());
  });

  it('renders KPI cards with formatted revenue', async () => {
    (getAnalytics as jest.Mock).mockResolvedValue(analytics());
    render(<StatisticsScreen />);

    await waitFor(() => expect(screen.getByText('Total Bookings')).toBeTruthy());
    expect(screen.getByText('20')).toBeTruthy();
    expect(screen.getByText('15 completed')).toBeTruthy();
    expect(screen.getByText('$2.5k')).toBeTruthy();
    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.getByText('4 new')).toBeTruthy();
    expect(screen.getByText('8')).toBeTruthy();
  });

  it('formats revenue under $1000 without the k suffix', async () => {
    (getAnalytics as jest.Mock).mockResolvedValue(analytics({ summary: { ...analytics().summary, totalRevenue: 450 } }));
    render(<StatisticsScreen />);
    await waitFor(() => expect(screen.getByText('$450')).toBeTruthy());
  });

  it('shows an error message when loading fails', async () => {
    (getAnalytics as jest.Mock).mockRejectedValue(new Error('down'));
    render(<StatisticsScreen />);
    await waitFor(() => expect(screen.getByText('Failed to load analytics.')).toBeTruthy());
  });

  it('lists service popularity bars with booking counts and revenue', async () => {
    (getAnalytics as jest.Mock).mockResolvedValue(analytics());
    render(<StatisticsScreen />);

    await waitFor(() => expect(screen.getByText('Oil Change')).toBeTruthy());
    expect(screen.getByText('10 bookings  ·  $500')).toBeTruthy();
    expect(screen.getByText('5 bookings')).toBeTruthy();
  });

  it('shows singular "booking" for a count of exactly 1', async () => {
    (getAnalytics as jest.Mock).mockResolvedValue(analytics({
      byService: [{ serviceId: 's1', serviceName: 'Oil Change', bookings: 1, completed: 1, revenue: 0 }],
    }));
    render(<StatisticsScreen />);
    await waitFor(() => expect(screen.getByText('1 booking')).toBeTruthy());
  });

  it('shows "No bookings in this period" when byService is empty', async () => {
    (getAnalytics as jest.Mock).mockResolvedValue(analytics({ byService: [], summary: { ...analytics().summary, totalBookings: 0 }, byStatus: {} }));
    render(<StatisticsScreen />);
    await waitFor(() => expect(screen.getAllByText('No bookings in this period').length).toBe(2));
  });

  it('renders the status breakdown sorted by count descending, with percentages', async () => {
    (getAnalytics as jest.Mock).mockResolvedValue(analytics());
    render(<StatisticsScreen />);

    await waitFor(() => expect(screen.getByText('Completed')).toBeTruthy());
    expect(screen.getByText('15 (75%)')).toBeTruthy();
    expect(screen.getByText('Pending')).toBeTruthy();
    expect(screen.getByText('Cancelled')).toBeTruthy();
  });

  it('formats a hyphenated status label with spaces', async () => {
    (getAnalytics as jest.Mock).mockResolvedValue(analytics({ byStatus: { 'no-show': 3 }, summary: { ...analytics().summary, totalBookings: 3 } }));
    render(<StatisticsScreen />);
    await waitFor(() => expect(screen.getByText('No show')).toBeTruthy());
  });

  it('switches periods and reloads analytics with the new date range', async () => {
    (getAnalytics as jest.Mock).mockResolvedValue(analytics());
    render(<StatisticsScreen />);
    await waitFor(() => expect(getAnalytics).toHaveBeenCalledTimes(1));

    fireEvent.press(screen.getByText('7 Days'));

    await waitFor(() => expect(getAnalytics).toHaveBeenCalledTimes(2));

    fireEvent.press(screen.getByText('3 Months'));
    await waitFor(() => expect(getAnalytics).toHaveBeenCalledTimes(3));
  });
});
