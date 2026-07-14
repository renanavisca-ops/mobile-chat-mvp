'use client';

import { useEffect, useState } from 'react';
import { searchUsers } from '@/lib/db/contacts';
import { renameGroupChat, addGroupMembers, removeGroupMember, leaveChat } from '@/lib/db/chats';
import type { ProfileLite } from '@/lib/db/types';

export function GroupInfoModal({
  open,
  onClose,
  chatId,
  title,
  isCreator,
  members,
  onRenamed,
  onMembersChanged,
  onLeft,
}: {
  open: boolean;
  onClose: () => void;
  chatId: string;
  title: string | null;
  isCreator: boolean;
  members: { id: string; username: string | null }[];
  onRenamed: (title: string) => void;
  onMembersChanged: () => void;
  onLeft: () => void;
}) {
  const [name, setName] = useState(title ?? '');
  const [savingName, setSavingName] = useState(false);
  const [err, setErr] = useState('');

  const [q, setQ] = useState('');
  const [results, setResults] = useState<ProfileLite[]>([]);
  const [adding, setAdding] = useState(false);

  const [busyMemberId, setBusyMemberId] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);

  useEffect(() => {
    if (open) {
      setName(title ?? '');
      setErr('');
      setQ('');
      setResults([]);
      setConfirmLeave(false);
    }
  }, [open, title]);

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

  async function saveName() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === title) return;
    setSavingName(true);
    setErr('');
    try {
      await renameGroupChat(chatId, trimmed);
      onRenamed(trimmed);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setSavingName(false);
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
      <div className="w-full max-w-sm rounded-2xl border border-slate-900 bg-slate-950 p-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="text-base font-semibold text-slate-100">Group info</div>
          <button type="button" onClick={onClose} className="rounded bg-slate-800 px-3 py-1.5 text-xs hover:bg-slate-700">
            Close
          </button>
        </div>

        {err && <p className="mt-2 text-xs text-red-400">{err}</p>}

        <div className="mt-4 space-y-1.5">
          <label className="ml-1 block text-xs text-slate-400">Group name</label>
          <div className="flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!isCreator}
              maxLength={60}
              className="flex-1 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 disabled:opacity-60"
            />
            {isCreator && (
              <button
                type="button"
                onClick={saveName}
                disabled={savingName || !name.trim() || name.trim() === title}
                className="rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                Save
              </button>
            )}
          </div>
          {!isCreator && <p className="ml-1 text-xs text-slate-500">Only the group creator can rename it.</p>}
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
