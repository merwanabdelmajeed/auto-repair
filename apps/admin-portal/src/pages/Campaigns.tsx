import React from 'react';

export default function Campaigns() {
  return (
    <div style={{ maxWidth: '1100px' }}>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '200px', display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '10px', padding: '10px 14px', boxShadow: 'var(--shadow-sm)' }}>
          <span>🔍</span>
          <span style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>Search campaigns…</span>
        </div>
        <button style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--color-secondary)', color: 'var(--color-primary)', fontWeight: 700, fontSize: '14px', borderRadius: '10px', padding: '10px 18px', border: 'none', cursor: 'pointer', boxShadow: 'var(--shadow-sm)' }}>
          ＋ New Campaign
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
        {[
          { icon: '📧', title: 'Email Campaigns', desc: 'Reach customers directly via AWS SES. Rich HTML templates, open tracking, and unsubscribe management.', phase: 'Phase 10', color: '#3B82F6' },
          { icon: '📲', title: 'Push Notifications', desc: 'Instant push campaigns via AWS SNS. Segment by location, behavior, or vehicle type.', phase: 'Phase 10', color: '#8B5CF6' },
        ].map((type) => (
          <div key={type.title} style={{ backgroundColor: 'var(--color-surface)', borderRadius: '12px', border: '1px solid var(--color-border)', padding: '24px', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: type.color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>{type.icon}</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '15px' }}>{type.title}</div>
                <span style={{ fontSize: '11px', color: type.color, fontWeight: 700, backgroundColor: type.color + '15', padding: '2px 8px', borderRadius: '4px' }}>{type.phase}</span>
              </div>
            </div>
            <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', lineHeight: '1.6' }}>{type.desc}</p>
          </div>
        ))}
      </div>

      <div style={{ backgroundColor: 'var(--color-surface)', borderRadius: '12px', border: '1px solid var(--color-border)', padding: '80px 40px', boxShadow: 'var(--shadow-sm)', textAlign: 'center', marginBottom: '20px' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>📢</div>
        <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '10px' }}>No Campaigns Yet</div>
        <div style={{ fontSize: '14px', color: 'var(--color-text-secondary)', maxWidth: '400px', margin: '0 auto 24px' }}>Campaign management will be fully enabled in Phase 10, including audience segmentation, scheduling, and tracking.</div>
      </div>

      <div style={{ backgroundColor: 'var(--color-surface)', borderRadius: '12px', border: '1px solid var(--color-border)', padding: '24px', boxShadow: 'var(--shadow-sm)' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '16px' }}>📋 Campaign Features (Phase 10)</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '10px' }}>
          {['Audience segmentation (all, location, new customers)', 'Scheduled delivery', 'Campaign tracking (open rate, CTR)', 'A/B testing for subject lines', 'Reusable templates', 'Opt-out / unsubscribe management'].map((f) => (
            <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px', backgroundColor: 'var(--color-background)', borderRadius: '8px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
              <span style={{ color: 'var(--color-success)', marginTop: '1px' }}>✓</span>
              {f}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
