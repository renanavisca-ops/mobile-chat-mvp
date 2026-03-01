'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { PageShell } from '@/components/page-shell';
import { useRequireAuth } from '@/lib/auth/use-require-auth';
import { sendMessage } from '@/lib/db/chats';
import { useChatRealtime } from '@/lib/realtime/use-chat-realtime';
import { browserSupabase } from '@/lib/supabase/client';
import type { MessageRow } from '@/lib/db/types';

function parseCipher(ciphertext: string): any {
  try {
    return JSON.parse(ciphertext);
  } catch {
    return {};
  }
}

export default function ChatPage({ params }: { params: { chatId: string } }) {
  const { loading: authLoading } = useRequireAuth();
  const chatId = params.chatId;
  const supabase = browserSupabase();

  const { messages, loading: msgLoading, appendLocal } = useChatRealtime(chatId);

  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const items = useMemo(() => {
    return messages.map((m) => ({ ...m, body: parseCipher(m.ciphertext) }));
  }, [messages]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [items.length]);

  async function onSend() {
    const t = text.trim();
    if (!t) return;

    setBusy(true);
    setText('');

    try {
      await sendMessage(chatId, { text: t });
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  function onPickFile() {
    fileInputRef.current?.click();
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // 🔒 Validaciones
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    const maxSize = 5 * 1024 * 1024; // 5MB

    if (!allowed.includes(file.type)) {
      setErr('Only JPG, PNG, WEBP allowed');
      return;
    }

    if (file.size > maxSize) {
      setErr('Max size 5MB');
      return;
    }

    // Por ahora solo mostramos que pasó validación
    alert(`Image valid: ${file.name}`);

    // reset input
    e.target.value = '';
  }

  const loading = authLoading || msgLoading;

  return (
    <PageShell title="Chat">
      {loading ? (
        <p>Loading…</p>
      ) : (
        <div className="flex flex-col gap-3">
          {err && <p className="text-sm text-red-400">{err}</p>}

          <div
            ref={scrollRef}
            className="h-[55vh] overflow-auto rounded-xl border border-slate-900 bg-slate-950/40 p-3"
          >
            {items.map((m) => (
              <div key={m.id} className="mb-2 text-sm">
                {m.body.text}
              </div>
            ))}
          </div>

          <div className="flex gap-2 items-center">
            {/* 📎 */}
            <button
              className="text-xl px-2"
              onClick={onPickFile}
              type="button"
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
              className="rounded bg-blue-600 px-3 py-2 text-sm"
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
