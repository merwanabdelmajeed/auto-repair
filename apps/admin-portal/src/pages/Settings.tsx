import React from 'react';

const SETTINGS_SECTIONS = [
  {
    title: 'Business Profile',
    items: [
      { label: 'Business Name', value: "Joe's Auto Repair", type: 'text' },
      { label: 'Legal Business Name', value: 'Joe\'s Auto Repair LLC', type: 'text' },
      { label: 'Primary Contact Email', value: 'admin@joesauto.com', type: 'text' },
      { label: 'Business Phone', value: '(408) 555-0100', type: 'text' },
      { label: 'Website', value: 'www.joesauto.com', type: 'text' },
      { label: 'Timezone', value: 'America/Los_Angeles', type: 'select' },
    ],
  },
  {
    title: 'Locations',
    items: [
      { label: 'San Jose (Primary)', value: '1234 Main St, San Jose, CA 95101', type: 'link' },
      { label: 'Add New Location', value: '', type: 'action' },
    ],
  },
  {
    title: 'Booking Settings',
    items: [
      { label: 'Online Booking', value: 'Enabled', type: 'toggle' },
      { label: 'Capacity Settings', value: 'Phase 7', type: 'badge' },
      { label: 'Blocked Times', value: 'Phase 8', type: 'badge' },
      { label: 'Advance Booking Window', value: '30 days', type: 'text' },
      { label: 'Cancellation Policy', value: '24 hour notice', type: 'text' },
    ],
  },
  {
    title: 'Roles & Access',
    items: [
      { label: 'Tenant Owner', value: 'You', type: 'text' },
      { label: 'Location Managers', value: '0 assigned', type: 'link' },
      { label: 'Invite Admin User', value: '', type: 'action' },
    ],
  },
];

export default function Settings() {
  return (
    <div style={{ maxWidth: '800px' }}>
      {/* Tenant Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', backgroundColor: 'var(--color-primary)', borderRadius: '12px', padding: '20px 24px', marginBottom: '24px', boxShadow: 'var(--shadow-md)' }}>
        <div style={{ width: '56px', height: '56px', borderRadius: '14px', backgroundColor: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px', flexShrink: 0 }}>🏢</div>
        <div style={{ flex: 1 }}>
          <div style={{ color: 'white', fontSize: '18px', fontWeight: 700, marginBottom: '4px' }}>Joe's Auto Repair</div>
          <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: '13px' }}>Tenant Owner · 1 Location · Phase 0</div>
        </div>
        <button style={{ backgroundColor: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
          Edit Profile
        </button>
      </div>

      {SETTINGS_SECTIONS.map((section) => (
        <div key={section.title} style={{ marginBottom: '20px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: '10px', paddingLeft: '4px' }}>
            {section.title}
          </h3>
          <div style={{ backgroundColor: 'var(--color-surface)', borderRadius: '12px', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
            {section.items.map((item, i) => (
              <div key={item.label} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 20px',
                borderBottom: i < section.items.length - 1 ? '1px solid var(--color-divider)' : 'none',
                cursor: item.type === 'link' || item.type === 'action' ? 'pointer' : 'default',
              }}>
                <span style={{ fontSize: '14px', fontWeight: 500, color: item.type === 'action' ? 'var(--color-primary)' : 'var(--color-text-primary)' }}>
                  {item.type === 'action' ? `＋ ${item.label}` : item.label}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {item.type === 'toggle' && (
                    <div style={{ width: '40px', height: '22px', borderRadius: '11px', backgroundColor: 'var(--color-primary)', position: 'relative', cursor: 'pointer' }}>
                      <div style={{ position: 'absolute', right: '3px', top: '3px', width: '16px', height: '16px', borderRadius: '50%', backgroundColor: 'white' }} />
                    </div>
                  )}
                  {item.type === 'badge' && (
                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-secondary)', backgroundColor: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '4px', padding: '2px 8px' }}>
                      {item.value}
                    </span>
                  )}
                  {(item.type === 'text' || item.type === 'select') && item.value && (
                    <span style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>{item.value}</span>
                  )}
                  {(item.type === 'link' || item.type === 'text' || item.type === 'select') && (
                    <span style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>›</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Danger Zone */}
      <div style={{ border: '1px solid rgba(239,68,68,0.25)', borderRadius: '12px', padding: '20px', backgroundColor: 'rgba(239,68,68,0.03)' }}>
        <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#EF4444', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: '12px' }}>Danger Zone</h3>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)' }}>Delete Tenant Account</div>
            <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>Permanently delete all tenant data. This cannot be undone.</div>
          </div>
          <button style={{ backgroundColor: 'white', border: '1px solid #EF4444', color: '#EF4444', fontWeight: 700, fontSize: '13px', borderRadius: '8px', padding: '8px 16px', cursor: 'pointer' }}>
            Delete Tenant
          </button>
        </div>
      </div>

      <div style={{ textAlign: 'center', marginTop: '24px', color: 'var(--color-text-muted)', fontSize: '12px' }}>
        AutoRepair Admin Portal · Phase 0 · v1.0.0
      </div>
    </div>
  );
}
