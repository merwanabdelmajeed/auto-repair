import type { CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Appointment } from '../api/appointments';

const rowStyle: CSSProperties = { display: 'flex', gap: '10px', alignItems: 'center', padding: '11px 14px', borderBottom: '1px solid var(--color-divider)' };
const iconStyle: CSSProperties = { fontSize: '13px', color: 'var(--color-text-muted)' };
const valueStyle: CSSProperties = { fontSize: '13px', color: 'var(--color-text-primary)' };

// Customer section of the appointment detail panel (Dashboard + Bookings).
// The name links to the customer's details on the Customers page — unless
// the account was deleted (no customerId), in which case it's plain text.
export default function AppointmentCustomerCard({ appt, phone }: { appt: Appointment; phone: string | null | undefined }) {
  const navigate = useNavigate();
  const customerId = appt.customerId;

  return (
    <div style={{ backgroundColor: 'var(--color-background)', borderRadius: '10px', border: '1px solid var(--color-border)', marginBottom: '16px', overflow: 'hidden' }}>
      {appt.customerName && (customerId ? (
        <div
          role="link"
          onClick={() => navigate(`/customers?customerId=${encodeURIComponent(customerId)}&open=1`)}
          style={{ ...rowStyle, justifyContent: 'space-between', cursor: 'pointer' }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(15,32,68,0.04)')}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={iconStyle}>👤</span>
            <span style={{ ...valueStyle, fontWeight: 600 }}>{appt.customerName}</span>
          </div>
          <span style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>›</span>
        </div>
      ) : (
        <div style={rowStyle}>
          <span style={iconStyle}>👤</span>
          <span style={{ ...valueStyle, fontWeight: 600 }}>{appt.customerName}</span>
        </div>
      ))}
      <div style={rowStyle}>
        <span style={iconStyle}>📞</span>
        <span style={valueStyle}>{phone || '—'}</span>
      </div>
      <div style={{ ...rowStyle, borderBottom: 'none' }}>
        <span style={iconStyle}>✉️</span>
        <span style={valueStyle}>{appt.customerEmail || '—'}</span>
      </div>
    </div>
  );
}
