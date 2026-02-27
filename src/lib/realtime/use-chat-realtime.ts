'use client';

import { useEffect, useState } from 'react';
import type { RealtimePostgresInsertPayload } from '@supabase/supabase-js';
import { browserSupabase } from '@/lib/supabase/client';
import { listMessages } from '@/lib/db/chats';
import type { MessageRow } from '@/types/chat';

export function useChatRealtime(chatId: string) {
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    listMessages(chatId, 200)
      .then((rows) => {
        if (!alive) return;
        setMessages(rows);
        setLoading(false);
      })
      .catch(() => setLoading(false));
    return () => {
      alive = false;
    };
  }, [chatId]);

  useEffect(() => {
    const supabase = browserSupabase();

    const channel = supabase
      .channel(`chat:${chatId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `chat_id=eq.${chatId}`
        },
        (payload: RealtimePostgresInsertPayload<MessageRow>) => {
          setMessages((current) => {
            if (current.some((item) => item.id === payload.new.id)) return current;
            return [...current, payload.new];
          });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [chatId]);

  return { messages, loading };
}
