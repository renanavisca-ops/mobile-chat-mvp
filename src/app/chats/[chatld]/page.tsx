'use client';

import { useMemo, useState } from 'react';
import { PageShell } from '@/components/page-shell';
import { useChatRealtime } from '@/lib/realtime/use-chat-realtime';

export default function ChatDetailPage({ params }: { params: { chatId: string } }) {
  const [draft, setDraft] = useState('');
  const messages = useChatRealtime(params.chatId);
  const deduped = useMemo(() => Array.from(new Map(messages.map((m) => [m.id, m])).values()), [messages]);

  return (
    <PageShell title={`Chat ${params.chatId}`}>
      <section className="flex flex-1 flex-col gap-2" aria-label="Message list">
        {deduped.map((message) => (
          <article className="rounded bg-slate-900 p-2 text-sm" key={message.id}>
            <p className="text-xs text-slate-400">{message.sender_device_id}</p>
            <p className="break-all">{message.ciphertext}</p>
          </article>
        ))}
      </section>
      <form className="flex gap-2">
        <input
          className="flex-1 rounded border border-slate-700 bg-slate-900 p-2"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Mensaje cifrado listo para enviar"
        />
        <button className="rounded bg-blue-600 px-3 py-2" type="button">
          Send
        </button>
      </form>
    </PageShell>
  );
}
