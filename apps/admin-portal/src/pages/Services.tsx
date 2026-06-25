import React from 'react';

const EXAMPLE_SERVICES = [
  { icon: '🛢️', name: 'Oil Change', category: 'Maintenance', duration: '30 min', active: true },
  { icon: '🔴', name: 'Brake Service', category: 'Safety', duration: '90 min', active: true },
  { icon: '🔬', name: 'Diagnostics', category: 'Inspection', duration: '60 min', active: true },
  { icon: '🔄', name: 'Tire Rotation', category: 'Maintenance', duration: '30 min', active: true },
  { icon: '⚙️', name: 'Transmission Service', category: 'Major Service', duration: '2 hrs', active: false },
  { icon: '📐', name: 'Alignment', category: 'Maintenance', duration: '45 min', active: true },
];

export default function Services() {
  return (
    <div style={{ maxWidth: '1100px' }}>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '200px', display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '10px', padding: '10px 14px', boxShadow: 'var(--shadow-sm)' }}>
          <span>🔍</span>
          <span style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>Search services…</span>
        </div>
        <button style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--color-secondary)', color: 'var(--color-primary)', fontWeight: 700, fontSize: '14px', borderRadius: '10px', padding: '10px 18px', border: 'none', cursor: 'pointer', boxShadow: 'var(--shadow-sm)' }}>
          ＋ Add Service
        </button>
      </div>

      <div style={{ backgroundColor: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '10px', padding: '12px 16px', marginBottom: '20px', display: 'flex', gap: '10px', alignItems: 'flex-start', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
        <span>ℹ️</span>
        <span>These are placeholder examples. Live service management (create, edit, reorder, categorize) will be implemented in Phase 5.</span>
      </div>

      <div style={{ backgroundColor: 'var(--color-surface)', borderRadius: '12px', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)' }}>
              {['', 'Service Name', 'Category', 'Est. Duration', 'Status', 'Actions'].map((col) => (
                <th key={col} style={{ textAlign: 'left', padding: '13px 16px', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {EXAMPLE_SERVICES.map((svc, i) => (
              <tr key={svc.name} style={{ borderBottom: i < EXAMPLE_SERVICES.length - 1 ? '1px solid var(--color-divider)' : 'none' }}>
                <td style={{ padding: '14px 16px', fontSize: '22px' }}>{svc.icon}</td>
                <td style={{ padding: '14px 16px', fontWeight: 600, fontSize: '14px', color: 'var(--color-text-primary)' }}>{svc.name}</td>
                <td style={{ padding: '14px 16px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>{svc.category}</td>
                <td style={{ padding: '14px 16px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>{svc.duration}</td>
                <td style={{ padding: '14px 16px' }}>
                  <span style={{
                    fontSize: '12px', fontWeight: 700, padding: '3px 10px', borderRadius: '100px',
                    backgroundColor: svc.active ? 'rgba(34,197,94,0.1)' : 'rgba(148,163,184,0.15)',
                    color: svc.active ? 'var(--color-success)' : 'var(--color-text-muted)',
                    border: `1px solid ${svc.active ? 'rgba(34,197,94,0.25)' : 'rgba(148,163,184,0.25)'}`,
                  }}>
                    {svc.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td style={{ padding: '14px 16px' }}>
                  <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color: 'var(--color-text-muted)' }}>⋯</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
