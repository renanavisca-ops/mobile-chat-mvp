'use client';

import { useEffect, useState } from 'react';
import { useT } from '@/lib/i18n/context';
import { browserSupabase } from '@/lib/supabase/client';
import { getStoreProfile, updateStoreProfile, updateStoreAutoMessages, type StoreProfileFields, type StoreAutoMessages } from '@/lib/db/store-profile';

const EMPTY: StoreProfileFields = {
  category: '', about: '', address: '', website: '', phone: '', businessHours: '',
};

const EMPTY_AUTO: StoreAutoMessages = { welcomeMessage: '', awayMessage: '', awayActive: false };

/**
 * Settings card for a store's commercial profile. Only rendered for store
 * admins (role admin/superadmin with a store); agents and regular users see
 * nothing. The saved data is shown to customers in the public support chat.
 */
export function BusinessProfileSettings() {
  const t = useT();
  const [storeId, setStoreId] = useState<string | null>(null);
  const [fields, setFields] = useState<StoreProfileFields>(EMPTY);
  const [auto, setAuto] = useState<StoreAutoMessages>(EMPTY_AUTO);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingAuto, setSavingAuto] = useState(false);
  const [status, setStatus] = useState('');
  const [statusAuto, setStatusAuto] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const supabase = browserSupabase();
        const { data: sessionData } = await supabase.auth.getSession();
        const user = sessionData.session?.user;
        if (!user) { if (alive) setLoading(false); return; }

        const { data } = await (supabase as any)
          .from('profiles')
          .select('role, store_id')
          .eq('id', user.id)
          .limit(1);
        const prof = (data as any[])?.[0];
        const canEdit = prof && prof.store_id &&
          (prof.role === 'admin' || prof.role === 'superadmin');
        if (!canEdit) { if (alive) setLoading(false); return; }

        const profile = await getStoreProfile(prof.store_id);
        if (!alive) return;
        setStoreId(prof.store_id);
        if (profile) {
          setFields({
            category: profile.category ?? '',
            about: profile.about ?? '',
            address: profile.address ?? '',
            website: profile.website ?? '',
            phone: profile.phone ?? '',
            businessHours: profile.businessHours ?? '',
          });
          setAuto({
            welcomeMessage: profile.welcomeMessage ?? '',
            awayMessage: profile.awayMessage ?? '',
            awayActive: profile.awayActive,
          });
        }
      } catch {
        if (alive) setStatus(`❌ ${t('business.loadError')}`);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [t]);

  // Nothing to show for non-admins (or while we resolve who the user is).
  if (loading || !storeId) return null;

  const set = (k: keyof StoreProfileFields) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setFields((f) => ({ ...f, [k]: e.target.value }));

  async function onSave() {
    if (!storeId) return;
    setSaving(true);
    setStatus('');
    try {
      await updateStoreProfile(storeId, fields);
      setStatus(`✅ ${t('business.saved')}`);
    } catch {
      setStatus(`❌ ${t('business.saveError')}`);
    } finally {
      setSaving(false);
    }
  }

  async function onSaveAuto() {
    if (!storeId) return;
    setSavingAuto(true);
    setStatusAuto('');
    try {
      await updateStoreAutoMessages(storeId, auto);
      setStatusAuto(`✅ ${t('business.saved')}`);
    } catch {
      setStatusAuto(`❌ ${t('autoMsg.saveError')}`);
    } finally {
      setSavingAuto(false);
    }
  }

  const inputCls = 'w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none';

  const Field = ({ label, k, placeholder, textarea }: { label: string; k: keyof StoreProfileFields; placeholder: string; textarea?: boolean }) => (
    <label className="block">
      <span className="mb-1 block text-xs text-slate-400">{label}</span>
      {textarea ? (
        <textarea rows={3} className={inputCls} placeholder={placeholder} value={fields[k] ?? ''} onChange={set(k)} />
      ) : (
        <input className={inputCls} placeholder={placeholder} value={fields[k] ?? ''} onChange={set(k)} />
      )}
    </label>
  );

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-slate-900 bg-slate-950/50 p-4 shadow-sm">
        <div className="text-sm font-medium text-slate-200">{t('business.title')}</div>
        <div className="mt-1 text-xs text-slate-400">{t('business.desc')}</div>
      </div>

      <div className="space-y-3 rounded-xl border border-slate-900 bg-slate-950/40 p-4">
        <Field label={t('business.category')} k="category" placeholder={t('business.categoryPlaceholder')} />
        <Field label={t('business.about')} k="about" placeholder={t('business.aboutPlaceholder')} textarea />
        <Field label={t('business.address')} k="address" placeholder={t('business.addressPlaceholder')} />
        <Field label={t('business.hours')} k="businessHours" placeholder={t('business.hoursPlaceholder')} />
        <Field label={t('business.website')} k="website" placeholder={t('business.websitePlaceholder')} />
        <Field label={t('business.phone')} k="phone" placeholder={t('business.phonePlaceholder')} />

        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="toky-grad rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? t('common.saving') : t('business.save')}
          </button>
          {status && <span className="text-xs text-slate-400">{status}</span>}
        </div>
      </div>

      {/* Automated messages */}
      <div className="rounded-xl border border-slate-900 bg-slate-950/50 p-4 shadow-sm">
        <div className="text-sm font-medium text-slate-200">{t('autoMsg.title')}</div>
        <div className="mt-1 text-xs text-slate-400">{t('autoMsg.desc')}</div>
      </div>
      <div className="space-y-3 rounded-xl border border-slate-900 bg-slate-950/40 p-4">
        <label className="block">
          <span className="mb-1 block text-xs text-slate-400">{t('autoMsg.welcome')}</span>
          <textarea rows={2} className={inputCls} placeholder={t('autoMsg.welcomePlaceholder')} value={auto.welcomeMessage ?? ''} onChange={(e) => setAuto({ ...auto, welcomeMessage: e.target.value })} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-slate-400">{t('autoMsg.away')}</span>
          <textarea rows={2} className={inputCls} placeholder={t('autoMsg.awayPlaceholder')} value={auto.awayMessage ?? ''} onChange={(e) => setAuto({ ...auto, awayMessage: e.target.value })} />
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input type="checkbox" checked={auto.awayActive} onChange={(e) => setAuto({ ...auto, awayActive: e.target.checked })} />
          {t('autoMsg.awayActive')}
        </label>
        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            onClick={onSaveAuto}
            disabled={savingAuto}
            className="toky-grad rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {savingAuto ? t('common.saving') : t('common.save')}
          </button>
          {statusAuto && <span className="text-xs text-slate-400">{statusAuto}</span>}
        </div>
      </div>
    </div>
  );
}
