import React, { useEffect, useState } from 'react';
import { getCapacity, updateCapacity, type CapacitySettings, type DayName, type DayHours } from '../api/capacity';

const ALL_DAYS: DayName[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_LABEL: Record<DayName, string> = {
  monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday',
  thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday',
};
const SLOT_OPTIONS = [30, 45, 60, 90, 120];

function fmtSlot(min: number): string {
  return min >= 60 ? `${min / 60}h` : `${min}m`;
}

export default function Capacity() {
  const [settings, setSettings] = useState<CapacitySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const [slotDuration, setSlotDuration] = useState(30);
  const [maxConcurrent, setMaxConcurrent] = useState(2);
  const [hours, setHours] = useState<Record<DayName, DayHours | null>>({
    monday: { open: '07:00', close: '17:00' },
    tuesday: { open: '07:00', close: '17:00' },
    wednesday: { open: '07:00', close: '17:00' },
    thursday: { open: '07:00', close: '17:00' },
    friday: { open: '07:00', close: '17:00' },
    saturday: { open: '07:00', close: '17:00' },
    sunday: null,
  });

  useEffect(() => {
    void (async () => {
      try {
        const data = await getCapacity();
        setSettings(data);
        setSlotDuration(data.slotDurationMinutes);
        setMaxConcurrent(data.maxConcurrent);
        setHours(data.operatingHours);
      } catch {
        setError('Failed to load capacity settings.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function toggleDay(day: DayName, isOpen: boolean) {
    setHours(prev => ({ ...prev, [day]: isOpen ? { open: '07:00', close: '17:00' } : null }));
  }

  function updateTime(day: DayName, field: 'open' | 'close', value: string) {
    setHours(prev => ({ ...prev, [day]: { ...prev[day]!, [field]: value } }));
  }

  async function save() {
    for (const day of ALL_DAYS) {
      const h = hours[day];
      if (h) {
        if (!/^\d{2}:\d{2}$/.test(h.open) || !/^\d{2}:\d{2}$/.test(h.close)) {
          setError(`Invalid time for ${DAY_LABEL[day]}. Please select a valid time.`);
          return;
        }
        if (h.open >= h.close) {
          setError(`Open time must be before close time for ${DAY_LABEL[day]}.`);
          return;
        }
      }
    }
    setError('');
    setSaving(true);
    setSaved(false);
    try {
      const updated = await updateCapacity({ slotDurationMinutes: slotDuration, maxConcurrent, operatingHours: hours });
      setSettings(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError('Failed to save settings.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading…</div>;
  }

  return (
    <div style={{ maxWidth: '720px' }}>
      {error && (
        <div style={{ backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '10px', padding: '12px 16px', marginBottom: '20px', color: 'var(--color-error)', fontSize: '14px' }}>
          {error}
        </div>
      )}
      {saved && (
        <div style={{ backgroundColor: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: '10px', padding: '12px 16px', marginBottom: '20px', color: 'var(--color-success)', fontSize: '14px' }}>
          ✓ Settings saved successfully.
        </div>
      )}

      {/* Slot Duration */}
      <div style={cardStyle}>
        <h3 style={sectionTitleStyle}>Slot Duration</h3>
        <p style={sectionDescStyle}>How long each appointment slot lasts.</p>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {SLOT_OPTIONS.map(opt => (
            <button
              key={opt}
              onClick={() => setSlotDuration(opt)}
              style={{
                padding: '8px 20px', borderRadius: '8px', border: `2px solid ${slotDuration === opt ? 'var(--color-primary)' : 'var(--color-border)'}`,
                backgroundColor: slotDuration === opt ? 'rgba(15,32,68,0.06)' : 'var(--color-background)',
                color: slotDuration === opt ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                fontWeight: slotDuration === opt ? 700 : 500, fontSize: '14px', cursor: 'pointer',
              }}
            >
              {fmtSlot(opt)}
            </button>
          ))}
        </div>
      </div>

      {/* Max Concurrent */}
      <div style={cardStyle}>
        <h3 style={sectionTitleStyle}>Max Concurrent Bookings</h3>
        <p style={sectionDescStyle}>Maximum appointments allowed per time slot.</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button onClick={() => setMaxConcurrent(v => Math.max(1, v - 1))} disabled={maxConcurrent <= 1} style={stepBtnStyle(maxConcurrent <= 1)}>−</button>
          <span style={{ fontSize: '28px', fontWeight: 800, color: 'var(--color-text-primary)', minWidth: '40px', textAlign: 'center' }}>{maxConcurrent}</span>
          <button onClick={() => setMaxConcurrent(v => Math.min(10, v + 1))} disabled={maxConcurrent >= 10} style={stepBtnStyle(maxConcurrent >= 10)}>+</button>
        </div>
      </div>

      {/* Operating Hours */}
      <div style={cardStyle}>
        <h3 style={sectionTitleStyle}>Operating Hours</h3>
        <p style={sectionDescStyle}>Set your shop's open hours for each day of the week.</p>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            {ALL_DAYS.map((day, i) => {
              const isOpen = hours[day] !== null;
              const h = hours[day];
              return (
                <tr key={day} style={{ borderBottom: i < ALL_DAYS.length - 1 ? '1px solid var(--color-divider)' : 'none' }}>
                  <td style={{ padding: '14px 0', width: '110px', fontWeight: 500, color: 'var(--color-text-primary)', fontSize: '14px' }}>
                    {DAY_LABEL[day]}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: isOpen ? 'var(--color-success)' : 'var(--color-text-muted)' }}>
                      <input
                        type="checkbox"
                        checked={isOpen}
                        onChange={e => toggleDay(day, e.target.checked)}
                        style={{ cursor: 'pointer' }}
                      />
                      {isOpen ? 'Open' : 'Closed'}
                    </label>
                  </td>
                  <td style={{ padding: '14px 0' }}>
                    {isOpen && h ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          type="time"
                          value={h.open}
                          onChange={e => updateTime(day, 'open', e.target.value)}
                          style={timeInputStyle}
                        />
                        <span style={{ color: 'var(--color-text-muted)' }}>–</span>
                        <input
                          type="time"
                          value={h.close}
                          onChange={e => updateTime(day, 'close', e.target.value)}
                          style={timeInputStyle}
                        />
                      </div>
                    ) : (
                      <span style={{ fontSize: '13px', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>Closed</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button
          onClick={() => void save()}
          disabled={saving}
          style={{
            padding: '12px 32px', backgroundColor: 'var(--color-secondary)', color: 'var(--color-primary)',
            border: 'none', borderRadius: '10px', fontWeight: 700, fontSize: '15px',
            cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
        {settings?.updatedAt && (
          <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
            Last saved {new Date(settings.updatedAt).toLocaleString()}
          </span>
        )}
      </div>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  backgroundColor: 'var(--color-surface)',
  borderRadius: '12px',
  padding: '20px 24px',
  marginBottom: '20px',
  border: '1px solid var(--color-border)',
  boxShadow: 'var(--shadow-sm)',
};

const sectionTitleStyle: React.CSSProperties = {
  margin: '0 0 4px',
  fontSize: '16px',
  fontWeight: 700,
  color: 'var(--color-text-primary)',
};

const sectionDescStyle: React.CSSProperties = {
  margin: '0 0 16px',
  fontSize: '13px',
  color: 'var(--color-text-secondary)',
};

const stepBtnStyle = (disabled: boolean): React.CSSProperties => ({
  width: '36px', height: '36px', borderRadius: '50%',
  border: `2px solid ${disabled ? 'var(--color-border)' : 'var(--color-primary)'}`,
  backgroundColor: 'transparent',
  color: disabled ? 'var(--color-text-muted)' : 'var(--color-primary)',
  fontSize: '20px', fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
});

const timeInputStyle: React.CSSProperties = {
  padding: '6px 10px', borderRadius: '6px',
  border: '1px solid var(--color-border)', fontSize: '14px',
  color: 'var(--color-text-primary)', backgroundColor: 'var(--color-background)',
};
