'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { PageShell } from '@/components/page-shell';
import { ForwardModal } from '@/components/forward-modal';
import { useRequireAuth } from '@/lib/auth/use-require-auth';
import { listChats, sendMessage, deleteMessage } from '@/lib/db/chats';
import { forwardMessageToChats, type ForwardPayload } from '@/lib/db/forward';
import { uploadChatImage, uploadChatMedia, uploadChatAudio, createSignedChatMediaUrl } from '@/lib/storage/upload';
import { useChatRealtime } from '@/lib/realtime/use-chat-realtime';
import { browserSupabase } from '@/lib/supabase/client';
import type { ChatSummary, MessageRow } from '@/lib/db/types';

type Payload = {
  v?: number;
  text?: string;
  imagePath?: string;
  imagePaths?: string[];
  videoPath?: string;
  audioPath?: string;
  reply_to?: string;
  is_deleted?: boolean;
};

function parseCipher(ciphertext: string | undefined | null): Payload {
  if (!ciphertext) return {};
  try {
    const obj = JSON.parse(ciphertext);
    if (obj && typeof obj === 'object') return obj as Payload;
  } catch {}
  return {};
}

function getMessagePayload(message: MessageRow): Payload {
  const parsed = parseCipher(message.ciphertext);
  if ((message as any).content && !parsed.text) parsed.text = (message as any).content;
  return parsed;
}

function shortId(id: string) {
  return id.length > 10 ? `${id.slice(0, 6)}…${id.slice(-4)}` : id;
}

function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
}

function toForwardPayload(body: Payload): ForwardPayload {
  const out: ForwardPayload = {};
  if (body.text) out.text = body.text;
  if (Array.isArray(body.imagePaths) && body.imagePaths.length) out.imagePaths = body.imagePaths.filter(Boolean);
  else if (body.imagePath) out.imagePath = body.imagePath;
  if (body.videoPath) out.videoPath = body.videoPath;
  if (body.audioPath) out.audioPath = body.audioPath;
  return out;
}

function extractAllPaths(body: Payload): string[] {
  const arr: string[] = [];
  if (body.imagePath) arr.push(body.imagePath);
  if (Array.isArray(body.imagePaths)) for (const p of body.imagePaths) if (p) arr.push(p);
  if (body.videoPath) arr.push(body.videoPath);
  if (body.audioPath) arr.push(body.audioPath);
  return Array.from(new Set(arr));
}

