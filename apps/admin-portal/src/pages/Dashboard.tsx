import React from 'react';

const KPI_CARDS = [
  { label: "Today's Bookings", value: '0', icon: '📅', color: '#0F2044', bg: 'rgba(15,32,68,0.08)' },
  { label: 'Active Customers', value: '0', icon: '👥', color: '#8B5CF6', bg: 'rgba(139,92,246,0.08)' },
  { label: 'Vehicles Registered', value: '0', icon: '🚗', color: '#3B82F6', bg: 'rgba(59,130,246,0.08)' },
  { label: 'Revenue This Month', value: '$0', icon: '💰', color: '#22C55E', bg: 'rgba(34,197,94,0.08)' },
];

const UPCOMING_EMPTY = true;

export default function Dashboard() {
  return (
    <div style={{ maxWidth: '1200px' }}>
      {/* Phase Banner */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        backgroundColor: 'rgba(245,158,11,0.08)',
        border: '1px solid rgba(245,158,11,0.25)',
        borderRadius: '12px',
        padding: '14px 20px',
        marginBottom: '24px',
      }}>
        <span style={{ fontSize: '20px' }}>🚀</span>
        <div>
          <strong style={{ color: 'var(--color-text-primary)', fontSize: '14px' }}>Phase 0 — Application Skeleton Complete</strong>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px', marginTop: '2px' }}>
            Navigation, layouts, and placeholder screens are in place. Phase 1 will establish the AWS serverless backend.
          </p>
        </div>
      </div>

      {/* KPI Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '16px',
        marginBottom: '28px',
      }}>
        {KPI_CARDS.map((card) => (
          <div key={card.label} style={{
            backgroundColor: 'var(--color-surface)',
            borderRadius: '12px',
            padding: '20px',
            boxShadow: 'var(--shadow-sm)',
            border: '1px solid var(--color-border)',
          }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              backgroundColor: card.bg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              marginBottom: '12px',
            }}>
              {card.icon}
            </div>
            <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--color-text-primary)', lineHeight: 1 }}>
              {card.value}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginTop: '6px' }}>
              {card.label}
            </div>
          </div>
        ))}
      </div>

      {/* Two Column Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '20px' }}>
        {/* Today's Schedule */}
        <div style={{
          backgroundColor: 'var(--color-surface)',
          borderRadius: '12px',
          padding: '20px',
          boxShadow: 'var(--shadow-sm)',
          border: '1px solid var(--color-border)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
              Today's Schedule
            </h2>
            <button style={{
              fontSize: '13px',
              color: 'var(--color-primary)',
              fontWeight: 600,
              padding: '6px 14px',
              borderRadius: '8px',
              border: '1px solid var(--color-border)',
              backgroundColor: 'transparent',
              cursor: 'pointer',
            }}>
              View All
            </button>
          </div>

          {UPCOMING_EMPTY && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '60px 20px',
              color: 'var(--color-text-muted)',
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📅</div>
              <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '8px' }}>
                No appointments today
              </div>
              <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', textAlign: 'center' }}>
                Appointments will appear here once customers start booking through the app.
              </div>
            </div>
          )}
        </div>

        {/* Right Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Quick Stats */}
          <div style={{
            backgroundColor: 'var(--color-surface)',
            borderRadius: '12px',
            padding: '20px',
            boxShadow: 'var(--shadow-sm)',
            border: '1px solid var(--color-border)',
          }}>
            <h2 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '16px', color: 'var(--color-text-primary)' }}>
              Location Overview
            </h2>
            {[
              { label: 'Open Slots Today', value: '—' },
              { label: 'Capacity Configured', value: 'No' },
              { label: 'Active Services', value: '0' },
              { label: 'Active Promotions', value: '0' },
            ].map((stat) => (
              <div key={stat.label} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 0',
                borderBottom: '1px solid var(--color-divider)',
                fontSize: '14px',
              }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>{stat.label}</span>
                <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{stat.value}</span>
              </div>
            ))}
          </div>

          {/* System Status */}
          <div style={{
            backgroundColor: 'var(--color-primary)',
            borderRadius: '12px',
            padding: '20px',
            boxShadow: 'var(--shadow-md)',
          }}>
            <h2 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '14px', color: 'white' }}>
              System Status
            </h2>
            {[
              { label: 'AWS Backend', status: 'Phase 1' },
              { label: 'Authentication', status: 'Phase 2' },
              { label: 'Booking Engine', status: 'Phase 6' },
              { label: 'Notifications', status: 'Future' },
            ].map((s) => (
              <div key={s.label} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 0',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                fontSize: '13px',
              }}>
                <span style={{ color: 'rgba(255,255,255,0.65)' }}>{s.label}</span>
                <span style={{
                  color: 'var(--color-secondary)',
                  fontWeight: 600,
                  backgroundColor: 'rgba(245,158,11,0.15)',
                  borderRadius: '4px',
                  padding: '2px 8px',
                  fontSize: '11px',
                }}>
                  {s.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
