'use client';

// Static-export-compatible single-chat route: /chats/view?c=<chatId>.
// Present in BOTH the hosted web build and the bundled mobile app, so the
// installed app can open a conversation full-screen (on phones) without a
// Next.js server resolving the dynamic /chats/[chatId] segment.
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ChatConversation } from '@/components/chat-conversation';

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function ChatFromQuery() {
  const c = (useSearchParams().get('c') || '').trim();
  if (!UUID_RE.test(c)) {
    return <div className="p-6 text-center text-sm text-slate-400">Chat not found.</div>;
  }
  return <ChatConversation chatId={c} />;
}

export default function ChatViewPage() {
  return (
    <Suspense fallback={null}>
      <ChatFromQuery />
    </Suspense>
  );
}
