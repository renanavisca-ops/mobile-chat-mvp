'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { createSignedChatMediaUrl } from '@/lib/storage/upload';
import { useLanguage } from '@/lib/i18n/context';

type Payload = { v?: number; text?: string; imagePath?: string; imagePaths?: string[]; videoPath?: string; audioPath?: string; gifUrl?: string; filePath?: string; fileName?: string; reply_to?: string; is_deleted?: boolean; };

function parseCipher(ciphertext: string | undefined | null): Payload {
  if (!ciphertext) return {};
  try {
    const obj = JSON.parse(ciphertext);
    if (obj && typeof obj === 'object') return obj as Payload;
  } catch {}
  return {};
}

function getMessagePayload(message: any): Payload {
  const parsed = parseCipher(message.ciphertext);
  if (message.content && !parsed.text) {
    parsed.text = message.content;
  }
  return parsed;
}

export default function PublicChatPage({ params }: { params: { token: string } }) {
  const token = params.token;
  const { t, lang } = useLanguage();

  const [sessionData, setSessionData] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    let alive = true;
    async function loadData() {
      try {
        const res = await fetch(`/api/public-chat/${token}`);
        if (!res.ok) {
          throw new Error(t('publicChat.errorNotFound'));
        }
        const data = await res.json();
        if (alive) {
          setSessionData(data.session);
          setMessages(data.messages || []);
          setLoading(false);
        }
      } catch (e: any) {
        if (alive) {
          setError(e.message);
          setLoading(false);
        }
      }
    }
    loadData();
    return () => { alive = false; };
  }, [token]);

  // Poll for new messages via the token-scoped server API.
  // (Customer clients are unauthenticated, so we don't rely on RLS-scoped
  // Realtime here; the API uses the service role and validates the token.)
  useEffect(() => {
    if (!sessionData?.chat_id) return;
    let alive = true;

    const poll = async () => {
      try {
        const res = await fetch(`/api/public-chat/${token}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!alive) return;
        setMessages((prev) => {
          const serverMsgs = data.messages || [];
          // keep optimistic local- messages that haven't come back yet
          const localOnly = prev.filter(
            (m) => String(m.id).startsWith('local-') &&
              !serverMsgs.some((s: any) => s.content === m.content && s.sender_type === m.sender_type)
          );
          return [...serverMsgs, ...localOnly];
        });
      } catch {
        // ignore transient errors
      }
    };

    const interval = setInterval(poll, 4000);
    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, [sessionData?.chat_id, token]);

  const items = useMemo(() => messages.map((m) => ({ ...m, body: getMessagePayload(m) })), [messages]);

  // Autoscroll
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [items.length]);

  // Signed URLs resolution
  useEffect(() => {
    let cancelled = false;
    async function resolveMissing() {
      const allPaths = new Set<string>();
      for (const m of items) {
        if (m.body.imagePath) allPaths.add(m.body.imagePath);
        if (m.body.imagePaths) m.body.imagePaths.forEach((p: string) => allPaths.add(p));
        if (m.body.videoPath) allPaths.add(m.body.videoPath);
        if (m.body.audioPath) allPaths.add(m.body.audioPath);
        if (m.body.filePath) allPaths.add(m.body.filePath);
      }

      const missing = Array.from(allPaths).filter((p) => !signedUrls[p]);
      if (missing.length === 0) return;

      try {
        const pairs = await Promise.all(
          missing.map(async (path) => {
            const url = await createSignedChatMediaUrl(path, 300);
            return [path, url] as const;
          })
        );
        if (cancelled) return;
        setSignedUrls((prev) => {
          const next = { ...prev };
          for (const [p, u] of pairs) next[p] = u;
          return next;
        });
      } catch (e: any) {
        console.error(e);
      }
    }
    resolveMissing();
    return () => { cancelled = true; };
  }, [items, signedUrls]);

  const onSend = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      // Optimistic
      const tempId = `local-${Date.now()}`;
      setMessages(prev => [...prev, {
        id: tempId,
        chat_id: sessionData.chat_id,
        content: trimmed,
        ciphertext: JSON.stringify({ v: 1, text: trimmed }),
        created_at: new Date().toISOString(),
        sender_type: 'customer',
        sender_id: sessionData.customer_id,
        read: false
      }]);
      setText('');

      const res = await fetch(`/api/public-chat/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: trimmed })
      });
      if (!res.ok) throw new Error(t('publicChat.errorSendFailed'));
    } catch (e: any) {
      console.error(e);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-300">{t('publicChat.loading')}</div>;
  }

  if (error || !sessionData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
        <div className="toky-glass toky-elev p-8 rounded-3xl border border-slate-800 text-center">
          <h2 className="font-display text-xl font-bold text-rose-400 mb-2">{t('publicChat.error')}</h2>
          <p className="text-slate-400">{error || t('publicChat.chatNotFound')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-slate-950 text-slate-100 flex flex-col max-w-md mx-auto">
      {/* Header */}
      <div className="toky-grad text-white p-4 pt-safe shadow-md flex items-center justify-between z-10">
        <div>
          <h1 className="font-display font-bold text-lg">{sessionData.chats?.title || t('publicChat.supportFallback')}</h1>
          <p className="text-white/80 text-xs">
            {sessionData.chats?.status === 'closed' ? t('publicChat.chatClosed') : t('publicChat.connected')}
          </p>
        </div>
        <div className="w-11 h-11 bg-white/20 rounded-2xl flex items-center justify-center ring-1 ring-white/20">
          <span className="text-xl">🎧</span>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-950/40">
        {items.length === 0 ? (
          <div className="text-center text-slate-500 mt-10">{t('publicChat.noMessagesYet')}</div>
        ) : (
          items.map(m => {
            const isCustomer = m.sender_type === 'customer';
            const isSystem = m.sender_type === 'system';

            if (isSystem) {
              return (
                <div key={m.id} className="text-center">
                  <span className="inline-block bg-slate-800/70 text-slate-400 text-xs px-3 py-1 rounded-full">
                    {m.body.text || t('publicChat.systemNotification')}
                  </span>
                </div>
              );
            }

            return (
              <div key={m.id} className={`flex flex-col ${isCustomer ? 'items-end' : 'items-start'}`}>
                <div className={`max-w-[85%] rounded-[1.25rem] px-4 py-2 ${
                  isCustomer ? 'toky-grad text-white rounded-br-md shadow-[0_4px_14px_-6px_rgba(79,70,229,0.7)]' : 'bg-slate-800 text-slate-100 border border-slate-800 rounded-bl-md shadow-sm'
                }`}>
                  {m.body.text && <div className="text-sm">{m.body.text}</div>}

                  {m.body.gifUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.body.gifUrl} alt="GIF" className="mt-2 max-w-full rounded" />
                  )}

                  {m.body.imagePaths && m.body.imagePaths.map((p: string) => signedUrls[p] && (
                    <img key={p} src={signedUrls[p]} alt="attachment" className="max-w-full rounded mt-2" />
                  ))}
                  {m.body.imagePath && signedUrls[m.body.imagePath] && (
                    <img src={signedUrls[m.body.imagePath]} alt="attachment" className="max-w-full rounded mt-2" />
                  )}
                  {m.body.videoPath && signedUrls[m.body.videoPath] && (
                    <video src={signedUrls[m.body.videoPath]} controls className="max-w-full rounded mt-2" />
                  )}
                  {m.body.audioPath && signedUrls[m.body.audioPath] && (
                    <audio src={signedUrls[m.body.audioPath]} controls className="max-w-full mt-2" />
                  )}
                  {m.body.filePath && signedUrls[m.body.filePath] && (
                    <a
                      href={signedUrls[m.body.filePath]}
                      target="_blank"
                      rel="noreferrer"
                      download={m.body.fileName}
                      className={`mt-2 flex items-center gap-2 rounded-lg border p-2 text-sm ${isCustomer ? 'border-white/30 text-white' : 'border-slate-700 text-slate-300'}`}
                    >
                      📎 <span className="truncate">{m.body.fileName || 'File'}</span>
                    </a>
                  )}

                  <div className={`text-[10px] mt-1 text-right ${isCustomer ? 'text-white/70' : 'text-slate-500'}`}>
                    {new Date(m.created_at).toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Input */}
      {sessionData.chats?.status !== 'closed' ? (
        <div className="toky-glass p-3 border-t border-slate-800/70 flex items-center gap-2 pb-safe">
          <input
            className="flex-1 bg-slate-900 border border-slate-800 focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/20 rounded-full px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none transition-all"
            placeholder={t('publicChat.composerPlaceholder')}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSend()}
            disabled={busy}
          />
          <button
            onClick={onSend}
            disabled={busy || !text.trim()}
            className="toky-grad toky-ring-brand w-11 h-11 text-white rounded-full flex items-center justify-center disabled:opacity-50 transition-colors"
          >
            <svg className="w-5 h-5 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      ) : (
        <div className="bg-slate-900 p-4 text-center text-sm text-slate-400 pb-safe">
          {t('publicChat.thisChatClosed')}
        </div>
      )}
    </div>
  );
}
