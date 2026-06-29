import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDashboardSummary, type DashboardSummary } from '../api/dashboard';
import { listAppointments, updateAppointmentStatus, applyPromo, type Appointment, type AppointmentStatus } from '../api/appointments';
import StatusPickerModal from '../components/StatusPickerModal';

const STATUS_STYLE: Record<AppointmentStatus, { bg: string; color: string; border: string }> = {
  pending:       { bg: 'rgba(245,158,11,0.1)',  color: '#D97706', border: 'rgba(245,158,11,0.3)' },
  confirmed:     { bg: 'rgba(37,99,235,0.1)',   color: '#2563EB', border: 'rgba(37,99,235,0.3)' },
  'in-progress': { bg: 'rgba(139,92,246,0.1)',  color: '#7C3AED', border: 'rgba(139,92,246,0.3)' },
  completed:     { bg: 'rgba(34,197,94,0.1)',   color: '#16A34A', border: 'rgba(34,197,94,0.3)' },
  cancelled:     { bg: 'rgba(148,163,184,0.1)', color: '#64748B', border: 'rgba(148,163,184,0.3)' },
};

const VALID_NEXT: Partial<Record<AppointmentStatus, AppointmentStatus[]>> = {
  pending:       ['confirmed', 'cancelled'],
  confirmed:     ['in-progress', 'cancelled'],
  'in-progress': ['completed', 'cancelled'],
};

