'use client';

import { useState } from 'react';
import { PageShell } from '@/components/page-shell';
import { createLocalDeviceBundle } from '@/lib/crypto/device';

export default function OnboardingPage() {
  const [status, setStatus] = useState('');

  async function runOnboarding() {
    const result = await createLocalDeviceBundle();
    localStorage.setItem('device_bundle', JSON.stringify(result));
    setStatus('Device identity creada localmente y lista para publicar prekeys.');
  }

  return (
    <PageShell title="Onboarding">
      <p>Configura el dispositivo único (MVP) y genera las llaves de Signal protocol en cliente.</p>
      <button className="w-fit rounded bg-blue-600 px-3 py-2" onClick={runOnboarding}>
        Generar llaves locales
      </button>
      <p aria-live="polite">{status}</p>
    </PageShell>
  );
}
