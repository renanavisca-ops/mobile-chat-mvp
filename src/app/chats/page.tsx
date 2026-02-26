'use client';

import Link from 'next/link';
import { PageShell } from '@/components/page-shell';

export default function ChatsPage() {
  return (
    <PageShell title="Chats">
      <p className="text-sm text-slate-300">Lista de chats (placeholder del MVP).</p>
      <ul className="space-y-2">
        <li>
          <Link className="block rounded border border-slate-800 p-3" href="/chats/demo-chat">
            Demo chat 1:1
          </Link>
        </li>
      </ul>
    </PageShell>
  );
}
