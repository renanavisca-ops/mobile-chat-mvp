'use client';

import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '@/lib/i18n/context';
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

/**
 * Attachment preview sheet. Opens when a document row in the conversation is
 * tapped. Previews images and PDFs inline; every file type gets Download,
 * Print (when previewable), Resend (forward) and Open-externally actions.
 *
 * Download is done by fetching the bytes and clicking a same-origin object URL:
 * the browser's `download` attribute is IGNORED on cross-origin URLs (the
 * Supabase signed URL), and `target="_blank"` frequently no-ops inside a mobile
 * WebView — so a plain `<a download>` "does nothing". Fetch → blob → object URL
 * works for both the signed URLs of legacy chats and the already-decrypted
 * `blob:` URLs of encrypted chats.
 */
export function DocumentPreview({
  open,
  onClose,
  url,
  fileName,
  fileSize,
  fileMime,
  onResend,
}: {
  open: boolean;
  onClose: () => void;
  /** Resolved signed/blob URL, or undefined while the attachment is still loading. */
  url?: string;
  fileName?: string;
  fileSize?: number;
  fileMime?: string;
  /** Forward/re-send this attachment to another chat. */
  onResend?: () => void;
}) {
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const printFrameRef = useRef<HTMLIFrameElement | null>(null);

  const mime = (fileMime || '').toLowerCase();
  const name = fileName || t('chat.file');
  const isImage = mime.startsWith('image/');
  const isPdf = mime === 'application/pdf' || /\.pdf$/i.test(fileName || '');
  const previewable = isImage || isPdf;

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

  // Reset transient state whenever a different attachment opens.
  useEffect(() => {
    if (open) setError(null);
  }, [open, url]);

  if (!open) return null;

  async function handleDownload() {
    if (!url) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('fetch failed');
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = name;
      a.rel = 'noreferrer';
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Give the download a beat to start before revoking the URL.
      setTimeout(() => {
        try { URL.revokeObjectURL(objUrl); } catch {}
      }, 4000);
    } catch {
      setError(t('chat.downloadFailed'));
    } finally {
      setBusy(false);
    }
  }

  function handlePrint() {
    if (!url) return;
    // Print the rendered preview via a hidden iframe so we never navigate away.
    const frame = printFrameRef.current;
    if (!frame) return;
    frame.onload = () => {
      try {
        frame.contentWindow?.focus();
        frame.contentWindow?.print();
      } catch {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    };
    frame.src = url;
  }

  function handleOpenExternal() {
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

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
        {!url ? (
          <div className="h-40 w-full max-w-md animate-pulse rounded-2xl bg-white/10" />
        ) : isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={name}
            className="max-h-full max-w-full rounded-xl object-contain"
          />
        ) : isPdf ? (
          <iframe
            src={url}
            title={name}
            className="h-full w-full rounded-xl bg-white"
          />
        ) : (
          <div className="flex max-w-sm flex-col items-center gap-4 text-center">
            <span className="grid h-24 w-24 place-items-center rounded-3xl bg-white/10 text-white/80">
              <FileIcon size={44} />
            </span>
            <div>
              <p className="text-sm font-medium text-white/90">
                {ext(fileName) ? `${ext(fileName)} · ` : ''}
                {fmtBytes(fileSize)}
              </p>
              <p className="mt-1 text-xs text-white/50">{t('chat.noInlinePreview')}</p>
            </div>
          </div>
        )}
      </div>

      {error ? (
        <p className="px-4 pb-1 text-center text-xs text-red-300">{error}</p>
      ) : null}

      {/* Action bar */}
      <div className="grid grid-cols-4 gap-1 border-t border-white/10 px-2 py-2 pb-safe">
        <ActionButton
          label={t('chat.download')}
          disabled={!url || busy}
          onClick={handleDownload}
          icon={<DownloadIcon size={22} />}
        />
        <ActionButton
          label={t('chat.print')}
          disabled={!url || !previewable}
          onClick={handlePrint}
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
          disabled={!url}
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
