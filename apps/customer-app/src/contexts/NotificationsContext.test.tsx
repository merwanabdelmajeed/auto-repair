import React from 'react';
import { Text } from 'react-native';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react-native';
import { NotificationsProvider, useNotifications } from './NotificationsContext';
import { getNotifications, markRead, markAllRead } from '../api/notifications';

jest.mock('../api/notifications', () => ({
  getNotifications: jest.fn(),
  markRead: jest.fn(),
  markAllRead: jest.fn(),
}));

function notif(overrides: Record<string, unknown> = {}) {
  return { notifId: 'n1', type: 'promotion_new', title: 'T', body: 'B', read: false, createdAt: 'c', appointmentId: null, promoId: null, ...overrides };
}

function Probe() {
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead } = useNotifications();
  return (
    <>
      <Text testID="loading">{String(loading)}</Text>
      <Text testID="unread">{String(unreadCount)}</Text>
      <Text testID="count">{String(notifications.length)}</Text>
      <Text testID="markOne" onPress={() => void markAsRead('n1')}>markOne</Text>
      <Text testID="markAll" onPress={() => void markAllAsRead()}>markAll</Text>
    </>
  );
}

beforeEach(() => jest.clearAllMocks());

describe('NotificationsProvider', () => {
  it('loads notifications on mount and computes unreadCount', async () => {
    (getNotifications as jest.Mock).mockResolvedValue([notif({ read: false }), notif({ notifId: 'n2', read: true })]);

    render(<NotificationsProvider><Probe /></NotificationsProvider>);

    await waitFor(() => expect(screen.getByTestId('count').props.children).toBe('2'));
    expect(screen.getByTestId('unread').props.children).toBe('1');
  });

  it('silently ignores a failed refresh', async () => {
    (getNotifications as jest.Mock).mockRejectedValue(new Error('down'));

    render(<NotificationsProvider><Probe /></NotificationsProvider>);

    await waitFor(() => expect(screen.getByTestId('loading').props.children).toBe('false'));
    expect(screen.getByTestId('count').props.children).toBe('0');
  });

  it('markAsRead marks the item locally even if the API call fails', async () => {
    (getNotifications as jest.Mock).mockResolvedValue([notif({ read: false })]);
    (markRead as jest.Mock).mockRejectedValue(new Error('fail'));

    render(<NotificationsProvider><Probe /></NotificationsProvider>);
    await waitFor(() => expect(screen.getByTestId('unread').props.children).toBe('1'));

    await act(async () => fireEvent.press(screen.getByTestId('markOne')));

    expect(screen.getByTestId('unread').props.children).toBe('0');
  });

  it('markAllAsRead marks every item read', async () => {
    (getNotifications as jest.Mock).mockResolvedValue([notif({ notifId: 'n1' }), notif({ notifId: 'n2' })]);
    (markAllRead as jest.Mock).mockResolvedValue({ updated: 2 });

    render(<NotificationsProvider><Probe /></NotificationsProvider>);
    await waitFor(() => expect(screen.getByTestId('unread').props.children).toBe('2'));

    await act(async () => fireEvent.press(screen.getByTestId('markAll')));

    expect(screen.getByTestId('unread').props.children).toBe('0');
  });

  it('preserves locally-read state across a 30s poll refresh, even if the server still reports unread', async () => {
    jest.useFakeTimers({ doNotFake: ['queueMicrotask'] });
    (getNotifications as jest.Mock).mockResolvedValue([notif({ notifId: 'n1', read: false })]);
    (markRead as jest.Mock).mockResolvedValue({ notifId: 'n1' });

    render(<NotificationsProvider><Probe /></NotificationsProvider>);
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByTestId('unread').props.children).toBe('1');

    await act(async () => { fireEvent.press(screen.getByTestId('markOne')); await Promise.resolve(); });
    expect(screen.getByTestId('unread').props.children).toBe('0');

    // The next poll still returns read: false from the server — the context should
    // keep it marked read locally rather than flipping it back to unread.
    await act(async () => {
      jest.advanceTimersByTime(30_000);
      await Promise.resolve();
    });
    expect(screen.getByTestId('unread').props.children).toBe('0');

    jest.useRealTimers();
  });
});

describe('useNotifications', () => {
  it('throws when used outside a NotificationsProvider', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow('useNotifications must be used inside NotificationsProvider');
    consoleSpy.mockRestore();
  });
});
