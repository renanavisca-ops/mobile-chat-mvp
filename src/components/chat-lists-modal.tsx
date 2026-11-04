'use client';

import { useEffect, useState } from 'react';
import { useT } from '@/lib/i18n/context';
import { useBackClose } from '@/lib/back';
import { useFocusTrap } from '@/lib/a11y/focus-trap';
import {
  getChatLists,
  createChatList,
  deleteChatList,
  renameChatList,
  setChatInList,
  type ChatList,
} from '@/lib/chat-lists';

type ChatOption = { id: string; title: string };

/**
 * Manage custom chat lists ("listas personalizadas"): create, rename, delete,
 * and choose which chats belong to each list. Lists are stored on-device
 * (see `chat-lists.ts`); every change calls `onChanged` so the chat list can
 * refresh its filter chips.
 */
export function ChatListsModal({
  open,
  onClose,
  ownerId,
  chats,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  ownerId: string;
  chats: ChatOption[];
  onChanged: () => void;
}) {
  const t = useT();
  useBackClose(open, onClose);
  const trapRef = useFocusTrap<HTMLDivElement>(open);

  const [lists, setLists] = useState<ChatList[]>([]);
  const [newName, setNewName] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');

  const refresh = () => setLists(ownerId ? getChatLists(ownerId) : []);

  useEffect(() => {
    if (open) {
      refresh();
      setNewName('');
      setExpandedId(null);
      setRenamingId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ownerId]);

  if (!open) return null;

  function create() {
    const name = newName.trim();
    if (!name) return;
    const list = createChatList(ownerId, name);
    setNewName('');
    setExpandedId(list.id);
    refresh();
    onChanged();
  }

  function remove(id: string) {
    deleteChatList(ownerId, id);
    if (expandedId === id) setExpandedId(null);
    refresh();
    onChanged();
  }

  function commitRename(id: string) {
    const name = renameText.trim();
    if (name) renameChatList(ownerId, id, name);
    setRenamingId(null);
    refresh();
    onChanged();
  }

  function toggleChat(listId: string, chatId: string, present: boolean) {
    setChatInList(ownerId, listId, chatId, present);
    refresh();
    onChanged();
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('chatLists.title')}
        className="toky-glass toky-elev max-h-[90vh] w-full max-w-md overflow-auto rounded-t-3xl border border-slate-800 p-4 pb-safe sm:rounded-3xl"
      >
        <div className="flex items-center justify-between">
          <div className="text-base font-semibold text-slate-100">{t('chatLists.title')}</div>
          <button type="button" onClick={onClose} className="rounded bg-slate-800 px-3 py-1.5 text-xs hover:bg-slate-700">
            {t('common.close')}
          </button>
        </div>

        <p className="mt-1 text-xs text-slate-400">{t('chatLists.hint')}</p>

        <div className="mt-3 flex gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') create(); }}
            maxLength={40}
            placeholder={t('chatLists.namePlaceholder')}
            className="min-w-0 flex-1 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100"
          />
          <button
            type="button"
            onClick={create}
            disabled={!newName.trim()}
            className="shrink-0 rounded-lg toky-grad toky-ring-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {t('chatLists.create')}
          </button>
        </div>

        {lists.length === 0 ? (
          <p className="mt-6 text-center text-sm text-slate-500">{t('chatLists.empty')}</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {lists.map((l) => (
              <li key={l.id} className="rounded-xl border border-slate-800 bg-slate-900/40">
                <div className="flex items-center justify-between gap-2 p-3">
                  {renamingId === l.id ? (
                    <input
                      autoFocus
                      value={renameText}
                      onChange={(e) => setRenameText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') commitRename(l.id); if (e.key === 'Escape') setRenamingId(null); }}
                      onBlur={() => commitRename(l.id)}
                      maxLength={40}
                      className="min-w-0 flex-1 rounded-lg border border-slate-800 bg-slate-900 px-2 py-1 text-sm text-slate-100"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setExpandedId((v) => (v === l.id ? null : l.id))}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    >
                      <span className="truncate text-sm font-medium text-slate-100">{l.name}</span>
                      <span className="shrink-0 text-xs text-slate-500">{l.chatIds.length}</span>
                    </button>
                  )}
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => { setRenamingId(l.id); setRenameText(l.name); }}
                      className="text-xs text-slate-400 hover:text-slate-200"
                    >
                      {t('chatLists.rename')}
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(l.id)}
                      className="text-xs text-rose-400 hover:text-rose-300"
                    >
                      {t('chatLists.delete')}
                    </button>
                  </div>
                </div>

                {expandedId === l.id && (
                  <div className="border-t border-slate-800 p-2">
                    {chats.length === 0 ? (
                      <p className="px-2 py-2 text-xs text-slate-500">{t('chatLists.noChats')}</p>
                    ) : (
                      <ul className="max-h-56 space-y-0.5 overflow-auto">
                        {chats.map((c) => {
                          const checked = l.chatIds.includes(c.id);
                          return (
                            <li key={c.id}>
                              <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 text-sm text-slate-200 hover:bg-slate-900">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) => toggleChat(l.id, c.id, e.target.checked)}
                                  className="h-4 w-4 accent-indigo-500"
                                />
                                <span className="truncate">{c.title}</span>
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
