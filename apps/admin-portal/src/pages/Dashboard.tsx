import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDashboardSummary, type DashboardSummary } from '../api/dashboard';
import { listAppointments, updateAppointmentStatus, applyPromo, type Appointment, type AppointmentStatus } from '../api/appointments';
import { listCustomers, type Customer } from '../api/customers';
import { listVehicles, updateVehicle, type Vehicle } from '../api/vehicles';
import StatusPickerModal from '../components/StatusPickerModal';
import { VALID_NEXT } from '../utils/appointmentTransitions';
import { fetchAllPages } from '../utils/fetchAllPages';

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const STATUS_STYLE: Record<AppointmentStatus, { bg: string; color: string; border: string }> = {
  pending:       { bg: 'rgba(245,158,11,0.1)',  color: '#D97706', border: 'rgba(245,158,11,0.3)' },
  confirmed:     { bg: 'rgba(37,99,235,0.1)',   color: '#2563EB', border: 'rgba(37,99,235,0.3)' },
  'in-progress': { bg: 'rgba(139,92,246,0.1)',  color: '#7C3AED', border: 'rgba(139,92,246,0.3)' },
  completed:     { bg: 'rgba(34,197,94,0.1)',   color: '#16A34A', border: 'rgba(34,197,94,0.3)' },
  cancelled:     { bg: 'rgba(148,163,184,0.1)', color: '#64748B', border: 'rgba(148,163,184,0.3)' },
};


