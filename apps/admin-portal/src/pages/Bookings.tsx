import React from 'react';

const STATUS_TABS = ['All', 'Scheduled', 'Confirmed', 'Completed', 'Cancelled'];

export default function Bookings() {
  return (
    <div style={{ maxWidth: '1100px' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div style={{
          flex: 1,
          minWidth: '220px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: '10px',
          padding: '10px 14px',
          boxShadow: 'var(--shadow-sm)',
        }}>
          <span style={{ fontSize: '16px' }}>🔍</span>
          <span style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>
            Search bookings by customer, date, service…
          </span>
        </div>
        <button style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          backgroundColor: 'var(--color-secondary)', color: 'var(--color-primary)',
          fontWeight: 700, fontSize: '14px', borderRadius: '10px',
          padding: '10px 18px', border: 'none', cursor: 'pointer',
          boxShadow: 'var(--shadow-sm)',
        }}>
          ＋ New Booking
        </button>
      </div>

      {/* Status Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {STATUS_TABS.map((tab, i) => (
          <button key={tab} style={{
            padding: '7px 16px',
            borderRadius: '100px',
            border: '1px solid',
            borderColor: i === 0 ? 'var(--color-primary)' : 'var(--color-border)',
            backgroundColor: i === 0 ? 'var(--color-primary)' : 'var(--color-surface)',
            color: i === 0 ? 'white' : 'var(--color-text-secondary)',
            fontSize: '13px', fontWeight: 600, cursor: 'pointer',
          }}>
            {tab}
          </button>
        ))}

        {/* Date Navigator */}
        <div style={{
          marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px',
          backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)',
          borderRadius: '10px', padding: '6px 12px', boxShadow: 'var(--shadow-sm)',
        }}>
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', color: 'var(--color-text-secondary)' }}>‹</button>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)' }}>📅 Jun 24, 2026</span>
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', color: 'var(--color-text-secondary)' }}>›</button>
        </div>
      </div>

      {/* Table */}
      <div style={{
        backgroundColor: 'var(--color-surface)',
        borderRadius: '12px',
        border: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-sm)',
        overflow: 'hidden',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
              {['Customer', 'Vehicle', 'Service', 'Date & Time', 'Status', 'Actions'].map((col) => (
                <th key={col} style={{
                  textAlign: 'left', padding: '14px 16px',
                  fontSize: '12px', fontWeight: 700, color: 'var(--color-text-muted)',
                  textTransform: 'uppercase', letterSpacing: '0.6px',
                  backgroundColor: 'var(--color-background)',
                }}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={6} style={{ padding: '80px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: '40px', marginBottom: '16px' }}>📋</div>
                <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '8px' }}>
                  No bookings found
                </div>
                <div style={{ fontSize: '14px', color: 'var(--color-text-muted)', maxWidth: '380px', margin: '0 auto' }}>
                  Bookings will appear here once customers start scheduling appointments through the customer app.
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Booking Fields Reference */}
      <div style={{
        backgroundColor: 'var(--color-surface)',
        borderRadius: '12px',
        border: '1px solid var(--color-border)',
        padding: '20px',
        marginTop: '20px',
        boxShadow: 'var(--shadow-sm)',
      }}>
        <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '14px', color: 'var(--color-text-primary)' }}>
          Appointment Data Model (Phase 6)
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
          {['appointmentId', 'tenantId', 'locationId', 'customerId', 'vehicleId', 'appointmentDate', 'appointmentTime', 'requestedServices', 'notes', 'status'].map((field) => (
            <div key={field} style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '8px 12px', backgroundColor: 'var(--color-background)',
              borderRadius: '6px', fontSize: '13px', fontFamily: 'monospace',
              color: 'var(--color-primary)', fontWeight: 600,
            }}>
              <span style={{ color: 'var(--color-success)', fontSize: '10px' }}>●</span>
              {field}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
