'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { PageShell } from '@/components/page-shell';
import { useRequireAuth } from '@/lib/auth/use-require-auth';
import { browserSupabase } from '@/lib/supabase/client';
import { createDirectChatWith } from '@/lib/db/chats';
import { addContact, listMyContacts, searchUsers } from '@/lib/db/contacts';
import { blockUser } from '@/lib/db/safety';
import { ReportModal } from '@/components/report-modal';
import { EmptyState } from '@/components/empty-state';
import { ChatListSkeleton } from '@/components/skeleton';
import { UsersIcon, UserPlusIcon } from '@/components/icons';
import { useT, TransBold } from '@/lib/i18n/context';
import type { ProfileLite } from '@/lib/db/types';

export default function ContactsPage() {
  const { loading } = useRequireAuth();
  const t = useT();
  const supabase = browserSupabase();

  const [contacts, setContacts] = useState<ProfileLite[]>([]);
  // Gate the empty state on the contacts fetch, not the auth `loading` flag,
  // which resolves before listMyContacts() returns (otherwise "no contacts yet"
  // flashes before the list appears).
  const [contactsLoaded, setContactsLoaded] = useState(false);
  const [err, setErr] = useState('');

  // modal state
  const [openAdd, setOpenAdd] = useState(false);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<ProfileLite[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const canSearch = useMemo(() => q.trim().length >= 2, [q]);

  async function refreshContacts() {
    const list = await listMyContacts();
    setContacts(list);
  }

  useEffect(() => {
    if (loading) return;
    refreshContacts()
      .catch((e) => setErr(e?.message ?? String(e)))
      .finally(() => setContactsLoaded(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  useEffect(() => {
    if (!openAdd) return;
    const timer = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(timer);
  }, [openAdd]);

  useEffect(() => {
    if (!openAdd) return;

    if (!canSearch) {
      setResults([]);
      return;
    }

    searchUsers(q)
      .then(setResults)
      .catch((e) => setErr(e?.message ?? String(e)));
  }, [q, canSearch, openAdd]);

  function openModal() {
    setErr('');
    setQ('');
    setResults([]);
    setOpenAdd(true);
  }

  function closeModal() {
    setOpenAdd(false);
    setQ('');
    setResults([]);
  }

  async function onAdd(userId: string) {
    setErr('');
    try {
      await addContact(userId);
      await refreshContacts();
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }

  async function onChat(userId: string) {
    setErr('');
    try {
      const { data } = await supabase.auth.getUser();
      if (!data.user) throw new Error('Not authenticated');

      const chatId = await createDirectChatWith(userId);
      window.location.href = `/chats/${chatId}`;
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }

  const [reportTarget, setReportTarget] = useState<string | null>(null);

  async function onBlock(userId: string) {
    setErr('');
    try {
      await blockUser(userId);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }

  return (
    <PageShell
      title={t('contacts.title')}
      right={
        <button
          className="rounded-full toky-grad toky-ring-brand px-4 py-2 text-sm"
          onClick={openModal}
        >
          {t('contacts.addContact')}
        </button>
      }
    >
      {err ? <p className="mb-3 text-sm text-red-300">{err}</p> : null}

      <div className="rounded-xl border border-slate-900 bg-slate-950/40 p-3">
        <div className="text-sm text-slate-300">{t('contacts.myContacts')}</div>

        {loading || !contactsLoaded ? (
          <ChatListSkeleton rows={6} />
        ) : contacts.length === 0 ? (
          <EmptyState
            icon={<UsersIcon size={30} />}
            title={t('contacts.noContactsYet')}
            action={{ label: t('contacts.addContact'), onClick: () => setOpenAdd(true), icon: <UserPlusIcon size={18} /> }}
          />
        ) : (
          <ul className="mt-2 divide-y divide-slate-900 rounded-lg border border-slate-900">
            {contacts.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 p-2">
                <div className="text-sm">{c.username ?? c.id}</div>
                <button
                  className="rounded toky-grad toky-ring-brand px-3 py-1.5 text-sm"
                  onClick={() => onChat(c.id)}
                >
                  {t('contacts.chat')}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Add contact modal */}
      {openAdd ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div className="w-full max-w-lg rounded-2xl border border-slate-900 bg-slate-950 p-4 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-base font-semibold">{t('contacts.addContactTitle')}</div>
                <div className="text-xs text-slate-400">
                  <TransBold text={t('contacts.searchHint')} />
                </div>
              </div>
              <button
                className="rounded bg-slate-800 px-3 py-1.5 text-sm hover:bg-slate-700"
                onClick={closeModal}
              >
                {t('common.close')}
              </button>
            </div>

            <input
              ref={inputRef}
              className="mt-3 w-full rounded border border-slate-800 bg-slate-950 px-3 py-2 text-slate-100"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('contacts.searchPlaceholder')}
            />

            {canSearch ? (
              results.length > 0 ? (
                <ul className="mt-3 divide-y divide-slate-900 rounded-lg border border-slate-900">
                  {results.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-3 p-2">
                      <div className="text-sm">{r.username ?? r.id}</div>
                      <div className="flex gap-2">
                        <button
                          className="rounded bg-slate-800 px-3 py-1.5 text-sm hover:bg-slate-700"
                          onClick={() => onAdd(r.id)}
                        >
                          {t('contacts.add')}
                        </button>
                        <button
                          className="rounded toky-grad toky-ring-brand px-3 py-1.5 text-sm"
                          onClick={() => onChat(r.id)}
                        >
                          {t('contacts.chat')}
                        </button>
                        <button
                          className="rounded bg-slate-800 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-700"
                          onClick={() => onBlock(r.id)}
                          title={t('contacts.blockUser')}
                        >
                          {t('contacts.block')}
                        </button>
                        <button
                          className="rounded bg-slate-800 px-3 py-1.5 text-sm text-red-400 hover:bg-slate-700"
                          onClick={() => setReportTarget(r.id)}
                          title={t('contacts.reportUser')}
                        >
                          {t('contacts.report')}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-slate-400">{t('contacts.noResults')}</p>
              )
            ) : (
              <p className="mt-3 text-sm text-slate-500">{t('contacts.typeAtLeast2')}</p>
            )}
          </div>
        </div>
      ) : null}

      <ReportModal
        open={!!reportTarget}
        onClose={() => setReportTarget(null)}
        reportedUserId={reportTarget}
      />
    </PageShell>
  );
}
