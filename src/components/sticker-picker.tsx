'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLanguage } from '@/lib/i18n/context';
import { listMyStickers, deleteSticker, type Sticker } from '@/lib/db/stickers';
import { StickerCreator } from '@/components/sticker-creator';
import { XIcon, PlusIcon, TrashIcon } from '@/components/icons';

export function StickerPicker({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (url: string) => void;
}) {
  const { t } = useLanguage();
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [loading, setLoading] = useState(false);
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const refresh = useCallback(() => {
    setLoading(true);
    listMyStickers()
      .then(setStickers)
      .catch(() => setStickers([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (open) refresh();
    else setEditMode(false);
  }, [open, refresh]);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-[85] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
        <div
          className="toky-glass toky-elev flex max-h-[80vh] w-full max-w-md flex-col rounded-t-3xl border border-slate-800 sm:rounded-3xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
            <h2 className="font-display text-base font-bold text-slate-100">{t('stickers.myStickers')}</h2>
            <div className="flex items-center gap-3">
              {stickers.length > 0 && (
                <button onClick={() => setEditMode((v) => !v)} className="text-xs font-medium text-slate-400 hover:text-slate-200">
                  {editMode ? t('common.done') : t('common.edit')}
                </button>
              )}
              <button onClick={onClose} aria-label={t('common.cancel')} className="text-slate-400 hover:text-slate-200">
                <XIcon size={20} />
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {/* Create tile */}
              <button
                type="button"
                onClick={() => setCreatorOpen(true)}
                className="toky-ring-brand flex aspect-square flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-slate-700 text-emerald-400 hover:bg-slate-900/60"
              >
                <PlusIcon size={22} />
                <span className="px-1 text-center text-[11px] font-medium leading-tight">{t('stickers.create')}</span>
              </button>

              {stickers.map((s) => (
                <div key={s.path} className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      if (editMode) return;
                      onPick(s.url);
                      onClose();
                    }}
                    className="toky-checker grid aspect-square w-full place-items-center overflow-hidden rounded-2xl border border-slate-800 p-1.5 hover:border-slate-600"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={s.url} alt="sticker" className="max-h-full max-w-full object-contain" />
                  </button>
                  {editMode && (
                    <button
                      type="button"
                      aria-label={t('common.remove')}
                      onClick={async () => {
                        try {
                          await deleteSticker(s.path);
                          setStickers((prev) => prev.filter((x) => x.path !== s.path));
                        } catch {
                          /* ignore */
                        }
                      }}
                      className="absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full bg-rose-600 text-white shadow"
                    >
                      <TrashIcon size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {!loading && stickers.length === 0 && (
              <p className="mt-6 text-center text-sm text-slate-500">{t('stickers.empty')}</p>
            )}
          </div>
        </div>
      </div>

      <StickerCreator
        open={creatorOpen}
        onClose={() => setCreatorOpen(false)}
        onCreated={() => refresh()}
      />
    </>
  );
}
