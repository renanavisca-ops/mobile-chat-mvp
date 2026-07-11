'use client';

import { createContext, useContext } from 'react';
import { usePresence } from '@/lib/realtime/use-presence';

const PresenceContext = createContext<Set<string>>(new Set());

export function PresenceProvider({ children }: { children: React.ReactNode }) {
  const online = usePresence();
  return <PresenceContext.Provider value={online}>{children}</PresenceContext.Provider>;
}

/** Returns true if the given user id is currently online. */
export function useIsOnline(userId: string | null | undefined): boolean {
  const online = useContext(PresenceContext);
  return userId ? online.has(userId) : false;
}

/** Returns the full set of online user ids. */
export function useOnlineUsers(): Set<string> {
  return useContext(PresenceContext);
}
