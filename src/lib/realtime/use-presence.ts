'use client';

import { useEffect, useState } from 'react';
import { browserSupabase } from '@/lib/supabase/client';

/**
 * Global online presence.
 * - Joins a shared Realtime presence channel keyed by the user's id.
 * - Heartbeats `touch_last_seen()` so we also keep a persisted "last seen".
 * - Respects `profiles.show_online`: a user who hides their status joins the
 *   channel to SEE others but does not broadcast themselves, so they appear
 *   offline to everyone else.
 *
 * Returns the set of user ids currently online.
 */
export function usePresence(): Set<string> {
  const [online, setOnline] = useState<Set<string>>(new Set());

  useEffect(() => {
    const supabase = browserSupabase();
    let cancelled = false;
    let heartbeat: ReturnType<typeof setInterval> | null = null;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      const { data: prof } = await supabase
        .from('profiles')
        .select('show_online')
        .eq('id', user.id)
        .maybeSingle();

      const showOnline = prof?.show_online ?? true;

      channel = supabase.channel('online-users', {
        config: { presence: { key: user.id } },
      });

      channel
        .on('presence', { event: 'sync' }, () => {
          if (!channel) return;
          const state = channel.presenceState();
          setOnline(new Set(Object.keys(state)));
        })
        .subscribe(async (status) => {
          if (status !== 'SUBSCRIBED' || !channel) return;
          if (showOnline) await channel.track({ online: true });
          await supabase.rpc('touch_last_seen');
        });

      heartbeat = setInterval(() => {
        supabase.rpc('touch_last_seen');
      }, 30_000);
    })();

    return () => {
      cancelled = true;
      if (heartbeat) clearInterval(heartbeat);
      if (channel) void supabase.removeChannel(channel);
    };
  }, []);

  return online;
}
