import Link from 'next/link';

export function PageShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-4 p-6">
      <header className="flex items-center justify-between border-b border-slate-800 pb-4">
        <h1 className="text-xl font-semibold">{title}</h1>
        <nav className="flex gap-2 text-sm">
          <Link href="/chats">Chats</Link>
          <Link href="/settings">Settings</Link>
        </nav>
      </header>
      {children}
    </main>
  );
}
