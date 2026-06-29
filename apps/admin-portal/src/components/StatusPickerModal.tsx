import React, { useEffect, useRef, useState } from 'react';
import type { AppointmentStatus } from '../api/appointments';

const KEYFRAME_ID = 'status-picker-keyframes';
const KEYFRAMES = `
  @keyframes sp-pop {
    from { opacity: 0; transform: scale(0.93) translateY(-4px); }
    to   { opacity: 1; transform: scale(1)    translateY(0); }
  }
  .sp-popover { animation: sp-pop 0.15s cubic-bezier(0.16, 1, 0.3, 1); }
`;

const POPOVER_WIDTH = 260;

const FORWARD_STYLE: Partial<Record<AppointmentStatus, { bg: string; color: string; border: string }>> = {
  confirmed:     { bg: 'rgba(37,99,235,0.07)',   color: '#2563EB', border: 'rgba(37,99,235,0.3)' },
  'in-progress': { bg: 'rgba(124,58,237,0.07)',  color: '#7C3AED', border: 'rgba(124,58,237,0.3)' },
  completed:     { bg: 'rgba(22,163,74,0.07)',   color: '#16A34A', border: 'rgba(22,163,74,0.3)' },
};

function statusLabel(s: AppointmentStatus) {
  return s === 'in-progress' ? 'In Progress' : s.charAt(0).toUpperCase() + s.slice(1);
}

interface Props {
  anchorRect: DOMRect | null;
  currentStatus: AppointmentStatus;
  validNext: AppointmentStatus[];
  onSelect: (status: AppointmentStatus) => void;
  onDismiss: () => void;
}

export default function StatusPickerModal({ anchorRect, currentStatus, validNext, onSelect, onDismiss }: Props) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0, openUp: false });

  useEffect(() => {
    if (document.getElementById(KEYFRAME_ID)) return;
    const style = document.createElement('style');
    style.id = KEYFRAME_ID;
    style.textContent = KEYFRAMES;
    document.head.appendChild(style);
  }, []);

  useEffect(() => {
    if (!anchorRect) return;
    const height = popoverRef.current?.offsetHeight ?? 160;
    const spaceBelow = window.innerHeight - anchorRect.bottom;
    const openUp = spaceBelow < height + 12 && anchorRect.top > height + 12;
    const rawLeft = anchorRect.left + anchorRect.width / 2 - POPOVER_WIDTH / 2;
    const left = Math.max(8, Math.min(rawLeft, window.innerWidth - POPOVER_WIDTH - 8));
    const top = openUp ? anchorRect.top - height - 6 : anchorRect.bottom + 6;
    setPos({ top, left, openUp });
  }, [anchorRect]);

  if (!anchorRect) return null;

  const forwardOpts = validNext.filter(s => s !== 'cancelled');
  const canCancel = validNext.includes('cancelled');

  return (
    <>
      {/* Invisible backdrop to catch outside clicks */}
      <div onClick={onDismiss} style={{ position: 'fixed', inset: 0, zIndex: 1000 }} />

      <div
        ref={popoverRef}
        className="sp-popover"
        style={{
          position: 'fixed',
          top: pos.top,
          left: pos.left,
          width: POPOVER_WIDTH,
          zIndex: 1001,
          backgroundColor: 'var(--color-surface)',
          borderRadius: '12px',
          border: '1px solid var(--color-border)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.1)',
          padding: '14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        <p style={{ margin: 0, fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Change Status
        </p>

        {forwardOpts.map(s => {
          const c = FORWARD_STYLE[s];
          return (
            <button
              key={s}
              onClick={() => { onDismiss(); onSelect(s); }}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: '8px',
                border: `1px solid ${c?.border ?? 'var(--color-border)'}`,
                backgroundColor: c?.bg ?? 'var(--color-background)',
                color: c?.color ?? 'var(--color-text-primary)',
                fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                textAlign: 'center', transition: 'opacity 0.1s',
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.75')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            >
              Move to {statusLabel(s)}
            </button>
          );
        })}

        {/* Divider */}
        <div style={{ height: '1px', backgroundColor: 'var(--color-divider)', margin: '2px 0' }} />

        <div style={{ display: 'flex', gap: '8px' }}>
          {canCancel && (
            <button
              onClick={() => { onDismiss(); onSelect('cancelled'); }}
              style={{
                flex: 1, padding: '9px 10px', borderRadius: '8px',
                border: '1px solid rgba(220,38,38,0.3)',
                backgroundColor: 'rgba(220,38,38,0.05)',
                color: '#DC2626', fontSize: '12px', fontWeight: 700,
                cursor: 'pointer', transition: 'opacity 0.1s',
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.75')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            >
              Cancel Appt
            </button>
          )}
          <button
            onClick={onDismiss}
            style={{
              flex: canCancel ? undefined : 1,
              padding: '9px 12px', borderRadius: '8px',
              border: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-background)',
              color: 'var(--color-text-secondary)', fontSize: '12px', fontWeight: 600,
              cursor: 'pointer', transition: 'opacity 0.1s',
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.7')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            Dismiss
          </button>
        </div>
      </div>
    </>
  );
}
