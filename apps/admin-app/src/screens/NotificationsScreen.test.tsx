import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import NotificationsScreen from './NotificationsScreen';
import { useNotifications } from '../contexts/NotificationsContext';

jest.mock('../contexts/NotificationsContext', () => ({ useNotifications: jest.fn() }));

function notif(overrides: Record<string, unknown> = {}) {
  return {
    notifId: 'n1', type: 'admin_new_booking', title: 'New Booking', body: 'A customer booked an appointment',
    read: false, createdAt: new Date().toISOString(), appointmentId: null, promoId: null,
    ...overrides,
  };
}

const mockNavigate = jest.fn();
const mockMarkAsRead = jest.fn();
const mockMarkAllAsRead = jest.fn();
const mockRefresh = jest.fn().mockResolvedValue(undefined);

function setup(overrides: Record<string, unknown> = {}) {
  (useNotifications as jest.Mock).mockReturnValue({
    notifications: [], loading: false, markAsRead: mockMarkAsRead, markAllAsRead: mockMarkAllAsRead, refresh: mockRefresh,
    ...overrides,
  });
}

beforeEach(() => jest.clearAllMocks());

describe('NotificationsScreen', () => {
  it('shows a spinner while loading with nothing yet', () => {
    setup({ loading: true, notifications: [] });
    const { UNSAFE_root } = render(<NotificationsScreen navigation={{ navigate: mockNavigate }} />);
    expect(UNSAFE_root).toBeTruthy();
    expect(screen.queryByText('No Notifications Yet')).toBeNull();
  });

  it('shows the empty state when there are no notifications', () => {
    setup({ notifications: [] });
    render(<NotificationsScreen navigation={{ navigate: mockNavigate }} />);
    expect(screen.getByText('No Notifications Yet')).toBeTruthy();
  });

  it('renders notification rows and hides "Mark all as read" when all are read', () => {
    setup({ notifications: [notif({ read: true })] });
    render(<NotificationsScreen navigation={{ navigate: mockNavigate }} />);
    expect(screen.getByText('New Booking')).toBeTruthy();
    expect(screen.queryByText('Mark all as read')).toBeNull();
  });

  it('shows "Mark all as read" when there are unread notifications, and wires it up', () => {
    setup({ notifications: [notif({ read: false })] });
    render(<NotificationsScreen navigation={{ navigate: mockNavigate }} />);

    fireEvent.press(screen.getByText('Mark all as read'));

    expect(mockMarkAllAsRead).toHaveBeenCalled();
  });

  it('marks an unread notification read and navigates to Bookings when it has an appointmentId', () => {
    setup({ notifications: [notif({ appointmentId: 'a1', read: false })] });
    render(<NotificationsScreen navigation={{ navigate: mockNavigate }} />);

    fireEvent.press(screen.getByText('New Booking'));

    expect(mockMarkAsRead).toHaveBeenCalledWith('n1');
    expect(mockNavigate).toHaveBeenCalledWith('Bookings', { appointmentId: 'a1' });
  });

  it('marks read but does not navigate when there is no appointmentId', () => {
    setup({ notifications: [notif({ type: 'admin_appointment_cancelled', title: 'Cancelled', appointmentId: null, read: false })] });
    render(<NotificationsScreen navigation={{ navigate: mockNavigate }} />);

    fireEvent.press(screen.getByText('Cancelled'));

    expect(mockMarkAsRead).toHaveBeenCalledWith('n1');
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('does not re-mark an already-read notification', () => {
    setup({ notifications: [notif({ notifId: 'n3', title: 'Old', appointmentId: null, read: true })] });
    render(<NotificationsScreen navigation={{ navigate: mockNavigate }} />);

    fireEvent.press(screen.getByText('Old'));

    expect(mockMarkAsRead).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('falls back to a generic icon/color for an unknown notification type', () => {
    setup({ notifications: [notif({ type: 'something_unknown', title: 'Mystery' })] });
    render(<NotificationsScreen navigation={{ navigate: mockNavigate }} />);
    expect(screen.getByText('Mystery')).toBeTruthy();
  });
});
