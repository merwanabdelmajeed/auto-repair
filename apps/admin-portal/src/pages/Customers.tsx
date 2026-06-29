import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { listCustomers, type Customer } from '../api/customers';
import { listVehicles, type Vehicle } from '../api/vehicles';

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function displayName(c: Customer) {
  if (c.firstName || c.lastName) return `${c.firstName} ${c.lastName}`.trim();
  return c.email;
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

  useEffect(() => { void load(); }, []);

  async function load() {
    try {
      setLoading(true);
      setError('');
      const [c, v] = await Promise.all([listCustomers(), listVehicles()]);
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
        `${c.firstName} ${c.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
        (c.phone ?? '').toLowerCase().includes(search.toLowerCase())
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
            placeholder="Search by name, email, or phone…"
            style={{ border: 'none', outline: 'none', backgroundColor: 'transparent', fontSize: '14px', color: 'var(--color-text-primary)', width: '100%' }}
          />
        </div>
      </div>

      {/* Filter banner or stats */}
      {customerIdFilter ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: 'rgba(15,32,68,0.06)', border: '1px solid var(--color-border)', borderRadius: '10px', padding: '10px 16px', marginBottom: '16px', fontSize: '13px' }}>
          <span>←</span>
          <button
            onClick={() => setSearchParams({})}
            style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontWeight: 700, fontSize: '13px', cursor: 'pointer', padding: 0 }}
          >
            Back to all customers
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '20px' }}>
          {[
            { label: 'Total Customers', value: customers.length, icon: '👥' },
            { label: 'Active', value: customers.filter(c => c.status === 'ACTIVE').length, icon: '✅' },
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
              {['Customer', 'Phone', 'Vehicles', 'Status', 'Joined'].map(col => (
                <th key={col} style={{ textAlign: 'left', padding: '13px 16px', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ padding: '60px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '14px' }}>Loading customers…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: '60px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: '36px', marginBottom: '12px' }}>👤</div>
                <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>{search ? 'No matches' : 'No customers yet'}</div>
                <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Customers register through the customer app and appear here automatically.</div>
              </td></tr>
            ) : filtered.map((c, i) => {
              const vehicles = vehicleMap[c.userId] ?? [];
              return (
                <tr key={c.userId} style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--color-divider)' : 'none' }}>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)' }}>{displayName(c)}</div>
                    {(c.firstName || c.lastName) && <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>{c.email}</div>}
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                    {c.phone ?? <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    {vehicles.length > 0 ? (
                      <button
                        onClick={() => navigate(`/vehicles?customerId=${c.userId}`)}
                        style={{ background: 'none', border: 'none', padding: '3px 8px', borderRadius: '6px', backgroundColor: 'rgba(15,32,68,0.06)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap' }}
                      >
                        <span>🚗</span>
                        <span style={{ fontSize: '13px', color: 'var(--color-primary)', fontWeight: 600 }}>{vehicles.length} vehicle{vehicles.length !== 1 ? 's' : ''}</span>
                        <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>›</span>
                      </button>
                    ) : (
                      <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, padding: '3px 10px', borderRadius: '100px', backgroundColor: c.status === 'ACTIVE' ? 'rgba(34,197,94,0.1)' : 'rgba(148,163,184,0.15)', color: c.status === 'ACTIVE' ? 'var(--color-success)' : 'var(--color-text-muted)', border: `1px solid ${c.status === 'ACTIVE' ? 'rgba(34,197,94,0.25)' : 'rgba(148,163,184,0.25)'}` }}>
                      {c.status}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>{fmtDate(c.createdAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
