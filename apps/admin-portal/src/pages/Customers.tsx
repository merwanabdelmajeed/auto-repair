import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { listCustomers, type Customer } from '../api/customers';
import { listVehicles, type Vehicle } from '../api/vehicles';
import { fetchAllPages } from '../utils/fetchAllPages';

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function displayName(c: Customer) {
  if (c.firstName || c.lastName) return `${c.firstName} ${c.lastName}`.trim();
  return c.email;
}

function initials(c: Customer) {
  if (c.firstName || c.lastName) return `${c.firstName?.[0] ?? ''}${c.lastName?.[0] ?? ''}`.toUpperCase();
  return c.email[0].toUpperCase();
}

export default function Customers() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const customerIdFilter = searchParams.get('customerId');

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vehicleMap, setVehicleMap] = useState<Record<string, Vehicle[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [detailCustomer, setDetailCustomer] = useState<Customer | null>(null);

  useEffect(() => { void load(); }, []);

  async function load() {
    try {
      setLoading(true);
      setError('');
      const [c, v] = await Promise.all([
        fetchAllPages(cursor => listCustomers(cursor)),
        fetchAllPages(cursor => listVehicles(cursor)),
      ]);
      setCustomers(c);
      const map: Record<string, Vehicle[]> = {};
      v.forEach(veh => {
        if (!map[veh.customerId]) map[veh.customerId] = [];
        map[veh.customerId].push(veh);
      });
      setVehicleMap(map);
    } catch {
      setError('Failed to load customers.');
    } finally {
      setLoading(false);
    }
  }

  const base = customerIdFilter
    ? customers.filter(c => c.userId === customerIdFilter)
    : customers;

  const filtered = search.trim()
    ? base.filter(c =>
        c.email.toLowerCase().includes(search.toLowerCase()) ||
        `${c.firstName} ${c.lastName}`.toLowerCase().includes(search.toLowerCase())
      )
    : base;

  return (
    <div style={{ maxWidth: '1100px' }}>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '220px', display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '10px', padding: '10px 14px', boxShadow: 'var(--shadow-sm)' }}>
          <span>🔍</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            style={{ border: 'none', outline: 'none', backgroundColor: 'transparent', fontSize: '14px', color: 'var(--color-text-primary)', width: '100%' }}
          />
        </div>
      </div>

      {customerIdFilter ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: 'rgba(15,32,68,0.06)', border: '1px solid var(--color-border)', borderRadius: '10px', padding: '10px 16px', marginBottom: '16px', fontSize: '13px' }}>
          <button onClick={() => setSearchParams({})} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontWeight: 700, fontSize: '13px', cursor: 'pointer', padding: 0 }}>
            ← Back to all customers
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '20px' }}>
          {[
            { label: 'Total Customers', value: customers.length, icon: '👥' },
            { label: 'Showing', value: filtered.length, icon: '🔍' },
          ].map(s => (
            <div key={s.label} style={{ backgroundColor: 'var(--color-surface)', borderRadius: '12px', padding: '20px', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <span style={{ fontSize: '28px' }}>{s.icon}</span>
              <div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--color-text-primary)' }}>{loading ? '—' : s.value}</div>
                <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{s.label}</div>
              </div>
            </div>
          ))}
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
              {['Customer', 'Vehicles', 'Status', 'Joined'].map(col => (
                <th key={col} style={{ textAlign: 'left', padding: '13px 16px', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} style={{ padding: '60px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '14px' }}>Loading customers…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={4} style={{ padding: '60px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: '36px', marginBottom: '12px' }}>👤</div>
                <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>{search ? 'No matches' : 'No customers yet'}</div>
                <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Customers register through the customer app.</div>
              </td></tr>
            ) : filtered.map((c, i) => {
              const vehicles = vehicleMap[c.userId] ?? [];
              const isDetail = detailCustomer?.userId === c.userId;
              return (
                <tr
                  key={c.userId}
                  onClick={() => setDetailCustomer(prev => prev?.userId === c.userId ? null : c)}
                  style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--color-divider)' : 'none', cursor: 'pointer', backgroundColor: isDetail ? 'rgba(15,32,68,0.04)' : 'transparent', transition: 'background-color 0.1s' }}
                  onMouseEnter={e => { if (!isDetail) e.currentTarget.style.backgroundColor = 'rgba(15,32,68,0.025)'; }}
                  onMouseLeave={e => { if (!isDetail) e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)' }}>{displayName(c)}</div>
                    {(c.firstName || c.lastName) && <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>{c.email}</div>}
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                    {vehicles.length > 0
                      ? `${vehicles.length} vehicle${vehicles.length !== 1 ? 's' : ''}`
                      : <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, padding: '3px 10px', borderRadius: '100px', backgroundColor: c.status === 'ACTIVE' ? 'rgba(34,197,94,0.1)' : 'rgba(148,163,184,0.15)', color: c.status === 'ACTIVE' ? 'var(--color-success)' : 'var(--color-text-muted)', border: `1px solid ${c.status === 'ACTIVE' ? 'rgba(34,197,94,0.25)' : 'rgba(148,163,184,0.25)'}` }}>
                      {c.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>{fmtDate(c.createdAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Detail Panel */}
      {detailCustomer && (() => {
        const c = detailCustomer;
        const vehicles = vehicleMap[c.userId] ?? [];
        return (
          <>
            <div onClick={() => setDetailCustomer(null)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.25)', zIndex: 200 }} />
            <div style={{ position: 'fixed', right: 0, top: 0, bottom: 0, width: '400px', backgroundColor: 'var(--color-surface)', boxShadow: '-4px 0 24px rgba(0,0,0,0.18)', zIndex: 201, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 20px 16px', borderBottom: '1px solid var(--color-border)' }}>
                <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-text-primary)' }}>Customer Details</span>
                <button onClick={() => setDetailCustomer(null)} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: 'var(--color-text-muted)', lineHeight: 1 }}>✕</button>
              </div>

              <div style={{ padding: '20px' }}>
                {/* Profile header */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '20px' }}>
                  <div style={{ width: '64px', height: '64px', borderRadius: '32px', backgroundColor: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', fontWeight: 700, color: 'white', marginBottom: '10px' }}>
                    {initials(c)}
                  </div>
                  <div style={{ fontSize: '17px', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '6px', textAlign: 'center' }}>{displayName(c)}</div>
                  <span style={{ fontSize: '12px', fontWeight: 700, padding: '3px 10px', borderRadius: '100px', backgroundColor: c.status === 'ACTIVE' ? 'rgba(34,197,94,0.1)' : 'rgba(148,163,184,0.15)', color: c.status === 'ACTIVE' ? 'var(--color-success)' : 'var(--color-text-muted)', border: `1px solid ${c.status === 'ACTIVE' ? 'rgba(34,197,94,0.25)' : 'rgba(148,163,184,0.25)'}` }}>
                    {c.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Contact</div>
                <div style={{ backgroundColor: 'var(--color-background)', borderRadius: '10px', border: '1px solid var(--color-border)', marginBottom: '16px', overflow: 'hidden' }}>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', padding: '11px 14px', borderBottom: '1px solid var(--color-divider)' }}>
                    <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>✉️</span>
                    <span style={{ fontSize: '13px', color: 'var(--color-text-primary)' }}>{c.email}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', padding: '11px 14px' }}>
                    <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>📅</span>
                    <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>Joined {fmtDate(c.createdAt)}</span>
                  </div>
                </div>

                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Vehicles ({vehicles.length})</div>
                {vehicles.length === 0 ? (
                  <div style={{ backgroundColor: 'var(--color-background)', borderRadius: '10px', border: '1px solid var(--color-border)', padding: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '16px', color: 'var(--color-text-muted)' }}>🚗</span>
                    <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>No vehicles registered</span>
                  </div>
                ) : (
                  <div style={{ backgroundColor: 'var(--color-background)', borderRadius: '10px', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
                    {vehicles.map((v, i) => (
                      <div
                        key={v.vehicleId}
                        onClick={() => { setDetailCustomer(null); navigate(`/vehicles?customerId=${c.userId}`); }}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: i < vehicles.length - 1 ? '1px solid var(--color-divider)' : 'none', cursor: 'pointer' }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(15,32,68,0.04)')}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '14px', color: 'var(--color-primary)' }}>🚗</span>
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)' }}>{v.year} {v.make} {v.model}</div>
                            {v.licensePlate && <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{v.licensePlate}</div>}
                          </div>
                        </div>
                        <span style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>›</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        );
      })()}
    </div>
  );
}
