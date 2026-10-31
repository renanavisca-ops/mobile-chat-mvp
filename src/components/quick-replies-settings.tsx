'use client';

import { useEffect, useState } from 'react';
import { useT } from '@/lib/i18n/context';
import { browserSupabase } from '@/lib/supabase/client';
import { listQuickReplies, upsertQuickReply, deleteQuickReply, type QuickReply } from '@/lib/db/quick-replies';

type Draft = { id?: string; title: string; body: string };

/**
 * Settings card to manage a store's quick replies (canned responses). Only
 * rendered for store admins; staff insert them from the chat composer.
 */
export function QuickRepliesSettings() {
  const t = useT();
  const [storeId, setStoreId] = useState<string | null>(null);
  const [items, setItems] = useState<QuickReply[]>([]);
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
        const list = await listQuickReplies(prof.store_id);
        if (!alive) return;
        setStoreId(prof.store_id);
        setItems(list);
      } catch {
        if (alive) setStatus(`❌ ${t('quickReplies.loadError')}`);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [t]);

  if (loading || !storeId) return null;

  async function reload() {
    if (!storeId) return;
    try { setItems(await listQuickReplies(storeId)); } catch {}
  }

  async function onSave() {
    if (!draft || !storeId) return;
    if (!draft.title.trim() || !draft.body.trim()) { setStatus(`❌ ${t('quickReplies.required')}`); return; }
    setBusy(true);
    setStatus('');
    try {
      await upsertQuickReply(storeId, draft);
      setDraft(null);
      await reload();
      setStatus(`✅ ${t('quickReplies.saved')}`);
    } catch {
      setStatus(`❌ ${t('quickReplies.saveError')}`);
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: string) {
    if (!window.confirm(t('quickReplies.deleteConfirm'))) return;
    setBusy(true);
    try { await deleteQuickReply(id); await reload(); }
    catch { setStatus(`❌ ${t('quickReplies.deleteError')}`); }
    finally { setBusy(false); }
  }

  const inputCls = 'w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none';

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-slate-900 bg-slate-950/50 p-4 shadow-sm">
        <div className="text-sm font-medium text-slate-200">{t('quickReplies.title')}</div>
        <div className="mt-1 text-xs text-slate-400">{t('quickReplies.desc')}</div>
      </div>

      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((q) => (
            <div key={q.id} className="flex items-start gap-3 rounded-xl border border-slate-900 bg-slate-950/40 p-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-slate-100">{q.title}</div>
                <div className="line-clamp-2 text-xs text-slate-400">{q.body}</div>
              </div>
              <button type="button" onClick={() => { setStatus(''); setDraft({ id: q.id, title: q.title, body: q.body }); }}
                className="shrink-0 rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-slate-700">{t('common.edit')}</button>
              <button type="button" onClick={() => onDelete(q.id)} disabled={busy}
                className="shrink-0 rounded-lg bg-rose-900/40 px-2.5 py-1.5 text-xs text-rose-300 hover:bg-rose-900/60 disabled:opacity-50">{t('common.delete')}</button>
            </div>
          ))}
        </div>
      )}

      {draft ? (
        <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
          <label className="block">
            <span className="mb-1 block text-xs text-slate-400">{t('quickReplies.shortcut')}</span>
            <input className={inputCls} placeholder={t('quickReplies.shortcutPlaceholder')} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-slate-400">{t('quickReplies.message')}</span>
            <textarea rows={3} className={inputCls} placeholder={t('quickReplies.messagePlaceholder')} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
          </label>
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
          <button type="button" onClick={() => { setStatus(''); setDraft({ title: '', body: '' }); }}
            className="rounded-lg bg-slate-800 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700">+ {t('quickReplies.add')}</button>
          {status && <span className="text-xs text-slate-400">{status}</span>}
        </div>
      )}
    </div>
  );
}
