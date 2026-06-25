import React from 'react';

export default function Customers() {
  return (
    <div style={{ maxWidth: '1100px' }}>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '220px', display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '10px', padding: '10px 14px', boxShadow: 'var(--shadow-sm)' }}>
          <span>🔍</span>
          <span style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>Search customers by name, email, or phone…</span>
        </div>
        <button style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--color-secondary)', color: 'var(--color-primary)', fontWeight: 700, fontSize: '14px', borderRadius: '10px', padding: '10px 18px', border: 'none', cursor: 'pointer', boxShadow: 'var(--shadow-sm)' }}>
          ＋ Add Customer
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '20px' }}>
        {[{ label: 'Total Customers', value: '0', icon: '👥' }, { label: 'New This Month', value: '0', icon: '🆕' }, { label: 'Active (last 30d)', value: '0', icon: '✅' }].map((s) => (
          <div key={s.label} style={{ backgroundColor: 'var(--color-surface)', borderRadius: '12px', padding: '20px', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ fontSize: '28px' }}>{s.icon}</span>
            <div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--color-text-primary)' }}>{s.value}</div>
              <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ backgroundColor: 'var(--color-surface)', borderRadius: '12px', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)' }}>
              {['Name', 'Email', 'Phone', 'Vehicles', 'Bookings', 'Joined', 'Actions'].map((col) => (
                <th key={col} style={{ textAlign: 'left', padding: '13px 16px', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={7} style={{ padding: '80px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: '40px', marginBottom: '16px' }}>👤</div>
                <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '8px' }}>No customers yet</div>
                <div style={{ fontSize: '14px', color: 'var(--color-text-muted)' }}>Customers register through the customer app. They'll appear here automatically.</div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
