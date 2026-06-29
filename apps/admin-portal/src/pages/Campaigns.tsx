import React, { useEffect, useState } from 'react';
import {
  listCampaigns, createCampaign, sendCampaign,
  type Campaign, type CampaignInput,
} from '../api/campaigns';

const AUDIENCE_LABELS: Record<Campaign['targetAudience'], string> = {
  all: 'All Customers',
  inactive_30: 'Inactive 30+ days',
  inactive_60: 'Inactive 60+ days',
  inactive_90: 'Inactive 90+ days',
};

const EMPTY_FORM: CampaignInput = { name: '', subject: '', body: '', targetAudience: 'all' };

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<CampaignInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [sending, setSending] = useState<string | null>(null);

  useEffect(() => { void load(); }, []);

  async function load() {
    try {
      setLoading(true);
      setError('');
      setCampaigns(await listCampaigns());
    } catch {
      setError('Failed to load campaigns.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!form.name.trim()) { setFormError('Campaign name is required.'); return; }
    if (!form.subject.trim()) { setFormError('Subject is required.'); return; }
    if (!form.body.trim()) { setFormError('Body is required.'); return; }
    setSaving(true);
    setFormError('');
    try {
      const created = await createCampaign(form);
      setCampaigns(prev => [created, ...prev]);
      setShowModal(false);
      setForm(EMPTY_FORM);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to save.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSend(c: Campaign) {
    if (!window.confirm(`Send "${c.name}" to ${AUDIENCE_LABELS[c.targetAudience]}? This sends emails immediately.`)) return;
    setSending(c.campaignId);
    try {
      const result = await sendCampaign(c.campaignId);
      setCampaigns(prev => prev.map(x => x.campaignId === c.campaignId
        ? { ...x, status: 'sent', sentAt: new Date().toISOString(), recipientCount: result.sent }
        : x
      ));
      alert(`Sent to ${result.sent} recipient${result.sent !== 1 ? 's' : ''}.`);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to send campaign.');
    } finally {
      setSending(null);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', border: '1px solid var(--color-border)',
    borderRadius: '8px', padding: '10px 12px', fontSize: '14px',
    color: 'var(--color-text-primary)', backgroundColor: 'var(--color-background)', outline: 'none',
  };
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '0.5px', color: 'var(--color-text-muted)', marginBottom: '6px', marginTop: '16px',
  };

  const drafts = campaigns.filter(c => c.status === 'draft');
  const sent = campaigns.filter(c => c.status === 'sent');

  return (
    <div style={{ maxWidth: '1100px' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '20px', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
          {loading ? '' : `${drafts.length} draft${drafts.length !== 1 ? 's' : ''} · ${sent.length} sent`}
        </div>
        <button
          onClick={() => { setForm(EMPTY_FORM); setFormError(''); setShowModal(true); }}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--color-secondary)', color: 'var(--color-primary)', fontWeight: 700, fontSize: '14px', borderRadius: '10px', padding: '10px 18px', border: 'none', cursor: 'pointer', boxShadow: 'var(--shadow-sm)', whiteSpace: 'nowrap' }}
        >
          + New Campaign
        </button>
      </div>

      {error && (
        <div style={{ backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', color: 'var(--color-error)', fontSize: '14px' }}>
          {error}
        </div>
      )}

      {/* Table */}
      <div style={{ backgroundColor: 'var(--color-surface)', borderRadius: '12px', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)' }}>
              {['Name', 'Audience', 'Subject', 'Status', 'Sent', 'Recipients', 'Actions'].map(col => (
                <th key={col} style={{ textAlign: 'left', padding: '13px 16px', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', whiteSpace: 'nowrap' }}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ padding: '60px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '14px' }}>Loading…</td></tr>
            ) : campaigns.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: '60px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: '36px', marginBottom: '12px' }}>📢</div>
                <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>No campaigns yet</div>
                <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Create an email campaign to re-engage your customers.</div>
              </td></tr>
            ) : campaigns.map((c, i) => (
              <tr key={c.campaignId} style={{ borderBottom: i < campaigns.length - 1 ? '1px solid var(--color-divider)' : 'none' }}>
                <td style={{ padding: '14px 16px', fontWeight: 600, fontSize: '14px', color: 'var(--color-text-primary)', maxWidth: '160px' }}>
                  <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                </td>
                <td style={{ padding: '14px 16px', fontSize: '13px', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                  {AUDIENCE_LABELS[c.targetAudience]}
                </td>
                <td style={{ padding: '14px 16px', fontSize: '13px', color: 'var(--color-text-secondary)', maxWidth: '200px' }}>
                  <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.subject}</span>
                </td>
                <td style={{ padding: '14px 16px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, padding: '3px 10px', borderRadius: '100px', backgroundColor: c.status === 'sent' ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)', color: c.status === 'sent' ? 'var(--color-success)' : '#D97706', border: `1px solid ${c.status === 'sent' ? 'rgba(34,197,94,0.25)' : 'rgba(245,158,11,0.25)'}` }}>
                    {c.status === 'sent' ? 'Sent' : 'Draft'}
                  </span>
                </td>
                <td style={{ padding: '14px 16px', fontSize: '13px', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                  {c.sentAt ? fmtDate(c.sentAt) : '—'}
                </td>
                <td style={{ padding: '14px 16px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                  {c.recipientCount !== null ? c.recipientCount : '—'}
                </td>
                <td style={{ padding: '14px 16px' }}>
                  {c.status === 'draft' ? (
                    <button
                      onClick={() => void handleSend(c)}
                      disabled={sending === c.campaignId}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: 700, cursor: sending === c.campaignId ? 'not-allowed' : 'pointer', opacity: sending === c.campaignId ? 0.6 : 1, whiteSpace: 'nowrap' }}
                    >
                      {sending === c.campaignId ? 'Sending…' : '▶ Send'}
                    </button>
                  ) : (
                    <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '20px' }}>
          <div style={{ backgroundColor: 'var(--color-surface)', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '520px', boxShadow: 'var(--shadow-lg)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text-primary)' }}>New Campaign</h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--color-text-muted)', lineHeight: 1 }}>✕</button>
            </div>

            {formError && (
              <div style={{ backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', color: 'var(--color-error)', fontSize: '13px' }}>
                {formError}
              </div>
            )}

            <label style={labelStyle}>Campaign Name *</label>
            <input
              style={inputStyle}
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Summer Re-engagement"
            />

            <label style={labelStyle}>Target Audience *</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px' }}>
              {(Object.entries(AUDIENCE_LABELS) as [Campaign['targetAudience'], string][]).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setForm(p => ({ ...p, targetAudience: key }))}
                  style={{ padding: '8px 14px', borderRadius: '8px', border: '1.5px solid', cursor: 'pointer', fontSize: '13px', fontWeight: 600, borderColor: form.targetAudience === key ? 'var(--color-primary)' : 'var(--color-border)', backgroundColor: form.targetAudience === key ? 'rgba(15,32,68,0.05)' : 'var(--color-background)', color: form.targetAudience === key ? 'var(--color-primary)' : 'var(--color-text-secondary)' }}
                >
                  {label}
                </button>
              ))}
            </div>

            <label style={labelStyle}>Email Subject *</label>
            <input
              style={inputStyle}
              value={form.subject}
              onChange={e => setForm(p => ({ ...p, subject: e.target.value }))}
              placeholder="e.g. We miss you — here's 20% off your next visit"
            />

            <label style={labelStyle}>Email Body *</label>
            <textarea
              style={{ ...inputStyle, height: '140px', resize: 'vertical' }}
              value={form.body}
              onChange={e => setForm(p => ({ ...p, body: e.target.value }))}
              placeholder="Write the email content here…"
            />

            <button
              onClick={() => void handleSave()}
              disabled={saving}
              style={{ width: '100%', marginTop: '24px', padding: '13px', backgroundColor: 'var(--color-secondary)', color: 'var(--color-primary)', fontWeight: 700, fontSize: '15px', borderRadius: '10px', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}
            >
              {saving ? 'Saving…' : 'Save as Draft'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
