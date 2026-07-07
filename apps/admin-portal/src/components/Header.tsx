import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../contexts/NotificationsContext';
import type { AppNotification } from '../api/notifications';

interface HeaderProps {
  title: string;
  subtitle?: string;
  onMenuClick: () => void;
  actions?: React.ReactNode;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function NotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  function handleClick(n: AppNotification) {
    if (!n.read) void markAsRead(n.notifId);
    setOpen(false);
    if (n.appointmentId) navigate(`/bookings?appointmentId=${n.appointmentId}`);
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '36px',
          height: '36px',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--color-background)',
          border: '1px solid var(--color-border)',
          cursor: 'pointer',
          fontSize: '16px',
          position: 'relative',
        }}
      >
        🔔
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: '-4px', right: '-4px',
            backgroundColor: 'var(--color-error)',
            borderRadius: '8px', minWidth: '16px', height: '16px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 3px', color: 'white', fontSize: '10px', fontWeight: 700,
          }}>
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 9 }} />
          <div style={{
            position: 'absolute', top: '44px', right: 0, width: '340px', maxHeight: '420px',
            overflowY: 'auto', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)',
            borderRadius: '12px', boxShadow: 'var(--shadow-md, 0 8px 24px rgba(0,0,0,0.12))', zIndex: 10,
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 16px', borderBottom: '1px solid var(--color-divider)',
            }}>
              <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--color-text-primary)' }}>
                Notifications
              </span>
              {unreadCount > 0 && (
                <button
                  onClick={() => void markAllAsRead()}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                    fontSize: '12px', fontWeight: 600, color: 'var(--color-primary)',
                  }}
                >
                  Mark all as read
                </button>
              )}
            </div>
            {notifications.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px' }}>
                No notifications yet
              </div>
            ) : (
              notifications.map(n => (
                <div
                  key={n.notifId}
                  onClick={() => handleClick(n)}
                  style={{
                    padding: '12px 16px', cursor: 'pointer',
                    borderBottom: '1px solid var(--color-divider)',
                    backgroundColor: n.read ? 'transparent' : 'rgba(15,32,68,0.03)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '2px' }}>
                    <span style={{ fontSize: '13px', fontWeight: n.read ? 500 : 700, color: 'var(--color-text-primary)' }}>{n.title}</span>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', flexShrink: 0 }}>{timeAgo(n.createdAt)}</span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{n.body}</div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function Header({ title, subtitle, onMenuClick, actions }: HeaderProps) {
  return (
    <header style={{
      height: 'var(--header-height)',
      backgroundColor: 'var(--color-surface)',
      borderBottom: '1px solid var(--color-border)',
      display: 'flex',
      alignItems: 'center',
      paddingLeft: '20px',
      paddingRight: '24px',
      gap: '16px',
      flexShrink: 0,
      boxShadow: 'var(--shadow-sm)',
    }}>
      {/* Hamburger */}
      <button
        onClick={onMenuClick}
        style={{
          width: '36px',
          height: '36px',
          borderRadius: '8px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '5px',
          padding: '8px',
          backgroundColor: 'transparent',
          border: 'none',
          cursor: 'pointer',
          flexShrink: 0,
          transition: 'background-color 0.15s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-background)')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        title="Toggle sidebar"
      >
        <span style={{ display: 'block', width: '18px', height: '2px', backgroundColor: 'var(--color-text-secondary)', borderRadius: '1px' }} />
        <span style={{ display: 'block', width: '18px', height: '2px', backgroundColor: 'var(--color-text-secondary)', borderRadius: '1px' }} />
        <span style={{ display: 'block', width: '18px', height: '2px', backgroundColor: 'var(--color-text-secondary)', borderRadius: '1px' }} />
      </button>

      {/* Title */}
      <div style={{ flex: 1 }}>
        <h1 style={{
          fontSize: '18px',
          fontWeight: 700,
          color: 'var(--color-text-primary)',
          lineHeight: 1.2,
        }}>
          {title}
        </h1>
        {subtitle && (
          <p style={{
            fontSize: '12px',
            color: 'var(--color-text-muted)',
            marginTop: '2px',
          }}>
            {subtitle}
          </p>
        )}
      </div>

      {/* Right Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {actions}

        <NotificationBell />

        {/* Avatar */}
        <div style={{
          width: '36px',
          height: '36px',
          borderRadius: '50%',
          backgroundColor: 'var(--color-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: '14px',
          fontWeight: 700,
          cursor: 'pointer',
          flexShrink: 0,
        }}>
          A
        </div>
      </div>
    </header>
  );
}
