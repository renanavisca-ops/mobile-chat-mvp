'use client';

import { useEffect, useState } from 'react';
import { useT } from '@/lib/i18n/context';
import { browserSupabase } from '@/lib/supabase/client';
import {
  listTemplates, upsertTemplate, deleteTemplate,
  type MessageTemplate, type TemplateOption,
} from '@/lib/db/templates';

type Draft = { id?: string; title: string; body: string; options: TemplateOption[] };

const newOption = (): TemplateOption => ({ id: crypto.randomUUID(), label: '' });

/**
 * Settings card to manage interactive message templates (text + tappable
 * options). Only rendered for store admins; staff send them from a store chat.
 */
export function TemplatesSettings() {
  const t = useT();
  const [storeId, setStoreId] = useState<string | null>(null);
  const [items, setItems] = useState<MessageTemplate[]>([]);
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
        const list = await listTemplates(prof.store_id);
        if (!alive) return;
        setStoreId(prof.store_id);
        setItems(list);
      } catch {
        if (alive) setStatus(`❌ ${t('templates.loadError')}`);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [t]);

  if (loading || !storeId) return null;

  async function reload() {
    if (!storeId) return;
    try { setItems(await listTemplates(storeId)); } catch {}
  }

  async function onSave() {
    if (!draft || !storeId) return;
    const options = draft.options.filter((o) => o.label.trim());
    if (!draft.title.trim() || !draft.body.trim()) { setStatus(`❌ ${t('templates.required')}`); return; }
    setBusy(true);
    setStatus('');
    try {
      await upsertTemplate(storeId, { ...draft, options });
      setDraft(null);
      await reload();
      setStatus(`✅ ${t('templates.saved')}`);
    } catch {
      setStatus(`❌ ${t('templates.saveError')}`);
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: string) {
    if (!window.confirm(t('templates.deleteConfirm'))) return;
    setBusy(true);
    try { await deleteTemplate(id); await reload(); }
    catch { setStatus(`❌ ${t('templates.deleteError')}`); }
    finally { setBusy(false); }
  }

  const inputCls = 'w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none';

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-slate-900 bg-slate-950/50 p-4 shadow-sm">
        <div className="text-sm font-medium text-slate-200">{t('templates.title')}</div>
        <div className="mt-1 text-xs text-slate-400">{t('templates.desc')}</div>
      </div>

      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((tpl) => (
            <div key={tpl.id} className="flex items-start gap-3 rounded-xl border border-slate-900 bg-slate-950/40 p-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-slate-100">{tpl.title}</div>
                <div className="line-clamp-1 text-xs text-slate-400">{tpl.body}</div>
                {tpl.options.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {tpl.options.map((o) => (
                      <span key={o.id} className="rounded border border-slate-700 px-1.5 py-0.5 text-[10px] text-slate-400">{o.label}</span>
                    ))}
                  </div>
                )}
              </div>
              <button type="button" onClick={() => { setStatus(''); setDraft({ id: tpl.id, title: tpl.title, body: tpl.body, options: tpl.options.length ? tpl.options : [newOption()] }); }}
                className="shrink-0 rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-slate-700">{t('common.edit')}</button>
              <button type="button" onClick={() => onDelete(tpl.id)} disabled={busy}
                className="shrink-0 rounded-lg bg-rose-900/40 px-2.5 py-1.5 text-xs text-rose-300 hover:bg-rose-900/60 disabled:opacity-50">{t('common.delete')}</button>
            </div>
          ))}
        </div>
      )}

      {draft ? (
        <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
          <label className="block">
            <span className="mb-1 block text-xs text-slate-400">{t('templates.name')}</span>
            <input className={inputCls} placeholder={t('templates.namePlaceholder')} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-slate-400">{t('templates.body')}</span>
            <textarea rows={2} className={inputCls} placeholder={t('templates.bodyPlaceholder')} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
          </label>
          <div className="space-y-2">
            <span className="block text-xs text-slate-400">{t('templates.options')}</span>
            {draft.options.map((o, i) => (
              <div key={o.id} className="flex items-center gap-2">
                <input className={inputCls} placeholder={t('templates.optionPlaceholder')} value={o.label}
                  onChange={(e) => setDraft({ ...draft, options: draft.options.map((x) => (x.id === o.id ? { ...x, label: e.target.value } : x)) })} />
                <button type="button" onClick={() => setDraft({ ...draft, options: draft.options.filter((x) => x.id !== o.id) })}
                  className="shrink-0 text-slate-500 hover:text-rose-300" aria-label={t('common.remove')}>✕</button>
              </div>
            ))}
            {draft.options.length < 6 && (
              <button type="button" onClick={() => setDraft({ ...draft, options: [...draft.options, newOption()] })}
                className="text-xs text-indigo-300 hover:text-indigo-200">+ {t('templates.addOption')}</button>
            )}
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
          <button type="button" onClick={() => { setStatus(''); setDraft({ title: '', body: '', options: [newOption()] }); }}
            className="rounded-lg bg-slate-800 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700">+ {t('templates.add')}</button>
          {status && <span className="text-xs text-slate-400">{status}</span>}
        </div>
      )}
    </div>
  );
}
