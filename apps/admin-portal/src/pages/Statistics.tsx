import React, { useEffect, useState, useCallback } from 'react';
import { getAnalytics, type AnalyticsResponse, type ServiceData } from '../api/analytics';

type Period = '7d' | '30d' | '90d';

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}

function periodRange(period: Period): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - (period === '7d' ? 6 : period === '30d' ? 29 : 89));
  return { start: toDateStr(start), end: toDateStr(end) };
}

function fmtMoney(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}


function ServiceBar({ svc, max }: { svc: ServiceData; max: number }) {
  const pct = max > 0 ? (svc.bookings / max) * 100 : 0;
  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
        <span style={{ color: 'var(--color-text-primary)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>{svc.serviceName}</span>
        <span style={{ color: 'var(--color-text-secondary)', flexShrink: 0, fontSize: '12px' }}>
          {svc.bookings} booking{svc.bookings !== 1 ? 's' : ''}
          {svc.revenue > 0 ? `  ·  ${fmtMoney(svc.revenue)}` : ''}
        </span>
      </div>
      <div style={{ height: '6px', backgroundColor: 'var(--color-border)', borderRadius: '3px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, backgroundColor: 'var(--color-secondary)', borderRadius: '3px', transition: 'width 0.4s ease' }} />
      </div>
    </div>
  );
}

function downloadCSV(data: AnalyticsResponse, period: Period) {
  const { start, end } = periodRange(period);
  const rows: string[][] = [
    ['Date', 'Bookings', 'Completed', 'Revenue ($)'],
    ...data.byDay.map(d => [d.date, String(d.bookings), String(d.completed), d.revenue.toFixed(2)]),
    [],
    ['Service', 'Bookings', 'Completed', 'Revenue ($)'],
    ...data.byService.map(s => [s.serviceName, String(s.bookings), String(s.completed), s.revenue.toFixed(2)]),
  ];
  const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `analytics-${start}-${end}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  completed: { label: 'Completed', color: '#22c55e' },
  pending: { label: 'Pending', color: '#f59e0b' },
  confirmed: { label: 'Confirmed', color: '#3b82f6' },
  cancelled: { label: 'Cancelled', color: '#ef4444' },
  'no-show': { label: 'No-show', color: '#94a3b8' },
};

export default function Statistics() {
  const [period, setPeriod] = useState<Period>('30d');
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (p: Period) => {
    setLoading(true);
    setError('');
    const { start, end } = periodRange(p);
    try {
      setData(await getAnalytics(start, end));
    } catch {
      setError('Failed to load analytics data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(period); }, [load, period]);

  const maxSvcBookings = data ? Math.max(...data.byService.map(s => s.bookings), 1) : 1;

  const kpis = data ? [
    { label: 'Total Bookings', value: String(data.summary.totalBookings), sub: `${data.summary.completedBookings} completed` },
    { label: 'Revenue', value: fmtMoney(data.summary.totalRevenue), sub: `from ${data.summary.completedBookings} jobs` },
    { label: 'Customers', value: String(data.summary.uniqueCustomers), sub: `${data.summary.newCustomers} new` },
    { label: 'Returning Customers', value: String(data.summary.returningCustomers), sub: `of ${data.summary.uniqueCustomers} total` },
  ] : [];

  const PERIODS: { key: Period; label: string }[] = [
    { key: '7d', label: '7 Days' },
    { key: '30d', label: '30 Days' },
    { key: '90d', label: '3 Months' },
  ];

  return (
    <div style={{ maxWidth: '1100px' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '4px', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '10px', padding: '3px' }}>
          {PERIODS.map(p => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              style={{
                padding: '7px 14px', borderRadius: '7px', border: 'none', cursor: 'pointer',
                fontSize: '13px', fontWeight: 600,
                backgroundColor: period === p.key ? 'var(--color-primary)' : 'transparent',
                color: period === p.key ? 'white' : 'var(--color-text-secondary)',
                transition: 'all 0.15s',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        {data && (
          <button
            onClick={() => downloadCSV(data, period)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', border: '1px solid var(--color-border)', borderRadius: '8px', background: 'transparent', fontSize: '13px', fontWeight: 600, cursor: 'pointer', color: 'var(--color-text-secondary)' }}
          >
            ↓ Export CSV
          </button>
        )}
      </div>

      {error && (
        <div style={{ backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '10px', padding: '12px 16px', marginBottom: '20px', color: 'var(--color-error)', fontSize: '14px' }}>
          {error}
        </div>
      )}

      {/* KPI Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '24px' }}>
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ backgroundColor: 'var(--color-surface)', borderRadius: '12px', border: '1px solid var(--color-border)', padding: '20px', minHeight: '80px', opacity: 0.5 }} />
          ))
          : kpis.map(k => (
            <div key={k.label} style={{ backgroundColor: 'var(--color-surface)', borderRadius: '12px', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)', padding: '20px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '8px' }}>{k.label}</div>
              <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--color-text-primary)', lineHeight: 1.1, marginBottom: '4px' }}>{k.value}</div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{k.sub}</div>
            </div>
          ))
        }
      </div>

      {/* Bottom Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
        {/* Service popularity */}
        <div style={{ backgroundColor: 'var(--color-surface)', borderRadius: '12px', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)', padding: '20px' }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '16px' }}>Service Popularity</div>
          {loading ? (
            <div style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>Loading…</div>
          ) : data && data.byService.length > 0 ? (
            data.byService.slice(0, 8).map(svc => (
              <ServiceBar key={svc.serviceId} svc={svc} max={maxSvcBookings} />
            ))
          ) : (
            <div style={{ color: 'var(--color-text-muted)', fontSize: '13px', paddingTop: '12px', textAlign: 'center' }}>
              No bookings in this period
            </div>
          )}
        </div>

        {/* Status breakdown */}
        <div style={{ backgroundColor: 'var(--color-surface)', borderRadius: '12px', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)', padding: '20px' }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '16px' }}>By Status</div>
          {loading ? (
            <div style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>Loading…</div>
          ) : data && data.summary.totalBookings > 0 ? (
            Object.entries(data.byStatus)
              .sort(([, a], [, b]) => b - a)
              .map(([status, count]) => {
                const cfg = STATUS_CONFIG[status] ?? { label: status, color: '#94a3b8' };
                const pct = Math.round((count / data.summary.totalBookings) * 100);
                return (
                  <div key={status} style={{ marginBottom: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                      <span style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>{cfg.label}</span>
                      <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>
                        {count} <span style={{ color: 'var(--color-text-muted)' }}>({pct}%)</span>
                      </span>
                    </div>
                    <div style={{ height: '6px', backgroundColor: 'var(--color-border)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, backgroundColor: cfg.color, borderRadius: '3px', transition: 'width 0.4s ease' }} />
                    </div>
                  </div>
                );
              })
          ) : (
            <div style={{ color: 'var(--color-text-muted)', fontSize: '13px', paddingTop: '12px', textAlign: 'center' }}>
              No bookings in this period
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
