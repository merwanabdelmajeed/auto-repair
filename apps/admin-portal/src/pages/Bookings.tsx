import React, { useEffect, useState } from 'react';
import {
  listAppointments,
  updateAppointmentStatus,
  applyPromo,
  type Appointment,
  type AppointmentStatus,
} from '../api/appointments';
import { listCustomers, type Customer } from '../api/customers';
import { listVehicles, updateVehicle, type Vehicle } from '../api/vehicles';
import StatusPickerModal from '../components/StatusPickerModal';

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function todayLocalDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

type BookingsTab = AppointmentStatus | 'current' | 'past';

const STATUS_TABS: { label: string; value: BookingsTab }[] = [
  { label: 'Current', value: 'current' },
  { label: 'Past', value: 'past' },
  { label: 'Pending', value: 'pending' },
  { label: 'Confirmed', value: 'confirmed' },
  { label: 'In Progress', value: 'in-progress' },
  { label: 'Completed', value: 'completed' },
  { label: 'Cancelled', value: 'cancelled' },
];

const STATUS_STYLE: Record<AppointmentStatus, { bg: string; color: string; border: string }> = {
  pending:       { bg: 'rgba(245,158,11,0.1)', color: '#D97706', border: 'rgba(245,158,11,0.3)' },
  confirmed:     { bg: 'rgba(59,130,246,0.1)', color: '#2563EB', border: 'rgba(59,130,246,0.3)' },
  'in-progress': { bg: 'rgba(139,92,246,0.1)', color: '#7C3AED', border: 'rgba(139,92,246,0.3)' },
  completed:     { bg: 'rgba(34,197,94,0.1)', color: '#16A34A', border: 'rgba(34,197,94,0.3)' },
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

function fmt(iso: string) {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function Bookings() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [customerMap, setCustomerMap] = useState<Record<string, Customer>>({});
  const [vehicleMap, setVehicleMap] = useState<Record<string, Vehicle>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<BookingsTab>('current');
  const [searchTerm, setSearchTerm] = useState('');
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

  useEffect(() => { void load(); }, []);

  async function load() {
    try {
      setLoading(true);
      setError('');
      const [data, customers, vehicles] = await Promise.all([listAppointments(), listCustomers(), listVehicles()]);
      setAppointments(data);
      const map: Record<string, Customer> = {};
      customers.forEach(c => { map[c.userId] = c; });
      setCustomerMap(map);
      const vmap: Record<string, Vehicle> = {};
      vehicles.forEach(v => { vmap[v.vehicleId] = v; });
      setVehicleMap(vmap);
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
    if (!appt.promoId) return;
    setAppointments(prev => prev.map(a => a.appointmentId === appt.appointmentId ? { ...a, promoApplied: true } : a));
    setDetailAppt(prev => prev?.appointmentId === appt.appointmentId ? { ...prev, promoApplied: true } : prev);
    try {
      await applyPromo(appt.promoId, appt.customerId, appt.appointmentId);
    } catch (err: unknown) {
      setAppointments(prev => prev.map(a => a.appointmentId === appt.appointmentId ? { ...a, promoApplied: false } : a));
      setDetailAppt(prev => prev?.appointmentId === appt.appointmentId ? { ...prev, promoApplied: false } : prev);
      setErrorDialog(err instanceof Error ? err.message : 'Failed to apply promo.');
    }
  }

  const today = todayLocalDate();
  const currentAppts = appointments.filter(a => a.scheduledAt.slice(0, 10) >= today);
  const pastAppts = appointments.filter(a => a.scheduledAt.slice(0, 10) < today);

  function tabCount(tab: BookingsTab): number {
    if (tab === 'current') return currentAppts.length;
    if (tab === 'past') return pastAppts.length;
    return currentAppts.filter(a => a.status === tab).length;
  }

  function matchesSearch(appt: Appointment): boolean {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    const customer = customerMap[appt.customerId];
    return (
      appt.serviceName.toLowerCase().includes(q) ||
      (appt.customerName ?? '').toLowerCase().includes(q) ||
      appt.customerEmail.toLowerCase().includes(q) ||
      (appt.vehicleSummary ?? '').toLowerCase().includes(q) ||
      (customer?.phone ?? '').toLowerCase().includes(q)
    );
  }

  const base = activeTab === 'current' ? currentAppts
    : activeTab === 'past' ? pastAppts
    : currentAppts.filter(a => a.status === activeTab);

  const filtered = base
    .filter(matchesSearch)
    .slice()
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));

  return (
    <div style={{ maxWidth: '1200px' }}>
      {/* Toolbar: Tabs + Search */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center', flex: 1 }}>
          {STATUS_TABS.map(tab => {
            const count = tabCount(tab.value);
            const active = activeTab === tab.value;
            return (
              <button key={tab.value} onClick={() => setActiveTab(tab.value)} style={{ padding: '7px 14px', borderRadius: '100px', border: '1px solid', borderColor: active ? 'var(--color-primary)' : 'var(--color-border)', backgroundColor: active ? 'var(--color-primary)' : 'var(--color-surface)', color: active ? 'white' : 'var(--color-text-secondary)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                {tab.label}
                <span style={{ backgroundColor: active ? 'rgba(255,255,255,0.2)' : 'var(--color-background)', borderRadius: '100px', padding: '1px 7px', fontSize: '11px' }}>{count}</span>
              </button>
            );
          })}
        </div>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', fontSize: '14px', pointerEvents: 'none' }}>🔍</span>
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search service, customer, vehicle…"
            style={{ paddingLeft: '32px', paddingRight: '12px', paddingTop: '8px', paddingBottom: '8px', border: '1px solid var(--color-border)', borderRadius: '8px', fontSize: '13px', color: 'var(--color-text-primary)', backgroundColor: 'var(--color-surface)', width: '260px', outline: 'none' }}
          />
        </div>
      </div>

      {error && (
        <div style={{ backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', color: 'var(--color-error)', fontSize: '14px' }}>
          {error}
        </div>
      )}

      <div style={{ backgroundColor: 'var(--color-surface)', borderRadius: '12px', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
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
            {loading ? (
              <tr><td colSpan={7} style={{ padding: '60px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '14px' }}>Loading appointments…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: '60px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: '36px', marginBottom: '12px' }}>📋</div>
                <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
                  {activeTab === 'current' ? 'No upcoming appointments' : activeTab === 'past' ? 'No past appointments' : `No ${activeTab} appointments`}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Appointments appear here when customers book through the app.</div>
              </td></tr>
            ) : filtered.map((appt, i) => {
              const st = STATUS_STYLE[appt.status];
              const opts = VALID_NEXT[appt.status];
              const isUpdating = updating === appt.appointmentId;
              const isDetail = detailAppt?.appointmentId === appt.appointmentId;
              return (
                <tr
                  key={appt.appointmentId}
                  onClick={() => { setDetailAppt(prev => prev?.appointmentId === appt.appointmentId ? null : appt); setShowVehicleDetail(false); setEditingVehicle(false); setVehicleEditError(''); }}
                  style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--color-divider)' : 'none', verticalAlign: 'middle', cursor: 'pointer', backgroundColor: isDetail ? 'rgba(15,32,68,0.04)' : 'transparent', transition: 'background-color 0.1s' }}
                  onMouseEnter={e => { if (!isDetail) e.currentTarget.style.backgroundColor = 'rgba(15,32,68,0.025)'; }}
                  onMouseLeave={e => { if (!isDetail) e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <td style={{ padding: '14px 16px', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{appt.serviceName}</td>
                  <td style={{ padding: '14px 16px', overflow: 'hidden' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{appt.customerName || appt.customerEmail}</div>
                    {appt.customerName && <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{appt.customerEmail}</div>}
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: '13px', color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{appt.vehicleSummary}</td>
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
                  <td style={{ padding: '14px 16px' }} onClick={e => e.stopPropagation()}>
                    {isUpdating ? (
                      <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Updating…</span>
                    ) : opts ? (
                      <button
                        onClick={e => { e.stopPropagation(); setStatusTarget({ appt, rect: e.currentTarget.getBoundingClientRect() }); }}
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
                  <td style={{ padding: '10px 16px' }} onClick={e => e.stopPropagation()}>
                    {appt.promoCode && !appt.promoApplied ? (
                      <button onClick={() => setPendingPromo(appt)} disabled={isUpdating} style={{ background: 'none', border: '1px solid rgba(245,158,11,0.4)', borderRadius: '6px', padding: '5px 10px', fontSize: '12px', cursor: 'pointer', color: '#D97706', fontWeight: 600, whiteSpace: 'nowrap' }}>
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
        const customer = customerMap[a.customerId];
        return (
          <>
            <div onClick={() => setDetailAppt(null)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.25)', zIndex: 200 }} />
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
                    <span style={{ fontSize: '13px', color: 'var(--color-text-primary)' }}>{a.customerEmail}</span>
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
                    <span style={{ fontSize: '13px', color: 'var(--color-text-primary)' }}>{fmt(a.scheduledAt)}</span>
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
                    <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>Booked {fmt(a.createdAt)}</span>
                  </div>
                </div>

                {(opts || (a.promoCode && !a.promoApplied)) && (
                  <div style={{ display: 'flex', gap: '10px' }}>
                    {opts && (
                      <button
                        onClick={e => setStatusTarget({ appt: a, rect: e.currentTarget.getBoundingClientRect() })}
                        disabled={isUpdating}
                        style={{ flex: 1, padding: '10px', border: '1px solid var(--color-border)', borderRadius: '8px', backgroundColor: 'var(--color-background)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', color: 'var(--color-primary)' }}
                      >
                        {isUpdating ? 'Updating…' : '⇄ Change Status'}
                      </button>
                    )}
                    {a.promoCode && !a.promoApplied && !isUpdating && (
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
          <div style={{ backgroundColor: 'var(--color-surface)', borderRadius: '16px', padding: '28px', width: '400px', maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '17px', fontWeight: 700, color: 'var(--color-text-primary)' }}>Cancel Appointment?</h3>
            <p style={{ margin: '0 0 24px', fontSize: '14px', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>Cancel "{pendingCancel.serviceName}" for {pendingCancel.customerName || pendingCancel.customerEmail}? This cannot be undone.</p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => setPendingCancel(null)} style={{ padding: '9px 20px', border: '1px solid var(--color-border)', borderRadius: '8px', backgroundColor: 'transparent', fontSize: '14px', fontWeight: 600, color: 'var(--color-text-secondary)', cursor: 'pointer' }}>Keep it</button>
              <button onClick={() => void confirmCancel()} style={{ padding: '9px 20px', border: 'none', borderRadius: '8px', backgroundColor: 'var(--color-error)', color: 'white', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}>Cancel Appointment</button>
            </div>
          </div>
        </div>
      )}
      {pendingPromo && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }}>
          <div style={{ backgroundColor: 'var(--color-surface)', borderRadius: '16px', padding: '28px', width: '400px', maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '17px', fontWeight: 700, color: 'var(--color-text-primary)' }}>Apply Promo Code?</h3>
            <p style={{ margin: '0 0 24px', fontSize: '14px', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>Mark <strong>{pendingPromo.promoCode}</strong> as applied for {pendingPromo.customerName || pendingPromo.customerEmail}?</p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => setPendingPromo(null)} style={{ padding: '9px 20px', border: '1px solid var(--color-border)', borderRadius: '8px', backgroundColor: 'transparent', fontSize: '14px', fontWeight: 600, color: 'var(--color-text-secondary)', cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => void confirmAndApplyPromo()} style={{ padding: '9px 20px', border: 'none', borderRadius: '8px', backgroundColor: '#D97706', color: 'white', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}>Mark Applied</button>
            </div>
          </div>
        </div>
      )}
      {errorDialog && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }}>
          <div style={{ backgroundColor: 'var(--color-surface)', borderRadius: '16px', padding: '28px', width: '400px', maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '17px', fontWeight: 700, color: 'var(--color-text-primary)' }}>Error</h3>
            <p style={{ margin: '0 0 24px', fontSize: '14px', color: 'var(--color-text-secondary)' }}>{errorDialog}</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setErrorDialog(null)} style={{ padding: '9px 24px', border: 'none', borderRadius: '8px', backgroundColor: 'var(--color-primary)', color: 'white', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}>OK</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
