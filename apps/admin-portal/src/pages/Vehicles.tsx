import React from 'react';

export default function Vehicles() {
  return (
    <div style={{ maxWidth: '1100px' }}>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '20px' }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '10px', padding: '10px 14px', boxShadow: 'var(--shadow-sm)' }}>
          <span>🔍</span>
          <span style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>Search by make, model, year, or VIN…</span>
        </div>
      </div>

      <div style={{ backgroundColor: 'var(--color-surface)', borderRadius: '12px', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden', marginBottom: '20px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)' }}>
              {['Year', 'Make', 'Model', 'VIN', 'Mileage', 'Customer', 'Actions'].map((col) => (
                <th key={col} style={{ textAlign: 'left', padding: '13px 16px', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={7} style={{ padding: '80px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: '40px', marginBottom: '16px' }}>🚗</div>
                <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '8px' }}>No vehicles registered</div>
                <div style={{ fontSize: '14px', color: 'var(--color-text-muted)', maxWidth: '380px', margin: '0 auto' }}>
                  Vehicles are added by customers through the customer app. Makes, models, and years pull from the NHTSA database.
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* NHTSA Info */}
      <div style={{ backgroundColor: 'var(--color-surface)', borderRadius: '12px', border: '1px solid var(--color-border)', padding: '24px', boxShadow: 'var(--shadow-sm)' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          🌐 NHTSA Integration (Phase 4)
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
          {[
            { icon: '🏭', title: 'Dynamic Makes', desc: 'All vehicle makes loaded from NHTSA API — no hardcoded data.' },
            { icon: '📋', title: 'Model Lookup', desc: 'Models populated dynamically based on the selected make.' },
            { icon: '📆', title: 'Year Range', desc: 'Available model years fetched in real-time for each model.' },
            { icon: '⚡', title: 'Caching Strategy', desc: 'NHTSA responses cached in DynamoDB to minimize API calls.' },
          ].map((item) => (
            <div key={item.title} style={{ padding: '14px', backgroundColor: 'var(--color-background)', borderRadius: '10px', borderLeft: '3px solid var(--color-secondary)' }}>
              <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '6px' }}>{item.icon} {item.title}</div>
              <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{item.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