function statusLabel(s: AppointmentStatus) {
  return s === 'in-progress' ? 'In Progress' : s.charAt(0).toUpperCase() + s.slice(1);
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function todayLocalDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [todaysAppointments, setTodaysAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [statusTarget, setStatusTarget] = useState<{ appt: Appointment; rect: DOMRect } | null>(null);
  const [pendingCancel, setPendingCancel] = useState<Appointment | null>(null);
  const [pendingPromo, setPendingPromo] = useState<Appointment | null>(null);
  const [errorDialog, setErrorDialog] = useState<string | null>(null);

  useEffect(() => {
    const today = todayLocalDate();
    Promise.all([
      getDashboardSummary().catch(() => null),
      listAppointments().catch(() => [] as Appointment[]),
    ]).then(([sum, appts]) => {
      setSummary(sum);
      setTodaysAppointments(
        appts
          .filter(a => a.scheduledAt.startsWith(today) && a.status !== 'cancelled')
          .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt)),
      );
    }).finally(() => setLoading(false));
  }, []);

  async function handleStatusUpdate(appt: Appointment, status: AppointmentStatus) {
    setUpdating(appt.appointmentId);
    try {
      await updateAppointmentStatus(appt.appointmentId, status);
      setTodaysAppointments(prev => prev.map(a => a.appointmentId === appt.appointmentId ? { ...a, status } : a));
    } catch {
      setErrorDialog('Failed to update status.');
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
    setTodaysAppointments(prev => prev.map(a => a.appointmentId === appt.appointmentId ? { ...a, promoApplied: true } : a));
    try {
      await applyPromo(appt.promoId, appt.customerId, appt.appointmentId);
    } catch (err: unknown) {
      setTodaysAppointments(prev => prev.map(a => a.appointmentId === appt.appointmentId ? { ...a, promoApplied: false } : a));
      setErrorDialog(err instanceof Error ? err.message : 'Failed to apply promo.');
    }
  }

  const kpis = [
    { label: "Today's Bookings", value: loading ? '—' : String(summary?.bookingsToday ?? 0), icon: '📅', color: '#0F2044', bg: 'rgba(15,32,68,0.08)', clickable: false },
    { label: 'Active Customers', value: loading ? '—' : String(summary?.totalCustomers ?? 0), icon: '👥', color: '#8B5CF6', bg: 'rgba(139,92,246,0.08)', to: '/customers', clickable: true },
    { label: 'Vehicles Registered', value: loading ? '—' : String(summary?.totalVehicles ?? 0), icon: '🚗', color: '#3B82F6', bg: 'rgba(59,130,246,0.08)', to: '/vehicles', clickable: true },
  ];

  const quickLinks = [
    { icon: '🏷️', label: 'Promotions', to: '/promotions' },
    { icon: '🔧', label: 'Services',   to: '/services' },
    { icon: '⚙️', label: 'Settings',   to: '/settings' },
  ];

  return (
    <div style={{ maxWidth: '1200px' }}>
      {/* KPI Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '28px' }}>
        {kpis.map(card => (
          <div
            key={card.label}
            onClick={card.clickable ? () => navigate(card.to!) : undefined}
            style={{
              backgroundColor: 'var(--color-surface)', borderRadius: '12px', padding: '20px',
              boxShadow: 'var(--shadow-sm)', border: '1px solid var(--color-border)',
              cursor: card.clickable ? 'pointer' : 'default', position: 'relative', transition: 'box-shadow 0.15s',
            }}
            onMouseEnter={card.clickable ? e => (e.currentTarget.style.boxShadow = 'var(--shadow-md)') : undefined}
            onMouseLeave={card.clickable ? e => (e.currentTarget.style.boxShadow = 'var(--shadow-sm)') : undefined}
          >
            <div style={{ width: '44px', height: '44px', borderRadius: '10px', backgroundColor: card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', marginBottom: '12px' }}>
              {card.icon}
            </div>
            <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--color-text-primary)', lineHeight: 1 }}>{card.value}</div>
            <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginTop: '6px' }}>{card.label}</div>
            {card.clickable && <span style={{ position: 'absolute', top: '16px', right: '16px', fontSize: '16px', color: 'var(--color-text-muted)' }}>›</span>}
          </div>
        ))}
      </div>

      {/* Today's Bookings Table */}
      <div style={{ backgroundColor: 'var(--color-surface)', borderRadius: '12px', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--color-border)', overflow: 'hidden', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--color-border)' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>Today's Bookings</h2>
          <button onClick={() => navigate('/bookings')} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontWeight: 600, fontSize: '13px', cursor: 'pointer', padding: '4px 8px', borderRadius: '6px' }}>
            See all bookings →
          </button>
        </div>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '14px' }}>Loading…</div>
        ) : todaysAppointments.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center' }}>
            <div style={{ fontSize: '32px', marginBottom: '10px' }}>📅</div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>No bookings today</div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '7%' }} />
              <col style={{ width: '18%' }} />
              <col style={{ width: '22%' }} />
              <col style={{ width: '13%' }} />
              <col style={{ width: '11%' }} />
              <col style={{ width: '29%' }} />
            </colgroup>
            <thead>
              <tr style={{ backgroundColor: 'var(--color-background)', borderBottom: '1px solid var(--color-border)' }}>
                {['Time', 'Customer', 'Service · Vehicle', 'Promo', 'Status', 'Actions'].map(col => (
                  <th key={col} style={{ textAlign: 'left', padding: '10px 16px', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {todaysAppointments.map((a, i) => {
                const st = STATUS_STYLE[a.status];
                const opts = VALID_NEXT[a.status];
                const isUpdating = updating === a.appointmentId;
                return (
                  <tr key={a.appointmentId} style={{ borderBottom: i < todaysAppointments.length - 1 ? '1px solid var(--color-divider)' : 'none', verticalAlign: 'middle' }}>
                    <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 700, color: 'var(--color-primary)', whiteSpace: 'nowrap' }}>{fmtTime(a.scheduledAt)}</td>
                    <td style={{ padding: '12px 16px', overflow: 'hidden' }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.customerName || a.customerEmail}</div>
                      {a.customerName && <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.customerEmail}</div>}
                    </td>
                    <td style={{ padding: '12px 16px', overflow: 'hidden' }}>
                      <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.serviceName}</div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.vehicleSummary}</div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {a.promoCode ? (
                        <div>
                          <span style={{ fontFamily: 'monospace', fontSize: '11px', fontWeight: 700, display: 'inline-block', color: a.promoApplied ? 'var(--color-success)' : 'var(--color-text-primary)', backgroundColor: a.promoApplied ? 'rgba(34,197,94,0.08)' : 'rgba(245,158,11,0.08)', border: `1px solid ${a.promoApplied ? 'rgba(34,197,94,0.25)' : 'rgba(245,158,11,0.25)'}`, borderRadius: '4px', padding: '2px 6px', whiteSpace: 'nowrap' }}>{a.promoCode}</span>
                          <div style={{ fontSize: '11px', color: a.promoApplied ? 'var(--color-success)' : 'var(--color-text-muted)', marginTop: '2px' }}>{a.promoApplied ? '✓ Applied' : 'Not applied'}</div>
                        </div>
                      ) : <span style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>—</span>}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {isUpdating ? (
                        <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Updating…</span>
                      ) : opts ? (
                        <button
                          onClick={e => setStatusTarget({ appt: a, rect: e.currentTarget.getBoundingClientRect() })}
                          style={{ fontSize: '12px', fontWeight: 700, padding: '4px 10px', borderRadius: '100px', backgroundColor: st.bg, color: st.color, border: `1px solid ${st.border}`, cursor: 'pointer', textTransform: 'capitalize', whiteSpace: 'nowrap' }}
                        >
                          {statusLabel(a.status)} ▾
                        </button>
                      ) : (
                        <span style={{ fontSize: '12px', fontWeight: 700, padding: '4px 10px', borderRadius: '100px', backgroundColor: st.bg, color: st.color, border: `1px solid ${st.border}`, display: 'inline-block', textTransform: 'capitalize' }}>
                          {statusLabel(a.status)}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '8px 16px' }}>
                      {a.promoCode && !a.promoApplied ? (
                        <button onClick={() => setPendingPromo(a)} disabled={isUpdating} style={{ background: 'none', border: '1px solid rgba(245,158,11,0.4)', borderRadius: '6px', padding: '4px 9px', fontSize: '12px', cursor: 'pointer', color: '#D97706', fontWeight: 600, whiteSpace: 'nowrap' }}>
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
        )}
      </div>

      {/* Quick Navigation */}
      <div style={{ backgroundColor: 'var(--color-surface)', borderRadius: '12px', padding: '16px 20px', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--color-border)' }}>
        <h2 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '12px', marginTop: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Quick Navigation</h2>
        <div style={{ display: 'flex', gap: '12px' }}>
          {quickLinks.map(link => (
            <button key={link.to} onClick={() => navigate(link.to)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)', borderRadius: '10px', cursor: 'pointer', transition: 'background-color 0.15s', flex: 1, justifyContent: 'center' }} onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(15,32,68,0.05)')} onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'var(--color-background)')}>
              <span style={{ fontSize: '18px' }}>{link.icon}</span>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>{link.label}</span>
            </button>
          ))}
        </div>
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
          <div style={{ backgroundColor: 'var(--color-surface)', borderRadius: '16px', padding: '28px', width: '380px', maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '17px', fontWeight: 700, color: 'var(--color-text-primary)' }}>Cancel Appointment?</h3>
            <p style={{ margin: '0 0 20px', fontSize: '14px', color: 'var(--color-text-secondary)' }}>This will cancel "{pendingCancel.serviceName}" for {pendingCancel.customerName || pendingCancel.customerEmail}. This cannot be undone.</p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setPendingCancel(null)} style={{ padding: '9px 18px', borderRadius: '8px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', cursor: 'pointer', fontSize: '14px', color: 'var(--color-text-secondary)' }}>Keep it</button>
              <button onClick={() => void confirmCancel()} style={{ padding: '9px 18px', borderRadius: '8px', border: 'none', backgroundColor: 'var(--color-error)', color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>Cancel Appointment</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Apply Promo Dialog */}
      {pendingPromo && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'var(--color-surface)', borderRadius: '16px', padding: '28px', width: '380px', maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '17px', fontWeight: 700, color: 'var(--color-text-primary)' }}>Apply Promo Code</h3>
            <p style={{ margin: '0 0 20px', fontSize: '14px', color: 'var(--color-text-secondary)' }}>Mark code "{pendingPromo.promoCode}" as applied for {pendingPromo.customerName || pendingPromo.customerEmail}?</p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setPendingPromo(null)} style={{ padding: '9px 18px', borderRadius: '8px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', cursor: 'pointer', fontSize: '14px', color: 'var(--color-text-secondary)' }}>Cancel</button>
              <button onClick={() => void confirmAndApplyPromo()} style={{ padding: '9px 18px', borderRadius: '8px', border: 'none', backgroundColor: '#D97706', color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>🏷 Mark Applied</button>
            </div>
          </div>
        </div>
      )}

      {/* Error Dialog */}
      {errorDialog && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'var(--color-surface)', borderRadius: '16px', padding: '28px', width: '340px', maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '17px', fontWeight: 700, color: 'var(--color-error)' }}>Error</h3>
            <p style={{ margin: '0 0 20px', fontSize: '14px', color: 'var(--color-text-secondary)' }}>{errorDialog}</p>
            <button onClick={() => setErrorDialog(null)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: 'none', backgroundColor: 'var(--color-primary)', color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>OK</button>
          </div>
        </div>
      )}
    </div>
  );
}
