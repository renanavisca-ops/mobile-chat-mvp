'use client';

import { useEffect, useState, useCallback } from 'react';
import type { RealtimePostgresChangesPayload, REALTIME_SUBSCRIBE_STATES } from '@supabase/supabase-js';
import { browserSupabase } from '@/lib/supabase/client';
import { listMessages, markMessagesAsRead, listReactions, listPollVotes, listHiddenMessages, decryptRow } from '@/lib/db/chats';
import type { MessageRow, MessageReaction, PollVote, HiddenMessage } from '@/lib/db/types';
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

  const [reactions, setReactions] = useState<MessageReaction[]>([]);
  const [pollVotes, setPollVotes] = useState<PollVote[]>([]);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());

  const { notify } = useNotifications();

  // initial reactions + poll votes + hidden messages for the whole chat
  useEffect(() => {
    let alive = true;
    listReactions(chatId).then((rows) => alive && setReactions(rows)).catch(() => {});
    listPollVotes(chatId).then((rows) => alive && setPollVotes(rows)).catch(() => {});
    listHiddenMessages(chatId)
      .then((rows) => alive && setHiddenIds(new Set(rows.map((r) => r.message_id))))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [chatId]);

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

  // Catch up after the realtime socket may have missed events (phone sleep,
  // network blip, tab backgrounded). Re-pulls the latest page and merges,
  // de-duping our own optimistic echoes against their real rows.
  const refetch = useCallback(async () => {
    try {
      const rows = await listMessages(chatId, PAGE_SIZE, 0);
      setMessages((prev) => {
        const map = new Map<string, MessageRow>();
        for (const m of prev) map.set(m.id, m);
        for (const r of rows) map.set(r.id, r);
        const realCiphertexts = new Set(rows.map((r) => r.ciphertext ?? ''));
        const merged = Array.from(map.values()).filter(
          (m) => !(String(m.id).startsWith('local-') && realCiphertexts.has(m.ciphertext ?? ''))
        );
        merged.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        return merged;
      });
      listReactions(chatId).then(setReactions).catch(() => {});
      listPollVotes(chatId).then(setPollVotes).catch(() => {});
      listHiddenMessages(chatId)
        .then((r) => setHiddenIds(new Set(r.map((x) => x.message_id))))
        .catch(() => {});
    } catch {
      // ignore transient failures
    }
  }, [chatId]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') refetch();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', refetch);
    window.addEventListener('focus', refetch);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', refetch);
      window.removeEventListener('focus', refetch);
    };
  }, [refetch]);

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
            const raw = payload.new as MessageRow;
            // Decrypt E2EE rows before they touch state so the rest of the UI
            // treats `ciphertext` as the usual plaintext payload JSON.
            void (async () => {
              const newMsg = await decryptRow(chatId, raw);
              setMessages((current) => {
                if (current.some((m) => m.id === newMsg.id)) return current;
                // Replace the optimistic local echo (added on send with a
                // `local-` id but the SAME plaintext ciphertext) so our own
                // messages don't show twice when the realtime INSERT comes back.
                const withoutEcho = current.filter(
                  (m) => !(m.id.startsWith('local-') && m.ciphertext === newMsg.ciphertext)
                );
                return [...withoutEcho, newMsg];
              });
              // Notificar si la app está en background y el mensaje no es mío
              if (document.hidden && newMsg.sender_id && newMsg.sender_id !== userId) {
                try {
                  let txt = 'Nuevo mensaje';
                  if (newMsg.content) {
                    txt = newMsg.content;
                  } else if (newMsg.ciphertext) {
                    const content = JSON.parse(newMsg.ciphertext);
                    txt = content.encrypted
                      ? 'Mensaje cifrado'
                      : content.text || (content.imagePaths ? 'Imagen' : (content.audioPath ? 'Nota de voz' : 'Nuevo mensaje'));
                  }
                  notify('Nuevo mensaje', { body: txt });
                } catch {}
              }
              // Si el mensaje no es mío, marcar como leído
              if (newMsg.sender_id && newMsg.sender_id !== userId) {
                markMessagesAsRead(chatId).catch(console.error);
              }
            })();
          } else if (payload.eventType === 'UPDATE') {
            const raw = payload.new as MessageRow;
            void (async () => {
              const updatedMsg = await decryptRow(chatId, raw);
              setMessages((current) => current.map((m) => (m.id === updatedMsg.id ? updatedMsg : m)));
            })();
          }
          else if (payload.eventType === 'DELETE') {
            const deletedId = payload.old.id;
            setMessages((current) => current.filter(m => m.id !== deletedId));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'message_reactions', filter: `chat_id=eq.${chatId}` },
        (payload: RealtimePostgresChangesPayload<MessageReaction>) => {
          if (payload.eventType === 'INSERT') {
            const row = payload.new as MessageReaction;
            setReactions((current) => {
              const withoutSameUser = current.filter(
                (r) => !(r.message_id === row.message_id && r.user_id === row.user_id)
              );
              return [...withoutSameUser, row];
            });
          } else if (payload.eventType === 'UPDATE') {
            const row = payload.new as MessageReaction;
            setReactions((current) => current.map((r) => (r.id === row.id ? row : r)));
          } else if (payload.eventType === 'DELETE') {
            const oldRow = payload.old as Partial<MessageReaction>;
            setReactions((current) => current.filter((r) => r.id !== oldRow.id));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'poll_votes', filter: `chat_id=eq.${chatId}` },
        (payload: RealtimePostgresChangesPayload<PollVote>) => {
          if (payload.eventType === 'DELETE') {
            const oldRow = payload.old as Partial<PollVote>;
            setPollVotes((current) =>
              current.filter((v) => !(v.message_id === oldRow.message_id && v.user_id === oldRow.user_id))
            );
            return;
          }
          const row = payload.new as PollVote;
          setPollVotes((current) => {
            const withoutSameUser = current.filter(
              (v) => !(v.message_id === row.message_id && v.user_id === row.user_id)
            );
            return [...withoutSameUser, row];
          });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'hidden_messages', filter: `chat_id=eq.${chatId}` },
        (payload: RealtimePostgresChangesPayload<HiddenMessage>) => {
          if (payload.eventType === 'DELETE') {
            const oldRow = payload.old as Partial<HiddenMessage>;
            if (!oldRow.message_id) return;
            setHiddenIds((prev) => {
              const next = new Set(prev);
              next.delete(oldRow.message_id!);
              return next;
            });
            return;
          }
          const row = payload.new as HiddenMessage;
          setHiddenIds((prev) => new Set(prev).add(row.message_id));
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
          // Catch up on anything missed before/while (re)subscribing.
          refetch();
        }
      });
      
    setChannelPresence(channel);

    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    setMeTyping,
    reactions,
    pollVotes,
    hiddenIds,
  };
}
