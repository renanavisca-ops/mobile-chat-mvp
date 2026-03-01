'use client';

import { useEffect, useState } from 'react';
import type { RealtimePostgresInsertPayload } from '@supabase/supabase-js';
import { browserSupabase } from '@/lib/supabase/client';
import { listMessages } from '@/lib/db/chats';
import type { MessageRow } from '@/lib/db/types';

export function useChatRealtime(chatId: string) {
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(true);

  // carga inicial
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

  // realtime inserts
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
          filter: `chat_id=eq.${chatId}`,
        },
        (payload: RealtimePostgresInsertPayload<MessageRow>) => {
          setMessages((current) => {
            if (current.some((m) => m.id === payload.new.id)) return current;
            return [...current, payload.new];
          });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [chatId]);

  // para pintar “optimista” al enviar (sin esperar realtime)
  function appendLocal(row: MessageRow) {
    setMessages((current) => {
      if (current.some((m) => m.id === row.id)) return current;
      return [...current, row];
    });
  }

  return { messages, loading, appendLocal };
}
