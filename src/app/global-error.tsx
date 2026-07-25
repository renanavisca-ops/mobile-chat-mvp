'use client';

/**
 * Global error boundary — the last line of defense.
 *
 * This catches errors thrown by the root layout itself (providers, theme, etc.)
 * where the normal error.tsx boundary can't help, because at that point the root
 * layout has failed. It therefore must render its own <html> and <body>, and
 * cannot rely on globals.css/Tailwind having loaded — so styles are inline.
 */

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Global error boundary caught:', error);
  }, [error]);

  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#020617',
          color: '#f1f5f9',
          fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
          padding: '24px',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '360px',
            textAlign: 'center',
            border: '1px solid #1e293b',
            borderRadius: '16px',
            background: 'rgba(15,23,42,0.6)',
            padding: '32px',
          }}
        >
          <div style={{ fontSize: '28px', marginBottom: '12px' }}>⚠️</div>
          <h1 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>Algo salió mal</h1>
          <p style={{ fontSize: '13px', color: '#94a3b8', marginTop: '4px' }}>Something went wrong</p>
          <p style={{ fontSize: '14px', lineHeight: 1.6, color: '#cbd5e1', marginTop: '16px' }}>
            La aplicación tuvo un problema al cargar.
            <br />
            <span style={{ color: '#64748b' }}>The app hit a problem while loading.</span>
          </p>
          <button
            onClick={() => reset()}
            style={{
              marginTop: '24px',
              width: '100%',
              border: 'none',
              borderRadius: '12px',
              background: '#2563eb',
              color: '#fff',
              fontSize: '14px',
              fontWeight: 500,
              padding: '10px 16px',
              cursor: 'pointer',
            }}
          >
            Reintentar · Try again
          </button>
          {error?.digest ? (
            <p style={{ marginTop: '20px', fontSize: '11px', color: '#475569' }}>Ref: {error.digest}</p>
          ) : null}
        </div>
      </body>
    </html>
  );
}
