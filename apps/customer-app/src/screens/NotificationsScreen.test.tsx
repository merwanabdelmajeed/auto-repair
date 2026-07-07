import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import NotificationsScreen from './NotificationsScreen';
import { useNotifications } from '../contexts/NotificationsContext';

jest.mock('../contexts/NotificationsContext', () => ({ useNotifications: jest.fn() }));

function notif(overrides: Record<string, unknown> = {}) {
  return {
    notifId: 'n1', type: 'promotion_new', title: 'New Promo', body: 'Save 10%',
    read: false, createdAt: new Date().toISOString(), appointmentId: null, promoId: 'p1',
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
    expect(screen.getByText('New Promo')).toBeTruthy();
    expect(screen.queryByText('Mark all as read')).toBeNull();
  });

  it('shows "Mark all as read" when there are unread notifications, and wires it up', () => {
    setup({ notifications: [notif({ read: false })] });
    render(<NotificationsScreen navigation={{ navigate: mockNavigate }} />);

    fireEvent.press(screen.getByText('Mark all as read'));

    expect(mockMarkAllAsRead).toHaveBeenCalled();
  });

  it('marks a promo notification read and navigates to Promotions', () => {
    setup({ notifications: [notif({ type: 'promotion_new', read: false })] });
    render(<NotificationsScreen navigation={{ navigate: mockNavigate }} />);

    fireEvent.press(screen.getByText('New Promo'));

    expect(mockMarkAsRead).toHaveBeenCalledWith('n1');
    expect(mockNavigate).toHaveBeenCalledWith('Promotions');
  });

  it('marks an appointment notification read and navigates to Appointments with the id', () => {
    setup({ notifications: [notif({ notifId: 'n2', type: 'appointment_confirmed', title: 'Confirmed', appointmentId: 'a1', read: false })] });
    render(<NotificationsScreen navigation={{ navigate: mockNavigate }} />);

    fireEvent.press(screen.getByText('Confirmed'));

    expect(mockMarkAsRead).toHaveBeenCalledWith('n2');
    expect(mockNavigate).toHaveBeenCalledWith('Appointments', { appointmentId: 'a1' });
  });

  it('does not re-mark an already-read notification, and does not navigate without a matching type/appointmentId', () => {
    setup({ notifications: [notif({ notifId: 'n3', type: 'appointment_reminder_24h', title: 'Reminder', appointmentId: null, read: true })] });
    render(<NotificationsScreen navigation={{ navigate: mockNavigate }} />);

    fireEvent.press(screen.getByText('Reminder'));

    expect(mockMarkAsRead).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