export default function ChatPage({ params }: { params: { chatId: string } }) {
  const { loading: authLoading, user, profile, accessToken } = useRequireAuth();
  const chatId = params.chatId;
  const userId = user?.id ?? null;

  const { messages, loading: msgLoading, appendLocal, loadMore, hasMore, loadingMore, typingUsers, setMeTyping } = useChatRealtime(chatId, userId);

  const [chat, setChat] = useState<ChatSummary | null>(null);
  const [members, setMembers] = useState<string[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const [text, setText] = useState('');
  const [pendingImages, setPendingImages] = useState<File[]>([]);
  const [pendingVideo, setPendingVideo] = useState<File | null>(null);
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [previewVideo, setPreviewVideo] = useState('');
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  const [forwardOpen, setForwardOpen] = useState(false);
  const [forwardBody, setForwardBody] = useState<ForwardPayload | null>(null);
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [chatsLoading, setChatsLoading] = useState(false);

  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const items = useMemo(() => messages.map((m) => ({ ...m, body: getMessagePayload(m) })), [messages]);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    const supabase = browserSupabase();

    async function loadChat() {
      const { data, error } = await supabase
        .from('chats')
        .select('id, kind, title, created_at, store_id, assigned_to, status')
        .eq('id', chatId)
        .single();

      if (!alive) return;
      if (error) setErr(error.message);
      else setChat(data as ChatSummary);
    }

    void loadChat();
    return () => {
      alive = false;
    };
  }, [chatId, userId]);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    const supabase = browserSupabase();

    async function loadMembers() {
      setMembersLoading(true);

      const { data: cms, error: cmErr } = await supabase
        .from('chat_members')
        .select('user_id')
        .eq('chat_id', chatId);

      if (!alive) return;

      if (cmErr) {
        setErr(cmErr.message);
        setMembersLoading(false);
        return;
      }

      const userIds = (cms ?? []).map((r: any) => r.user_id).filter(Boolean);
      if (userIds.length === 0) {
        setMembers([]);
        setMembersLoading(false);
        return;
      }

      const { data: profs, error: pErr } = await supabase
        .from('profiles')
        .select('id, username')
        .in('id', userIds);

      if (!alive) return;

      if (pErr) {
        setErr(pErr.message);
        setMembersLoading(false);
        return;
      }

      const byId = new Map<string, string>();
      for (const p of profs ?? []) byId.set((p as any).id, (p as any).username ?? '');
      setMembers(userIds.map((id: string) => byId.get(id) || shortId(id)));
      setMembersLoading(false);
    }

    void loadMembers();
    return () => {
      alive = false;
    };
  }, [chatId, userId]);

  useEffect(() => {
    if (!userId || !profile) return;
    let alive = true;

    async function loadForwardChats() {
      setChatsLoading(true);
      try {
        const list = await listChats(userId, profile as any);
        if (!alive) return;
        setChats(list.filter((c) => c.id !== chatId));
      } catch (e: any) {
        if (alive) setErr(e?.message ?? String(e));
      } finally {
        if (alive) setChatsLoading(false);
      }
    }

    void loadForwardChats();
    return () => {
      alive = false;
    };
  }, [chatId, userId, profile]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 180) {
      el.scrollTop = el.scrollHeight;
    }
  }, [items.length]);

  useEffect(() => {
    if (!userId) return;
    const t = window.setTimeout(() => setMeTyping(text.trim().length > 0), 250);
    return () => window.clearTimeout(t);
  }, [text, setMeTyping, userId]);

  useEffect(() => {
    if (!userId) return;
    const t = window.setTimeout(() => setMeTyping(false), 3000);
    return () => window.clearTimeout(t);
  }, [text, setMeTyping, userId]);

  useEffect(() => {
    let cancelled = false;

    async function resolveMissing() {
      const allPaths = new Set<string>();
      for (const m of items) for (const p of extractAllPaths(m.body)) allPaths.add(p);

      const missing = Array.from(allPaths).filter((p) => !signedUrls[p]);
      if (missing.length === 0) return;

      try {
        const pairs = await Promise.all(
          missing.map(async (path) => [path, await createSignedChatMediaUrl(path, 300)] as const)
        );
        if (cancelled) return;

        setSignedUrls((prev) => {
          const next = { ...prev };
          for (const [p, url] of pairs) next[p] = url;
          return next;
        });
      } catch (e: any) {
        if (!cancelled) setErr(e?.message ?? String(e));
      }
    }

    void resolveMissing();
    return () => {
      cancelled = true;
    };
  }, [items, signedUrls]);

  function clearPendingImages() {
    for (const url of previewImages) URL.revokeObjectURL(url);
    setPreviewImages([]);
    setPendingImages([]);
    if (imageInputRef.current) imageInputRef.current.value = '';
  }

  function clearPendingVideo() {
    if (previewVideo) URL.revokeObjectURL(previewVideo);
    setPreviewVideo('');
    setPendingVideo(null);
    if (videoInputRef.current) videoInputRef.current.value = '';
  }

  async function onImagesChange(e: React.ChangeEvent<HTMLInputElement>) {
    setErr('');
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    const allowed = new Set(['image/jpeg', 'image/png', 'image/webp']);
    const picked = files.slice(0, 6);

    for (const file of picked) {
      if (!allowed.has(file.type)) {
        setErr('Solo JPG, PNG o WEBP.');
        e.target.value = '';
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setErr('Máximo 5MB por imagen.');
        e.target.value = '';
        return;
      }
    }

    if (pendingVideo) clearPendingVideo();

    const normalized = picked.map((file) => new File([file], sanitizeFilename(file.name), { type: file.type }));
    const urls = normalized.map((file) => URL.createObjectURL(file));

    setPendingImages(normalized);
    setPreviewImages(urls);
    e.target.value = '';
  }

  async function onVideoChange(e: React.ChangeEvent<HTMLInputElement>) {
    setErr('');
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 200 * 1024 * 1024) {
      setErr('Máximo 200MB por video.');
      e.target.value = '';
      return;
    }

    if (pendingImages.length) clearPendingImages();

    const normalized = new File([file], sanitizeFilename(file.name), { type: file.type });
    if (previewVideo) URL.revokeObjectURL(previewVideo);
    setPreviewVideo(URL.createObjectURL(normalized));
    setPendingVideo(normalized);
    e.target.value = '';
  }

  function appendOptimistic(payload: Payload) {
    const temp: MessageRow = {
      id: `local-${crypto.randomUUID()}`,
      chat_id: chatId,
      sender_device_id: 'local',
      ciphertext: JSON.stringify({ v: 1, ...payload }),
      content: payload.text || null,
      nonce: `local-${crypto.randomUUID()}`,
      message_type: 'whisper',
      sender_type: 'agent',
      sender_id: userId,
      read: false,
      created_at: new Date().toISOString(),
    } as any;

    appendLocal(temp);
  }

  async function sendPayload(payload: Payload) {
    if (!userId) throw new Error('Not authenticated');
    appendOptimistic(payload);
    await sendMessage(chatId, payload, userId);
  }

  async function onSend() {
    setErr('');
    const t = text.trim();
    if (!t && pendingImages.length === 0 && !pendingVideo) return;

    setBusy(true);

    try {
      if (pendingVideo) {
        const { path } = await uploadChatMedia({ chatId, file: pendingVideo, kind: 'video' });
        const payload: Payload = t ? { text: t, videoPath: path } : { videoPath: path };
        setText('');
        clearPendingVideo();
        await sendPayload(payload);
        return;
      }

      if (pendingImages.length > 0) {
        const results = await Promise.all(pendingImages.map((file) => uploadChatImage(chatId, file)));
        const paths = results.map((r) => r.path);
        const payload: Payload = t ? { text: t, imagePaths: paths } : { imagePaths: paths };
        setText('');
        clearPendingImages();
        await sendPayload(payload);
        return;
      }

      setText('');
      await sendPayload({ text: t });
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function startRecording() {
    setErr('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach((track) => track.stop());
        setBusy(true);
        try {
          const { path } = await uploadChatAudio(chatId, blob);
          await sendPayload({ audioPath: path });
        } catch (e: any) {
          setErr(e?.message ?? String(e));
        } finally {
          setBusy(false);
        }
      };

      recorder.start();
      setIsRecording(true);
    } catch (e: any) {
      setErr('No se pudo acceder al micrófono: ' + e.message);
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }

  async function onDelete(messageId: string) {
    if (!userId) return;
    setBusy(true);
    try {
      await deleteMessage(messageId, chatId, userId);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function updateStatus(newStatus: 'in_progress' | 'closed') {
    setBusy(true);
    try {
      if (!accessToken) throw new Error('Session token not ready. Refresh and try again.');

      const res = await fetch(`/api/chat/${chatId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? 'Error al actualizar estado');

      setChat((prev) => (prev ? { ...prev, status: newStatus } : prev));
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function confirmForward(destChatIds: string[]) {
    if (!forwardBody || !userId) return;
    setBusy(true);
    try {
      await forwardMessageToChats(destChatIds, forwardBody, userId);
      setForwardOpen(false);
      setForwardBody(null);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollTop === 0 && hasMore && !loadingMore) loadMore();
  }

  const loading = authLoading || msgLoading;

  return (
    <PageShell title="Chat">
      <ForwardModal
        open={forwardOpen}
        chats={chats}
        loading={chatsLoading}
        onClose={() => setForwardOpen(false)}
        onConfirm={confirmForward}
      />

      {err ? <p className="mb-3 text-sm text-red-300">{err}</p> : null}

      {loading ? (
        <p className="text-sm text-slate-300">Loading…</p>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
            <div>Members: {membersLoading ? 'Loading…' : members.length ? members.join(', ') : '—'}</div>

            {chat && (
              <div className="flex items-center gap-2">
                <span className="rounded bg-slate-800 px-1.5 py-0.5 uppercase text-slate-300">
                  {chat.status ?? 'open'}
                </span>

                {chat.status === 'open' ? (
                  <button
                    onClick={() => updateStatus('in_progress')}
                    className="rounded bg-blue-600 px-2 py-1 text-white hover:bg-blue-500 disabled:opacity-60"
                    disabled={busy || !accessToken}
                  >
                    Tomar
                  </button>
                ) : null}

                {chat.status !== 'closed' ? (
                  <button
                    onClick={() => updateStatus('closed')}
                    className="rounded bg-slate-700 px-2 py-1 text-white hover:bg-slate-600 disabled:opacity-60"
                    disabled={busy || !accessToken}
                  >
                    Cerrar
                  </button>
                ) : null}
              </div>
            )}
          </div>

          <div ref={scrollRef} onScroll={handleScroll} className="h-[58vh] overflow-auto rounded-xl border border-slate-900 bg-slate-950/40 p-3">
            {loadingMore ? <div className="my-2 text-center text-xs text-slate-500">Cargando anteriores...</div> : null}

            {items.length === 0 ? (
              <p className="text-sm text-slate-400">No messages yet.</p>
            ) : (
              <ul className="space-y-2">
                {items.map((m) => {
                  const imgPaths: string[] = [];
                  if (m.body.imagePath) imgPaths.push(m.body.imagePath);
                  if (Array.isArray(m.body.imagePaths)) imgPaths.push(...m.body.imagePaths.filter(Boolean));
                  const videoPath = m.body.videoPath;
                  const audioPath = m.body.audioPath;
                  const isOwn = m.sender_id === userId || m.sender_device_id === 'local';
                  const isSystem = m.sender_type === 'system';

                  return (
                    <li
                      key={m.id}
                      className={`flex flex-col rounded-lg p-2 ${
                        isSystem
                          ? 'mx-auto max-w-[90%] border border-slate-700 bg-slate-800 text-center text-xs text-slate-400'
                          : isOwn
                            ? 'ml-auto max-w-[82%] border border-blue-800 bg-blue-900/40'
                            : 'mr-auto max-w-[82%] border border-slate-800 bg-slate-900'
                      }`}
                    >
                      <div className="mb-1 flex items-center justify-between gap-2 text-[10px] text-slate-500">
                        <span>{new Date(m.created_at).toLocaleString()}</span>
                        {!isSystem && isOwn ? <span className={m.read ? 'text-blue-400' : 'text-slate-600'}>{m.read ? '✓✓' : '✓'}</span> : null}
                      </div>

                      {m.body.is_deleted ? (
                        <div className="text-sm italic text-slate-500">🚫 Este mensaje fue eliminado</div>
                      ) : (
                        <>
                          {m.body.text ? <div className="whitespace-pre-wrap text-sm">{m.body.text}</div> : null}

                          {imgPaths.length ? (
                            <div className="mt-2 grid grid-cols-2 gap-2">
                              {Array.from(new Set(imgPaths)).map((path) => {
                                const url = signedUrls[path] || '';
                                return url ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img key={path} src={url} alt="chat image" className="max-h-80 w-auto rounded-lg border border-slate-900" />
                                ) : (
                                  <div key={path} className="h-28 w-full animate-pulse rounded-lg border border-slate-900 bg-slate-800" />
                                );
                              })}
                            </div>
                          ) : null}

                          {videoPath ? (
                            <div className="mt-2">
                              {signedUrls[videoPath] ? (
                                <video src={signedUrls[videoPath]} controls className="max-h-96 w-full rounded-lg border border-slate-900" />
                              ) : (
                                <div className="h-40 w-full animate-pulse rounded-lg border border-slate-900 bg-slate-800" />
                              )}
                            </div>
                          ) : null}

                          {audioPath ? (
                            <div className="mt-2">
                              {signedUrls[audioPath] ? (
                                <audio src={signedUrls[audioPath]} controls className="h-10 w-full" />
                              ) : (
                                <div className="h-10 w-full animate-pulse rounded-lg border border-slate-900 bg-slate-800" />
                              )}
                            </div>
                          ) : null}
                        </>
                      )}

                      {!isSystem && !m.body.is_deleted ? (
                        <div className="mt-2 flex justify-end gap-2 text-xs">
                          <button
                            className="text-slate-400 hover:text-slate-200"
                            onClick={() => {
                              setForwardBody(toForwardPayload(m.body));
                              setForwardOpen(true);
                            }}
                          >
                            Forward
                          </button>
                          {isOwn && !String(m.id).startsWith('local-') ? (
                            <button className="text-red-300 hover:text-red-200" onClick={() => onDelete(m.id)} disabled={busy}>
                              Delete
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {previewImages.length ? (
            <div className="rounded border border-slate-900 bg-slate-950/40 p-2">
              <div className="mb-2 text-xs text-slate-400">Preview imágenes:</div>
              <div className="grid grid-cols-3 gap-2">
                {previewImages.map((url) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={url} src={url} alt="preview" className="h-24 w-full rounded border border-slate-900 object-cover" />
                ))}
              </div>
              <div className="mt-2 flex justify-end">
                <button className="rounded bg-slate-800 px-3 py-1.5 text-xs hover:bg-slate-700" onClick={clearPendingImages} disabled={busy}>
                  Remove all
                </button>
              </div>
            </div>
          ) : null}

          {previewVideo ? (
            <div className="rounded border border-slate-900 bg-slate-950/40 p-2">
              <div className="mb-2 text-xs text-slate-400">Preview video:</div>
              <video src={previewVideo} controls className="max-h-72 w-full rounded border border-slate-900" />
              <div className="mt-2 flex justify-end">
                <button className="rounded bg-slate-800 px-3 py-1.5 text-xs hover:bg-slate-700" onClick={clearPendingVideo} disabled={busy}>
                  Remove
                </button>
              </div>
            </div>
          ) : null}

          {typingUsers.length > 0 ? <div className="ml-2 animate-pulse text-xs text-blue-400">Alguien está escribiendo...</div> : null}

          <div className="flex items-center gap-2">
            <input ref={imageInputRef} type="file" hidden multiple accept="image/jpeg,image/png,image/webp" onChange={onImagesChange} />
            <input ref={videoInputRef} type="file" hidden accept="video/*" onChange={onVideoChange} />

            <button className="rounded bg-slate-800 px-3 py-2 text-sm hover:bg-slate-700" onClick={() => imageInputRef.current?.click()} disabled={busy}>
              📷
            </button>
            <button className="rounded bg-slate-800 px-3 py-2 text-sm hover:bg-slate-700" onClick={() => videoInputRef.current?.click()} disabled={busy}>
              🎥
            </button>
            <input
              className="flex-1 rounded border border-slate-800 bg-slate-950 px-3 py-2 text-slate-100"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type a message…"
              onKeyDown={(e) => {
                if (e.key === 'Enter') void onSend();
              }}
            />
            <button className="rounded bg-blue-600 px-3 py-2 text-sm hover:bg-blue-500 disabled:opacity-60" onClick={onSend} disabled={busy || isRecording || !userId}>
              Send
            </button>
            <button
              className={`rounded px-3 py-2 text-sm disabled:opacity-60 ${isRecording ? 'bg-red-600 text-white' : 'bg-slate-800 hover:bg-slate-700'}`}
              onClick={isRecording ? stopRecording : startRecording}
              disabled={busy || !userId}
            >
              🎤
            </button>
          </div>
        </div>
      )}
    </PageShell>
  );
}
