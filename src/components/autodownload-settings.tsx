'use client';

import { useState } from 'react';
import { useT } from '@/lib/i18n/context';
import {
  getAutoDownloadSettings,
  setAutoDownloadSettings,
  MEDIA_KINDS,
  type AutoDownloadSettings as Settings,
  type MediaKind,
  type NetworkClass,
} from '@/lib/media-autodownload';

/**
 * Settings card: auto-download received media by network (Wi-Fi vs mobile data)
 * and content type (photos / voice / video). Stored on-device. A disabled kind
 * shows a tap-to-download tile in the chat instead of fetching automatically.
 */
export function AutoDownloadSettings() {
  const t = useT();
  const [settings, setSettings] = useState<Settings>(getAutoDownloadSettings);

  function toggle(net: NetworkClass, kind: MediaKind) {
    setSettings((prev) => {
      const next: Settings = {
        wifi: { ...prev.wifi },
        cellular: { ...prev.cellular },
      };
      next[net][kind] = !next[net][kind];
      setAutoDownloadSettings(next);
      return next;
    });
  }

  const nets: NetworkClass[] = ['wifi', 'cellular'];

  return (
    <div className="rounded-xl border border-slate-900 bg-slate-950/50 p-4 shadow-sm">
      <div className="text-sm font-medium text-slate-200">{t('autoDownload.title')}</div>
      <div className="mt-1 text-xs text-slate-400">{t('autoDownload.desc')}</div>

      <div className="mt-4 space-y-4">
        {nets.map((net) => (
          <div key={net}>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t(`autoDownload.net_${net}`)}
            </div>
            <div className="flex flex-wrap gap-2">
              {MEDIA_KINDS.map((kind) => {
                const on = settings[net][kind];
                return (
                  <button
                    key={kind}
                    type="button"
                    role="switch"
                    aria-checked={on}
                    onClick={() => toggle(net, kind)}
                    className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition ${
                      on
                        ? 'border-emerald-600 bg-emerald-600/15 text-emerald-200'
                        : 'border-slate-800 bg-slate-900 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    <span>{on ? '✓' : '○'}</span>
                    {t(`autoDownload.kind_${kind}`)}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
