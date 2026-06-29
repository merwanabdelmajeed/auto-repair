import React, { useEffect, useState } from 'react';
import {
  listAppointments,
  updateAppointmentStatus,
  applyPromo,
  type Appointment,
  type AppointmentStatus,
} from '../api/appointments';
import StatusPickerModal from '../components/StatusPickerModal';

const STATUS_TABS: { label: string; value: AppointmentStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Confirmed', value: 'confirmed' },
  { label: 'In Progress', value: 'in-progress' },
  { label: 'Completed', value: 'completed' },
  { label: 'Cancelled', value: 'cancelled' },
];

const STATUS_STYLE: Record<AppointmentStatus, { bg: string; color: string; border: string }> = {
  pending: { bg: 'rgba(245,158,11,0.1)', color: '#D97706', border: 'rgba(245,158,11,0.3)' },
  confirmed: { bg: 'rgba(59,130,246,0.1)', color: '#2563EB', border: 'rgba(59,130,246,0.3)' },
  'in-progress': { bg: 'rgba(139,92,246,0.1)', color: '#7C3AED', border: 'rgba(139,92,246,0.3)' },
  completed: { bg: 'rgba(34,197,94,0.1)', color: '#16A34A', border: 'rgba(34,197,94,0.3)' },
  cancelled: { bg: 'rgba(148,163,184,0.1)', color: '#64748B', border: 'rgba(148,163,184,0.3)' },
};

const VALID_NEXT: Partial<Record<AppointmentStatus, AppointmentStatus[]>> = {
  pending:       ['confirmed', 'cancelled'],
  confirmed:     ['in-progress', 'cancelled'],
  'in-progress': ['completed', 'cancelled'],
};

function statusLabel(s: AppointmentStatus) {
  return s === 'in-progress' ? 'In Progress' : s.charAt(0).toUpperCase() + s.slice(1);
}

