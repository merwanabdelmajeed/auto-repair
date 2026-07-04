import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { useAuth } from '../auth/AuthContext';
import { NotificationsProvider } from '../contexts/NotificationsContext';
import { SHOP_NAME } from '../constants';

const PAGE_TITLES: Record<string, { title: string; subtitle: string }> = {
  '/dashboard': { title: 'Dashboard', subtitle: "Overview of today's activity" },
  '/bookings': { title: 'Bookings', subtitle: 'Manage appointment bookings' },
  '/customers': { title: 'Customers', subtitle: 'View and manage customer profiles' },
  '/vehicles': { title: 'Vehicles', subtitle: 'Customer vehicle registry' },
  '/services': { title: 'Services', subtitle: 'Manage your service catalog' },
  '/capacity': { title: 'Capacity', subtitle: 'Operating hours, slot duration, and concurrent bookings' },
  '/blocked-times': { title: 'Blocked Times', subtitle: 'Block dates for holidays and closures' },
  '/promotions': { title: 'Promotions', subtitle: 'Create and manage promotions' },
  '/statistics': { title: 'Statistics', subtitle: 'Analytics and reporting' },
  '/settings': { title: 'Settings', subtitle: 'Configure your shop settings' },
};

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const location = useLocation();
  const { logout, user } = useAuth();
  const pageInfo = PAGE_TITLES[location.pathname] ?? { title: SHOP_NAME, subtitle: '' };

  const logoutBtn = (
    <button
      onClick={() => void logout()}
      title={`Sign out (${user?.email ?? ''})`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 12px',
        borderRadius: '8px',
        border: '1px solid var(--color-border)',
        backgroundColor: 'var(--color-background)',
        color: 'var(--color-text-secondary)',
        fontSize: '13px',
        fontWeight: 500,
        cursor: 'pointer',
      }}
    >
      <span>↩</span>
      <span>Sign out</span>
    </button>
  );

  return (
    <NotificationsProvider>
      <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
        <Sidebar isOpen={sidebarOpen} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          <Header
            title={pageInfo.title}
            subtitle={pageInfo.subtitle}
            onMenuClick={() => setSidebarOpen((o) => !o)}
            actions={logoutBtn}
          />
          <main style={{
            flex: 1,
            overflowY: 'auto',
            padding: '28px',
            backgroundColor: 'var(--color-background)',
          }}>
            <Outlet />
          </main>
        </div>
      </div>
    </NotificationsProvider>
  );
}
