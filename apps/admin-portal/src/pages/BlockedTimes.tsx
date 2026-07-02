import React, { useEffect, useState } from 'react';
import { listBlockedTimes, createBlockedTime, deleteBlockedTime, type BlockedTime } from '../api/blockedTimes';

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtRange(startDate: string, endDate: string): string {
  const fmt = (d: string) =>
    new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return startDate === endDate ? fmt(startDate) : `${fmt(startDate)} – ${fmt(endDate)}`;
}

export default function BlockedTimes() {
  const [blockedTimes, setBlockedTimes] = useState<BlockedTime[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const [label, setLabel] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState('');

  useEffect(() => { void load(); }, []);

  async function load() {
    try {
      const data = await listBlockedTimes();
      setBlockedTimes(data.sort((a, b) => a.startDate.localeCompare(b.startDate)));
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }

  function openModal() {
    const today = todayStr();
    setLabel('');
    setStartDate(today);
    setEndDate(today);
    setModalError('');
    setShowModal(true);
  }

  async function handleSave() {
    if (!label.trim()) { setModalError('Label is required.'); return; }
    if (startDate > endDate) { setModalError('Start date must be on or before end date.'); return; }

    setSaving(true);
    setModalError('');
    try {
      const created = await createBlockedTime({ label: label.trim(), startDate, endDate });
      setBlockedTimes(prev => [...prev, created].sort((a, b) => a.startDate.localeCompare(b.startDate)));
      setShowModal(false);
    } catch {
      setModalError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(bt: BlockedTime) {
    if (!confirm(`Remove "${bt.label}" (${fmtRange(bt.startDate, bt.endDate)})?`)) return;
    try {
      await deleteBlockedTime(bt.blockedTimeId);
      setBlockedTimes(prev => prev.filter(b => b.blockedTimeId !== bt.blockedTimeId));
    } catch {
      alert('Failed to remove blocked time.');
    }
  }

  return (
    <div style={{ maxWidth: '800px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
          Block dates to prevent customer bookings on holidays or closures.
        </div>
        <button
          onClick={openModal}
          style={{ padding: '9px 20px', backgroundColor: 'var(--color-secondary)', color: 'var(--color-primary)', border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '14px', cursor: 'pointer' }}
        >
          + Add Block
        </button>
      </div>

      <div style={{ backgroundColor: 'var(--color-surface)', borderRadius: '12px', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)' }}>
              {['Label', 'Date Range', 'Created', ''].map(col => (
                <th key={col} style={{ textAlign: 'left', padding: '13px 16px', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} style={{ padding: '60px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '14px' }}>Loading…</td></tr>
            ) : blockedTimes.length === 0 ? (
              <tr><td colSpan={4} style={{ padding: '60px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: '36px', marginBottom: '12px' }}>🗓️</div>
                <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>No blocked times</div>
                <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Add blocks to prevent bookings on holidays or closures.</div>
              </td></tr>
            ) : blockedTimes.map((bt, i) => (
              <tr key={bt.blockedTimeId} style={{ borderBottom: i < blockedTimes.length - 1 ? '1px solid var(--color-divider)' : 'none' }}>
                <td style={{ padding: '14px 16px', fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)' }}>{bt.label}</td>
                <td style={{ padding: '14px 16px', fontSize: '14px', color: 'var(--color-text-secondary)' }}>{fmtRange(bt.startDate, bt.endDate)}</td>
                <td style={{ padding: '14px 16px', fontSize: '13px', color: 'var(--color-text-muted)' }}>
                  {new Date(bt.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </td>
                <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                  <button
                    onClick={() => void handleDelete(bt)}
                    style={{ padding: '5px 12px', backgroundColor: 'rgba(239,68,68,0.08)', color: 'var(--color-error)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'var(--color-surface)', borderRadius: '16px', padding: '28px', width: '440px', maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--color-text-primary)' }}>Block Dates</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--color-text-muted)', lineHeight: 1 }}>✕</button>
            </div>

            {modalError && (
              <div style={{ backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', color: 'var(--color-error)', fontSize: '13px' }}>
                {modalError}
              </div>
            )}

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Label</label>
              <input
                type="text"
                value={label}
                onChange={e => setLabel(e.target.value)}
                placeholder="e.g. Independence Day, Staff Training"
                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--color-border)', fontSize: '14px', color: 'var(--color-text-primary)', backgroundColor: 'var(--color-background)', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Start Date</label>
              <input
                type="date"
                value={startDate}
                min={todayStr()}
                onChange={e => setStartDate(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--color-border)', fontSize: '14px', color: 'var(--color-text-primary)', backgroundColor: 'var(--color-background)', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>End Date</label>
              <input
                type="date"
                value={endDate}
                min={todayStr()}
                onChange={e => setEndDate(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--color-border)', fontSize: '14px', color: 'var(--color-text-primary)', backgroundColor: 'var(--color-background)', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <button onClick={() => setShowModal(false)} style={{ flex: 1, padding: '11px', border: '1px solid var(--color-border)', borderRadius: '8px', backgroundColor: 'transparent', fontSize: '14px', fontWeight: 600, color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={() => void handleSave()} disabled={saving} style={{ flex: 1, padding: '11px', backgroundColor: 'var(--color-secondary)', color: 'var(--color-primary)', border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '14px', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
