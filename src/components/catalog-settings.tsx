'use client';

import { useEffect, useRef, useState } from 'react';
import { useT } from '@/lib/i18n/context';
import { browserSupabase } from '@/lib/supabase/client';
import { compressImage } from '@/lib/image-compress';
import {
  listProducts, upsertProduct, deleteProduct, uploadProductImage, productImageUrl,
  type Product, type ProductInput,
} from '@/lib/db/catalog';

const EMPTY_DRAFT: ProductInput = {
  name: '', description: '', price: '', imagePath: null, active: true,
};

/**
 * Settings card for a store's catalog (products/services). Only rendered for
 * store admins. The saved catalog is shown to customers in the public support
 * chat.
 */
export function CatalogSettings() {
  const t = useT();
  const [storeId, setStoreId] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<ProductInput | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState('');
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const supabase = browserSupabase();
        const { data: sessionData } = await supabase.auth.getSession();
        const user = sessionData.session?.user;
        if (!user) { if (alive) setLoading(false); return; }
        const { data } = await (supabase as any)
          .from('profiles').select('role, store_id').eq('id', user.id).limit(1);
        const prof = (data as any[])?.[0];
        const canEdit = prof && prof.store_id && (prof.role === 'admin' || prof.role === 'superadmin');
        if (!canEdit) { if (alive) setLoading(false); return; }
        const list = await listProducts(prof.store_id);
        if (!alive) return;
        setStoreId(prof.store_id);
        setProducts(list);
      } catch {
        if (alive) setStatus(`❌ ${t('catalog.loadError')}`);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [t]);

  if (loading || !storeId) return null;

  async function reload() {
    if (!storeId) return;
    try { setProducts(await listProducts(storeId)); } catch {}
  }

  async function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !draft || !storeId) return;
    setUploading(true);
    setStatus('');
    try {
      const small = await compressImage(file, 1024, 0.8);
      const path = await uploadProductImage(storeId, small);
      setDraft((d) => (d ? { ...d, imagePath: path } : d));
    } catch {
      setStatus(`❌ ${t('catalog.imageError')}`);
    } finally {
      setUploading(false);
    }
  }

  async function onSave() {
    if (!draft || !storeId) return;
    if (!draft.name.trim()) { setStatus(`❌ ${t('catalog.nameRequired')}`); return; }
    setBusy(true);
    setStatus('');
    try {
      await upsertProduct(storeId, draft);
      setDraft(null);
      await reload();
      setStatus(`✅ ${t('catalog.saved')}`);
    } catch {
      setStatus(`❌ ${t('catalog.saveError')}`);
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(p: Product) {
    if (!window.confirm(t('catalog.deleteConfirm'))) return;
    setBusy(true);
    try {
      await deleteProduct(p);
      await reload();
    } catch {
      setStatus(`❌ ${t('catalog.deleteError')}`);
    } finally {
      setBusy(false);
    }
  }

  const inputCls = 'w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none';

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-slate-900 bg-slate-950/50 p-4 shadow-sm">
        <div className="text-sm font-medium text-slate-200">{t('catalog.title')}</div>
        <div className="mt-1 text-xs text-slate-400">{t('catalog.desc')}</div>
      </div>

      {/* Existing products */}
      {products.length > 0 && (
        <div className="space-y-2">
          {products.map((p) => {
            const url = productImageUrl(p.imagePath);
            return (
              <div key={p.id} className="flex items-center gap-3 rounded-xl border border-slate-900 bg-slate-950/40 p-3">
                <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-slate-800 text-slate-500">
                  {url
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={url} alt="" className="h-full w-full object-cover" />
                    : <span className="text-lg">🛍️</span>}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm text-slate-100">{p.name}</span>
                    {!p.active && <span className="shrink-0 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">{t('catalog.hidden')}</span>}
                  </div>
                  {p.price && <div className="text-xs text-emerald-300">{p.price}</div>}
                </div>
                <button type="button" onClick={() => { setStatus(''); setDraft({ id: p.id, name: p.name, description: p.description ?? '', price: p.price ?? '', imagePath: p.imagePath, active: p.active, sort: p.sort }); }}
                  className="shrink-0 rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-slate-700">{t('common.edit')}</button>
                <button type="button" onClick={() => onDelete(p)} disabled={busy}
                  className="shrink-0 rounded-lg bg-rose-900/40 px-2.5 py-1.5 text-xs text-rose-300 hover:bg-rose-900/60 disabled:opacity-50">{t('common.delete')}</button>
              </div>
            );
          })}
        </div>
      )}

      {/* Editor */}
      {draft ? (
        <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
          <label className="block">
            <span className="mb-1 block text-xs text-slate-400">{t('catalog.name')}</span>
            <input className={inputCls} placeholder={t('catalog.namePlaceholder')} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-slate-400">{t('catalog.price')}</span>
            <input className={inputCls} placeholder={t('catalog.pricePlaceholder')} value={draft.price ?? ''} onChange={(e) => setDraft({ ...draft, price: e.target.value })} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-slate-400">{t('catalog.description')}</span>
            <textarea rows={2} className={inputCls} placeholder={t('catalog.descriptionPlaceholder')} value={draft.description ?? ''} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          </label>

          <div className="flex items-center gap-3">
            <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-lg bg-slate-800 text-slate-500">
              {draft.imagePath
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={productImageUrl(draft.imagePath) ?? ''} alt="" className="h-full w-full object-cover" />
                : <span className="text-lg">🖼️</span>}
            </div>
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
              className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700 disabled:opacity-50">
              {uploading ? t('catalog.uploading') : t('catalog.image')}
            </button>
            {draft.imagePath && (
              <button type="button" onClick={() => setDraft({ ...draft, imagePath: null })}
                className="text-xs text-slate-500 hover:text-slate-300">{t('common.remove')}</button>
            )}
            <input ref={fileRef} type="file" hidden accept="image/*" onChange={onPickImage} />
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} />
            {t('catalog.visible')}
          </label>

          <div className="flex items-center gap-2 pt-1">
            <button type="button" onClick={onSave} disabled={busy || uploading}
              className="toky-grad rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
              {busy ? t('common.saving') : t('common.save')}
            </button>
            <button type="button" onClick={() => { setDraft(null); setStatus(''); }}
              className="rounded-lg bg-slate-800 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700">{t('common.cancel')}</button>
            {status && <span className="text-xs text-slate-400">{status}</span>}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => { setStatus(''); setDraft({ ...EMPTY_DRAFT }); }}
            className="rounded-lg bg-slate-800 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700">
            + {t('catalog.add')}
          </button>
          {status && <span className="text-xs text-slate-400">{status}</span>}
        </div>
      )}
    </div>
  );
}
