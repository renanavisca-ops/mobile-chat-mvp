'use client';

import { useEffect, useRef } from 'react';
import { browserSupabase } from '@/lib/supabase/client';
import { sendMessage } from '@/lib/db/chats';
import { dueScheduled, removeScheduled } from '@/lib/scheduled-messages';

/**
 * Sends due "schedule later" messages while the app is open. Checks on mount,
 * every 30s, and whenever the app returns to the foreground; each due item goes
 * through the normal (end-to-end encrypted) sendMessage path, then is removed.
 * A ref guards against overlapping runs. No-op when signed out.
 */
export function ScheduledSender() {
  const running = useRef(false);

  useEffect(() => {
    let stopped = false;

    async function flush() {
      if (running.current || stopped) return;
      running.current = true;
      try {
        const { data } = await browserSupabase().auth.getUser();
        const uid = data.user?.id;
        if (!uid) return;
        const due = dueScheduled(uid);
        for (const item of due) {
          if (stopped) break;
          try {
            await sendMessage(item.chatId, { text: item.text });
            removeScheduled(uid, item.id);
          } catch {
            // leave it queued; retry on the next tick
          }
        }
      } catch {
        /* ignore */
      } finally {
        running.current = false;
      }
    }

    void flush();
    const timer = setInterval(flush, 30_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void flush();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return null;
}
