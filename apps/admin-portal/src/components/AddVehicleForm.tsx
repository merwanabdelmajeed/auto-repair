import React, { useEffect, useState } from 'react';
import { addVehicleForCustomer, type Vehicle } from '../api/vehicles';
import { decodeVin, normalizeVin, VIN_LENGTH } from '../utils/vin';
import { missingFieldsMessage } from '../utils/missingFields';

// Admin adds a vehicle for a customer. A 17-character VIN is required; it's
// decoded via NHTSA's free decoder to pre-fill year/make/model/trim, but every
// field stays editable so the admin can enter or correct details by hand
// (e.g. when a VIN doesn't decode). The paid plate lookup is deliberately not
// offered here (customer app only).

const CUR_YEAR = new Date().getFullYear();

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', fontSize: '13px', padding: '7px 9px',
  border: '1px solid var(--color-border)', borderRadius: '6px',
  color: 'var(--color-text-primary)', backgroundColor: 'var(--color-surface)',
};
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)',
  textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '4px',
};

type Props = {
  customerId: string;
  onAdded: (vehicle: Vehicle) => void;
  onCancel: () => void;
  // Pre-fills (and immediately decodes) the VIN — used when an edited VIN
  // turned out to belong to a different car.
  initialVin?: string;
};

export default function AddVehicleForm({ customerId, onAdded, onCancel, initialVin }: Props) {
  const [vin, setVin] = useState('');
  const [decoding, setDecoding] = useState(false);
  const [decoded, setDecoded] = useState(false);
  const [vinError, setVinError] = useState('');
  const [year, setYear] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [trim, setTrim] = useState('');
  const [color, setColor] = useState('');
  const [plate, setPlate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (initialVin) void handleVinChange(initialVin);
    // Run once on open; later VIN edits go through the input's onChange.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleVinChange(raw: string) {
    const next = normalizeVin(raw);
    setVin(next);
    setVinError('');
    setDecoded(false);
    if (next.length !== VIN_LENGTH) return;
    setDecoding(true);
    const result = await decodeVin(next);
    setDecoding(false);
    if (result.status !== 'ok') {
      setVinError(result.status === 'unavailable'
        ? 'VIN lookup is unavailable right now — enter the details manually.'
        : "Couldn't decode this VIN — check it or enter the details manually.");
      return;
    }
    const v = result.vehicle;
    setYear(v.year);
    setMake(v.make);
    setModel(v.model);
    setTrim(v.trim ?? '');
    setDecoded(true);
  }

  async function handleSave() {
    if (vin.length !== VIN_LENGTH) {
      setError('VIN must be 17 characters.');
      return;
    }
    const missing = missingFieldsMessage({ Year: year, Make: make, Model: model, Color: color });
    if (missing) {
      setError(missing);
      return;
    }
    const y = parseInt(year, 10);
    if (isNaN(y) || y < 1900 || y > CUR_YEAR + 1) {
      setError('Please enter a valid year.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const vehicle = await addVehicleForCustomer({
        customerId,
        vin,
        year: y,
        make: make.trim(),
        model: model.trim(),
        trim: trim.trim() || undefined,
        color: color.trim(),
        licensePlate: plate.trim().toUpperCase() || undefined,
      });
      onAdded(vehicle);
    } catch {
      setError('Failed to add vehicle. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const field = (label: string, value: string, set: (v: string) => void, opts: { placeholder?: string } = {}) => (
    <div style={{ flex: 1, minWidth: 0 }}>
      <label style={labelStyle}>
        {label}
        <input
          aria-label={label}
          value={value}
          onChange={e => set(e.target.value)}
          placeholder={opts.placeholder}
          style={{ ...inputStyle, marginTop: '4px', textTransform: 'none', fontWeight: 400, letterSpacing: 0 }}
        />
      </label>
    </div>
  );

  return (
    <form
      onSubmit={e => { e.preventDefault(); void handleSave(); }}
      onKeyDown={e => { if (e.key === 'Escape') onCancel(); }}
      style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)', borderRadius: '10px', padding: '14px', marginBottom: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}
    >
      <div>
        <label style={labelStyle}>
          VIN
          <input
            aria-label="VIN"
            value={vin}
            onChange={e => void handleVinChange(e.target.value)}
            placeholder="17-character VIN"
            autoFocus
            style={{ ...inputStyle, marginTop: '4px', fontFamily: 'monospace', letterSpacing: '0.5px', textTransform: 'none', fontWeight: 400 }}
          />
        </label>
        <div style={{ fontSize: '12px', marginTop: '4px', color: vinError ? 'var(--color-error)' : 'var(--color-text-muted)' }}>
          {decoding ? 'Decoding VIN…' : vinError || (decoded ? 'VIN decoded — check the details below.' : `${vin.length}/${VIN_LENGTH} characters`)}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        {field('Year', year, setYear, { placeholder: 'e.g. 2020' })}
        {field('Make', make, setMake, { placeholder: 'e.g. Honda' })}
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        {field('Model', model, setModel, { placeholder: 'e.g. Accord' })}
        {field('Trim', trim, setTrim, { placeholder: 'Optional' })}
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        {field('Color', color, setColor, { placeholder: 'e.g. Silver' })}
        {field('License plate', plate, setPlate, { placeholder: 'Optional' })}
      </div>

      {error && <div role="alert" style={{ fontSize: '13px', color: 'var(--color-error)' }}>{error}</div>}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '14px' }}>
        <button type="button" onClick={onCancel} disabled={saving} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', fontWeight: 600, fontSize: '13px', cursor: 'pointer', padding: 0 }}>
          Cancel
        </button>
        <button type="submit" disabled={saving || decoding} style={{ backgroundColor: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 700, fontSize: '13px', padding: '7px 14px', cursor: saving ? 'default' : 'pointer', opacity: saving || decoding ? 0.6 : 1 }}>
          {saving ? 'Adding…' : 'Add vehicle'}
        </button>
      </div>
    </form>
  );
}
