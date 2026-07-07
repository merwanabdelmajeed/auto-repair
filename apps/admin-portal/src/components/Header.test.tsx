import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Header from './Header';
import { NotificationsProvider } from '../contexts/NotificationsContext';
import { getNotifications, markAllRead } from '../api/notifications';
import type { AppNotification } from '../api/notifications';

vi.mock('../api/notifications', () => ({
  getNotifications: vi.fn(),
  markRead: vi.fn().mockResolvedValue({ notifId: 'n1' }),
  markAllRead: vi.fn().mockResolvedValue({ updated: 0 }),
}));

function notif(overrides: Partial<AppNotification>): AppNotification {
  return {
    notifId: 'n1',
    type: 'admin_new_booking',
    title: 'New booking',
    body: 'A customer booked an appointment',
    read: false,
    createdAt: new Date().toISOString(),
    appointmentId: null,
    promoId: null,
    ...overrides,
  };
}

function renderHeader() {
  return render(
    <MemoryRouter>
      <NotificationsProvider>
        <Header title="Dashboard" onMenuClick={() => {}} />
      </NotificationsProvider>
    </MemoryRouter>
  );
}

describe('Header notification bell', () => {
  it('shows the actual unread count instead of capping at "9+"', async () => {
    const many = Array.from({ length: 12 }, (_, i) => notif({ notifId: `n${i}`, read: false }));
    vi.mocked(getNotifications).mockResolvedValue(many);

    renderHeader();

    expect(await screen.findByText('12')).toBeInTheDocument();
    expect(screen.queryByText('9+')).not.toBeInTheDocument();
  });

  it('shows "Mark all as read" only when there are unread notifications, and clears the badge when clicked', async () => {
    vi.mocked(getNotifications).mockResolvedValue([
      notif({ notifId: 'n1', read: false }),
      notif({ notifId: 'n2', read: false }),
    ]);
    vi.mocked(markAllRead).mockResolvedValue({ updated: 2 });

    renderHeader();

    await screen.findByText('2');
    fireEvent.click(screen.getByRole('button', { name: /🔔/ }));

    const markAllBtn = await screen.findByRole('button', { name: 'Mark all as read' });
    fireEvent.click(markAllBtn);

    expect(markAllRead).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByText('2')).not.toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Mark all as read' })).not.toBeInTheDocument();
  });

  it('hides "Mark all as read" when every notification is already read', async () => {
    vi.mocked(getNotifications).mockResolvedValue([notif({ notifId: 'n1', read: true })]);

    renderHeader();

    fireEvent.click(await screen.findByRole('button', { name: /🔔/ }));

    expect(await screen.findByText('New booking')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mark all as read' })).not.toBeInTheDocument();
  });
});
