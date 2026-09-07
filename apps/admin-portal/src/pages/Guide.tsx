import React from 'react';

/**
 * Owner's Guide — renders the self-contained guide document
 * (public/owner-guide.html) inside a full-height iframe. The guide is a static
 * asset so it stays fast and never couples to the app's data or auth.
 */
export default function Guide() {
  return (
    <div style={{ height: '100%', minHeight: 'calc(100vh - 150px)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }}>
        <a
          href="/owner-guide.html"
          target="_blank"
          rel="noreferrer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '7px 14px',
            borderRadius: '8px',
            border: '1px solid var(--color-border)',
            backgroundColor: 'var(--color-surface)',
            color: 'var(--color-text-secondary)',
            fontSize: '13px',
            fontWeight: 500,
            textDecoration: 'none',
          }}
        >
          <span aria-hidden="true">↗</span>
          <span>Open in new tab</span>
        </a>
      </div>
      <iframe
        title="Owner's Guide"
        src="/owner-guide.html"
        style={{
          flex: 1,
          width: '100%',
          minHeight: 'calc(100vh - 200px)',
          border: '1px solid var(--color-border)',
          borderRadius: '12px',
          backgroundColor: 'var(--color-surface)',
        }}
      />
    </div>
  );
}
