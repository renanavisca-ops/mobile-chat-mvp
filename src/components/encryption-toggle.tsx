'use client';

import { useEffect, useState } from 'react';
import { useT } from '@/lib/i18n/context';
import { getChatEncrypted, enableChatEncryption } from '@/lib/db/chats';

/**
 * Opt-in end-to-end encryption for a 1:1 or group chat (§9). Shows the current
 * state and, when off, lets the user turn it on. Enabling calls
 * enableChatEncryption, which locks the chat (distributes a wrapped key to each
 * member and marks it encrypted); from then on messages are sealed. If a member
 * hasn't set up encryption on a device yet, it reports that instead of failing
 * silently. Never forces encryption (no enc_required) so no one is locked out.
 */
export function EncryptionToggle({ chatId }: { chatId: string }) {
  const t = useT();
  const [encrypted, setEncrypted] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    getChatEncrypted(chatId).then(setEncrypted).catch(() => setEncrypted(false));
  }, [chatId]);

  async function enable() {
    setBusy(true); setMsg('');
    try {
      const r = await enableChatEncryption(chatId);
      if (r.ok) { setEncrypted(true); setMsg(''); }
      else setMsg(t('encryption.missing'));
    } catch (e: any) {
      setMsg(e?.message === 'Set up encryption on this device first.' ? t('encryption.setupFirst') : t('encryption.error'));
    } finally { setBusy(false); }
  }

  if (encrypted === null) return null;

  return (
    <div className="mt-3 rounded-lg border border-slate-900 bg-slate-950/40 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium text-slate-200">🔒 {t('encryption.title')}</div>
          <div className="mt-0.5 text-xs text-slate-500">
            {encrypted ? t('encryption.onDesc') : t('encryption.offDesc')}
          </div>
        </div>
        {encrypted ? (
          <span className="shrink-0 rounded-full bg-emerald-900/40 px-2 py-0.5 text-xs text-emerald-300">{t('encryption.on')}</span>
        ) : (
          <button
            type="button"
            onClick={enable}
            disabled={busy}
            className="shrink-0 rounded-lg toky-grad toky-ring-brand px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          >
            {busy ? t('encryption.enabling') : t('encryption.enable')}
          </button>
        )}
      </div>
      {msg && <p className="mt-2 text-xs text-amber-300">{msg}</p>}
    </div>
  );
}
