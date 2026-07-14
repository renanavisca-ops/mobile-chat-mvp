'use client';

import { useEffect, useRef, useState } from 'react';
import { searchUsers } from '@/lib/db/contacts';
import { updateGroupInfo, addGroupMembers, removeGroupMember, leaveChat, setChatMuted, getChatMuted } from '@/lib/db/chats';
import { uploadGroupAvatar } from '@/lib/db/groupAvatar';
import type { ProfileLite } from '@/lib/db/types';

export function GroupInfoModal({
  open,
  onClose,
  chatId,
  title,
  description,
  avatarUrl,
  isCreator,
  members,
  onUpdated,
  onMembersChanged,
  onLeft,
}: {
  open: boolean;
  onClose: () => void;
  chatId: string;
  title: string | null;
  description: string | null;
  avatarUrl: string | null;
  isCreator: boolean;
  members: { id: string; username: string | null }[];
  onUpdated: (patch: { title?: string; description?: string; avatar_url?: string }) => void;
  onMembersChanged: () => void;
  onLeft: () => void;
}) {
  const [name, setName] = useState(title ?? '');
  const [desc, setDesc] = useState(description ?? '');
  const [savingInfo, setSavingInfo] = useState(false);
  const [err, setErr] = useState('');

  const [avatarBusy, setAvatarBusy] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  const [muted, setMuted] = useState(false);
  const [muteBusy, setMuteBusy] = useState(false);

  const [q, setQ] = useState('');
  const [results, setResults] = useState<ProfileLite[]>([]);
  const [adding, setAdding] = useState(false);

  const [busyMemberId, setBusyMemberId] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);

  useEffect(() => {
    if (open) {
      setName(title ?? '');
      setDesc(description ?? '');
      setErr('');
      setQ('');
      setResults([]);
      setConfirmLeave(false);
      getChatMuted(chatId).then(setMuted).catch(() => {});
    }
  }, [open, title, description, chatId]);

  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(() => {
      searchUsers(query)
        .then((rows) => setResults(rows.filter((r) => !members.some((m) => m.id === r.id))))
        .catch(() => setResults([]));
    }, 300);
    return () => clearTimeout(t);
  }, [q, members]);

  if (!open) return null;

  const infoChanged = name.trim() !== (title ?? '') || desc.trim() !== (description ?? '');

  async function saveInfo() {
    const trimmedTitle = name.trim();
    if (!trimmedTitle) return;
    setSavingInfo(true);
    setErr('');
    try {
      await updateGroupInfo(chatId, trimmedTitle, desc.trim());
      onUpdated({ title: trimmedTitle, description: desc.trim() });
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setSavingInfo(false);
    }
  }

  async function onAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setAvatarBusy(true);
    setErr('');
    try {
      const url = await uploadGroupAvatar(chatId, file);
      onUpdated({ avatar_url: url });
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setAvatarBusy(false);
    }
  }

  async function toggleMute() {
    const next = !muted;
    setMuteBusy(true);
    try {
      await setChatMuted(chatId, next);
      setMuted(next);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setMuteBusy(false);
    }
  }

  async function addMember(userId: string) {
    setAdding(true);
    setErr('');
    try {
      await addGroupMembers(chatId, [userId]);
      setQ('');
      setResults([]);
      onMembersChanged();
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setAdding(false);
    }
  }

  async function removeMember(userId: string) {
    setBusyMemberId(userId);
    setErr('');
    try {
      await removeGroupMember(chatId, userId);
      onMembersChanged();
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setBusyMemberId(null);
    }
  }

  async function leaveGroup() {
    setLeaving(true);
    setErr('');
    try {
      await leaveChat(chatId);
      onLeft();
    } catch (e: any) {
      setErr(e?.message ?? String(e));
      setLeaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="max-h-[90vh] w-full max-w-sm overflow-auto rounded-2xl border border-slate-900 bg-slate-950 p-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="text-base font-semibold text-slate-100">Group info</div>
          <button type="button" onClick={onClose} className="rounded bg-slate-800 px-3 py-1.5 text-xs hover:bg-slate-700">
            Close
          </button>
        </div>

        {err && <p className="mt-2 text-xs text-red-400">{err}</p>}

        <div className="mt-4 flex items-center gap-4">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" className="h-16 w-16 rounded-full border border-slate-800 object-cover" />
          ) : (
            <span className="grid h-16 w-16 place-items-center rounded-full bg-slate-800 text-lg font-semibold text-slate-300">
              {(title || '?').trim().charAt(0).toUpperCase()}
            </span>
          )}
          {isCreator && (
            <div>
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                disabled={avatarBusy}
                className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-700 disabled:opacity-50"
              >
                {avatarBusy ? 'Subiendo…' : 'Cambiar foto'}
              </button>
              <input ref={avatarInputRef} type="file" hidden accept="image/*" onChange={onAvatarChange} />
            </div>
          )}
        </div>

        <div className="mt-4 space-y-1.5">
          <label className="ml-1 block text-xs text-slate-400">Group name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!isCreator}
            maxLength={60}
            className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 disabled:opacity-60"
          />
        </div>

        <div className="mt-3 space-y-1.5">
          <label className="ml-1 block text-xs text-slate-400">Description</label>
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            disabled={!isCreator}
            maxLength={500}
            rows={2}
            placeholder={isCreator ? 'What is this group about?' : ''}
            className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 disabled:opacity-60"
          />
        </div>

        {isCreator ? (
          <button
            type="button"
            onClick={saveInfo}
            disabled={savingInfo || !name.trim() || !infoChanged}
            className="mt-2 w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {savingInfo ? 'Guardando…' : 'Guardar'}
          </button>
        ) : (
          <p className="mt-1 ml-1 text-xs text-slate-500">Solo el creador del grupo puede editarlo.</p>
        )}

        <div className="mt-4 flex items-center justify-between rounded-lg border border-slate-900 bg-slate-950/60 p-3">
          <div>
            <div className="text-sm font-medium text-slate-200">Silenciar notificaciones</div>
            <div className="text-xs text-slate-500">No recibirás avisos push de este chat.</div>
          </div>
          <button
            type="button"
            onClick={toggleMute}
            disabled={muteBusy}
            role="switch"
            aria-checked={muted}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
              muted ? 'bg-emerald-600' : 'bg-slate-700'
            }`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${muted ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>

        <div className="mt-4">
          <div className="ml-1 text-xs text-slate-400">Members ({members.length})</div>
          <ul className="mt-2 max-h-40 space-y-1 overflow-auto">
            {members.map((m) => (
              <li key={m.id} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm text-slate-200 hover:bg-slate-900">
                <span>{m.username ?? m.id.slice(0, 8)}</span>
                {isCreator && (
                  <button
                    type="button"
                    onClick={() => removeMember(m.id)}
                    disabled={busyMemberId === m.id}
                    className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
                  >
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>

        {isCreator && (
          <div className="mt-4 space-y-1.5">
            <label className="ml-1 block text-xs text-slate-400">Add members</label>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by username…"
              autoCapitalize="none"
              className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            />
            {results.length > 0 && (
              <ul className="max-h-32 space-y-1 overflow-auto">
                {results.map((r) => (
                  <li key={r.id} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-slate-900">
                    <span className="text-slate-200">{r.username ?? r.id}</span>
                    <button
                      type="button"
                      onClick={() => addMember(r.id)}
                      disabled={adding}
                      className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-200 hover:bg-slate-700 disabled:opacity-50"
                    >
                      Add
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="mt-5 border-t border-slate-900 pt-4">
          {confirmLeave ? (
            <div className="flex items-center gap-2">
              <span className="flex-1 text-xs text-slate-400">Leave this group?</span>
              <button
                type="button"
                onClick={() => setConfirmLeave(false)}
                className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={leaveGroup}
                disabled={leaving}
                className="rounded-lg bg-rose-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-600 disabled:opacity-50"
              >
                {leaving ? 'Leaving…' : 'Confirm'}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmLeave(true)}
              className="w-full rounded-lg border border-rose-900/50 bg-rose-950/20 px-4 py-2 text-sm text-rose-300 hover:bg-rose-950/30"
            >
              Leave group
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
