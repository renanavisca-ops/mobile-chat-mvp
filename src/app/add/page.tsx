'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { browserSupabase } from '@/lib/supabase/client';
import { profileByUsername, addContact, type ContactCard } from '@/lib/db/contacts';
import { createDirectChatWith } from '@/lib/db/chats';
import { avatarBg, initials } from '@/lib/ui/avatar';
import { useT } from '@/lib/i18n/context';

type Status = 'loading' | 'needauth' | 'notfound' | 'self' | 'ready' | 'working' | 'added' | 'error';

function AddInner() {
  const t = useT();
  const router = useRouter();
  const username = useSearchParams().get('u') || '';
  const [status, setStatus] = useState<Status>('loading');
  const [card, setCard] = useState<ContactCard | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!username) { if (alive) setStatus('notfound'); return; }
      const { data } = await browserSupabase().auth.getSession();
      if (!alive) return;
      if (!data.session?.user) { setStatus('needauth'); return; }
      try {
        const p = await profileByUsername(username);
        if (!alive) return;
        if (!p) { setStatus('notfound'); return; }
        if (p.id === data.session.user.id) { setCard(p); setStatus('self'); return; }
        setCard(p);
        setStatus('ready');
      } catch {
        if (alive) setStatus('notfound');
      }
    })();
    return () => { alive = false; };
  }, [username]);

  const name = card?.displayName || (card?.username ? `@${card.username}` : '');

  async function add() {
    if (!card) return;
    setStatus('working');
    setErr('');
    try {
      await addContact(card.id);
      setStatus('added');
    } catch (e: any) {
      setErr(e?.message ?? String(e));
      setStatus('error');
    }
  }

  async function chat() {
    if (!card) return;
    setStatus('working');
    setErr('');
    try {
      await addContact(card.id).catch(() => {});
      const chatId = await createDirectChatWith(card.id);
      router.replace(`/chats/view?c=${chatId}`);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
      setStatus('error');
    }
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-slate-950 p-6 text-slate-100">
      <div className="w-full max-w-sm rounded-3xl border border-slate-800 bg-slate-900/60 p-6 text-center">
        {status === 'loading' && <div className="mx-auto h-24 w-24 animate-pulse rounded-full bg-slate-800" />}

        {status === 'needauth' && (
          <>
            <h1 className="text-lg font-semibold">{t('addContact.title')}</h1>
            <p className="mt-2 text-sm text-slate-400">{t('addContact.needAuth')}</p>
            <Link href="/login" className="toky-grad mt-4 inline-block rounded-xl px-5 py-2.5 text-sm font-semibold text-white">
              {t('join.signIn')}
            </Link>
          </>
        )}

        {status === 'notfound' && (
          <>
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-slate-800 text-2xl">👤</div>
            <h1 className="mt-3 text-lg font-semibold">{t('addContact.invalidTitle')}</h1>
            <p className="mt-2 text-sm text-slate-400">{t('addContact.invalidBody')}</p>
            <Link href="/contacts" className="mt-4 inline-block rounded-xl bg-slate-800 px-5 py-2.5 text-sm text-slate-200 hover:bg-slate-700">
              {t('addContact.goToContacts')}
            </Link>
          </>
        )}

        {(status === 'self') && card && (
          <>
            <Avatar card={card} />
            <h1 className="mt-4 text-lg font-semibold">{name}</h1>
            <p className="mt-2 text-sm text-slate-400">{t('addContact.thisIsYou')}</p>
            <Link href="/contacts" className="mt-4 inline-block rounded-xl bg-slate-800 px-5 py-2.5 text-sm text-slate-200 hover:bg-slate-700">
              {t('addContact.goToContacts')}
            </Link>
          </>
        )}

        {(status === 'ready' || status === 'working' || status === 'error') && card && (
          <>
            <Avatar card={card} />
            <h1 className="mt-4 text-lg font-semibold">{name}</h1>
            {card.username && card.displayName && <p className="mt-1 text-sm text-slate-400">@{card.username}</p>}
            {err && <p className="mt-2 text-xs text-rose-300">{err}</p>}
            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                onClick={chat}
                disabled={status === 'working'}
                className="toky-grad toky-ring-brand w-full rounded-xl px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                {t('addContact.addAndChat')}
              </button>
              <button
                type="button"
                onClick={add}
                disabled={status === 'working'}
                className="w-full rounded-xl bg-slate-800 px-5 py-3 text-sm text-slate-200 hover:bg-slate-700 disabled:opacity-50"
              >
                {t('addContact.addOnly')}
              </button>
            </div>
            <Link href="/contacts" className="mt-3 inline-block text-xs text-slate-500 hover:text-slate-300">
              {t('common.cancel')}
            </Link>
          </>
        )}

        {status === 'added' && card && (
          <>
            <Avatar card={card} />
            <h1 className="mt-4 text-lg font-semibold">{name}</h1>
            <p className="mt-2 text-sm text-emerald-300">{t('addContact.added')}</p>
            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                onClick={chat}
                className="toky-grad toky-ring-brand w-full rounded-xl px-5 py-3 text-sm font-semibold text-white"
              >
                {t('contacts.chat')}
              </button>
              <Link href="/contacts" className="w-full rounded-xl bg-slate-800 px-5 py-3 text-sm text-slate-200 hover:bg-slate-700">
                {t('addContact.goToContacts')}
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Avatar({ card }: { card: ContactCard }) {
  const label = card.displayName || card.username || '?';
  if (card.avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={card.avatarUrl} alt="" className="mx-auto h-24 w-24 rounded-full object-cover" />;
  }
  return (
    <span className="mx-auto grid h-24 w-24 place-items-center rounded-full text-2xl font-semibold text-white" style={{ backgroundImage: avatarBg(label) }}>
      {initials(label)}
    </span>
  );
}

export default function AddContactPage() {
  return (
    <Suspense fallback={null}>
      <AddInner />
    </Suspense>
  );
}
