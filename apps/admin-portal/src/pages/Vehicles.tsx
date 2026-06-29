import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { listVehicles, type Vehicle } from '../api/vehicles';
import { listCustomers, type Customer } from '../api/customers';

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function displayName(c: Customer) {
  if (c.firstName || c.lastName) return `${c.firstName} ${c.lastName}`.trim();
  return c.email;
}

export default function Vehicles() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const customerIdFilter = searchParams.get('customerId');

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [customerMap, setCustomerMap] = useState<Record<string, Customer>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => { void load(); }, []);

  async function load() {
    try {
      setLoading(true);
      setError('');
      const [v, c] = await Promise.all([listVehicles(), listCustomers()]);
      setVehicles(v);
      const map: Record<string, Customer> = {};
      c.forEach(cu => { map[cu.userId] = cu; });
      setCustomerMap(map);
    } catch {
      setError('Failed to load vehicles.');
    } finally {
      setLoading(false);
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

  return (
    <div style={{ maxWidth: '1100px' }}>
      {/* Search + count */}
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

      {/* Filter banner */}
      {filterCustomer && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: 'rgba(15,32,68,0.06)', border: '1px solid var(--color-border)', borderRadius: '10px', padding: '10px 16px', marginBottom: '16px', fontSize: '13px' }}>
          <span>👤</span>
          <span style={{ color: 'var(--color-text-secondary)' }}>
            Showing vehicles for <strong style={{ color: 'var(--color-text-primary)' }}>{displayName(filterCustomer)}</strong>
          </span>
          <button
            onClick={() => setSearchParams({})}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--color-primary)', fontWeight: 700, fontSize: '13px', cursor: 'pointer', padding: '2px 6px' }}
          >
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
                <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
                  Vehicles are added by customers through the customer app.
                </div>
              </td></tr>
            ) : filtered.map((v, i) => {
              const owner = customerMap[v.customerId];
              return (
                <tr key={v.vehicleId} style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--color-divider)' : 'none' }}>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)' }}>{v.year} {v.make} {v.model}{v.trim ? ' ' + v.trim : ''}</div>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    {owner ? (
                      <button
                        onClick={() => navigate(`/customers?customerId=${v.customerId}`)}
                        style={{ background: 'none', border: 'none', padding: '3px 8px', borderRadius: '6px', backgroundColor: 'rgba(15,32,68,0.06)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap' }}
                      >
                        <span style={{ fontSize: '13px', color: 'var(--color-primary)', fontWeight: 600 }}>{displayName(owner)}</span>
                        <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>›</span>
                      </button>
                    ) : (
                      <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>—</span>
                    )}
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
    </div>
  );
}
