import { useEffect, useState } from 'react';
// The guide is a self-contained HTML document (all images inlined as data URIs).
// We import it as a raw string and render it from an in-memory blob URL rather
// than serving it as a static file — Amplify's SPA rewrite would otherwise send
// /owner-guide.html back to index.html, nesting the portal inside itself.
import guideHtml from '../assets/owner-guide.html?raw';

export default function Guide() {
  const [url, setUrl] = useState('');

  useEffect(() => {
    const blob = new Blob([guideHtml], { type: 'text/html' });
    const objectUrl = URL.createObjectURL(blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, []);

  return (
    <div style={{ height: '100%', minHeight: 'calc(100vh - 150px)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }}>
        <a
          href={url || undefined}
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
            pointerEvents: url ? 'auto' : 'none',
            opacity: url ? 1 : 0.5,
          }}
        >
          <span aria-hidden="true">↗</span>
          <span>Open in new tab</span>
        </a>
      </div>
      <iframe
        title="Owner's Guide"
        src={url}
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
