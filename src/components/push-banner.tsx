'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useT } from '@/lib/i18n/context';

type Banner = { id: number; title: string; body: string; url?: string };

/**
 * Top in-app banner for a push that arrives while the app is open. The OS
 * doesn't show a foreground FCM notification, so `initForegroundPush` raises a
 * `toky:push` event and this renders it (tap to open the chat). Auto-dismisses.
 */
export function PushBanner() {
  const router = useRouter();
  const t = useT();
  const [banner, setBanner] = useState<Banner | null>(null);

  useEffect(() => {
    let hideTimer: ReturnType<typeof setTimeout> | undefined;
    const onPush = (e: Event) => {
      const detail = (e as CustomEvent).detail as
        | { title?: string; body?: string; url?: string; count?: number }
        | undefined;
      if (!detail) return;
      // A coalesced burst (count > 1) shows one summary line instead of each msg.
      const multi = (detail.count ?? 1) > 1;
      setBanner({
        id: Date.now(),
        title: multi ? t('push.newMessages', { n: detail.count ?? 0 }) : detail.title || 'Toky Chat',
        body: multi ? '' : detail.body || '',
        url: detail.url,
      });
      if (hideTimer) clearTimeout(hideTimer);
      hideTimer = setTimeout(() => setBanner(null), 4500);
    };
    window.addEventListener('toky:push', onPush as EventListener);
    return () => {
      window.removeEventListener('toky:push', onPush as EventListener);
      if (hideTimer) clearTimeout(hideTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!banner) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[95] flex justify-center px-3 pt-safe">
      <button
        type="button"
        onClick={() => {
          const url = banner.url;
          setBanner(null);
          if (url) router.push(url);
        }}
        className="pointer-events-auto mt-2 w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900/95 px-4 py-3 text-left shadow-2xl ring-1 ring-black/40 backdrop-blur toky-rise"
      >
        <div className="truncate text-sm font-semibold text-slate-100">{banner.title}</div>
        {banner.body && <div className="truncate text-xs text-slate-300">{banner.body}</div>}
      </button>
    </div>
  );
}
