'use client';

import { useEffect, useState, useCallback } from 'react';
import type { RealtimePostgresChangesPayload, REALTIME_SUBSCRIBE_STATES } from '@supabase/supabase-js';
import { browserSupabase } from '@/lib/supabase/client';
import { listMessages, markMessagesAsRead } from '@/lib/db/chats';
import type { MessageRow } from '@/lib/db/types';
import { useNotifications } from '@/lib/hooks/useNotifications';

const PAGE_SIZE = 50;

export function useChatRealtime(chatId: string) {
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [meTyping, setMeTyping] = useState(false);
  const [channelPresence, setChannelPresence] = useState<any>(null);

  const { notify } = useNotifications();

  // carga inicial
  useEffect(() => {
    let alive = true;
    setLoading(true);

    listMessages(chatId, PAGE_SIZE, 0)
      .then((rows) => {
        if (!alive) return;
        setMessages(rows);
        setHasMore(rows.length === PAGE_SIZE);
        setLoading(false);
        // Marcar leídos
        markMessagesAsRead(chatId).catch(console.error);
      })
      .catch(() => setLoading(false));

    return () => {
      alive = false;
    };
  }, [chatId]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || loading) return;
    setLoadingMore(true);
    
    try {
      const rows = await listMessages(chatId, PAGE_SIZE, messages.length);
      if (rows.length < PAGE_SIZE) setHasMore(false);
      setMessages(prev => [...rows, ...prev]);
    } catch (e) {
      console.error('Error loading more messages:', e);
    } finally {
      setLoadingMore(false);
    }
  }, [chatId, loadingMore, hasMore, loading, messages.length]);

  // realtime inserts, updates, deletes & presence
  useEffect(() => {
    const supabase = browserSupabase();
    let userId = '';
    
    supabase.auth.getUser().then((res: { data: any }) => {
      if (res.data.user) userId = res.data.user.id;
    });

    const channel = supabase
      .channel(`chat:${chatId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `chat_id=eq.${chatId}`,
        },
        (payload: RealtimePostgresChangesPayload<MessageRow>) => {
          if (payload.eventType === 'INSERT') {
            const newMsg = payload.new as MessageRow;
            setMessages((current) => {
              if (current.some((m) => m.id === newMsg.id)) return current;
              return [...current, newMsg];
            });
            // Notificar si la app está en background y el mensaje no es mío
            if (document.hidden && newMsg.sender_id && newMsg.sender_id !== userId) {
              try {
                let txt = 'Nuevo mensaje';
                if (newMsg.content) {
                  txt = newMsg.content;
                } else if (newMsg.ciphertext) {
                  const content = JSON.parse(newMsg.ciphertext);
                  txt = content.text || (content.imagePaths ? 'Imagen' : (content.audioPath ? 'Nota de voz' : 'Nuevo mensaje'));
                }
                notify('Nuevo mensaje', { body: txt });
              } catch {}
            }
            // Si el mensaje no es mío, marcar como leído
            if (newMsg.sender_id && newMsg.sender_id !== userId) {
              markMessagesAsRead(chatId).catch(console.error);
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedMsg = payload.new as MessageRow;
            setMessages((current) => current.map(m => m.id === updatedMsg.id ? updatedMsg : m));
          }
          else if (payload.eventType === 'DELETE') {
            const deletedId = payload.old.id;
            setMessages((current) => current.filter(m => m.id !== deletedId));
          }
        }
      )
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState() as Record<string, Array<{ typing: boolean; userId: string }>>;
        const typing: string[] = [];
        for (const id in state) {
          const presences = state[id];
          for (const p of presences) {
            if (p.typing && p.userId !== userId) {
              typing.push(p.userId);
            }
          }
        }
        setTypingUsers(Array.from(new Set(typing)));
      })
      .subscribe(async (status: REALTIME_SUBSCRIBE_STATES) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ typing: false, userId });
        }
      });
      
    setChannelPresence(channel);

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [chatId, notify]);

  // Update presence typing status
  useEffect(() => {
    if (!channelPresence) return;
    const updateTyping = async () => {
      const supabase = browserSupabase();
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        await channelPresence.track({ typing: meTyping, userId: data.user.id }).catch(console.error);
      }
    };
    updateTyping();
  }, [meTyping, channelPresence]);

  // para pintar “optimista” al enviar (sin esperar realtime)
  function appendLocal(row: MessageRow) {
    setMessages((current) => {
      if (current.some((m) => m.id === row.id)) return current;
      return [...current, row];
    });
  }

  return { 
    messages, 
    loading, 
    appendLocal, 
    loadMore, 
    hasMore, 
    loadingMore,
    typingUsers,
    setMeTyping
  };
}