function statusLabel(s: AppointmentStatus) {
  return s === 'in-progress' ? 'In Progress' : s.charAt(0).toUpperCase() + s.slice(1);
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function todayLocalDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [todaysAppointments, setTodaysAppointments] = useState<Appointment[]>([]);
  const [customerMap, setCustomerMap] = useState<Record<string, Customer>>({});
  const [vehicleMap, setVehicleMap] = useState<Record<string, Vehicle>>({});
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [statusTarget, setStatusTarget] = useState<{ appt: Appointment; rect: DOMRect } | null>(null);
  const [pendingCancel, setPendingCancel] = useState<Appointment | null>(null);
  const [pendingPromo, setPendingPromo] = useState<Appointment | null>(null);
  const [errorDialog, setErrorDialog] = useState<string | null>(null);
  const [detailAppt, setDetailAppt] = useState<Appointment | null>(null);
  const [showVehicleDetail, setShowVehicleDetail] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(false);
  const [editPlate, setEditPlate] = useState('');
  const [editVin, setEditVin] = useState('');
  const [savingVehicle, setSavingVehicle] = useState(false);
  const [vehicleEditError, setVehicleEditError] = useState('');
  const [dashSearch, setDashSearch] = useState('');

  useEffect(() => {
    const today = todayLocalDate();
    Promise.all([
      getDashboardSummary().catch(() => null),
      fetchAllPages(cursor => listAppointments(cursor)).catch(() => [] as Appointment[]),
      fetchAllPages(cursor => listCustomers(cursor)).catch(() => [] as Customer[]),
      fetchAllPages(cursor => listVehicles(cursor)).catch(() => [] as Vehicle[]),
    ]).then(([sum, appts, customers, vehicles]) => {
      setSummary(sum);
      setTodaysAppointments(
        appts
          .filter(a => a.scheduledAt.startsWith(today))
          .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt)),
      );
      const map: Record<string, Customer> = {};
      customers.forEach(c => { map[c.userId] = c; });
      setCustomerMap(map);
      const vmap: Record<string, Vehicle> = {};
      vehicles.forEach(v => { vmap[v.vehicleId] = v; });
      setVehicleMap(vmap);
    }).finally(() => setLoading(false));
  }, []);

  async function handleStatusUpdate(appt: Appointment, status: AppointmentStatus) {
    setUpdating(appt.appointmentId);
    try {
      await updateAppointmentStatus(appt.appointmentId, status);
      setTodaysAppointments(prev => prev.map(a => a.appointmentId === appt.appointmentId ? { ...a, status } : a));
      setDetailAppt(prev => prev?.appointmentId === appt.appointmentId ? { ...prev, status } : prev);
    } catch {
      setErrorDialog('Failed to update status.');
    } finally {
      setUpdating(null);
    }
  }

  function handleStatusSelect(status: AppointmentStatus) {
    if (!statusTarget) return;
    const appt = statusTarget.appt;
    setStatusTarget(null);
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
    if (!appt.promoId || !appt.customerId) return;
    setTodaysAppointments(prev => prev.map(a => a.appointmentId === appt.appointmentId ? { ...a, promoApplied: true } : a));
    setDetailAppt(prev => prev?.appointmentId === appt.appointmentId ? { ...prev, promoApplied: true } : prev);
    try {
      await applyPromo(appt.promoId, appt.customerId, appt.appointmentId);
    } catch (err: unknown) {
      setTodaysAppointments(prev => prev.map(a => a.appointmentId === appt.appointmentId ? { ...a, promoApplied: false } : a));
      setDetailAppt(prev => prev?.appointmentId === appt.appointmentId ? { ...prev, promoApplied: false } : prev);
      setErrorDialog(err instanceof Error ? err.message : 'Failed to apply promo.');
    }
  }

  const kpis = [
    { label: "Today's Bookings", value: loading ? '—' : String(summary?.bookingsToday ?? 0), icon: '📅', color: '#0F2044', bg: 'rgba(15,32,68,0.08)', clickable: false },
    { label: 'Total Customers',    value: loading ? '—' : String(summary?.totalCustomers ?? 0), icon: '👥', color: '#8B5CF6', bg: 'rgba(139,92,246,0.08)', to: '/customers', clickable: true },
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
            <div style={{ width: '44px', height: '44px', borderRadius: '10px', backgroundColor: card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', marginBottom: '12px' }}>{card.icon}</div>
            <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--color-text-primary)', lineHeight: 1 }}>{card.value}</div>
            <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginTop: '6px' }}>{card.label}</div>
            {card.clickable && <span style={{ position: 'absolute', top: '16px', right: '16px', fontSize: '16px', color: 'var(--color-text-muted)' }}>›</span>}
          </div>
        ))}
      </div>

      {/* Today's Bookings */}
      <div style={{ backgroundColor: 'var(--color-surface)', borderRadius: '12px', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--color-border)', overflow: 'hidden', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '14px 20px', borderBottom: '1px solid var(--color-border)', flexWrap: 'wrap' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0, flexShrink: 0 }}>Today's Bookings</h2>
          <div style={{ position: 'relative', flex: 1, minWidth: '180px', maxWidth: '280px' }}>
            <span style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', fontSize: '13px', pointerEvents: 'none' }}>🔍</span>
            <input
              type="text"
              value={dashSearch}
              onChange={e => setDashSearch(e.target.value)}
              placeholder="Search…"
              style={{ width: '100%', paddingLeft: '28px', paddingRight: '10px', paddingTop: '7px', paddingBottom: '7px', border: '1px solid var(--color-border)', borderRadius: '7px', fontSize: '13px', color: 'var(--color-text-primary)', backgroundColor: 'var(--color-background)', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <button onClick={() => navigate('/bookings')} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontWeight: 600, fontSize: '13px', cursor: 'pointer', padding: '4px 8px', borderRadius: '6px', flexShrink: 0 }}>
            See all →
          </button>
        </div>
        {(() => {
          const dashFiltered = dashSearch.trim()
            ? todaysAppointments.filter(a => {
                const q = dashSearch.toLowerCase();
                const customer = a.customerId ? customerMap[a.customerId] : undefined;
                return (
                  a.serviceName.toLowerCase().includes(q) ||
                  (a.customerName ?? '').toLowerCase().includes(q) ||
                  (a.customerEmail ?? '').toLowerCase().includes(q) ||
                  (a.vehicleSummary ?? '').toLowerCase().includes(q) ||
                  (customer?.phone ?? '').toLowerCase().includes(q)
                );
              })
            : todaysAppointments;
          return loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '14px' }}>Loading…</div>
          ) : dashFiltered.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center' }}>
            <div style={{ fontSize: '32px', marginBottom: '10px' }}>📅</div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>No bookings today</div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '16%' }} />
              <col style={{ width: '16%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '16%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '11%' }} />
              <col style={{ width: '17%' }} />
            </colgroup>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)' }}>
                {['Service', 'Customer', 'Vehicle', 'Scheduled', 'Promo', 'Status', 'Actions'].map(col => (
                  <th key={col} style={{ textAlign: 'left', padding: '13px 16px', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dashFiltered.map((a, i) => {
                const st = STATUS_STYLE[a.status];
                const opts = VALID_NEXT[a.status];
                const isUpdating = updating === a.appointmentId;
                const isDetail = detailAppt?.appointmentId === a.appointmentId;
                return (
                  <tr
                    key={a.appointmentId}
                    onClick={() => { setDetailAppt(prev => prev?.appointmentId === a.appointmentId ? null : a); setShowVehicleDetail(false); setEditingVehicle(false); setVehicleEditError(''); }}
                    style={{ borderBottom: i < dashFiltered.length - 1 ? '1px solid var(--color-divider)' : 'none', verticalAlign: 'middle', cursor: 'pointer', backgroundColor: isDetail ? 'rgba(15,32,68,0.04)' : 'transparent', transition: 'background-color 0.1s' }}
                    onMouseEnter={e => { if (!isDetail) e.currentTarget.style.backgroundColor = 'rgba(15,32,68,0.025)'; }}
                    onMouseLeave={e => { if (!isDetail) e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    <td style={{ padding: '14px 16px', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.serviceName}</td>
                    <td style={{ padding: '14px 16px', overflow: 'hidden' }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.customerName || a.customerEmail}</div>
                      {a.customerName && <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.customerEmail}</div>}
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '13px', color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.vehicleSummary}</td>
                    <td style={{ padding: '14px 16px', fontSize: '13px', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>{fmtDateTime(a.scheduledAt)}</td>
                    <td style={{ padding: '14px 16px' }}>
                      {a.promoCode ? (
                        <div>
                          <span style={{ fontFamily: 'monospace', fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap', display: 'inline-block', color: a.promoApplied ? 'var(--color-success)' : 'var(--color-text-primary)', backgroundColor: a.promoApplied ? 'rgba(34,197,94,0.08)' : 'rgba(245,158,11,0.08)', border: `1px solid ${a.promoApplied ? 'rgba(34,197,94,0.25)' : 'rgba(245,158,11,0.25)'}`, borderRadius: '4px', padding: '2px 6px' }}>
                            {a.promoCode}
                          </span>
                          <div style={{ fontSize: '11px', color: a.promoApplied ? 'var(--color-success)' : 'var(--color-text-muted)', marginTop: '3px', whiteSpace: 'nowrap' }}>
                            {a.promoApplied ? '✓ Applied' : 'Not applied'}
                          </div>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '14px 16px' }} onClick={e => e.stopPropagation()}>
                      {isUpdating ? (
                        <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Updating…</span>
                      ) : opts && a.customerId ? (
                        <button
                          onClick={e => { e.stopPropagation(); setStatusTarget({ appt: a, rect: e.currentTarget.getBoundingClientRect() }); }}
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
                    <td style={{ padding: '10px 16px' }} onClick={e => e.stopPropagation()}>
                      {a.promoCode && a.customerId && !a.promoApplied ? (
                        <button onClick={() => setPendingPromo(a)} disabled={isUpdating} style={{ background: 'none', border: '1px solid rgba(245,158,11,0.4)', borderRadius: '6px', padding: '5px 10px', fontSize: '12px', cursor: 'pointer', color: '#D97706', fontWeight: 600, whiteSpace: 'nowrap' }}>
                          🏷 Apply
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
        );
        })()}
      </div>

      {/* Quick Navigation */}
      <div style={{ backgroundColor: 'var(--color-surface)', borderRadius: '12px', padding: '16px 20px', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--color-border)' }}>
        <h2 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '12px', marginTop: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Quick Navigation</h2>
        <div style={{ display: 'flex', gap: '12px' }}>
          {quickLinks.map(link => (
            <button key={link.to} onClick={() => navigate(link.to)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)', borderRadius: '10px', cursor: 'pointer', flex: 1, justifyContent: 'center' }} onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(15,32,68,0.05)')} onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'var(--color-background)')}>
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

      {/* Detail Panel */}
      {detailAppt && (() => {
        const a = detailAppt;
        const st = STATUS_STYLE[a.status];
        const opts = VALID_NEXT[a.status];
        const isUpdating = updating === a.appointmentId;
        const customer = a.customerId ? customerMap[a.customerId] : undefined;
        return (
          <>
            <div onClick={() => setDetailAppt(null)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.3)', zIndex: 200 }} />
            <div style={{ position: 'fixed', right: 0, top: 0, bottom: 0, width: '400px', backgroundColor: 'var(--color-surface)', boxShadow: '-4px 0 24px rgba(0,0,0,0.18)', zIndex: 201, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '20px 20px 16px', borderBottom: '1px solid var(--color-border)' }}>
                <div style={{ flex: 1, marginRight: '12px' }}>
                  <div style={{ fontSize: '17px', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '6px' }}>{a.serviceName}</div>
                  <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 9px', borderRadius: '100px', backgroundColor: st.bg, color: st.color, border: `1px solid ${st.border}` }}>{statusLabel(a.status)}</span>
                </div>
                <button onClick={() => setDetailAppt(null)} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: 'var(--color-text-muted)', lineHeight: 1, padding: '2px' }}>✕</button>
              </div>

              <div style={{ padding: '16px 20px', flex: 1 }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Customer</div>
                <div style={{ backgroundColor: 'var(--color-background)', borderRadius: '10px', border: '1px solid var(--color-border)', marginBottom: '16px', overflow: 'hidden' }}>
                  {a.customerName && (
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', padding: '11px 14px', borderBottom: '1px solid var(--color-divider)' }}>
                      <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>👤</span>
                      <span style={{ fontSize: '13px', color: 'var(--color-text-primary)', fontWeight: 600 }}>{a.customerName}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', padding: '11px 14px', borderBottom: '1px solid var(--color-divider)' }}>
                    <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>✉️</span>
                    <span style={{ fontSize: '13px', color: 'var(--color-text-primary)' }}>{a.customerEmail || '—'}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', padding: '11px 14px' }}>
                    <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>📞</span>
                    <span style={{ fontSize: '13px', color: customer?.phone ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}>{customer?.phone ?? '—'}</span>
                  </div>
                </div>

                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Appointment</div>
                <div style={{ backgroundColor: 'var(--color-background)', borderRadius: '10px', border: '1px solid var(--color-border)', marginBottom: '16px', overflow: 'hidden' }}>
                  <div onClick={() => setShowVehicleDetail(v => !v)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: '1px solid var(--color-divider)', cursor: 'pointer' }} onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(15,32,68,0.04)')} onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '14px', color: 'var(--color-primary)' }}>🚗</span>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)' }}>{a.vehicleSummary}</span>
                    </div>
                    <span style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>{showVehicleDetail ? '∨' : '›'}</span>
                  </div>
                  {showVehicleDetail && vehicleMap[a.vehicleId] && (() => {
                    const veh = vehicleMap[a.vehicleId];
                    const inlineInput: React.CSSProperties = { flex: 1, border: '1px solid var(--color-primary)', borderRadius: '5px', padding: '4px 8px', fontSize: '13px', fontFamily: 'monospace', color: 'var(--color-text-primary)', backgroundColor: 'var(--color-surface)', outline: 'none' };
                    return (
                      <div style={{ padding: '10px 14px 12px', borderBottom: '1px solid var(--color-divider)', backgroundColor: 'rgba(15,32,68,0.02)', display: 'flex', flexDirection: 'column', gap: '7px' }}>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                          <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', width: '52px', flexShrink: 0 }}>Plate</span>
                          {editingVehicle
                            ? <input style={inlineInput} value={editPlate} onChange={e => setEditPlate(e.target.value.toUpperCase())} placeholder="e.g. ABC1234" />
                            : <span style={{ fontSize: '13px', fontWeight: veh.licensePlate ? 700 : 400, color: veh.licensePlate ? 'var(--color-text-primary)' : 'var(--color-text-muted)', fontFamily: 'monospace' }}>{veh.licensePlate ?? '—'}</span>}
                        </div>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                          <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', width: '52px', flexShrink: 0 }}>Color</span>
                          <span style={{ fontSize: '13px', color: 'var(--color-text-primary)' }}>{veh.color}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                          <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', width: '52px', flexShrink: 0 }}>VIN</span>
                          {editingVehicle
                            ? <input style={inlineInput} value={editVin} onChange={e => setEditVin(e.target.value.toUpperCase())} placeholder="17-char VIN" />
                            : <span style={{ fontSize: '13px', color: veh.vin ? 'var(--color-text-secondary)' : 'var(--color-text-muted)', fontFamily: 'monospace' }}>{veh.vin ?? '—'}</span>}
                        </div>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                          <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', width: '52px', flexShrink: 0 }}>Added</span>
                          <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{fmtDate(veh.createdAt)}</span>
                        </div>
                        {vehicleEditError && <span style={{ fontSize: '12px', color: 'var(--color-error)' }}>{vehicleEditError}</span>}
                        {editingVehicle ? (
                          <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                            <button
                              onClick={async () => {
                                setSavingVehicle(true); setVehicleEditError('');
                                try {
                                  const updated = await updateVehicle(veh.vehicleId, { licensePlate: editPlate.trim() || null, vin: editVin.trim() || null });
                                  setVehicleMap(prev => ({ ...prev, [veh.vehicleId]: { ...veh, ...updated } }));
                                  setEditingVehicle(false);
                                } catch { setVehicleEditError('Failed to save.'); }
                                finally { setSavingVehicle(false); }
                              }}
                              disabled={savingVehicle}
                              style={{ flex: 1, padding: '6px', borderRadius: '6px', border: 'none', backgroundColor: 'var(--color-primary)', color: 'white', fontSize: '12px', fontWeight: 700, cursor: 'pointer', opacity: savingVehicle ? 0.6 : 1 }}
                            >
                              {savingVehicle ? 'Saving…' : 'Save'}
                            </button>
                            <button onClick={() => { setEditingVehicle(false); setVehicleEditError(''); }} style={{ flex: 1, padding: '6px', borderRadius: '6px', border: '1px solid var(--color-border)', backgroundColor: 'transparent', fontSize: '12px', fontWeight: 600, cursor: 'pointer', color: 'var(--color-text-secondary)' }}>
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => { setEditPlate(veh.licensePlate ?? ''); setEditVin(veh.vin ?? ''); setEditingVehicle(true); setVehicleEditError(''); }} style={{ alignSelf: 'flex-start', marginTop: '4px', padding: '5px 12px', borderRadius: '6px', border: '1px solid rgba(15,32,68,0.3)', backgroundColor: 'transparent', fontSize: '12px', fontWeight: 700, cursor: 'pointer', color: 'var(--color-primary)' }}>
                            ✏️ Edit Plate / VIN
                          </button>
                        )}
                      </div>
                    );
                  })()}
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', padding: '11px 14px', borderBottom: '1px solid var(--color-divider)' }}>
                    <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>🕐</span>
                    <span style={{ fontSize: '13px', color: 'var(--color-text-primary)' }}>{fmtDateTime(a.scheduledAt)}</span>
                  </div>
                  {a.notes && (
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '11px 14px', borderBottom: '1px solid var(--color-divider)' }}>
                      <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>📝</span>
                      <span style={{ fontSize: '13px', color: 'var(--color-text-primary)', lineHeight: 1.4 }}>{a.notes}</span>
                    </div>
                  )}
                  {a.promoCode && (
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', padding: '11px 14px', borderBottom: '1px solid var(--color-divider)' }}>
                      <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>🏷</span>
                      <span style={{ fontSize: '13px', color: a.promoApplied ? 'var(--color-success)' : 'var(--color-text-primary)', fontFamily: 'monospace' }}>
                        {a.promoCode}{a.promoApplied ? ' ✓ Applied' : ' — not yet applied'}
                      </span>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', padding: '11px 14px' }}>
                    <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>🧾</span>
                    <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>Booked {fmtDateTime(a.createdAt)}</span>
                  </div>
                </div>

                {!a.customerId && (
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '10px 12px', borderRadius: '8px', backgroundColor: 'var(--color-background)', marginBottom: '10px' }}>
                    <span style={{ fontSize: '13px' }}>🔒</span>
                    <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>This customer's account was deleted — status is locked.</span>
                  </div>
                )}
                {((opts && a.customerId) || (a.promoCode && a.customerId && !a.promoApplied)) && (
                  <div style={{ display: 'flex', gap: '10px' }}>
                    {opts && a.customerId && (
                      <button
                        onClick={e => setStatusTarget({ appt: a, rect: e.currentTarget.getBoundingClientRect() })}
                        disabled={isUpdating}
                        style={{ flex: 1, padding: '10px', border: '1px solid var(--color-border)', borderRadius: '8px', backgroundColor: 'var(--color-background)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                      >
                        {isUpdating ? 'Updating…' : '⇄ Change Status'}
                      </button>
                    )}
                    {a.promoCode && a.customerId && !a.promoApplied && !isUpdating && (
                      <button
                        onClick={() => setPendingPromo(a)}
                        style={{ flex: 1, padding: '10px', border: '1px solid rgba(245,158,11,0.4)', borderRadius: '8px', backgroundColor: 'rgba(245,158,11,0.06)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', color: '#D97706' }}
                      >
                        🏷 Apply Promo
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        );
      })()}

      {pendingCancel && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }}>
          <div style={{ backgroundColor: 'var(--color-surface)', borderRadius: '16px', padding: '28px', width: '380px', maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '17px', fontWeight: 700, color: 'var(--color-text-primary)' }}>Cancel Appointment?</h3>
            <p style={{ margin: '0 0 20px', fontSize: '14px', color: 'var(--color-text-secondary)' }}>Cancel "{pendingCancel.serviceName}" for {pendingCancel.customerName || pendingCancel.customerEmail}? This cannot be undone.</p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setPendingCancel(null)} style={{ padding: '9px 18px', borderRadius: '8px', border: '1px solid var(--color-border)', backgroundColor: 'transparent', cursor: 'pointer', fontSize: '14px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Keep it</button>
              <button onClick={() => void confirmCancel()} style={{ padding: '9px 18px', borderRadius: '8px', border: 'none', backgroundColor: 'var(--color-error)', color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>Cancel Appointment</button>
            </div>
          </div>
        </div>
      )}

      {pendingPromo && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }}>
          <div style={{ backgroundColor: 'var(--color-surface)', borderRadius: '16px', padding: '28px', width: '380px', maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '17px', fontWeight: 700, color: 'var(--color-text-primary)' }}>Apply Promo Code</h3>
            <p style={{ margin: '0 0 20px', fontSize: '14px', color: 'var(--color-text-secondary)' }}>Mark "{pendingPromo.promoCode}" as applied for {pendingPromo.customerName || pendingPromo.customerEmail}?</p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setPendingPromo(null)} style={{ padding: '9px 18px', borderRadius: '8px', border: '1px solid var(--color-border)', backgroundColor: 'transparent', cursor: 'pointer', fontSize: '14px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Cancel</button>
              <button onClick={() => void confirmAndApplyPromo()} style={{ padding: '9px 18px', borderRadius: '8px', border: 'none', backgroundColor: '#D97706', color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>🏷 Mark Applied</button>
            </div>
          </div>
        </div>
      )}

      {errorDialog && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }}>
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
