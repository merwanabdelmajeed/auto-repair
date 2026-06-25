import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';

const PAGE_TITLES: Record<string, { title: string; subtitle: string }> = {
  '/dashboard': { title: 'Dashboard', subtitle: "Overview of today's activity" },
  '/bookings': { title: 'Bookings', subtitle: 'Manage appointment bookings' },
  '/customers': { title: 'Customers', subtitle: 'View and manage customer profiles' },
  '/vehicles': { title: 'Vehicles', subtitle: 'Customer vehicle registry' },
  '/services': { title: 'Services', subtitle: 'Manage your service catalog' },
  '/promotions': { title: 'Promotions', subtitle: 'Create and manage promotions' },
  '/campaigns': { title: 'Campaigns', subtitle: 'Email and push notification campaigns' },
  '/statistics': { title: 'Statistics', subtitle: 'Analytics and reporting' },
  '/settings': { title: 'Settings', subtitle: 'Configure your shop settings' },
};

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const location = useLocation();
  const pageInfo = PAGE_TITLES[location.pathname] ?? { title: 'AutoRepair Admin', subtitle: '' };

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar isOpen={sidebarOpen} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        <Header
          title={pageInfo.title}
          subtitle={pageInfo.subtitle}
          onMenuClick={() => setSidebarOpen((o) => !o)}
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
  );
}
