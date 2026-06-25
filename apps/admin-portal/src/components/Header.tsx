import React from 'react';

interface HeaderProps {
  title: string;
  subtitle?: string;
  onMenuClick: () => void;
  actions?: React.ReactNode;
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

        {/* Notification Bell */}
        <button style={{
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
        }}>
          🔔
        </button>

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
