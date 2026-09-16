'use client';

// Static-export-compatible public-chat route: /public-chat?token=<token>.
// Present in BOTH the hosted web build and the bundled mobile app, so the
// installed app can open a public session without a Next.js server resolving
// a dynamic path segment.
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { PublicChatView } from '@/components/public-chat-view';

function PublicChatFromQuery() {
  const token = (useSearchParams().get('token') || '').trim();
  if (!token) {
    return (
      <div className="p-6 text-center text-sm text-slate-400">Invalid or missing link.</div>
    );
  }
  return <PublicChatView token={token} />;
}

export default function PublicChatQueryPage() {
  return (
    <Suspense fallback={null}>
      <PublicChatFromQuery />
    </Suspense>
  );
}
