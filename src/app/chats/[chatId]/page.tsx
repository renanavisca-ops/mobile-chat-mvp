'use client';

import { useMemo, useState } from 'react';
import { PageShell } from '@/components/page-shell';
import { useRequireAuth } from '@/lib/auth/use-require-auth';
import { sendMessage } from '@/lib/db/chats';
import { useChatRealtime } from '@/lib/realtime/use-chat-realtime';

function parseCipher(ciphertext: string): { text?: string; imageUrl?: string } {
  try {
    const obj = JSON.parse(ciphertext);
    if (obj && typeof obj === 'object') return obj;
  } catch {}
  return {};
}

export default function ChatPage({ params }: { params: { chatId: string } }) {
  const { loading } = useRequireAuth();
  const chatId = params.chatId;
  const { messages } = useChatRealtime(chatId);

  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const items = useMemo(() => {
    return messages.map((m) => {
      const body = parseCipher(m.ciphertext);
      return { ...m, body };
    });
  }, [messages]);

  async function onSend() {
    setErr('');
    if (!text.trim()) return;
    setBusy(true);
    try {
      await sendMessage(chatId, { text: text.trim() });
      setText('');
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell title="Chat">
      {loading ? (
        <p className="text-sm text-slate-300">Loading…</p>
      ) : (
        <div className="flex flex-col gap-3">
          {err ? <p className="text-sm text-red-300">{err}</p> : null}

          <div className="h-[55vh] overflow-auto rounded-xl border border-slate-900 bg-slate-950/40 p-3">
            {items.length === 0 ? (
              <p className="text-sm text-slate-400">No messages yet.</p>
            ) : (
              <ul className="space-y-2">
                {items.map((m) => (
                  <li key={m.id} className="rounded-lg border border-slate-900 bg-slate-950/60 p-2">
                    <div className="text-xs text-slate-500">{new Date(m.created_at).toLocaleString()}</div>
                    {m.body.text ? <div className="text-sm">{m.body.text}</div> : null}
                    {m.body.imageUrl ? (
                      // Nota: esto es para bucket público. Si ya lo hiciste privado, luego lo cambiamos a Signed URL.
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
