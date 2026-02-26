'use client';

import { useEffect, useRef, useState } from 'react';
import type { RealtimePostgresInsertPayload } from '@supabase/supabase-js';
import { browserSupabase } from '@/lib/supabase/client';
import type { MessageRow } from '@/types/chat';

const MAX_BACKOFF_MS = 10_000;

export function useChatRealtime(chatId: string) {
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const retryMs = useRef(500);

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
            if (current.some((item) => item.id === payload.new.id)) {
              return current;
            }
            return [...current, payload.new];
          });
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          retryMs.current = 500;
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [chatId]);

  useEffect(() => {
    const interval = setInterval(() => {
      retryMs.current = Math.min(MAX_BACKOFF_MS, retryMs.current * 2);
    }, retryMs.current);
    return () => clearInterval(interval);
  }, []);

  return messages;
}
