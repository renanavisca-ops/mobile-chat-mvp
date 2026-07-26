/**
 * Shimmering skeleton placeholders shown while data loads, instead of bare
 * "Loading…" text. Styling lives in globals.css (.toky-skeleton).
 */

export function Skeleton({ className = '' }: { className?: string }) {
  return <span className={`toky-skeleton block rounded-lg ${className}`} aria-hidden />;
}

/** A single chat-list row placeholder (avatar + two text lines + time). */
export function ChatRowSkeleton() {
  return (
    <div className="flex items-center gap-3 p-2.5">
      <Skeleton className="h-12 w-12 shrink-0 rounded-2xl" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-3.5 w-2/5" />
        <Skeleton className="h-3 w-3/5" />
      </div>
      <Skeleton className="h-2.5 w-8 shrink-0" />
    </div>
  );
}

/** N chat rows, with a subtle width variation so it doesn't look mechanical. */
export function ChatListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <ul className="space-y-0.5" aria-busy="true">
      {Array.from({ length: rows }).map((_, i) => (
        <li key={i}>
          <ChatRowSkeleton />
        </li>
      ))}
    </ul>
  );
}

/** A conversation loading state: a few alternating incoming/outgoing bubbles. */
export function MessagesSkeleton() {
  const widths = ['w-40', 'w-28', 'w-52', 'w-32', 'w-44'];
  return (
    <div className="flex flex-col gap-3 p-4" aria-busy="true">
      {widths.map((w, i) => (
        <Skeleton
          key={i}
          className={`h-10 rounded-[1.25rem] ${w} ${i % 2 ? 'self-end rounded-br-md' : 'self-start rounded-bl-md'}`}
        />
      ))}
    </div>
  );
}
