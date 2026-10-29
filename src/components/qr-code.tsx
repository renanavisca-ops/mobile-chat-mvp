'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

/** Render a QR code for `value` as an image (generated client-side). */
export function QrCode({ value, size = 184 }: { value: string; size?: number }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(value, { width: size, margin: 1, errorCorrectionLevel: 'M' })
      .then((u) => { if (alive) setUrl(u); })
      .catch(() => { if (alive) setUrl(''); });
    return () => { alive = false; };
  }, [value, size]);

  if (!url) return <div style={{ width: size, height: size }} className="animate-pulse rounded-lg bg-slate-800" />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="QR" width={size} height={size} className="rounded-lg bg-white p-2" />;
}