function fmt(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function Bookings() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<AppointmentStatus | 'all'>('all');
  const [updating, setUpdating] = useState<string | null>(null);
  const [statusTarget, setStatusTarget] = useState<{ appt: Appointment; rect: DOMRect } | null>(null);
  const [pendingCancel, setPendingCancel] = useState<Appointment | null>(null);
  const [pendingPromo, setPendingPromo] = useState<Appointment | null>(null);
  const [errorDialog, setErrorDialog] = useState<string | null>(null);

  useEffect(() => { void load(); }, []);

  async function load() {
    try {
      setLoading(true);
      setError('');
      const data = await listAppointments();
      setAppointments(data);
    } catch {
      setError('Failed to load appointments.');
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusUpdate(appt: Appointment, status: AppointmentStatus) {
    setUpdating(appt.appointmentId);
    try {
      await updateAppointmentStatus(appt.appointmentId, status);
      setAppointments(prev => prev.map(a => a.appointmentId === appt.appointmentId ? { ...a, status } : a));
    } catch {
      alert('Failed to update status.');
    } finally {
      setUpdating(null);
    }
  }

  function handleStatusSelect(status: AppointmentStatus) {
    if (!statusTarget) return;
    const appt = statusTarget.appt;
    if (status === 'cancelled') {
      setPendingCancel(appt);
    } else {
      void handleStatusUpdate(appt, status);
    }
  }

  async function confirmCancel() {
    if (!pendingCancel) return;
    const appt = pendingCancel;
    setPendingCancel(null);
    await handleStatusUpdate(appt, 'cancelled');
  }

  async function confirmAndApplyPromo() {
    if (!pendingPromo) return;
    const appt = pendingPromo;
    setPendingPromo(null);
    if (!appt.promoId) return;
    // Optimistic update — show applied immediately
    setAppointments(prev => prev.map(a => a.appointmentId === appt.appointmentId ? { ...a, promoApplied: true } : a));
    try {
      await applyPromo(appt.promoId, appt.customerId, appt.appointmentId);
    } catch (err: unknown) {
      // Revert on failure
      setAppointments(prev => prev.map(a => a.appointmentId === appt.appointmentId ? { ...a, promoApplied: false } : a));
      setErrorDialog(err instanceof Error ? err.message : 'Failed to apply promo.');
    }
  }

  const filtered = (activeTab === 'all' ? appointments : appointments.filter(a => a.status === activeTab))
    .slice()
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));

  return (
    <div style={{ maxWidth: '1200px' }}>
      {/* Status Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
        {STATUS_TABS.map(tab => {
          const count = tab.value === 'all' ? appointments.length : appointments.filter(a => a.status === tab.value).length;
          const active = activeTab === tab.value;
          return (
            <button key={tab.value} onClick={() => setActiveTab(tab.value)} style={{ padding: '7px 14px', borderRadius: '100px', border: '1px solid', borderColor: active ? 'var(--color-primary)' : 'var(--color-border)', backgroundColor: active ? 'var(--color-primary)' : 'var(--color-surface)', color: active ? 'white' : 'var(--color-text-secondary)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
              {tab.label}
              <span style={{ backgroundColor: active ? 'rgba(255,255,255,0.2)' : 'var(--color-background)', borderRadius: '100px', padding: '1px 7px', fontSize: '11px' }}>{count}</span>
            </button>
          );
        })}
      </div>

      {error && (
        <div style={{ backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', color: 'var(--color-error)', fontSize: '14px' }}>
          {error}
        </div>
      )}

      <div style={{ backgroundColor: 'var(--color-surface)', borderRadius: '12px', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '18%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '22%' }} />
          </colgroup>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)' }}>
              {['Customer', 'Vehicle', 'Service', 'Scheduled', 'Promo', 'Status', 'Actions'].map(col => (
                <th key={col} style={{ textAlign: 'left', padding: '13px 16px', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ padding: '60px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '14px' }}>Loading appointments…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: '60px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: '36px', marginBottom: '12px' }}>📋</div>
                <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>{activeTab === 'all' ? 'No appointments yet' : `No ${activeTab} appointments`}</div>
                <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Appointments appear here when customers book through the app.</div>
              </td></tr>
            ) : filtered.map((appt, i) => {
              const st = STATUS_STYLE[appt.status];
              const opts = VALID_NEXT[appt.status];
              const isUpdating = updating === appt.appointmentId;
              return (
                <tr key={appt.appointmentId} style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--color-divider)' : 'none', verticalAlign: 'middle' }}>
                  <td style={{ padding: '14px 16px', overflow: 'hidden' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{appt.customerName || appt.customerEmail}</div>
                    {appt.customerName && <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{appt.customerEmail}</div>}
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: '13px', color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{appt.vehicleSummary}</td>
                  <td style={{ padding: '14px 16px', fontSize: '13px', fontWeight: 500, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{appt.serviceName}</td>
                  <td style={{ padding: '14px 16px', fontSize: '13px', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>{fmt(appt.scheduledAt)}</td>
                  <td style={{ padding: '14px 16px' }}>
                    {appt.promoCode ? (
                      <div>
                        <span style={{ fontFamily: 'monospace', fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap', display: 'inline-block', color: appt.promoApplied ? 'var(--color-success)' : 'var(--color-text-primary)', backgroundColor: appt.promoApplied ? 'rgba(34,197,94,0.08)' : 'rgba(245,158,11,0.08)', border: `1px solid ${appt.promoApplied ? 'rgba(34,197,94,0.25)' : 'rgba(245,158,11,0.25)'}`, borderRadius: '4px', padding: '2px 6px' }}>
                          {appt.promoCode}
                        </span>
                        <div style={{ fontSize: '11px', color: appt.promoApplied ? 'var(--color-success)' : 'var(--color-text-muted)', marginTop: '3px', whiteSpace: 'nowrap' }}>
                          {appt.promoApplied ? '✓ Applied' : 'Not applied'}
                        </div>
                      </div>
                    ) : (
                      <span style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    {isUpdating ? (
                      <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Updating…</span>
                    ) : opts ? (
                      <button
                        onClick={e => setStatusTarget({ appt, rect: e.currentTarget.getBoundingClientRect() })}
                        style={{ fontSize: '12px', fontWeight: 700, padding: '4px 10px', borderRadius: '100px', backgroundColor: st.bg, color: st.color, border: `1px solid ${st.border}`, cursor: 'pointer', textTransform: 'capitalize', whiteSpace: 'nowrap' }}
                      >
                        {statusLabel(appt.status)} ▾
                      </button>
                    ) : (
                      <span style={{ fontSize: '12px', fontWeight: 700, padding: '4px 10px', borderRadius: '100px', backgroundColor: st.bg, color: st.color, border: `1px solid ${st.border}`, display: 'inline-block', textTransform: 'capitalize' }}>
                        {statusLabel(appt.status)}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    {appt.promoCode && !appt.promoApplied ? (
                      <button onClick={() => setPendingPromo(appt)} disabled={isUpdating} style={{ background: 'none', border: '1px solid rgba(245,158,11,0.4)', borderRadius: '6px', padding: '5px 10px', fontSize: '12px', cursor: 'pointer', color: '#D97706', fontWeight: 600, whiteSpace: 'nowrap' }}>
                        🏷 Apply Promo
                      </button>
                    ) : (
                      <span style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <StatusPickerModal
        anchorRect={statusTarget?.rect ?? null}
        currentStatus={statusTarget?.appt.status ?? 'pending'}
        validNext={statusTarget ? (VALID_NEXT[statusTarget.appt.status] ?? []) : []}
        onSelect={handleStatusSelect}
        onDismiss={() => setStatusTarget(null)}
      />
      {pendingCancel && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1002 }}>
          <div style={{ backgroundColor: 'var(--color-surface)', borderRadius: '16px', padding: '28px', width: '400px', maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '17px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
              Cancel Appointment?
            </h3>
            <p style={{ margin: '0 0 24px', fontSize: '14px', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
              Cancel "{pendingCancel.serviceName}" for {pendingCancel.customerName || pendingCancel.customerEmail}? This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => setPendingCancel(null)} style={{ padding: '9px 20px', border: '1px solid var(--color-border)', borderRadius: '8px', backgroundColor: 'transparent', fontSize: '14px', fontWeight: 600, color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
                Keep it
              </button>
              <button onClick={() => void confirmCancel()} style={{ padding: '9px 20px', border: 'none', borderRadius: '8px', backgroundColor: 'var(--color-error)', color: 'white', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}>
                Cancel Appointment
              </button>
            </div>
          </div>
        </div>
      )}
      {pendingPromo && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'var(--color-surface)', borderRadius: '16px', padding: '28px', width: '400px', maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '17px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
              Apply Promo Code?
            </h3>
            <p style={{ margin: '0 0 24px', fontSize: '14px', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
              Mark code <strong>{pendingPromo.promoCode}</strong> as applied for {pendingPromo.customerName || pendingPromo.customerEmail}? This records that the discount was given in person and prevents re-use.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => setPendingPromo(null)} style={{ padding: '9px 20px', border: '1px solid var(--color-border)', borderRadius: '8px', backgroundColor: 'transparent', fontSize: '14px', fontWeight: 600, color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={() => void confirmAndApplyPromo()} style={{ padding: '9px 20px', border: 'none', borderRadius: '8px', backgroundColor: '#D97706', color: 'white', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}>
                Mark Applied
              </button>
            </div>
          </div>
        </div>
      )}
      {errorDialog && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'var(--color-surface)', borderRadius: '16px', padding: '28px', width: '400px', maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '17px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
              Cannot Apply Promo
            </h3>
            <p style={{ margin: '0 0 24px', fontSize: '14px', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
              {errorDialog}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setErrorDialog(null)} style={{ padding: '9px 24px', border: 'none', borderRadius: '8px', backgroundColor: 'var(--color-primary)', color: 'white', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
