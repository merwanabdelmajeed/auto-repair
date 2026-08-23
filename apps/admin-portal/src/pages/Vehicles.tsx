import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { listVehicles, updateVehicle, type Vehicle } from '../api/vehicles';
import { listCustomers, type Customer } from '../api/customers';
import { listAppointments, type Appointment } from '../api/appointments';
import { fetchAllPages } from '../utils/fetchAllPages';

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const HISTORY_STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  pending: { bg: 'rgba(245,158,11,0.1)', color: '#D97706' },
  confirmed: { bg: 'rgba(59,130,246,0.1)', color: '#2563EB' },
  'in-progress': { bg: 'rgba(139,92,246,0.1)', color: '#7C3AED' },
  completed: { bg: 'rgba(16,185,129,0.1)', color: '#059669' },
  cancelled: { bg: 'rgba(107,114,128,0.1)', color: '#4B5563' },
};

function displayName(c: Customer) {
  if (c.firstName || c.lastName) return `${c.firstName} ${c.lastName}`.trim();
  return c.email;
}

function initials(c: Customer) {
  if (c.firstName || c.lastName) return `${c.firstName?.[0] ?? ''}${c.lastName?.[0] ?? ''}`.toUpperCase();
  return c.email[0].toUpperCase();
}

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', border: '1px solid var(--color-primary)',
  borderRadius: '6px', padding: '7px 10px', fontSize: '13px',
  color: 'var(--color-text-primary)', backgroundColor: 'var(--color-surface)', outline: 'none',
};

