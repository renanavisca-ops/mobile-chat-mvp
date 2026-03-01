'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { PageShell } from '@/components/page-shell';
import { useRequireAuth } from '@/lib/auth/use-require-auth';
import { sendMessage } from '@/lib/db/chats';
import { useChatRealtime } from '@/lib/realtime/use-chat-realtime';
import type { MessageRow } from '@/lib/db/types';

function parseCipher(ciphertext: string): { text?: string; imageUrl?: string; imagePath?: string } {
  try {
    const obj = JSON.parse(ciphertext);
    if (obj && typeof obj === 'object') return obj;
  } catch {}
  return {};
}

export default function ChatPage({ params }: { params: { chatId: string } }) {
  const { loading: authLoading } = useRequireAuth();
  const chatId = params.chatId;

  const { messages, loading: msgLoading, appendLocal } = useChatRealtime(chatId);

  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  const items = useMemo(() => {
    return messages.map((m) => ({ ...m, body: parseCipher(m.ciphertext) }));
  }, [messages]);

  // auto-scroll al final cuando llegan mensajes
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [items.length]);

  async function onSend() {
    setErr('');
    const t = text.trim();
    if (!t) return;

    setBusy(true);

    // 1) pintar optimista (sin esperar realtime)
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

    try {
      // 2) enviar real a DB
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
          {err ? <p className="text-sm text-red-300">{err}</p> : null}

          <div
            ref={scrollRef}
            className="h-[55vh] overflow-auto rounded-xl border border-slate-900 bg-slate-950/40 p-3"
          >
            {items.length === 0 ? (
              <p className="text-sm text-slate-400">No messages yet.</p>
            ) : (
              <ul className="space-y-2">
                {items.map((m) => (
                  <li key={m.id} className="rounded-lg border border-slate-900 bg-slate-950/60 p-2">
                    <div className="text-xs text-slate-500">{new Date(m.created_at).toLocaleString()}</div>
                    {m.body.text ? <div className="text-sm">{m.body.text}</div> : null}

                    {/* imageUrl queda temporal; luego lo cambiaremos a Signed URL usando imagePath */}
                    {m.body.imageUrl ? (
                      <img src={m.body.imageUrl} className="mt-2 max-h-64 rounded" alt="image" />
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex gap-2">
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
        </div>
      )}
    </PageShell>
  );
}
