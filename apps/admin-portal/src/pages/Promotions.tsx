import React from 'react';

export default function Promotions() {
  return (
    <div style={{ maxWidth: '1100px' }}>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '200px', display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '10px', padding: '10px 14px', boxShadow: 'var(--shadow-sm)' }}>
          <span>🔍</span>
          <span style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>Search promotions…</span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {['All', 'Active', 'Scheduled', 'Expired'].map((f, i) => (
            <button key={f} style={{ padding: '8px 14px', borderRadius: '100px', border: '1px solid', borderColor: i === 0 ? 'var(--color-primary)' : 'var(--color-border)', backgroundColor: i === 0 ? 'var(--color-primary)' : 'var(--color-surface)', color: i === 0 ? 'white' : 'var(--color-text-secondary)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
              {f}
            </button>
          ))}
        </div>
        <button style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--color-secondary)', color: 'var(--color-primary)', fontWeight: 700, fontSize: '14px', borderRadius: '10px', padding: '10px 18px', border: 'none', cursor: 'pointer', boxShadow: 'var(--shadow-sm)' }}>
          ＋ New Promotion
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--color-surface)', borderRadius: '12px', border: '1px solid var(--color-border)', padding: '80px 40px', boxShadow: 'var(--shadow-sm)', marginBottom: '20px' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🏷️</div>
        <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '10px' }}>No Promotions Created</div>
        <div style={{ fontSize: '14px', color: 'var(--color-text-secondary)', textAlign: 'center', maxWidth: '400px', marginBottom: '24px', lineHeight: '1.6' }}>
          Create promotions that appear on the customer app home screen. Promotions can be tenant-wide or scoped to a specific location.
        </div>
        <button style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--color-primary)', color: 'white', fontWeight: 700, fontSize: '14px', borderRadius: '10px', padding: '12px 24px', border: 'none', cursor: 'pointer' }}>
          ＋ Create First Promotion
        </button>
      </div>

      <div style={{ backgroundColor: 'var(--color-surface)', borderRadius: '12px', border: '1px solid var(--color-border)', padding: '24px', boxShadow: 'var(--shadow-sm)' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '16px' }}>Promotion Fields (Phase 9)</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
          {['Title', 'Description', 'Image (S3)', 'Start Date', 'End Date', 'Priority', 'Active Flag', 'Scope (Tenant/Location)'].map((field) => (
            <div key={field} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', backgroundColor: 'var(--color-background)', borderRadius: '8px', fontSize: '13px', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
              <span style={{ color: 'var(--color-secondary)', fontSize: '10px' }}>★</span>
              {field}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
