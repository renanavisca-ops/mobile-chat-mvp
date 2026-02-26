import Link from 'next/link';

export default function Home() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 p-8">
      <h1 className="text-2xl font-semibold">Mobile Chat MVP</h1>
      <p>E2EE client-side con Supabase Realtime y arquitectura preparada para escalar.</p>
      <div className="flex gap-3">
        <Link className="rounded bg-blue-600 px-3 py-2" href="/login">
          Login
        </Link>
        <Link className="rounded bg-slate-700 px-3 py-2" href="/chats">
          Chats
        </Link>
      </div>
    </main>
  );
}
