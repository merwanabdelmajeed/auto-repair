import React, { useEffect, useState } from 'react';
import {
  listServices,
  createService,
  updateService,
  deleteService,
  type Service,
  type ServiceInput,
} from '../api/services';

const EMPTY_FORM: ServiceInput = { name: '', description: '', isActive: true };

export default function Services() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [form, setForm] = useState<ServiceInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => { void load(); }, []);

  async function load() {
    try {
      setLoading(true);
      setError('');
      const data = await listServices();
      setServices(data);
    } catch {
      setError('Failed to load services.');
    } finally {
      setLoading(false);
    }
  }

  function openAdd() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setShowModal(true);
  }

  function openEdit(svc: Service) {
    setEditing(svc);
    setForm({ name: svc.name, description: svc.description, isActive: svc.isActive });
    setFormError('');
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.name.trim()) { setFormError('Name is required.'); return; }
    setSaving(true);
    setFormError('');
    try {
      if (editing) {
        await updateService(editing.serviceId, form);
        setServices(prev => prev.map(s => s.serviceId === editing.serviceId ? { ...s, ...form } : s));
      } else {
        const created = await createService(form);
        setServices(prev => [created, ...prev]);
      }
      setShowModal(false);
    } catch {
      setFormError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(svc: Service) {
    if (!window.confirm(`Delete "${svc.name}"? This cannot be undone.`)) return;
    try {
      await deleteService(svc.serviceId);
      setServices(prev => prev.filter(s => s.serviceId !== svc.serviceId));
    } catch {
      alert('Failed to delete service.');
    }
  }

  return (
    <div style={{ maxWidth: '1100px' }}>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, fontSize: '13px', color: 'var(--color-text-secondary)' }}>
          {loading ? 'Loading…' : `${services.length} service${services.length !== 1 ? 's' : ''}`}
        </div>
        <button onClick={openAdd} style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--color-secondary)', color: 'var(--color-primary)', fontWeight: 700, fontSize: '14px', borderRadius: '10px', padding: '10px 18px', border: 'none', cursor: 'pointer', boxShadow: 'var(--shadow-sm)' }}>
          + Add Service
        </button>
      </div>

      {error && (
        <div style={{ backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', color: 'var(--color-error)', fontSize: '14px' }}>
          {error}
        </div>
      )}

      <div style={{ backgroundColor: 'var(--color-surface)', borderRadius: '12px', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)' }}>
              {['Service Name', 'Description', 'Status', 'Actions'].map(col => (
                <th key={col} style={{ textAlign: 'left', padding: '13px 16px', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} style={{ padding: '60px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '14px' }}>Loading services…</td></tr>
            ) : services.length === 0 ? (
              <tr><td colSpan={4} style={{ padding: '60px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: '36px', marginBottom: '12px' }}>🔧</div>
                <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>No services yet</div>
                <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Add your first service to let customers start booking.</div>
              </td></tr>
            ) : services.map((svc, i) => (
              <tr
                key={svc.serviceId}
                onClick={() => openEdit(svc)}
                style={{ borderBottom: i < services.length - 1 ? '1px solid var(--color-divider)' : 'none', cursor: 'pointer', transition: 'background-color 0.1s' }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(15,32,68,0.025)'; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <td style={{ padding: '14px 16px', fontWeight: 600, fontSize: '14px', color: 'var(--color-text-primary)' }}>{svc.name}</td>
                <td style={{ padding: '14px 16px', fontSize: '13px', color: 'var(--color-text-secondary)', maxWidth: '260px' }}>
                  <span style={{ overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{svc.description || '—'}</span>
                </td>
                <td style={{ padding: '14px 16px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, padding: '3px 10px', borderRadius: '100px', backgroundColor: svc.isActive ? 'rgba(34,197,94,0.1)' : 'rgba(148,163,184,0.15)', color: svc.isActive ? 'var(--color-success)' : 'var(--color-text-muted)', border: `1px solid ${svc.isActive ? 'rgba(34,197,94,0.25)' : 'rgba(148,163,184,0.25)'}` }}>
                    {svc.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td style={{ padding: '14px 16px' }} onClick={e => e.stopPropagation()}>
                  <button onClick={() => void handleDelete(svc)} style={{ background: 'none', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', padding: '4px 10px', fontSize: '12px', cursor: 'pointer', color: 'var(--color-error)' }}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '20px' }}>
          <div style={{ backgroundColor: 'var(--color-surface)', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '480px', boxShadow: 'var(--shadow-lg)' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '20px' }}>
              {editing ? 'Edit Service' : 'Add Service'}
            </h2>

            {formError && (
              <div style={{ backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', color: 'var(--color-error)', fontSize: '13px' }}>
                {formError}
              </div>
            )}

            {[
              { label: 'Service Name *', key: 'name', type: 'text', placeholder: 'e.g. Oil Change' },
              { label: 'Description', key: 'description', type: 'text', placeholder: 'Brief description…' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{f.label}</label>
                <input
                  type="text"
                  value={String(form[f.key as keyof ServiceInput] ?? '')}
                  onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--color-border)', borderRadius: '8px', fontSize: '14px', color: 'var(--color-text-primary)', backgroundColor: 'var(--color-background)', boxSizing: 'border-box' }}
                />
              </div>
            ))}
            <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input type="checkbox" id="isActive" checked={form.isActive ?? true} onChange={e => setForm(prev => ({ ...prev, isActive: e.target.checked }))} />
              <label htmlFor="isActive" style={{ fontSize: '14px', color: 'var(--color-text-primary)', cursor: 'pointer' }}>Active (visible to customers)</label>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowModal(false)} style={{ padding: '10px 20px', border: '1px solid var(--color-border)', borderRadius: '8px', background: 'transparent', fontSize: '14px', cursor: 'pointer', color: 'var(--color-text-secondary)' }}>Cancel</button>
              <button onClick={() => void handleSave()} disabled={saving} style={{ padding: '10px 24px', backgroundColor: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Service'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
