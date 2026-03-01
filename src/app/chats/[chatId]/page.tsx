'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { PageShell } from '@/components/page-shell';
import { useRequireAuth } from '@/lib/auth/use-require-auth';
import { sendMessage } from '@/lib/db/chats';
import { uploadChatImage, createSignedChatMediaUrl } from '@/lib/storage/upload';
import { useChatRealtime } from '@/lib/realtime/use-chat-realtime';
import { browserSupabase } from '@/lib/supabase/client';
import type { MessageRow } from '@/lib/db/types';

type Payload = { v?: number; text?: string; imagePath?: string; imagePaths?: string[] };

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
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

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

  function extractAllImagePaths(body: Payload): string[] {
    const arr: string[] = [];
    if (body.imagePath) arr.push(body.imagePath);
    if (Array.isArray(body.imagePaths)) {
      for (const p of body.imagePaths) if (typeof p === 'string' && p) arr.push(p);
    }
    // dedupe
    return Array.from(new Set(arr));
  }

  // Fetch signed URLs for any image paths we haven't resolved yet
  useEffect(() => {
    let cancelled = false;

    async function resolveAll() {
      const allPaths = new Set<string>();
      for (const m of items) {
        for (const p of extractAllImagePaths(m.body)) allPaths.add(p);
      }

      const paths = Array.from(allPaths);
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
        if (!cancelled) setErr(e?.message ?? String(e));
      }
    }

    resolveAll();

    return () => {
      cancelled = true;
    };
  }, [items, signedUrls]);

  function onPickFiles() {
    setErr('');
    fileInputRef.current?.click();
  }

  function clearPendingFiles() {
    setPendingFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function onFilesChange(e: React.ChangeEvent<HTMLInputElement>) {
    setErr('');
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    const allowed = new Set(['image/jpeg', 'image/png', 'image/webp']);
    const maxSize = 5 * 1024 * 1024;

    // hard cap to keep MVP sane
    const MAX_FILES = 6;
    const picked = files.slice(0, MAX_FILES);

    for (const f of picked) {
      if (!allowed.has(f.type)) {
        setErr('Solo JPG, PNG o WEBP.');
        e.target.value = '';
        return;
      }
      if (f.size > maxSize) {
        setErr('Máximo 5MB por imagen.');
        e.target.value = '';
        return;
      }
      const safeName = sanitizeFilename(f.name);
      if (!safeName || safeName.length < 3) {
        setErr('Nombre de archivo inválido.');
        e.target.value = '';
        return;
      }
    }

    // normalize filenames
    const normalized = picked.map((f) => new File([f], sanitizeFilename(f.name), { type: f.type }));

    // Append (so you can attach multiple times)
    setPendingFiles((prev) => [...prev, ...normalized].slice(0, MAX_FILES));
    e.target.value = '';
  }

  async function onSend() {
    setErr('');
    const t = text.trim();

    if (!t && pendingFiles.length === 0) return;

    setBusy(true);

    try {
      // multi-image flow
      if (pendingFiles.length > 0) {
        const files = pendingFiles;

        // upload all (parallel)
        const results = await Promise.all(files.map((file) => uploadChatImage(chatId, file)));
        const paths = results.map((r) => r.path);

        const payload: { text?: string; imagePaths: string[] } = t ? { text: t, imagePaths: paths } : { imagePaths: paths };

        // optimistic append
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
        clearPendingFiles();

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
                  const paths = extractAllImagePaths(m.body);

                  return (
                    <li key={m.id} className="rounded-lg border border-slate-900 bg-slate-950/60 p-2">
                      <div className="text-xs text-slate-500">{new Date(m.created_at).toLocaleString()}</div>

                      {m.body.text ? <div className="text-sm">{m.body.text}</div> : null}

                      {paths.length ? (
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          {paths.map((path) => {
                            const url = signedUrls[path] || '';
                            return url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                key={path}
                                src={url}
                                alt="chat image"
                                className="max-h-80 w-auto rounded-lg border border-slate-900"
                              />
                            ) : (
                              <div
                                key={path}
                                className="h-28 w-full animate-pulse rounded-lg border border-slate-900 bg-slate-800"
                              />
                            );
                          })}
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
              onClick={onPickFiles}
              type="button"
              title="Attach images"
            >
              📎
            </button>

            <input
              ref={fileInputRef}
              type="file"
              hidden
              multiple
              accept="image/jpeg,image/png,image/webp"
              onChange={onFilesChange}
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

          {pendingFiles.length ? (
            <div className="flex items-center justify-between rounded border border-slate-900 bg-slate-950/40 p-2 text-sm">
              <div className="text-slate-200">
                Imágenes listas: <span className="font-mono">{pendingFiles.length}</span> (máx 6)
              </div>
              <button
                className="rounded bg-slate-800 px-3 py-1.5 text-xs hover:bg-slate-700"
                onClick={clearPendingFiles}
              >
                Remove all
              </button>
            </div>
          ) : null}
        </div>
      )}
    </PageShell>
  );
}
