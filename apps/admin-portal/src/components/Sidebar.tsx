import React from 'react';
import { NavLink } from 'react-router-dom';
import { SHOP_NAME, SHOP_CITY } from '../constants';

type NavItem = {
  path: string;
  label: string;
  icon: string;
};

const NAV_ITEMS: NavItem[] = [
  { path: '/dashboard', label: 'Dashboard', icon: '⊞' },
  { path: '/bookings', label: 'Bookings', icon: '📅' },
  { path: '/customers', label: 'Customers', icon: '👥' },
  { path: '/vehicles', label: 'Vehicles', icon: '🚗' },
  { path: '/services', label: 'Services', icon: '🔧' },
  { path: '/capacity', label: 'Capacity', icon: '⏱️' },
  { path: '/blocked-times', label: 'Blocked Times', icon: '🚫' },
  { path: '/promotions', label: 'Promotions', icon: '🏷️' },
  { path: '/statistics', label: 'Statistics', icon: '📊' },
  { path: '/settings', label: 'Settings', icon: '⚙️' },
];

interface SidebarProps {
  isOpen: boolean;
}

export default function Sidebar({ isOpen }: SidebarProps) {
  return (
    <aside style={{
      width: isOpen ? '280px' : '0',
      minWidth: isOpen ? '280px' : '0',
      height: '100vh',
      backgroundColor: 'var(--color-primary)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      transition: 'width 0.25s ease, min-width 0.25s ease',
      flexShrink: 0,
    }}>
      {/* Logo */}
      <div style={{
        padding: '24px 20px 20px',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            backgroundColor: 'rgba(255,255,255,0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '20px',
            flexShrink: 0,
          }}>
            🔧
          </div>
          <div style={{ overflow: 'hidden' }}>
            <div style={{
              color: 'white',
              fontWeight: 700,
              fontSize: '15px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {SHOP_NAME}
            </div>
            {SHOP_CITY && (
              <div style={{
                color: 'rgba(255,255,255,0.5)',
                fontSize: '11px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                marginTop: '2px',
              }}>
                {SHOP_CITY}
              </div>
            )}
          </div>
        </div>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          backgroundColor: 'rgba(245,158,11,0.15)',
          border: '1px solid rgba(245,158,11,0.25)',
          borderRadius: '4px',
          padding: '2px 8px',
          marginTop: '8px',
        }}>
          <span style={{ color: 'var(--color-secondary)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.6px' }}>
            ADMIN PORTAL
          </span>
        </div>
      </div>



      {/* Navigation */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '11px 20px',
              color: isActive ? 'white' : 'rgba(255,255,255,0.55)',
              backgroundColor: isActive ? 'rgba(245,158,11,0.12)' : 'transparent',
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: isActive ? 600 : 400,
              position: 'relative',
              borderLeft: isActive ? '3px solid var(--color-secondary)' : '3px solid transparent',
              transition: 'background-color 0.15s, color 0.15s',
              whiteSpace: 'nowrap',
            })}
          >
            <span style={{ fontSize: '16px', flexShrink: 0 }}>{item.icon}</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div style={{
        padding: '12px 20px',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        flexShrink: 0,
      }}>
        <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: '11px', textAlign: 'center' }}>
          v1.0.0
        </div>
      </div>
    </aside>
  );
}
