import React, { useEffect, useState } from 'react';
import {
  listPromotions, createPromotion, updatePromotion, deletePromotion,
  type Promotion,
} from '../api/promotions';

type PromoForm = {
  code: string;
  description: string;
  type: 'percent' | 'fixed';
  value: number;
  maxUsesStr: string;
  expiresAtStr: string;
  isActive: boolean;
};

const EMPTY_FORM: PromoForm = {
  code: '', description: '', type: 'percent', value: 10, maxUsesStr: '', expiresAtStr: '', isActive: true,
};

function fmtDate(iso: string) {
  const d = new Date(iso.length === 10 ? iso + 'T23:59:59' : iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatValue(p: Promotion) {
  return p.type === 'percent' ? `${p.value}% off` : `$${p.value.toFixed(2)} off`;
}

function promoToForm(p: Promotion): PromoForm {
  return {
    code: p.code,
    description: p.description ?? '',
    type: p.type,
    value: p.value,
    maxUsesStr: p.maxUses !== null ? String(p.maxUses) : '',
    expiresAtStr: p.expiresAt
      ? new Date(p.expiresAt.length === 10 ? p.expiresAt + 'T23:59:59' : p.expiresAt)
          .toLocaleDateString('en-CA')
      : '',
    isActive: p.isActive,
  };
}

export default function Promotions() {
  const [promos, setPromos] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Promotion | null>(null);
  const [form, setForm] = useState<PromoForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => { void load(); }, []);

  async function load() {
    try {
      setLoading(true);
      setError('');
      setPromos(await listPromotions());
    } catch {
      setError('Failed to load promotions.');
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setShowModal(true);
  }

  function openEdit(p: Promotion) {
    setEditTarget(p);
    setForm(promoToForm(p));
    setFormError('');
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditTarget(null);
  }

  async function handleSave() {
    if (!form.value || form.value <= 0) { setFormError('Value must be greater than 0.'); return; }
    if (form.type === 'percent' && form.value > 100) { setFormError('Percent cannot exceed 100.'); return; }
    setSaving(true);
    setFormError('');
    try {
      const maxUses = form.maxUsesStr ? parseInt(form.maxUsesStr, 10) : null;
      const expiresAt = form.expiresAtStr.trim()
        ? new Date(form.expiresAtStr + 'T23:59:59').toISOString()
        : null;

      if (!editTarget) {
        // Create
        if (!form.code.trim()) { setFormError('Promo code is required.'); setSaving(false); return; }
        const created = await createPromotion({
          code: form.code,
          description: form.description,
          type: form.type,
          value: form.value,
          maxUses: maxUses && maxUses > 0 ? maxUses : null,
          expiresAt,
        });
        setPromos(prev => [created, ...prev]);
      } else {
        // Update
        const updated = await updatePromotion(editTarget.promoId, {
          description: form.description,
          type: form.type,
          value: form.value,
          maxUses: maxUses && maxUses > 0 ? maxUses : null,
          expiresAt,
        });
        setPromos(prev => prev.map(p => p.promoId === editTarget.promoId ? updated : p));
      }
      closeModal();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to save.');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(p: Promotion) {
    const updated = await updatePromotion(p.promoId, { isActive: !p.isActive });
    setPromos(prev => prev.map(x => x.promoId === p.promoId ? updated : x));
  }

  async function handleDelete(p: Promotion) {
    if (!window.confirm(`Delete code "${p.code}"? This cannot be undone.`)) return;
    try {
      await deletePromotion(p.promoId);
      setPromos(prev => prev.filter(x => x.promoId !== p.promoId));
    } catch {
      alert('Failed to delete promotion.');
    }
  }

  const shown = promos.filter(p => {
    if (filter === 'active') return p.isActive;
    if (filter === 'inactive') return !p.isActive;
    return true;
  });

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', border: '1px solid var(--color-border)',
    borderRadius: '8px', padding: '10px 12px', fontSize: '14px',
    color: 'var(--color-text-primary)', backgroundColor: 'var(--color-background)', outline: 'none',
  };
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '0.5px', color: 'var(--color-text-muted)', marginBottom: '6px', marginTop: '16px',
  };

  return (
    <div style={{ maxWidth: '1100px' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '6px' }}>
          {(['all', 'active', 'inactive'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{ padding: '7px 14px', borderRadius: '100px', border: '1px solid', cursor: 'pointer', fontSize: '13px', fontWeight: 600, borderColor: filter === f ? 'var(--color-primary)' : 'var(--color-border)', backgroundColor: filter === f ? 'var(--color-primary)' : 'var(--color-surface)', color: filter === f ? 'white' : 'var(--color-text-secondary)' }}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <div style={{ flex: 1, fontSize: '13px', color: 'var(--color-text-muted)' }}>
          {loading ? '' : `${shown.length} promotion${shown.length !== 1 ? 's' : ''}`}
        </div>
        <button onClick={openCreate} style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--color-secondary)', color: 'var(--color-primary)', fontWeight: 700, fontSize: '14px', borderRadius: '10px', padding: '10px 18px', border: 'none', cursor: 'pointer', boxShadow: 'var(--shadow-sm)', whiteSpace: 'nowrap' }}>
          + New Promotion
        </button>
      </div>

      {error && (
        <div style={{ backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', color: 'var(--color-error)', fontSize: '14px' }}>{error}</div>
      )}

      {/* Table */}
      <div style={{ backgroundColor: 'var(--color-surface)', borderRadius: '12px', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)' }}>
              {['Code', 'Description', 'Discount', 'Uses', 'Expires', 'Status', 'Actions'].map(col => (
                <th key={col} style={{ textAlign: 'left', padding: '13px 16px', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', whiteSpace: 'nowrap' }}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ padding: '60px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '14px' }}>Loading…</td></tr>
            ) : shown.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: '60px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: '36px', marginBottom: '12px' }}>🏷️</div>
                <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>No promotions</div>
                <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Create a discount code to let customers save on bookings.</div>
              </td></tr>
            ) : shown.map((p, i) => {
              const expiryDate = p.expiresAt ? new Date(p.expiresAt.length === 10 ? p.expiresAt + 'T23:59:59' : p.expiresAt) : null;
              const expired = expiryDate ? expiryDate < new Date() : false;
              const maxed = p.maxUses !== null && p.usedCount >= p.maxUses;
              return (
                <tr key={p.promoId} style={{ borderBottom: i < shown.length - 1 ? '1px solid var(--color-divider)' : 'none' }}>
                  <td style={{ padding: '14px 16px', fontWeight: 700, fontSize: '14px', color: 'var(--color-primary)', fontFamily: 'monospace' }}>{p.code}</td>
                  <td style={{ padding: '14px 16px', fontSize: '13px', color: 'var(--color-text-secondary)', maxWidth: '200px' }}>
                    <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.description || '—'}</span>
                  </td>
                  <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, padding: '3px 8px', borderRadius: '4px', backgroundColor: p.type === 'percent' ? 'rgba(59,130,246,0.1)' : 'rgba(34,197,94,0.1)', color: p.type === 'percent' ? '#2563EB' : '#16A34A' }}>
                      {formatValue(p)}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: '13px', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                    {p.usedCount}{p.maxUses ? ` / ${p.maxUses}` : ''}
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: '13px', color: expired ? 'var(--color-error)' : 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                    {p.expiresAt ? fmtDate(p.expiresAt) : '—'}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    {expired || maxed ? (
                      <span style={{ fontSize: '12px', fontWeight: 700, padding: '3px 10px', borderRadius: '100px', backgroundColor: 'rgba(148,163,184,0.15)', color: 'var(--color-text-muted)', border: '1px solid rgba(148,163,184,0.25)' }}>
                        {expired ? 'Expired' : 'Maxed'}
                      </span>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          onClick={() => void handleToggleActive(p)}
                          style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', width: '40px', height: '22px', borderRadius: '11px', backgroundColor: p.isActive ? 'var(--color-primary)' : 'var(--color-border)', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0, transition: 'background-color 0.2s' }}
                        >
                          <span style={{ position: 'absolute', left: p.isActive ? '20px' : '2px', width: '18px', height: '18px', borderRadius: '50%', backgroundColor: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.25)', transition: 'left 0.15s' }} />
                        </button>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: p.isActive ? 'var(--color-success)' : 'var(--color-text-muted)' }}>
                          {p.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => openEdit(p)} style={{ background: 'none', border: '1px solid var(--color-border)', borderRadius: '6px', padding: '4px 10px', fontSize: '12px', cursor: 'pointer', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                        Edit
                      </button>
                      <button onClick={() => void handleDelete(p)} style={{ background: 'none', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', padding: '4px 10px', fontSize: '12px', cursor: 'pointer', color: 'var(--color-error)' }}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Create / Edit Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '20px' }}>
          <div style={{ backgroundColor: 'var(--color-surface)', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '480px', boxShadow: 'var(--shadow-lg)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
                {editTarget ? 'Edit Promotion' : 'Create Promotion'}
              </h2>
              <button onClick={closeModal} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--color-text-muted)', lineHeight: 1 }}>✕</button>
            </div>

            {formError && (
              <div style={{ backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', color: 'var(--color-error)', fontSize: '13px' }}>
                {formError}
              </div>
            )}

            {/* Code — editable on create, read-only on edit */}
            <label style={labelStyle}>Promo Code {!editTarget && '*'}</label>
            {editTarget ? (
              <div style={{ padding: '10px 12px', borderRadius: '8px', backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)', fontSize: '14px', fontWeight: 700, color: 'var(--color-primary)', fontFamily: 'monospace', letterSpacing: '1px' }}>
                {editTarget.code}
              </div>
            ) : (
              <input
                style={inputStyle}
                value={form.code}
                onChange={e => setForm(p => ({ ...p, code: e.target.value.toUpperCase().replace(/\s/g, '') }))}
                placeholder="e.g. SUMMER20"
              />
            )}

            <label style={labelStyle}>Description</label>
            <input
              style={inputStyle}
              value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              placeholder="e.g. 20% off all services this summer"
            />

            <label style={labelStyle}>Discount Type *</label>
            <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
              {(['percent', 'fixed'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setForm(p => ({ ...p, type: t }))}
                  style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1.5px solid', cursor: 'pointer', fontSize: '13px', fontWeight: 600, borderColor: form.type === t ? 'var(--color-primary)' : 'var(--color-border)', backgroundColor: form.type === t ? 'rgba(15,32,68,0.05)' : 'var(--color-background)', color: form.type === t ? 'var(--color-primary)' : 'var(--color-text-secondary)' }}
                >
                  {t === 'percent' ? '% Percent' : '$ Fixed Amount'}
                </button>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={labelStyle}>{form.type === 'percent' ? 'Percent Off *' : 'Amount Off ($) *'}</label>
                <input style={inputStyle} type="number" value={form.value} onChange={e => setForm(p => ({ ...p, value: parseFloat(e.target.value) || 0 }))} min={0} max={form.type === 'percent' ? 100 : undefined} />
              </div>
              <div>
                <label style={labelStyle}>Max Uses</label>
                <input style={inputStyle} type="number" value={form.maxUsesStr} onChange={e => setForm(p => ({ ...p, maxUsesStr: e.target.value }))} placeholder="Unlimited" min={1} />
              </div>
            </div>

            <label style={labelStyle}>Expires At</label>
            <input style={inputStyle} type="date" value={form.expiresAtStr} onChange={e => setForm(p => ({ ...p, expiresAtStr: e.target.value }))} />

            <button
              onClick={() => void handleSave()}
              disabled={saving}
              style={{ width: '100%', marginTop: '24px', padding: '13px', backgroundColor: 'var(--color-secondary)', color: 'var(--color-primary)', fontWeight: 700, fontSize: '15px', borderRadius: '10px', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}
            >
              {saving ? (editTarget ? 'Saving…' : 'Creating…') : (editTarget ? 'Save Changes' : 'Create Promotion')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
