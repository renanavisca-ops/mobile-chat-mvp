'use client';

import { useEffect, useState } from 'react';
import { useT } from '@/lib/i18n/context';
import { browserSupabase } from '@/lib/supabase/client';
import {
  listCampaigns, upsertCampaign, deleteCampaign, getAudienceCount,
  type Campaign,
} from '@/lib/db/campaigns';

type Draft = { id?: string; name: string; body: string; dailyLimit: number };

const EMPTY: Draft = { name: '', body: '', dailyLimit: 0 };

/**
 * Settings card to prepare internal campaigns. Only rendered for store admins.
 * SENDING IS DISABLED: there is no background sender or external provider
 * configured (see docs/CAMPAIGNS.md). Admins can draft campaigns and see the
 * authorized-audience count only.
 */
export function CampaignsSettings() {
  const t = useT();
  const [storeId, setStoreId] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [audience, setAudience] = useState(0);
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
        const [cs, aud] = await Promise.all([listCampaigns(prof.store_id), getAudienceCount(prof.store_id)]);
        if (!alive) return;
        setStoreId(prof.store_id);
        setCampaigns(cs);
        setAudience(aud);
      } catch {
        if (alive) setStatus(`❌ ${t('campaigns.loadError')}`);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [t]);

  if (loading || !storeId) return null;

  async function reload() {
    if (!storeId) return;
    try { setCampaigns(await listCampaigns(storeId)); } catch {}
  }

  async function onSave() {
    if (!draft || !storeId) return;
    if (!draft.name.trim() || !draft.body.trim()) { setStatus(`❌ ${t('campaigns.required')}`); return; }
    setBusy(true);
    setStatus('');
    try {
      await upsertCampaign(storeId, draft);
      setDraft(null);
      await reload();
      setStatus(`✅ ${t('campaigns.saved')}`);
    } catch {
      setStatus(`❌ ${t('campaigns.saveError')}`);
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: string) {
    if (!window.confirm(t('campaigns.deleteConfirm'))) return;
    setBusy(true);
    try { await deleteCampaign(id); await reload(); }
    catch { setStatus(`❌ ${t('campaigns.deleteError')}`); }
    finally { setBusy(false); }
  }

  const inputCls = 'w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none';

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-slate-900 bg-slate-950/50 p-4 shadow-sm">
        <div className="text-sm font-medium text-slate-200">{t('campaigns.title')}</div>
        <div className="mt-1 text-xs text-slate-400">{t('campaigns.desc')}</div>
      </div>

      {/* Sending disabled notice — make the state unmistakable. */}
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
        {t('campaigns.disabledNotice')}
      </div>

      <div className="rounded-xl border border-slate-900 bg-slate-950/40 p-3 text-sm text-slate-300">
        {t('campaigns.audience')}: <span className="font-semibold text-slate-100">{audience}</span>
        <div className="mt-0.5 text-[11px] text-slate-500">{t('campaigns.audienceHint')}</div>
      </div>

      {campaigns.length > 0 && (
        <div className="space-y-2">
          {campaigns.map((c) => (
            <div key={c.id} className="flex items-start gap-3 rounded-xl border border-slate-900 bg-slate-950/40 p-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm text-slate-100">{c.name}</span>
                  <span className="shrink-0 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] uppercase text-slate-400">{t(`campaigns.status_${c.status}`)}</span>
                </div>
                <div className="line-clamp-1 text-xs text-slate-500">{c.body}</div>
              </div>
              <button type="button" onClick={() => { setStatus(''); setDraft({ id: c.id, name: c.name, body: c.body, dailyLimit: c.dailyLimit }); }}
                className="shrink-0 rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-slate-700">{t('common.edit')}</button>
              <button type="button" onClick={() => onDelete(c.id)} disabled={busy}
                className="shrink-0 rounded-lg bg-rose-900/40 px-2.5 py-1.5 text-xs text-rose-300 hover:bg-rose-900/60 disabled:opacity-50">{t('common.delete')}</button>
            </div>
          ))}
        </div>
      )}

      {draft ? (
        <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
          <label className="block">
            <span className="mb-1 block text-xs text-slate-400">{t('campaigns.name')}</span>
            <input className={inputCls} placeholder={t('campaigns.namePlaceholder')} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-slate-400">{t('campaigns.body')}</span>
            <textarea rows={3} className={inputCls} placeholder={t('campaigns.bodyPlaceholder')} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-slate-400">{t('campaigns.dailyLimit')}</span>
            <input type="number" min={0} className={inputCls} value={draft.dailyLimit} onChange={(e) => setDraft({ ...draft, dailyLimit: Number(e.target.value) || 0 })} />
          </label>
          <div className="flex items-center gap-2 pt-1">
            <button type="button" onClick={onSave} disabled={busy}
              className="toky-grad rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{busy ? t('common.saving') : t('campaigns.saveDraft')}</button>
            <button type="button" disabled title={t('campaigns.disabledNotice')}
              className="cursor-not-allowed rounded-lg bg-slate-800 px-4 py-2 text-sm text-slate-500" aria-disabled="true">{t('campaigns.send')}</button>
            <button type="button" onClick={() => { setDraft(null); setStatus(''); }}
              className="rounded-lg bg-slate-800 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700">{t('common.cancel')}</button>
            {status && <span className="text-xs text-slate-400">{status}</span>}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => { setStatus(''); setDraft({ ...EMPTY }); }}
            className="rounded-lg bg-slate-800 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700">+ {t('campaigns.add')}</button>
          {status && <span className="text-xs text-slate-400">{status}</span>}
        </div>
      )}
    </div>
  );
}
