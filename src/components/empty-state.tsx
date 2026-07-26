import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * Friendly branded empty state: a gradient icon tile, a title, an optional
 * subtitle and a single call-to-action. Matches the chats-list empty state so
 * every "nothing here yet" screen feels part of the same app.
 */
export function EmptyState({
  icon,
  title,
  subtitle,
  action,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  action?: { label: string; href?: string; onClick?: () => void; icon?: ReactNode };
}) {
  return (
    <div className="mt-10 flex flex-col items-center px-6 text-center">
      <div className="toky-grad toky-ring-brand grid h-16 w-16 place-items-center rounded-3xl text-white">
        {icon}
      </div>
      <p className="mt-4 font-display text-lg font-bold">{title}</p>
      {subtitle && <p className="mt-1 max-w-xs text-sm text-slate-400">{subtitle}</p>}
      {action &&
        (action.href ? (
          <Link
            href={action.href}
            className="toky-grad toky-ring-brand mt-4 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white"
          >
            {action.icon}
            {action.label}
          </Link>
        ) : (
          <button
            type="button"
            onClick={action.onClick}
            className="toky-grad toky-ring-brand mt-4 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white"
          >
            {action.icon}
            {action.label}
          </button>
        ))}
    </div>
  );
}
