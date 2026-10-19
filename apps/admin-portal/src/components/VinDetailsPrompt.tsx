import React from 'react';
import { describeDecoded, type VinLookup } from '../hooks/useVehicleEdit';

// Live result of the VIN lookup, shown under the VIN field while editing —
// before Save. A VIN that belongs to a different car blocks the edit and
// offers to add that car as a new vehicle instead.
type Props = {
  lookup: VinLookup;
  onAddAsNew: () => void;
  style?: React.CSSProperties;
};

const note = (color: string): React.CSSProperties => ({ fontSize: '12px', color, lineHeight: 1.4 });

export default function VinDetailsPrompt({ lookup, onAddAsNew, style }: Props) {
  if (lookup.status === 'idle') return null;
  let body: React.ReactNode;
  switch (lookup.status) {
    case 'decoding':
      body = <span style={note('var(--color-text-muted)')}>Looking up VIN…</span>;
      break;
    case 'match':
      body = <span style={note('var(--color-success)')}>✓ VIN matches this vehicle ({describeDecoded(lookup.decoded)}).</span>;
      break;
    case 'not-found':
      body = <span style={note('var(--color-text-muted)')}>Couldn't decode this VIN — it will be saved as entered.</span>;
      break;
    case 'unavailable':
      body = <span style={note('var(--color-text-muted)')}>VIN lookup is unavailable right now — it will be saved as entered.</span>;
      break;
    case 'different-car':
      body = (
        <div role="group" aria-label="Different car" style={{ backgroundColor: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.35)', borderRadius: '8px', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontSize: '13px', color: 'var(--color-text-primary)', lineHeight: 1.4 }}>
            This VIN belongs to a <strong>{describeDecoded(lookup.decoded)}</strong> — a different car.
            To keep this vehicle's service history accurate, add it as a new vehicle instead.
          </span>
          <button
            type="button"
            onClick={onAddAsNew}
            style={{ alignSelf: 'flex-start', padding: '6px 12px', borderRadius: '6px', border: 'none', backgroundColor: 'var(--color-primary)', color: 'white', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
          >
            Add as new vehicle
          </button>
        </div>
      );
      break;
  }
  return <div style={style}>{body}</div>;
}
