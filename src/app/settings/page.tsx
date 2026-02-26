'use client';

import { useEffect, useState } from 'react';
import { PageShell } from '@/components/page-shell';
import { fingerprintFromIdentity } from '@/lib/crypto/fingerprint';

export default function SettingsPage() {
  const [fingerprint, setFingerprint] = useState('calculando...');

  useEffect(() => {
    void fingerprintFromIdentity('missing-identity-material').then(setFingerprint);
  }, []);

  return (
    <PageShell title="Settings">
      <h2 className="text-lg font-medium">Safety Number (MVP)</h2>
      <p className="rounded bg-slate-900 p-3 font-mono text-sm">{fingerprint}</p>
      <p className="text-xs text-slate-400">Comparar fuera de banda para verificar identidad.</p>
    </PageShell>
  );
}
