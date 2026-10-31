'use client';

import { useEffect, useState } from 'react';
import { useT } from '@/lib/i18n/context';
import { browserSupabase } from '@/lib/supabase/client';
import {
  listLabels, upsertLabel, deleteLabel, labelChipClasses, labelDotClasses,
  LABEL_COLORS, type Label,
} from '@/lib/db/labels';

type Draft = { id?: string; name: string; color: string };

/**
 * Settings card to manage a store's conversation labels. Only rendered for
 * store admins; staff apply the labels from a store chat.
 */
export function LabelsSettings() {
  const t = useT();
  const [storeId, setStoreId] = useState<string | null>(null);
  const [items, setItems] = useState<Label[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');

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
        const list = await listLabels(prof.store_id);
        if (!alive) return;
        setStoreId(prof.store_id);
        setItems(list);
      } catch {
        if (alive) setStatus(`❌ ${t('labels.loadError')}`);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [t]);

  if (loading || !storeId) return null;

  async function reload() {
    if (!storeId) return;
    try { setItems(await listLabels(storeId)); } catch {}
  }

  async function onSave() {
    if (!draft || !storeId) return;
    if (!draft.name.trim()) { setStatus(`❌ ${t('labels.required')}`); return; }
    setBusy(true);
    setStatus('');
    try {
      await upsertLabel(storeId, draft);
      setDraft(null);
      await reload();
      setStatus(`✅ ${t('labels.saved')}`);
    } catch {
      setStatus(`❌ ${t('labels.saveError')}`);
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: string) {
    if (!window.confirm(t('labels.deleteConfirm'))) return;
    setBusy(true);
    try { await deleteLabel(id); await reload(); }
    catch { setStatus(`❌ ${t('labels.deleteError')}`); }
    finally { setBusy(false); }
  }

  const inputCls = 'w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none';

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-slate-900 bg-slate-950/50 p-4 shadow-sm">
        <div className="text-sm font-medium text-slate-200">{t('labels.title')}</div>
        <div className="mt-1 text-xs text-slate-400">{t('labels.desc')}</div>
      </div>

      {items.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {items.map((l) => (
            <span key={l.id} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ring-1 ${labelChipClasses(l.color)}`}>
              {l.name}
              <button type="button" onClick={() => { setStatus(''); setDraft({ id: l.id, name: l.name, color: l.color ?? 'slate' }); }}
                className="opacity-70 hover:opacity-100" aria-label={t('common.edit')}>✎</button>
              <button type="button" onClick={() => onDelete(l.id)} disabled={busy}
                className="opacity-70 hover:opacity-100" aria-label={t('common.delete')}>✕</button>
            </span>
          ))}
        </div>
      )}

      {draft ? (
        <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
          <label className="block">
            <span className="mb-1 block text-xs text-slate-400">{t('labels.name')}</span>
            <input className={inputCls} placeholder={t('labels.namePlaceholder')} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </label>
          <div>
            <span className="mb-1 block text-xs text-slate-400">{t('labels.color')}</span>
            <div className="flex flex-wrap gap-2">
              {LABEL_COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setDraft({ ...draft, color: c })}
                  className={`h-7 w-7 rounded-full ${labelDotClasses(c)} ${draft.color === c ? 'ring-2 ring-white' : 'ring-1 ring-slate-700'}`}
                  aria-label={c} />
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button type="button" onClick={onSave} disabled={busy}
              className="toky-grad rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{busy ? t('common.saving') : t('common.save')}</button>
            <button type="button" onClick={() => { setDraft(null); setStatus(''); }}
              className="rounded-lg bg-slate-800 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700">{t('common.cancel')}</button>
            {status && <span className="text-xs text-slate-400">{status}</span>}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => { setStatus(''); setDraft({ name: '', color: 'indigo' }); }}
            className="rounded-lg bg-slate-800 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700">+ {t('labels.add')}</button>
          {status && <span className="text-xs text-slate-400">{status}</span>}
        </div>
      )}
    </div>
  );
}
