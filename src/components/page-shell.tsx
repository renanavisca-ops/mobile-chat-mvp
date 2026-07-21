'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useT } from '@/lib/i18n/context';
import {
  ChatBubbleIcon,
  UsersIcon,
  HashIcon,
  PhoneIcon,
  GearIcon,
} from '@/components/icons';

// "New group" moved into the chats "+" menu, so the bottom bar surfaces Calls.
const NAV_ITEMS = [
  { href: '/chats', key: 'nav.chats', Icon: ChatBubbleIcon },
  { href: '/calls', key: 'nav.calls', Icon: PhoneIcon },
  { href: '/contacts', key: 'nav.contacts', Icon: UsersIcon },
  { href: '/channels', key: 'nav.channels', Icon: HashIcon },
  { href: '/settings', key: 'nav.settings', Icon: GearIcon },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  const t = useT();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-800 bg-slate-950/95 pb-safe backdrop-blur">
      <ul className="mx-auto flex max-w-2xl items-stretch justify-around">
        {NAV_ITEMS.map(({ href, key, Icon }) => {
          const active = pathname === href || pathname?.startsWith(href + '/');
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={[
                  'flex flex-col items-center gap-1 py-2 text-[11px] font-medium transition-colors',
                  active ? 'text-blue-500' : 'text-slate-400 hover:text-slate-200',
                ].join(' ')}
              >
                <Icon className="h-6 w-6" size={24} />
                <span className="leading-none">{t(key)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function PageShell({
  title,
  right,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-900 bg-slate-950/90 pt-safe backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
          <h1 className="truncate text-lg font-semibold">{title}</h1>
          {right ? <div className="shrink-0">{right}</div> : null}
        </div>
      </header>

      <div className="mx-auto w-full max-w-2xl px-3 pb-28 pt-3">{children}</div>

      <BottomNav />
    </main>
  );
}
