'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLanguage } from '@/lib/i18n/context';
import { listMyStickers, deleteSticker, uploadSticker, imageToStickerBlob, type Sticker } from '@/lib/db/stickers';
import {
  getFavorites, toggleFavorite,
  getPacks, createPack, deletePack,
  getPackMap, setPackOf,
} from '@/lib/sticker-collection';
import { StickerCreator } from '@/components/sticker-creator';
import { useBackClose } from '@/lib/back';
import { XIcon, PlusIcon, TrashIcon } from '@/components/icons';

type Tab = 'fav' | 'all' | string;

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
  useBackClose(open, onClose);
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [loading, setLoading] = useState(false);
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [importing, setImporting] = useState(false);

  // Local organization (favorites + packs), kept in React state mirrors.
  const [favs, setFavs] = useState<Set<string>>(new Set());
  const [packs, setPacks] = useState<string[]>([]);
  const [packMap, setPackMap] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<Tab>('all');
  const [selected, setSelected] = useState<string | null>(null);
  const [newPackOpen, setNewPackOpen] = useState(false);
  const [newPackName, setNewPackName] = useState('');

  const importRef = useRef<HTMLInputElement | null>(null);

  const refreshCollection = useCallback(() => {
    setFavs(getFavorites());
    setPacks(getPacks());
    setPackMap(getPackMap());
  }, []);

  const refresh = useCallback(() => {
    setLoading(true);
    listMyStickers()
      .then(setStickers)
      .catch(() => setStickers([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (open) { refresh(); refreshCollection(); }
    else { setEditMode(false); setSelected(null); setNewPackOpen(false); }
  }, [open, refresh, refreshCollection]);

  if (!open) return null;

  const visible = stickers.filter((s) => {
    if (tab === 'fav') return favs.has(s.path);
    if (tab === 'all') return true;
    return packMap[s.path] === tab;
  });

  async function onImportFile(file: File) {
    setImporting(true);
    try {
      const blob = await imageToStickerBlob(file);
      await uploadSticker(blob);
      refresh();
    } catch {
      /* ignore bad image */
    } finally {
      setImporting(false);
    }
  }

  function TabBtn({ id, label }: { id: Tab; label: string }) {
    return (
      <button
        type="button"
        onClick={() => { setTab(id); setSelected(null); }}
        aria-pressed={tab === id}
        className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
          tab === id ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
        }`}
      >
        {label}
      </button>
    );
  }

  const sel = selected ? stickers.find((s) => s.path === selected) ?? null : null;

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
              <button onClick={() => { setImporting(false); importRef.current?.click(); }} className="text-xs font-medium text-slate-400 hover:text-slate-200">
                {importing ? t('stickers.importing') : t('stickers.import')}
              </button>
              {stickers.length > 0 && (
                <button onClick={() => { setEditMode((v) => !v); setSelected(null); }} className="text-xs font-medium text-slate-400 hover:text-slate-200">
                  {editMode ? t('common.done') : t('common.edit')}
                </button>
              )}
              <button onClick={onClose} aria-label={t('common.cancel')} className="text-slate-400 hover:text-slate-200">
                <XIcon size={20} />
              </button>
            </div>
          </div>

          {/* Tabs: Favorites / All / custom packs / + */}
          <div className="flex items-center gap-2 overflow-x-auto border-b border-slate-800/70 px-3 py-2">
            <TabBtn id="fav" label={`★ ${t('stickers.favorites')}`} />
            <TabBtn id="all" label={t('stickers.all')} />
            {packs.map((p) => <TabBtn key={p} id={p} label={p} />)}
            {newPackOpen ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const name = newPackName.trim();
                  if (name) { createPack(name); setPacks(getPacks()); setTab(name); }
                  setNewPackName('');
                  setNewPackOpen(false);
                }}
                className="flex shrink-0 items-center gap-1"
              >
                <input
                  autoFocus
                  value={newPackName}
                  onChange={(e) => setNewPackName(e.target.value)}
                  placeholder={t('stickers.packName')}
                  maxLength={40}
                  className="w-28 rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-100 focus:outline-none"
                />
                <button type="submit" className="shrink-0 rounded-full bg-indigo-600 px-2 py-1 text-xs text-white">OK</button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setNewPackOpen(true)}
                className="shrink-0 rounded-full bg-slate-800 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-700"
                aria-label={t('stickers.newPack')}
              >
                ＋
              </button>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {/* Delete-pack control when viewing a custom pack */}
            {tab !== 'fav' && tab !== 'all' && (
              <div className="mb-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => { deletePack(tab); setPacks(getPacks()); setPackMap(getPackMap()); setTab('all'); }}
                  className="text-[11px] text-rose-300 hover:text-rose-200"
                >
                  {t('stickers.deletePack')}
                </button>
              </div>
            )}

            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {/* Create tile (only on All) */}
              {tab === 'all' && (
                <button
                  type="button"
                  onClick={() => setCreatorOpen(true)}
                  className="toky-ring-brand flex aspect-square flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-slate-700 text-emerald-400 hover:bg-slate-900/60"
                >
                  <PlusIcon size={22} />
                  <span className="px-1 text-center text-[11px] font-medium leading-tight">{t('stickers.create')}</span>
                </button>
              )}

              {visible.map((s) => {
                const fav = favs.has(s.path);
                const isSel = selected === s.path;
                return (
                  <div key={s.path} className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        if (editMode) { setSelected(isSel ? null : s.path); return; }
                        onPick(s.url);
                        onClose();
                      }}
                      className={`toky-checker grid aspect-square w-full place-items-center overflow-hidden rounded-2xl border p-1.5 ${
                        isSel ? 'border-indigo-500 ring-2 ring-indigo-500/50' : 'border-slate-800 hover:border-slate-600'
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={s.url} alt="sticker" className="max-h-full max-w-full object-contain" />
                    </button>

                    {/* Favorite star (always available) */}
                    <button
                      type="button"
                      aria-label={t('stickers.favorite')}
                      onClick={() => { toggleFavorite(s.path); setFavs(getFavorites()); }}
                      className={`absolute -left-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full shadow ${
                        fav ? 'bg-amber-400 text-slate-900' : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      <span className="text-[13px] leading-none">{fav ? '★' : '☆'}</span>
                    </button>

                    {editMode && (
                      <button
                        type="button"
                        aria-label={t('common.remove')}
                        onClick={async () => {
                          try {
                            await deleteSticker(s.path);
                            setStickers((prev) => prev.filter((x) => x.path !== s.path));
                            setSelected((cur) => (cur === s.path ? null : cur));
                          } catch { /* ignore */ }
                        }}
                        className="absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full bg-rose-600 text-white shadow"
                      >
                        <TrashIcon size={13} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {!loading && stickers.length === 0 && (
              <p className="mt-6 text-center text-sm text-slate-500">{t('stickers.empty')}</p>
            )}
            {!loading && stickers.length > 0 && visible.length === 0 && (
              <p className="mt-6 text-center text-sm text-slate-500">
                {tab === 'fav' ? t('stickers.noFavorites') : t('stickers.emptyPack')}
              </p>
            )}
          </div>

          {/* Organize bar for the selected sticker (edit mode): assign to a pack. */}
          {editMode && sel && (
            <div className="border-t border-slate-800 p-3">
              <div className="mb-1.5 text-[11px] uppercase tracking-wide text-slate-500">{t('stickers.moveToPack')}</div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => { setPackOf(sel.path, null); setPackMap(getPackMap()); }}
                  aria-pressed={!packMap[sel.path]}
                  className={`rounded-full px-3 py-1 text-xs ${!packMap[sel.path] ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300'}`}
                >
                  {t('stickers.noPack')}
                </button>
                {packs.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => { setPackOf(sel.path, p); setPackMap(getPackMap()); }}
                    aria-pressed={packMap[sel.path] === p}
                    className={`rounded-full px-3 py-1 text-xs ${packMap[sel.path] === p ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300'}`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <input
        ref={importRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) void onImportFile(f);
        }}
      />

      <StickerCreator
        open={creatorOpen}
        onClose={() => setCreatorOpen(false)}
        onCreated={() => refresh()}
      />
    </>
  );
}
