'use client';

import { useEffect, useRef, useState } from 'react';
import { useT } from '@/lib/i18n/context';
import { queuedCount } from '@/lib/send-queue';

type Phase = 'online' | 'offline' | 'reconnected';

/**
 * App-wide connection status. Shows a thin banner while offline (messages are
 * queued and auto-sent on reconnect by the send-queue), and a brief
 * "back online" confirmation when connectivity returns. Renders nothing while
 * steadily online.
 */
export function ConnectionBanner() {
  const t = useT();
  const [phase, setPhase] = useState<Phase>('online');
  const [queued, setQueued] = useState(0);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Seed from the current state (guarded: not all runtimes expose it).
    let online = true;
    try { online = navigator.onLine; } catch {}
    setPhase(online ? 'online' : 'offline');

    const clearHide = () => { if (hideTimer.current) { clearTimeout(hideTimer.current); hideTimer.current = null; } };

    const goOffline = () => {
      clearHide();
      setPhase('offline');
    };
    const goOnline = () => {
      clearHide();
      setPhase('reconnected');
      // Keep the confirmation briefly, then hide.
      hideTimer.current = setTimeout(() => setPhase('online'), 2500);
    };

    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
      clearHide();
    };
  }, []);

  // While offline, reflect how many messages are waiting to send.
  useEffect(() => {
    if (phase !== 'offline') { setQueued(0); return; }
    const tick = () => { try { setQueued(queuedCount()); } catch { setQueued(0); } };
    tick();
    const id = setInterval(tick, 2000);
    return () => clearInterval(id);
  }, [phase]);

  if (phase === 'online') return null;

  const offline = phase === 'offline';
  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed inset-x-0 top-0 z-[100] px-3 pt-[env(safe-area-inset-top)] text-center text-xs font-medium ${
        offline ? 'bg-slate-800 text-slate-200' : 'bg-emerald-700 text-white'
      }`}
    >
      <div className="py-1.5">
        {offline
          ? (queued > 0
              ? t('connection.offlineQueued', { count: queued })
              : t('connection.offline'))
          : t('connection.reconnected')}
      </div>
    </div>
  );
}
