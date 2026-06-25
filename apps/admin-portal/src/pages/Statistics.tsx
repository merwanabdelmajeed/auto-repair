import React from 'react';

const PERIOD_TABS = ['Day', 'Week', 'Month', 'Year'];
const METRICS = [
  { label: 'Appointments Scheduled', value: '0', icon: '📅', color: '#0F2044' },
  { label: 'Completed', value: '0', icon: '✅', color: '#22C55E' },
  { label: 'Cancelled', value: '0', icon: '❌', color: '#EF4444' },
  { label: 'New Customers', value: '0', icon: '👤', color: '#8B5CF6' },
  { label: 'Revenue', value: '$0', icon: '💰', color: '#F59E0B' },
  { label: 'Avg Service Time', value: '—', icon: '⏱️', color: '#3B82F6' },
];

export default function Statistics() {
  return (
    <div style={{ maxWidth: '1100px' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '10px', padding: '4px', boxShadow: 'var(--shadow-sm)' }}>
          {PERIOD_TABS.map((tab, i) => (
            <button key={tab} style={{
              padding: '7px 18px', borderRadius: '8px', border: 'none', cursor: 'pointer',
              backgroundColor: i === 2 ? 'var(--color-primary)' : 'transparent',
              color: i === 2 ? 'white' : 'var(--color-text-secondary)',
              fontSize: '13px', fontWeight: 600, transition: 'all 0.15s',
            }}>
              {tab}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '10px', padding: '7px 14px', boxShadow: 'var(--shadow-sm)', fontSize: '13px', fontWeight: 600 }}>
          📅 Jun 1 – Jun 30, 2026
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
          {['All Locations', 'San Jose'].map((loc, i) => (
            <button key={loc} style={{ padding: '7px 14px', borderRadius: '8px', border: '1px solid', borderColor: i === 0 ? 'var(--color-primary)' : 'var(--color-border)', backgroundColor: i === 0 ? 'var(--color-primary)' : 'var(--color-surface)', color: i === 0 ? 'white' : 'var(--color-text-secondary)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
              {loc}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '14px', marginBottom: '24px' }}>
        {METRICS.map((m) => (
          <div key={m.label} style={{ backgroundColor: 'var(--color-surface)', borderRadius: '12px', padding: '18px', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: '22px', marginBottom: '10px' }}>{m.icon}</div>
            <div style={{ fontSize: '26px', fontWeight: 800, color: m.color, lineHeight: 1 }}>{m.value}</div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '6px' }}>{m.label}</div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px', marginBottom: '16px' }}>
        <div style={{ backgroundColor: 'var(--color-surface)', borderRadius: '12px', border: '1px solid var(--color-border)', padding: '24px', boxShadow: 'var(--shadow-sm)' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '4px' }}>Appointments Over Time</h3>
          <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '20px' }}>Daily appointment volume for the selected period</p>
          <div style={{ height: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--color-background)', borderRadius: '8px', border: '2px dashed var(--color-border)', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '32px' }}>📊</span>
            <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Bar chart renders in Phase 11</span>
          </div>
        </div>
        <div style={{ backgroundColor: 'var(--color-surface)', borderRadius: '12px', border: '1px solid var(--color-border)', padding: '24px', boxShadow: 'var(--shadow-sm)' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '4px' }}>Services Breakdown</h3>
          <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '20px' }}>Most requested services</p>
          <div style={{ height: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--color-background)', borderRadius: '8px', border: '2px dashed var(--color-border)', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '32px' }}>🥧</span>
            <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Pie chart renders in Phase 11</span>
          </div>
        </div>
      </div>

      {/* Busiest Hours */}
      <div style={{ backgroundColor: 'var(--color-surface)', borderRadius: '12px', border: '1px solid var(--color-border)', padding: '24px', boxShadow: 'var(--shadow-sm)' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '4px' }}>Busiest Hours & Days</h3>
        <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '16px' }}>Peak booking times help optimize staffing and capacity</p>
        <div style={{ height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--color-background)', borderRadius: '8px', border: '2px dashed var(--color-border)', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontSize: '32px' }}>🗓️</span>
          <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Heat map renders in Phase 11</span>
        </div>
      </div>
    </div>
  );
}