export default function Vehicles() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const customerIdFilter = searchParams.get('customerId');
  const vehicleIdParam = searchParams.get('vehicleId');

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [customerMap, setCustomerMap] = useState<Record<string, Customer>>({});
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [detailVehicle, setDetailVehicle] = useState<Vehicle | null>(null);

  // inline edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editPlate, setEditPlate] = useState('');
  const [editVin, setEditVin] = useState('');
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState('');

  useEffect(() => { void load(); }, []);

  useEffect(() => {
    if (vehicleIdParam && vehicles.length > 0) {
      const match = vehicles.find(v => v.vehicleId === vehicleIdParam);
      if (match) openDetail(match);
    }
  }, [vehicleIdParam, vehicles]);

  async function load() {
    try {
      setLoading(true);
      setError('');
      const [v, c, a] = await Promise.all([
        fetchAllPages(cursor => listVehicles(cursor)),
        fetchAllPages(cursor => listCustomers(cursor)),
        fetchAllPages(cursor => listAppointments(cursor)),
      ]);
      setVehicles(v);
      const map: Record<string, Customer> = {};
      c.forEach(cu => { map[cu.userId] = cu; });
      setCustomerMap(map);
      setAppointments(a);
    } catch {
      setError('Failed to load vehicles.');
    } finally {
      setLoading(false);
    }
  }

  function openDetail(v: Vehicle) {
    setDetailVehicle(v);
    setIsEditing(false);
    setEditError('');
  }

  function startEdit() {
    if (!detailVehicle) return;
    setEditPlate(detailVehicle.licensePlate ?? '');
    setEditVin(detailVehicle.vin ?? '');
    setEditError('');
    setIsEditing(true);
  }

  function cancelEdit() {
    setIsEditing(false);
    setEditError('');
  }

  async function saveEdit() {
    if (!detailVehicle) return;
    setSaving(true);
    setEditError('');
    try {
      const updated = await updateVehicle(detailVehicle.vehicleId, {
        licensePlate: editPlate.trim() || null,
        vin: editVin.trim() || null,
      });
      const merged = { ...detailVehicle, ...updated };
      setVehicles(prev => prev.map(v => v.vehicleId === detailVehicle.vehicleId ? merged : v));
      setDetailVehicle(merged);
      setIsEditing(false);
    } catch {
      setEditError('Failed to save changes.');
    } finally {
      setSaving(false);
    }
  }

  const filtered = vehicles
    .filter(v => !customerIdFilter || v.customerId === customerIdFilter)
    .filter(v => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        `${v.year} ${v.make} ${v.model}${v.trim ? ' ' + v.trim : ''}`.toLowerCase().includes(q) ||
        (v.licensePlate ?? '').toLowerCase().includes(q) ||
        (v.vin ?? '').toLowerCase().includes(q)
      );
    });

  const filterCustomer = customerIdFilter ? customerMap[customerIdFilter] : null;

  // Filtered by vehicleId, not customerId, so history still shows even for a
  // vehicle whose owning customer account has since been deleted.
  const detailVehicleHistory = detailVehicle
    ? appointments
        .filter(a => a.vehicleId === detailVehicle.vehicleId)
        .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime())
    : [];

  return (
    <div style={{ maxWidth: '1100px' }}>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '10px', padding: '10px 14px', boxShadow: 'var(--shadow-sm)' }}>
          <span>🔍</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by make, model, plate, or VIN…"
            style={{ border: 'none', outline: 'none', backgroundColor: 'transparent', fontSize: '14px', color: 'var(--color-text-primary)', width: '100%' }}
          />
        </div>
        <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
          {loading ? '…' : `${filtered.length} vehicle${filtered.length !== 1 ? 's' : ''}`}
        </div>
      </div>

      {filterCustomer && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: 'rgba(15,32,68,0.06)', border: '1px solid var(--color-border)', borderRadius: '10px', padding: '10px 16px', marginBottom: '16px', fontSize: '13px' }}>
          <span>👤</span>
          <span style={{ color: 'var(--color-text-secondary)' }}>
            Showing vehicles for <strong style={{ color: 'var(--color-text-primary)' }}>{displayName(filterCustomer)}</strong>
          </span>
          <button onClick={() => setSearchParams({})} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--color-primary)', fontWeight: 700, fontSize: '13px', cursor: 'pointer', padding: '2px 6px' }}>
            Show all
          </button>
        </div>
      )}

      {error && (
        <div style={{ backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', color: 'var(--color-error)', fontSize: '14px' }}>
          {error}
        </div>
      )}

      <div style={{ backgroundColor: 'var(--color-surface)', borderRadius: '12px', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)' }}>
              {['Vehicle', 'Owner', 'License Plate', 'Color', 'VIN', 'Added'].map(col => (
                <th key={col} style={{ textAlign: 'left', padding: '13px 16px', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ padding: '60px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '14px' }}>Loading vehicles…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: '80px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: '40px', marginBottom: '16px' }}>🚗</div>
                <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
                  {search ? 'No vehicles match your search' : filterCustomer ? 'This customer has no registered vehicles' : 'No vehicles registered yet'}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Vehicles are added by customers through the customer app.</div>
              </td></tr>
            ) : filtered.map((v, i) => {
              const owner = customerMap[v.customerId];
              const isDetail = detailVehicle?.vehicleId === v.vehicleId;
              return (
                <tr
                  key={v.vehicleId}
                  onClick={() => openDetail(v)}
                  style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--color-divider)' : 'none', cursor: 'pointer', backgroundColor: isDetail ? 'rgba(15,32,68,0.04)' : 'transparent', transition: 'background-color 0.1s' }}
                  onMouseEnter={e => { if (!isDetail) e.currentTarget.style.backgroundColor = 'rgba(15,32,68,0.025)'; }}
                  onMouseLeave={e => { if (!isDetail) e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)' }}>{v.year} {v.make} {v.model}{v.trim ? ' ' + v.trim : ''}</div>
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                    {owner ? displayName(owner) : <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    {v.licensePlate
                      ? <span style={{ fontSize: '12px', fontWeight: 700, padding: '3px 10px', borderRadius: '4px', backgroundColor: 'var(--color-primary)', color: 'white', letterSpacing: '1px' }}>{v.licensePlate}</span>
                      : <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>—</span>}
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>{v.color}</td>
                  <td style={{ padding: '14px 16px', fontSize: '12px', color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>{v.vin || '—'}</td>
                  <td style={{ padding: '14px 16px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>{fmtDate(v.createdAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Detail Panel */}
      {detailVehicle && (() => {
        const v = detailVehicle;
        const owner = customerMap[v.customerId];
        return (
          <>
            <div onClick={() => { setDetailVehicle(null); setIsEditing(false); }} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.25)', zIndex: 200 }} />
            <div style={{ position: 'fixed', right: 0, top: 0, bottom: 0, width: '400px', backgroundColor: 'var(--color-surface)', boxShadow: '-4px 0 24px rgba(0,0,0,0.18)', zIndex: 201, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 20px 16px', borderBottom: '1px solid var(--color-border)' }}>
                <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-text-primary)' }}>Vehicle Details</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {!isEditing && (
                    <button
                      onClick={startEdit}
                      style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'none', border: '1px solid var(--color-border)', borderRadius: '6px', padding: '5px 10px', fontSize: '12px', cursor: 'pointer', color: 'var(--color-primary)', fontWeight: 600 }}
                    >
                      ✏️ Edit Plate / VIN
                    </button>
                  )}
                  <button onClick={() => { setDetailVehicle(null); setIsEditing(false); }} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: 'var(--color-text-muted)', lineHeight: 1 }}>✕</button>
                </div>
              </div>

              <div style={{ padding: '20px' }}>
                {/* Vehicle header */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '20px' }}>
                  <div style={{ width: '72px', height: '72px', borderRadius: '16px', backgroundColor: 'rgba(15,32,68,0.08)', border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', marginBottom: '10px' }}>
                    🚗
                  </div>
                  <div style={{ fontSize: '17px', fontWeight: 700, color: 'var(--color-text-primary)', textAlign: 'center' }}>
                    {v.year} {v.make} {v.model}{v.trim ? ' ' + v.trim : ''}
                  </div>
                </div>

                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Details</div>
                <div style={{ backgroundColor: 'var(--color-background)', borderRadius: '10px', border: '1px solid var(--color-border)', marginBottom: '16px', overflow: 'hidden' }}>
                  {/* License Plate */}
                  {isEditing ? (
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', padding: '9px 14px', borderBottom: '1px solid var(--color-divider)' }}>
                      <span style={{ fontSize: '13px', color: 'var(--color-text-muted)', flexShrink: 0 }}>🪪</span>
                      <input
                        value={editPlate}
                        onChange={e => setEditPlate(e.target.value.toUpperCase())}
                        placeholder="License plate"
                        style={{ ...inputStyle, marginBottom: 0 }}
                      />
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', padding: '11px 14px', borderBottom: '1px solid var(--color-divider)' }}>
                      <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>🪪</span>
                      <span style={{ fontSize: '13px', color: v.licensePlate ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}>
                        {v.licensePlate || 'No license plate'}
                      </span>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', padding: '11px 14px', borderBottom: '1px solid var(--color-divider)' }}>
                    <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>🎨</span>
                    <span style={{ fontSize: '13px', color: 'var(--color-text-primary)' }}>{v.color}</span>
                  </div>

                  {/* VIN */}
                  {isEditing ? (
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', padding: '9px 14px', borderBottom: '1px solid var(--color-divider)' }}>
                      <span style={{ fontSize: '13px', color: 'var(--color-text-muted)', flexShrink: 0 }}>🔢</span>
                      <input
                        value={editVin}
                        onChange={e => setEditVin(e.target.value.toUpperCase())}
                        placeholder="VIN number"
                        style={{ ...inputStyle, marginBottom: 0, fontFamily: 'monospace' }}
                      />
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', padding: '11px 14px', borderBottom: '1px solid var(--color-divider)' }}>
                      <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>🔢</span>
                      <span style={{ fontSize: '13px', color: v.vin ? 'var(--color-text-primary)' : 'var(--color-text-muted)', fontFamily: v.vin ? 'monospace' : 'inherit' }}>
                        {v.vin ? `VIN: ${v.vin}` : 'No VIN on file'}
                      </span>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', padding: '11px 14px' }}>
                    <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>📅</span>
                    <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>Added {fmtDate(v.createdAt)}</span>
                  </div>
                </div>

                {/* Edit error */}
                {editError && (
                  <div style={{ backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '8px', padding: '10px 14px', marginBottom: '12px', color: 'var(--color-error)', fontSize: '13px' }}>
                    {editError}
                  </div>
                )}

                {/* Edit actions */}
                {isEditing && (
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
                    <button onClick={cancelEdit} style={{ flex: 1, padding: '10px', border: '1px solid var(--color-border)', borderRadius: '8px', backgroundColor: 'transparent', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
                      Cancel
                    </button>
                    <button onClick={() => void saveEdit()} disabled={saving} style={{ flex: 1, padding: '10px', border: 'none', borderRadius: '8px', backgroundColor: 'var(--color-secondary)', fontSize: '13px', fontWeight: 700, color: 'var(--color-primary)', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
                      {saving ? 'Saving…' : 'Save Changes'}
                    </button>
                  </div>
                )}

                {owner && !isEditing && (
                  <>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Owner</div>
                    <div
                      onClick={() => { setDetailVehicle(null); navigate(`/customers?customerId=${v.customerId}`); }}
                      style={{ backgroundColor: 'var(--color-background)', borderRadius: '10px', border: '1px solid var(--color-border)', padding: '14px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--color-primary)')}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--color-border)')}
                    >
                      <div style={{ width: '40px', height: '40px', borderRadius: '20px', backgroundColor: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', fontWeight: 700, color: 'white', flexShrink: 0 }}>
                        {initials(owner)}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '2px' }}>{displayName(owner)}</div>
                        <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{owner.email}</div>
                      </div>
                      <span style={{ fontSize: '16px', color: 'var(--color-text-muted)' }}>›</span>
                    </div>
                  </>
                )}

                {/* Service history — keyed by vehicleId, so this still works
                    even when the owning customer was deleted. */}
                {!isEditing && (
                  <>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', marginTop: owner ? '16px' : 0 }}>Service History</div>
                    {detailVehicleHistory.length === 0 ? (
                      <div style={{ backgroundColor: 'var(--color-background)', borderRadius: '10px', border: '1px solid var(--color-border)', padding: '14px', textAlign: 'center', fontSize: '13px', color: 'var(--color-text-muted)' }}>
                        No appointments recorded for this vehicle yet.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {detailVehicleHistory.map(appt => {
                          const st = HISTORY_STATUS_STYLE[appt.status] ?? HISTORY_STATUS_STYLE.cancelled!;
                          return (
                            <div key={appt.appointmentId} style={{ backgroundColor: 'var(--color-background)', borderRadius: '10px', border: '1px solid var(--color-border)', padding: '10px 12px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)' }}>{appt.serviceName}</span>
                                <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '100px', backgroundColor: st.bg, color: st.color, textTransform: 'capitalize' }}>
                                  {appt.status.replace('-', ' ')}
                                </span>
                              </div>
                              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{fmtDate(appt.scheduledAt)}</div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </>
        );
      })()}
    </div>
  );
}
