'use client';

import { useMemo, useState } from 'react';
import { useT } from '@/lib/i18n/context';
import { firstUrl } from '@/components/link-preview';
import { FileIcon, GlobeIcon, XIcon } from '@/components/icons';

/** Minimal shape of a decrypted message the gallery needs. */
export type GalleryMessage = {
  id: string;
  created_at?: string;
  body: {
    text?: string;
    imagePath?: string;
    imagePaths?: string[];
    videoPath?: string;
    filePath?: string;
    fileName?: string;
    fileMime?: string;
    fileSize?: number;
    is_deleted?: boolean;
  };
};

type Tab = 'media' | 'docs' | 'links';

type MediaItem = { key: string; path: string; isVideo: boolean };
type DocItem = { key: string; body: GalleryMessage['body'] };
type LinkItem = { key: string; url: string; text: string };

function fmtBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  return `${n >= 10 || i === 0 ? Math.round(n) : n.toFixed(1)} ${units[i]}`;
}

/**
 * Shared media / docs / links for a chat — WhatsApp's "Archivos, enlaces y docs".
 * Reads from the already-decrypted messages the conversation holds and reuses
 * its resolver + viewers (an image URL opens the lightbox, a file opens the
 * document preview), so nothing is fetched or decrypted twice.
 */
export function ChatMediaGallery({
  open,
  onClose,
  messages,
  resolveUrl,
  onOpenImage,
  onOpenDoc,
}: {
  open: boolean;
  onClose: () => void;
  messages: GalleryMessage[];
  resolveUrl: (path: string) => string | undefined;
  onOpenImage: (url: string) => void;
  onOpenDoc: (body: GalleryMessage['body']) => void;
}) {
  const t = useT();
  const [tab, setTab] = useState<Tab>('media');

  const { media, docs, links } = useMemo(() => {
    const media: MediaItem[] = [];
    const docs: DocItem[] = [];
    const links: LinkItem[] = [];
    // Newest first.
    const ordered = [...messages].reverse();
    for (const m of ordered) {
      const b = m.body;
      if (!b || b.is_deleted) continue;
      if (b.imagePath) media.push({ key: `${m.id}:${b.imagePath}`, path: b.imagePath, isVideo: false });
      if (Array.isArray(b.imagePaths)) {
        for (const p of b.imagePaths) if (p) media.push({ key: `${m.id}:${p}`, path: p, isVideo: false });
      }
      if (b.videoPath) media.push({ key: `${m.id}:${b.videoPath}`, path: b.videoPath, isVideo: true });
      if (b.filePath) docs.push({ key: `${m.id}:${b.filePath}`, body: b });
      const url = firstUrl(b.text);
      if (url) links.push({ key: `${m.id}:link`, url, text: (b.text ?? '').trim() });
    }
    return { media, docs, links };
  }, [messages]);

  if (!open) return null;

  const TabBtn = ({ id, label, count }: { id: Tab; label: string; count: number }) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition ${
        tab === id ? 'toky-grad toky-ring-brand text-white' : 'text-slate-400 hover:text-slate-200'
      }`}
    >
      {label} {count > 0 ? <span className="opacity-70">({count})</span> : null}
    </button>
  );

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-3xl border border-slate-800 toky-glass toky-elev">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="text-base font-semibold text-slate-100">{t('gallery.title')}</div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="grid h-8 w-8 place-items-center rounded-full bg-slate-800 text-slate-300 hover:bg-slate-700"
          >
            <XIcon size={18} />
          </button>
        </div>

        <div className="mx-4 mb-3 flex gap-1 rounded-xl border border-slate-800 bg-slate-900/50 p-1">
          <TabBtn id="media" label={t('gallery.media')} count={media.length} />
          <TabBtn id="docs" label={t('gallery.docs')} count={docs.length} />
          <TabBtn id="links" label={t('gallery.links')} count={links.length} />
        </div>

        <div className="flex-1 overflow-auto px-4 pb-4">
          {tab === 'media' && (
            media.length === 0 ? (
              <Empty label={t('gallery.empty')} />
            ) : (
              <div className="grid grid-cols-3 gap-1.5">
                {media.map((it) => {
                  const url = resolveUrl(it.path);
                  return (
                    <button
                      key={it.key}
                      type="button"
                      onClick={() => url && onOpenImage(url)}
                      className="relative aspect-square overflow-hidden rounded-lg bg-slate-800"
                    >
                      {url ? (
                        it.isVideo ? (
                          <video src={url} className="h-full w-full object-cover" muted playsInline />
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={url} alt="" className="h-full w-full object-cover" />
                        )
                      ) : (
                        <div className="h-full w-full animate-pulse bg-slate-800" />
                      )}
                      {it.isVideo && (
                        <span className="absolute inset-0 grid place-items-center">
                          <span className="grid h-8 w-8 place-items-center rounded-full bg-black/50 text-white">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                          </span>
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )
          )}

          {tab === 'docs' && (
            docs.length === 0 ? (
              <Empty label={t('gallery.empty')} />
            ) : (
              <ul className="space-y-1.5">
                {docs.map((it) => (
                  <li key={it.key}>
                    <button
                      type="button"
                      onClick={() => onOpenDoc(it.body)}
                      className="flex w-full items-center gap-3 rounded-lg border border-slate-900 bg-slate-950/60 px-3 py-2.5 text-left hover:bg-slate-900"
                    >
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-slate-800 text-slate-300">
                        <FileIcon size={20} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-slate-200">{it.body.fileName || t('chat.file')}</span>
                        <span className="block text-xs text-slate-500">{fmtBytes(it.body.fileSize)}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )
          )}

          {tab === 'links' && (
            links.length === 0 ? (
              <Empty label={t('gallery.empty')} />
            ) : (
              <ul className="space-y-1.5">
                {links.map((it) => (
                  <li key={it.key}>
                    <a
                      href={it.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 rounded-lg border border-slate-900 bg-slate-950/60 px-3 py-2.5 hover:bg-slate-900"
                    >
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-slate-800 text-slate-300">
                        <GlobeIcon size={20} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-blue-400">{it.url}</span>
                        {it.text && it.text !== it.url && (
                          <span className="block truncate text-xs text-slate-500">{it.text}</span>
                        )}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            )
          )}
        </div>
      </div>
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return <div className="grid h-40 place-items-center text-center text-sm text-slate-500">{label}</div>;
}
