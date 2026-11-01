'use client';

import { useEffect, useState } from 'react';
import { useT } from '@/lib/i18n/context';
import { browserSupabase } from '@/lib/supabase/client';
import {
  listAutomationRules, upsertAutomationRule, deleteAutomationRule,
  type AutomationRule, type AutomationInput,
} from '@/lib/db/automations';
import { listLabels, type Label } from '@/lib/db/labels';
import type { MatchType } from '@/lib/automations/match';

type Draft = Omit<AutomationInput, 'keywords'> & { keywordsText: string };

const EMPTY: Draft = {
  name: '', enabled: true, matchType: 'contains', keywordsText: '',
  caseSensitive: false, actionReply: '', actionLabelId: null,
};

/**
 * Settings card to manage keyword automation rules. Only rendered for store
 * admins. Rules run server-side on incoming support-chat messages (see
 * api/public-chat) — they never touch end-to-end-encrypted chats.
 */
export function AutomationsSettings() {
  const t = useT();
  const [storeId, setStoreId] = useState<string | null>(null);
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
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
        const [rs, ls] = await Promise.all([listAutomationRules(prof.store_id), listLabels(prof.store_id)]);
        if (!alive) return;
        setStoreId(prof.store_id);
        setRules(rs);
        setLabels(ls);
      } catch {
        if (alive) setStatus(`❌ ${t('automations.loadError')}`);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [t]);

  if (loading || !storeId) return null;

  async function reload() {
    if (!storeId) return;
    try { setRules(await listAutomationRules(storeId)); } catch {}
  }

  async function onSave() {
    if (!draft || !storeId) return;
    const keywords = draft.keywordsText.split(',').map((k) => k.trim()).filter(Boolean);
    if (!draft.name.trim() || keywords.length === 0) { setStatus(`❌ ${t('automations.required')}`); return; }
    if (!draft.actionReply?.trim() && !draft.actionLabelId) { setStatus(`❌ ${t('automations.needAction')}`); return; }
    setBusy(true);
    setStatus('');
    try {
      await upsertAutomationRule(storeId, { ...draft, keywords });
      setDraft(null);
      await reload();
      setStatus(`✅ ${t('automations.saved')}`);
    } catch {
      setStatus(`❌ ${t('automations.saveError')}`);
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: string) {
    if (!window.confirm(t('automations.deleteConfirm'))) return;
    setBusy(true);
    try { await deleteAutomationRule(id); await reload(); }
    catch { setStatus(`❌ ${t('automations.deleteError')}`); }
    finally { setBusy(false); }
  }

  const inputCls = 'w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none';
  const matchLabel = (m: MatchType) => t(`automations.match_${m}`);

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-slate-900 bg-slate-950/50 p-4 shadow-sm">
        <div className="text-sm font-medium text-slate-200">{t('automations.title')}</div>
        <div className="mt-1 text-xs text-slate-400">{t('automations.desc')}</div>
      </div>

      {rules.length > 0 && (
        <div className="space-y-2">
          {rules.map((r) => (
            <div key={r.id} className="flex items-start gap-3 rounded-xl border border-slate-900 bg-slate-950/40 p-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm text-slate-100">{r.name}</span>
                  {!r.enabled && <span className="shrink-0 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">{t('automations.off')}</span>}
                </div>
                <div className="truncate text-xs text-slate-500">
                  {matchLabel(r.matchType)}: {r.keywords.join(', ')}
                </div>
              </div>
              <button type="button" onClick={() => { setStatus(''); setDraft({ id: r.id, name: r.name, enabled: r.enabled, matchType: r.matchType, keywordsText: r.keywords.join(', '), caseSensitive: r.caseSensitive, actionReply: r.actionReply ?? '', actionLabelId: r.actionLabelId }); }}
                className="shrink-0 rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-slate-700">{t('common.edit')}</button>
              <button type="button" onClick={() => onDelete(r.id)} disabled={busy}
                className="shrink-0 rounded-lg bg-rose-900/40 px-2.5 py-1.5 text-xs text-rose-300 hover:bg-rose-900/60 disabled:opacity-50">{t('common.delete')}</button>
            </div>
          ))}
        </div>
      )}

      {draft ? (
        <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
          <label className="block">
            <span className="mb-1 block text-xs text-slate-400">{t('automations.name')}</span>
            <input className={inputCls} placeholder={t('automations.namePlaceholder')} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-1 block text-xs text-slate-400">{t('automations.matchType')}</span>
              <select className={inputCls} value={draft.matchType} onChange={(e) => setDraft({ ...draft, matchType: e.target.value as MatchType })}>
                <option value="contains">{t('automations.match_contains')}</option>
                <option value="equals">{t('automations.match_equals')}</option>
                <option value="starts_with">{t('automations.match_starts_with')}</option>
              </select>
            </label>
            <label className="flex items-end gap-2 pb-2 text-sm text-slate-300">
              <input type="checkbox" checked={draft.caseSensitive} onChange={(e) => setDraft({ ...draft, caseSensitive: e.target.checked })} />
              {t('automations.caseSensitive')}
            </label>
          </div>
          <label className="block">
            <span className="mb-1 block text-xs text-slate-400">{t('automations.keywords')}</span>
            <input className={inputCls} placeholder={t('automations.keywordsPlaceholder')} value={draft.keywordsText} onChange={(e) => setDraft({ ...draft, keywordsText: e.target.value })} />
          </label>

          <div className="h-px bg-slate-800" />
          <div className="text-xs text-slate-400">{t('automations.actions')}</div>
          <label className="block">
            <span className="mb-1 block text-xs text-slate-400">{t('automations.reply')}</span>
            <textarea rows={2} className={inputCls} placeholder={t('automations.replyPlaceholder')} value={draft.actionReply ?? ''} onChange={(e) => setDraft({ ...draft, actionReply: e.target.value })} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-slate-400">{t('automations.label')}</span>
            <select className={inputCls} value={draft.actionLabelId ?? ''} onChange={(e) => setDraft({ ...draft, actionLabelId: e.target.value || null })}>
              <option value="">{t('automations.noLabel')}</option>
              {labels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </label>

          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={draft.enabled} onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })} />
            {t('automations.enabled')}
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
          <button type="button" onClick={() => { setStatus(''); setDraft({ ...EMPTY }); }}
            className="rounded-lg bg-slate-800 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700">+ {t('automations.add')}</button>
          {status && <span className="text-xs text-slate-400">{status}</span>}
        </div>
      )}
    </div>
  );
}
