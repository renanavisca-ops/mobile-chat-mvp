'use client';

import { apiFetch } from '@/lib/api/client';
import { useEffect, useState } from 'react';

type Preview = {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
};

// Cache across renders/messages so the same link is fetched once per session.
const cache = new Map<string, Preview | null>();
const inflight = new Map<string, Promise<Preview | null>>();

async function loadPreview(url: string): Promise<Preview | null> {
  if (cache.has(url)) return cache.get(url) ?? null;
  if (inflight.has(url)) return inflight.get(url)!;
  const p = (async () => {
    try {
      const res = await apiFetch(`/api/link-preview?url=${encodeURIComponent(url)}`);
      if (!res.ok) return null;
      const data = (await res.json()) as Preview;
      // Only worth showing if we got at least a title or image.
      const useful = data.title || data.image ? data : null;
      cache.set(url, useful);
      return useful;
    } catch {
      cache.set(url, null);
      return null;
    } finally {
      inflight.delete(url);
    }
  })();
  inflight.set(url, p);
  return p;
}

/**
 * Renders an Open Graph card for the first link in a message. Fetches lazily,
 * caches per session, and renders nothing until (and unless) useful data comes
 * back — so a plain link with no metadata just stays a plain link.
 */
export function LinkPreview({ url, mine }: { url: string; mine?: boolean }) {
  const [data, setData] = useState<Preview | null>(() => cache.get(url) ?? null);

  useEffect(() => {
    let alive = true;
    if (!cache.has(url)) {
      loadPreview(url).then((d) => {
        if (alive) setData(d);
      });
    } else {
      setData(cache.get(url) ?? null);
    }
    return () => {
      alive = false;
    };
  }, [url]);

  if (!data) return null;

  const frame = mine
    ? 'border-white/25 bg-black/15 hover:bg-black/25'
    : 'border-slate-700 bg-slate-900/50 hover:bg-slate-900/70';

  return (
    <a
      href={data.url}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={`mt-2 block overflow-hidden rounded-xl border ${frame} transition-colors`}
    >
      {data.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={data.image} alt="" className="max-h-40 w-full object-cover" loading="lazy" />
      ) : null}
      <div className="px-3 py-2">
        {data.siteName ? (
          <div className={`text-[10px] font-semibold uppercase tracking-wide ${mine ? 'text-white/70' : 'text-blue-300'}`}>
            {data.siteName}
          </div>
        ) : null}
        {data.title ? <div className="mt-0.5 line-clamp-2 text-[13px] font-semibold">{data.title}</div> : null}
        {data.description ? (
          <div className={`mt-0.5 line-clamp-2 text-[11px] ${mine ? 'text-white/70' : 'text-slate-400'}`}>
            {data.description}
          </div>
        ) : null}
      </div>
    </a>
  );
}

/** First http(s) URL in a string, or null. */
export function firstUrl(text: string | undefined | null): string | null {
  if (!text) return null;
  const m = text.match(/https?:\/\/[^\s<>"')]+/i);
  return m ? m[0] : null;
}
