import { useRef, useState } from 'react';
import { updateVehicle, type Vehicle } from '../api/vehicles';
import { decodeVin, normalizeVin, VIN_LENGTH, type DecodedVin } from '../utils/vin';

// Shared plate/VIN edit flow for every place an admin edits a vehicle
// (Vehicles page, and the booking/dashboard detail panels). VIN edits are for
// *corrections* — a VIN identifies a car, so a VIN that belongs to a different
// car becomes a new vehicle rather than rewriting this one (which would move
// this car's service history onto the other car).
//  - VIN input is normalized (uppercase, alphanumerics only, max 17).
//  - An unchanged VIN is saved as-is (older records may predate validation).
//  - A changed VIN must be 17 characters (or blank, to remove it). As soon as
//    it reaches 17 characters it's decoded via NHTSA — before Save:
//      same year/make/model  → "✓ matches", Save as normal
//      different car         → Save is blocked; offer "Add as new vehicle"
//                               (opens the add form, VIN pre-filled)
//      can't decode / NHTSA down → Save just saves the VIN
//    Trim is ignored in the comparison: NHTSA trims often differ from what
//    customers enter for the same car.

type Identity = Pick<Vehicle, 'year' | 'make' | 'model'>;

export type VinLookup =
  | { status: 'idle' }
  | { status: 'decoding' }
  | { status: 'match'; decoded: DecodedVin }
  | { status: 'different-car'; decoded: DecodedVin }
  | { status: 'not-found' }
  | { status: 'unavailable' };

// Year/make/model only; make/model compared ignoring case and punctuation
// ("F-150" = "F150", "HONDA" = "Honda").
export function isDifferentCar(v: Identity, d: DecodedVin): boolean {
  const norm = (s?: string | null) => (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return String(v.year) !== d.year || norm(v.make) !== norm(d.make) || norm(v.model) !== norm(d.model);
}

export function describeDecoded(d: DecodedVin): string {
  return [d.year, d.make, d.model, d.trim].filter(Boolean).join(' ');
}

export function useVehicleEdit(onSaved: (updated: Vehicle) => void) {
  const [target, setTarget] = useState<Vehicle | null>(null);
  const [plate, setPlateRaw] = useState('');
  const [vin, setVinRaw] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [lookup, setLookup] = useState<VinLookup>({ status: 'idle' });
  // Set when the admin chooses "Add as new vehicle": the site renders the
  // add-vehicle form for this customer with the VIN pre-filled.
  const [addNew, setAddNew] = useState<{ customerId: string; vin: string } | null>(null);
  // Only the latest lookup may update state (the VIN can change mid-request).
  const lookupSeq = useRef(0);

  const original = target?.vin ?? '';

  function resetLookup() {
    lookupSeq.current += 1;
    setLookup({ status: 'idle' });
  }

  function start(v: Vehicle) {
    setTarget(v);
    setPlateRaw(v.licensePlate ?? '');
    setVinRaw(v.vin ?? '');
    setError('');
    setAddNew(null);
    resetLookup();
  }

  function cancel() {
    setTarget(null);
    setError('');
    resetLookup();
  }

  async function setVin(input: string) {
    const next = normalizeVin(input);
    setVinRaw(next);
    setError('');
    resetLookup();
    if (!target || next === original || next.length !== VIN_LENGTH) return;

    const seq = lookupSeq.current;
    setLookup({ status: 'decoding' });
    const result = await decodeVin(next);
    if (seq !== lookupSeq.current) return;
    if (result.status !== 'ok') {
      setLookup({ status: result.status });
    } else if (isDifferentCar(target, result.vehicle)) {
      setLookup({ status: 'different-car', decoded: result.vehicle });
    } else {
      setLookup({ status: 'match', decoded: result.vehicle });
    }
  }

  const canSave = !saving && lookup.status !== 'decoding' && lookup.status !== 'different-car';

  async function save() {
    if (!target) return;
    if (vin !== original && vin && vin.length !== VIN_LENGTH) {
      setError('VIN must be 17 characters.');
      return;
    }
    if (lookup.status === 'decoding') return;
    if (lookup.status === 'different-car') {
      setError('This VIN belongs to a different car — add it as a new vehicle instead.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const updated = await updateVehicle(target.vehicleId, {
        licensePlate: plate.trim().toUpperCase() || null,
        vin: vin.trim() || null,
      });
      onSaved({ ...target, ...updated });
      cancel();
    } catch {
      setError('Failed to save.');
    } finally {
      setSaving(false);
    }
  }

  // "Add as new vehicle": leave this vehicle untouched and hand the VIN to the
  // add-vehicle form for the same customer.
  function startAddAsNew() {
    if (!target) return;
    setAddNew({ customerId: target.customerId, vin });
    cancel();
  }

  function closeAddAsNew() {
    setAddNew(null);
  }

  return {
    editing: target !== null,
    plate, vin, saving, error, lookup, canSave, addNew,
    setPlate: (t: string) => setPlateRaw(t.toUpperCase()),
    setVin: (t: string) => { void setVin(t); },
    start, cancel, save, startAddAsNew, closeAddAsNew,
  };
}
