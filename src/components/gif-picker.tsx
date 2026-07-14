'use client';

import { useEffect, useRef, useState } from 'react';
import { searchGifs, trendingGifs, giphyConfigured, type Gif } from '@/lib/giphy';
import { useT } from '@/lib/i18n/context';

export function GifPicker({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (gif: Gif) => void;
}) {
  const t = useT();
  const [query, setQuery] = useState('');
  const [gifs, setGifs] = useState<Gif[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const reqId = useRef(0);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setErr('');
    if (!giphyConfigured()) {
      setErr(t('gif.notConfigured'));
      setGifs([]);
      return;
    }
    setLoading(true);
    const id = ++reqId.current;
    trendingGifs()
      .then((g) => id === reqId.current && setGifs(g))
      .catch(() => id === reqId.current && setErr(t('gif.error')))
      .finally(() => id === reqId.current && setLoading(false));
  }, [open, t]);

  useEffect(() => {
    if (!open || !giphyConfigured()) return;
    const id = ++reqId.current;
    setLoading(true);
    const timer = setTimeout(() => {
      searchGifs(query)
        .then((g) => id === reqId.current && setGifs(g))
        .catch(() => id === reqId.current && setErr(t('gif.error')))
        .finally(() => id === reqId.current && setLoading(false));
    }, 350);
    return () => clearTimeout(timer);
  }, [query, open, t]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[75] flex items-end justify-center bg-black/60 p-2 sm:items-center"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex h-[70vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-900 bg-slate-950 shadow-xl">
        <div className="flex items-center gap-2 border-b border-slate-900 p-3">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('gif.searchPlaceholder')}
            className="flex-1 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
          />
          <button type="button" onClick={onClose} className="rounded bg-slate-800 px-3 py-2 text-xs hover:bg-slate-700">
            {t('common.close')}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {err ? (
            <p className="p-4 text-center text-sm text-slate-400">{err}</p>
          ) : loading && gifs.length === 0 ? (
            <p className="p-4 text-center text-sm text-slate-500">{t('common.loading')}</p>
          ) : gifs.length === 0 ? (
            <p className="p-4 text-center text-sm text-slate-500">{t('gif.noResults')}</p>
          ) : (
            <div className="columns-2 gap-2 sm:columns-3">
              {gifs.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => onPick(g)}
                  className="mb-2 block w-full overflow-hidden rounded-lg border border-slate-900 hover:border-indigo-500"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={g.previewUrl} alt={g.title || 'GIF'} className="w-full" loading="lazy" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-slate-900 p-2 text-center text-[10px] text-slate-500">{t('gif.poweredBy')}</div>
      </div>
    </div>
  );
}
