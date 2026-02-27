'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = pathname === href || pathname?.startsWith(href + '/');
  return (
    <Link
      href={href}
      className={[
        'rounded-full px-3 py-1.5 text-sm transition',
        active ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-900 hover:text-white'
      ].join(' ')}
    >
      {label}
    </Link>
  );
}

export function PageShell({
  title,
  right,
  children
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4 sm:p-6">
        <header className="flex flex-col gap-3 rounded-2xl border border-slate-900 bg-slate-950/50 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-xl font-semibold">{title}</h1>
            <div className="sm:hidden">{right}</div>
          </div>

          <nav className="flex flex-wrap items-center gap-2">
            <NavLink href="/chats" label="Chats" />
            <NavLink href="/contacts" label="Contacts" />
            <NavLink href="/groups/new" label="New group" />
            <NavLink href="/settings" label="Settings" />
          </nav>

          <div className="hidden sm:block">{right}</div>
        </header>

        <section className="rounded-2xl border border-slate-900 bg-slate-950/60 p-4 shadow-sm">
          {children}
        </section>

        <footer className="pb-6 text-center text-xs text-slate-500">
         Toky Chat • built on Next.js + Supabase
        </footer>
      </div>
    </main>
  );
}
