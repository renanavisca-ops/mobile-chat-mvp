'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { PageShell } from '@/components/page-shell';
import { useRequireAuth } from '@/lib/auth/use-require-auth';
import { sendMessage } from '@/lib/db/chats';
import { uploadChatImage, createSignedChatMediaUrl } from '@/lib/storage/upload';
import { useChatRealtime } from '@/lib/realtime/use-chat-realtime';
import { browserSupabase } from '@/lib/supabase/client';
import type { MessageRow } from '@/lib/db/types';

type Payload = { v?: number; text?: string; imagePath?: string };

function parseCipher(ciphertext: string): Payload {
  try {
    const obj = JSON.parse(ciphertext);
    if (obj && typeof obj === 'object') return obj as Payload;
  } catch {}
  return {};
}

function shortId(id: string) {
  return id.length > 10 ? `${id.slice(0, 6)}…${id.slice(-4)}` : id;
}

function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
}

export default function ChatPage({ params }: { params: { chatId: string } }) {
  const { loading: authLoading } = useRequireAuth();
  const chatId = params.chatId;

  const supabase = browserSupabase();
  const { messages, loading: msgLoading, appendLocal } = useChatRealtime(chatId);

  // members
  const [members, setMembers] = useState<string[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);

  // compose
  const [text, setText] = useState('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  // signed url cache (path -> url)
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Load members (no embeds)
  useEffect(() => {
    let alive = true;

    async function loadMembers() {
      setMembersLoading(true);

      const { data: cms, error: cmErr } = await supabase
        .from('chat_members')
        .select('user_id')
        .eq('chat_id', chatId);

      if (!alive) return;

      if (cmErr) {
        setErr(cmErr.message);
        setMembersLoading(false);
        return;
      }

      const userIds = (cms ?? []).map((r: any) => r.user_id).filter(Boolean);

      if (userIds.length === 0) {
        setMembers([]);
        setMembersLoading(false);
        return;
      }

      const { data: profs, error: pErr } = await supabase
        .from('profiles')
        .select('id, username')
        .in('id', userIds);

      if (!alive) return;

      if (pErr) {
        setErr(pErr.message);
        setMembersLoading(false);
        return;
      }

      const byId = new Map<string, string>();
      for (const p of profs ?? []) byId.set((p as any).id, (p as any).username ?? '');

      setMembers(userIds.map((id: string) => byId.get(id) || shortId(id)));
      setMembersLoading(false);
    }

    loadMembers();
    return () => {
      alive = false;
    };
  }, [chatId, supabase]);

  const items = useMemo(() => {
    return messages.map((m) => ({ ...m, body: parseCipher(m.ciphertext) }));
  }, [messages]);

  // autoscroll
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [items.length]);

  // Fetch signed URLs for any imagePath we haven't resolved yet
  useEffect(() => {
    let cancelled = false;

    async function resolveAll() {
      const paths = Array.from(
        new Set(items.map((m) => m.body.imagePath).filter((p): p is string => !!p))
      );

      const missing = paths.filter((p) => !signedUrls[p]);
      if (missing.length === 0) return;

      try {
        const pairs = await Promise.all(
          missing.map(async (path) => {
            const url = await createSignedChatMediaUrl(path, 300); // 5 min
            return [path, url] as const;
          })
        );

        if (cancelled) return;

        setSignedUrls((prev) => {
          const next = { ...prev };
          for (const [p, u] of pairs) next[p] = u;
          return next;
        });
      } catch (e: any) {
        // If user is not a member, policy will block signed url. Show error once.
        if (!cancelled) setErr(e?.message ?? String(e));
      }
    }

    resolveAll();

    return () => {
      cancelled = true;
    };
    // IMPORTANT: depend on items + signedUrls snapshot
  }, [items, signedUrls]);

  function onPickFile() {
    setErr('');
    fileInputRef.current?.click();
  }

  function clearPendingFile() {
    setPendingFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setErr('');
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = new Set(['image/jpeg', 'image/png', 'image/webp']);
    const maxSize = 5 * 1024 * 1024;

    if (!allowed.has(file.type)) {
      setErr('Solo JPG, PNG o WEBP.');
      e.target.value = '';
      return;
    }

    if (file.size > maxSize) {
      setErr('Máximo 5MB.');
      e.target.value = '';
      return;
    }

    const safeName = sanitizeFilename(file.name);
    if (!safeName || safeName.length < 3) {
      setErr('Nombre de archivo inválido.');
      e.target.value = '';
      return;
    }

    setPendingFile(new File([file], safeName, { type: file.type }));
  }

  async function onSend() {
    setErr('');
    const t = text.trim();

    // allow text-only, image-only, or image+text
    if (!t && !pendingFile) return;

    setBusy(true);

    try {
      // image flow: upload first -> store only imagePath
      if (pendingFile) {
        const file = pendingFile;

        const { path } = await uploadChatImage(chatId, file);

        const payload: { text?: string; imagePath: string } = t
          ? { text: t, imagePath: path }
          : { imagePath: path };

        // optimistic append (after upload so we have path)
        const temp: MessageRow = {
          id: `local-${crypto.randomUUID()}`,
          chat_id: chatId,
          sender_device_id: 'local',
          ciphertext: JSON.stringify({ v: 1, ...payload }),
          nonce: `local-${crypto.randomUUID()}`,
          message_type: 'whisper',
          created_at: new Date().toISOString(),
        };
        appendLocal(temp);

        setText('');
        clearPendingFile();

        await sendMessage(chatId, payload);
        return;
      }

      // text-only flow
      const temp: MessageRow = {
        id: `local-${crypto.randomUUID()}`,
        chat_id: chatId,
        sender_device_id: 'local',
        ciphertext: JSON.stringify({ v: 1, text: t }),
        nonce: `local-${crypto.randomUUID()}`,
        message_type: 'whisper',
        created_at: new Date().toISOString(),
      };
      appendLocal(temp);

      setText('');
      await sendMessage(chatId, { text: t });
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  const loading = authLoading || msgLoading;

  return (
    <PageShell title="Chat">
      {loading ? (
        <p className="text-sm text-slate-300">Loading…</p>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="text-xs text-slate-400">
            Members: {membersLoading ? 'Loading…' : members.length ? members.join(', ') : '—'}
          </div>

          {err ? <p className="text-sm text-red-300">{err}</p> : null}

          <div
            ref={scrollRef}
            className="h-[55vh] overflow-auto rounded-xl border border-slate-900 bg-slate-950/40 p-3"
          >
            {items.length === 0 ? (
              <p className="text-sm text-slate-400">No messages yet.</p>
            ) : (
              <ul className="space-y-2">
                {items.map((m) => {
                  const path = m.body.imagePath;
                  const url = path ? signedUrls[path] : '';

                  return (
                    <li key={m.id} className="rounded-lg border border-slate-900 bg-slate-950/60 p-2">
                      <div className="text-xs text-slate-500">{new Date(m.created_at).toLocaleString()}</div>

                      {m.body.text ? <div className="text-sm">{m.body.text}</div> : null}

                      {path ? (
                        <div className="mt-2">
                          {url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={url}
                              alt="chat image"
                              className="max-h-80 w-auto rounded-lg border border-slate-900"
                            />
                          ) : (
                            <div className="text-xs text-slate-400">Cargando imagen…</div>
                          )}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              className="rounded bg-slate-800 px-3 py-2 text-sm hover:bg-slate-700"
              onClick={onPickFile}
              type="button"
              title="Attach image"
            >
              📎
            </button>

            <input
              ref={fileInputRef}
              type="file"
              hidden
              accept="image/jpeg,image/png,image/webp"
              onChange={onFileChange}
            />

            <input
              className="flex-1 rounded border border-slate-800 bg-slate-950 px-3 py-2 text-slate-100"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type a message…"
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSend();
              }}
            />

            <button
              className="rounded bg-blue-600 px-3 py-2 text-sm hover:bg-blue-500 disabled:opacity-60"
              onClick={onSend}
              disabled={busy}
            >
              Send
            </button>
          </div>

          {pendingFile ? (
            <div className="flex items-center justify-between rounded border border-slate-900 bg-slate-950/40 p-2 text-sm">
              <div className="text-slate-200">
                Imagen lista: <span className="font-mono">{pendingFile.name}</span> ({Math.round(pendingFile.size / 1024)} KB)
              </div>
              <button
                className="rounded bg-slate-800 px-3 py-1.5 text-xs hover:bg-slate-700"
                onClick={clearPendingFile}
              >
                Remove
              </button>
            </div>
          ) : null}
        </div>
      )}
    </PageShell>
  );
}
