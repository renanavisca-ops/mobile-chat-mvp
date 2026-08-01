'use client';

import { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { useLanguage } from '@/lib/i18n/context';
import { canNativeFiles, shareNativeFile, saveNativeFile } from '@/lib/native-files';
import {
  XIcon,
  DownloadIcon,
  PrinterIcon,
  ForwardIcon,
  ExternalLinkIcon,
  FileIcon,
} from '@/components/icons';

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

function ext(name?: string): string {
  if (!name) return '';
  const m = name.match(/\.([a-z0-9]+)$/i);
  return m ? m[1].toUpperCase() : '';
}

/** Best-effort MIME from the filename when the message body didn't carry one. */
function mimeFromName(name?: string): string {
  const e = ext(name).toLowerCase();
  const map: Record<string, string> = {
    pdf: 'application/pdf',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    txt: 'text/plain',
    csv: 'text/csv',
  };
  return map[e] || '';
}

/**
 * Attachment preview sheet. Opens when a document row in the conversation is
 * tapped. Previews images and PDFs inline; every file type gets Download,
 * Print (when previewable), Resend (forward) and Open-externally actions.
 *
 * The bytes are resolved through `load()` — the SAME fetch/decrypt path the
 * forward ("Resend") flow uses — rather than the conversation's pre-resolved
 * signed-URL map, which can be empty (a transient RLS/auth race) or, in an
 * encrypted chat, an `octet-stream` blob URL that an <iframe> refuses to render.
 * We then rebuild a typed same-origin object URL so preview, download, print and
 * open all work: the browser ignores the `download` attribute on cross-origin
 * URLs and `target="_blank"` frequently no-ops inside a mobile WebView, so a
 * same-origin object URL is what makes downloads actually fire.
 */
export function DocumentPreview({
  open,
  onClose,
  load,
  httpUrl,
  srcKey,
  fileName,
  fileSize,
  fileMime,
  onResend,
}: {
  open: boolean;
  onClose: () => void;
  /** Resolve the decrypted attachment bytes. Omitted when there's nothing to load. */
  load?: () => Promise<Blob>;
  /**
   * Resolve a real http(s) signed URL for the file (undefined for encrypted
   * chats, which have no server-side plaintext). Preferred for Open/Download:
   * the Capacitor WebView can't save or open a `blob:` URL, but it delegates a
   * window.open of an http(s) URL to the system browser, which then renders or
   * downloads it (with `download` forcing an attachment disposition).
   */
  httpUrl?: (opts?: { download?: boolean }) => Promise<string>;
  /** Stable identity of the attachment (its storage path) so re-renders that
   *  hand us a fresh `load` closure don't retrigger the fetch. */
  srcKey?: string;
  fileName?: string;
  fileSize?: number;
  fileMime?: string;
  /** Forward/re-send this attachment to another chat. */
  onResend?: () => void;
}) {
  const { t } = useLanguage();
  const loadRef = useRef(load);
  loadRef.current = load;
  const [objUrl, setObjUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const printFrameRef = useRef<HTMLIFrameElement | null>(null);

  const native = Capacitor.isNativePlatform();
  // On native we save/share the actual bytes through the OS, so we always need
  // the (decrypted) blob — even for a Word/Excel doc we won't preview inline.
  const nativeFiles = canNativeFiles();
  const name = fileName || t('chat.file');
  const mime = (fileMime || mimeFromName(fileName) || '').toLowerCase();
  const isImage = mime.startsWith('image/');
  const isPdf = mime === 'application/pdf';
  // The Android System WebView has no built-in PDF renderer, so an <iframe> of a
  // PDF is blank there — only render it inline on the web, and lean on Open
  // (system browser) natively.
  const canInlinePdf = isPdf && !native;
  const previewable = isImage || canInlinePdf;
  // We only need to fetch (and decrypt) the bytes when we'll actually show them
  // inline, or when there's no http URL to hand off to (encrypted chats). A
  // Word/Excel doc on native, say, needs neither — skip the (up-to-50MB) fetch.
  const needsBytes = isImage || canInlinePdf || !httpUrl || nativeFiles;

  // Lock body scroll + close on Escape while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  // Resolve the bytes whenever the sheet opens for a new attachment. Rebuild a
  // typed object URL so <iframe>/<img> render (encrypted chats hand back an
  // untyped blob) and so downloads have a same-origin URL to click.
  useEffect(() => {
    if (!open || !loadRef.current || !needsBytes) return;
    let cancelled = false;
    let created: string | null = null;
    setError(null);
    setNotice(null);
    setBlob(null);
    setObjUrl(null);
    setLoading(true);
    (async () => {
      try {
        const raw = await loadRef.current!();
        if (cancelled) return;
        const type = fileMime || mimeFromName(fileName) || raw.type || 'application/octet-stream';
        const typed = raw.type === type ? raw : new Blob([raw], { type });
        created = URL.createObjectURL(typed);
        setBlob(typed);
        setObjUrl(created);
      } catch {
        if (!cancelled) setError(t('chat.previewFailed'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      if (created) {
        try { URL.revokeObjectURL(created); } catch {}
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, srcKey]);

  if (!open) return null;

  async function handleDownload() {
    // Native: write the decrypted bytes to the device's Documents.
    if (nativeFiles && blob) {
      setError(null);
      try {
        await saveNativeFile(blob, name);
        setNotice(t('chat.savedToDevice'));
      } catch {
        setError(t('chat.downloadFailed'));
      }
      return;
    }
    // Web, non-encrypted: a real signed URL with an attachment disposition, which
    // the browser downloads.
    if (httpUrl) {
      try {
        const u = await httpUrl({ download: true });
        window.open(u, '_blank', 'noopener,noreferrer');
        return;
      } catch {
        setError(t('chat.downloadFailed'));
        return;
      }
    }
    // Web, encrypted: same-origin blob click.
    if (!blob) return;
    const dl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = dl;
    a.download = name;
    a.rel = 'noreferrer';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => {
      try { URL.revokeObjectURL(dl); } catch {}
    }, 4000);
  }

  function handlePrint() {
    if (!objUrl) return;
    const frame = printFrameRef.current;
    if (!frame) return;
    frame.onload = () => {
      try {
        frame.contentWindow?.focus();
        frame.contentWindow?.print();
      } catch {
        window.open(objUrl, '_blank', 'noopener,noreferrer');
      }
    };
    frame.src = objUrl;
  }

  async function handleShareNative() {
    if (!blob) return;
    setError(null);
    try {
      await shareNativeFile(blob, name, name);
    } catch {
      // A user-cancelled share sheet throws too — don't surface that as an error.
    }
  }

  async function handleOpenExternal() {
    // Native: hand the decrypted file to the OS share sheet (view/print/save).
    if (nativeFiles) {
      await handleShareNative();
      return;
    }
    // Web, non-encrypted: open the signed URL (renders PDFs/Office previews).
    if (httpUrl) {
      try {
        const u = await httpUrl();
        window.open(u, '_blank', 'noopener,noreferrer');
        return;
      } catch {
        /* fall through to blob */
      }
    }
    if (objUrl) window.open(objUrl, '_blank', 'noopener,noreferrer');
  }

  const ready = !!objUrl && !!blob;
  // Open/Download work as soon as we can produce a URL — an http URL needs no
  // byte fetch, so they light up even while the inline preview is still loading.
  const canOpen = ready || !!httpUrl;

  return (
    <div
      className="fixed inset-0 z-[92] flex flex-col bg-black/90 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3 pt-safe">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10 text-white">
          <FileIcon size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">{name}</p>
          <p className="text-xs text-white/50">
            {[ext(fileName), fmtBytes(fileSize)].filter(Boolean).join(' · ')}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
          aria-label={t('common.close')}
        >
          <XIcon size={22} />
        </button>
      </div>

      {/* Preview body */}
      <div className="flex flex-1 items-center justify-center overflow-auto p-4">
        {loading ? (
          <div className="h-40 w-full max-w-md animate-pulse rounded-2xl bg-white/10" />
        ) : error ? (
          <div className="flex max-w-sm flex-col items-center gap-3 text-center">
            <span className="grid h-20 w-20 place-items-center rounded-3xl bg-white/10 text-white/70">
              <FileIcon size={40} />
            </span>
            <p className="text-sm text-red-300">{error}</p>
          </div>
        ) : ready && isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={objUrl!} alt={name} className="max-h-full max-w-full rounded-xl object-contain" />
        ) : ready && canInlinePdf ? (
          <iframe src={objUrl!} title={name} className="h-full w-full rounded-xl bg-white" />
        ) : (
          <button
            type="button"
            onClick={canOpen ? handleOpenExternal : undefined}
            disabled={!canOpen}
            className="flex max-w-sm flex-col items-center gap-4 text-center disabled:cursor-default"
          >
            <span className="grid h-24 w-24 place-items-center rounded-3xl bg-white/10 text-white/80">
              <FileIcon size={44} />
            </span>
            <div>
              <p className="text-sm font-medium text-white/90">
                {ext(fileName) ? `${ext(fileName)} · ` : ''}
                {fmtBytes(fileSize)}
              </p>
              <p className="mt-1 text-xs text-white/50">
                {canOpen ? t('chat.tapToOpen') : t('chat.noInlinePreview')}
              </p>
            </div>
          </button>
        )}
      </div>

      {notice ? (
        <p className="px-4 pb-1 text-center text-xs text-emerald-300">{notice}</p>
      ) : error && !loading ? (
        <p className="px-4 pb-1 text-center text-xs text-red-300">{error}</p>
      ) : null}

      {/* Action bar */}
      <div className="grid grid-cols-4 gap-1 border-t border-white/10 px-2 py-2 pb-safe">
        <ActionButton
          label={t('chat.download')}
          disabled={!canOpen}
          onClick={handleDownload}
          icon={<DownloadIcon size={22} />}
        />
        <ActionButton
          label={t('chat.print')}
          // On the web we print the inline preview; natively (no WebView print)
          // we hand off to the system browser, which can print — so enable it
          // whenever we can open the file.
          disabled={native ? !canOpen : (!ready || !previewable)}
          onClick={native ? handleOpenExternal : handlePrint}
          icon={<PrinterIcon size={22} />}
        />
        <ActionButton
          label={t('chat.resend')}
          disabled={!onResend}
          onClick={() => {
            onResend?.();
            onClose();
          }}
          icon={<ForwardIcon size={22} />}
        />
        <ActionButton
          label={t('chat.openExternal')}
          disabled={!canOpen}
          onClick={handleOpenExternal}
          icon={<ExternalLinkIcon size={22} />}
        />
      </div>

      {/* Hidden frame used only to drive printing without navigating away. */}
      <iframe ref={printFrameRef} title="print" className="hidden" aria-hidden="true" />
    </div>
  );
}

function ActionButton({
  label,
  icon,
  onClick,
  disabled,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex flex-col items-center gap-1 rounded-xl px-1 py-2 text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-35"
    >
      {icon}
      <span className="text-[11px] font-medium">{label}</span>
    </button>
  );
}
