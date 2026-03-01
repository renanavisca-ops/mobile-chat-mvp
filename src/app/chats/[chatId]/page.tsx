'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { PageShell } from '@/components/page-shell';
import { ForwardModal } from '@/components/forward-modal';
import { MessageActionsSheet } from '@/components/message-actions-sheet';
import { AttachSheet } from '@/components/attach-sheet';
import { useRequireAuth } from '@/lib/auth/use-require-auth';
import { listChats, sendMessage } from '@/lib/db/chats';
import { forwardMessageToChats, type ForwardPayload } from '@/lib/db/forward';
import { uploadChatImage, uploadChatMedia, createSignedChatMediaUrl } from '@/lib/storage/upload';
import { useChatRealtime } from '@/lib/realtime/use-chat-realtime';
import { browserSupabase } from '@/lib/supabase/client';
import type { ChatSummary, MessageRow } from '@/lib/db/types';

type Payload = { v?: number; text?: string; imagePath?: string; imagePaths?: string[]; videoPath?: string };

function parseCipher(ciphertext: string): Payload {
  try {
    const obj = JSON.parse(ciphertext);
    if (obj && typeof obj === 'object') return obj as Payload;
  } catch {}
  return {};
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
  return out;
}

export default function ChatPage({ params }: { params: { chatId: string } }) {
  const { loading: authLoading } = useRequireAuth();
  const chatId = params.chatId;

  const supabase = browserSupabase();
  const { messages, loading: msgLoading, appendLocal } = useChatRealtime(chatId);

  // members
  const [members, setMembers] = useState<string[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);

  // compose
  const [text, setText] = useState('');
  const [pendingImages, setPendingImages] = useState<File[]>([]);
  const [pendingVideo, setPendingVideo] = useState<File | null>(null);

  // Local previews
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [previewVideo, setPreviewVideo] = useState<string>('');

  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  // Signed URL cache (path -> url)
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  // Video play error -> only shows “Abrir video”
  const [videoPlayError, setVideoPlayError] = useState<Record<string, boolean>>({});

  // Forward state
  const [forwardOpen, setForwardOpen] = useState(false);
  const [forwardBody, setForwardBody] = useState<ForwardPayload | null>(null);
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [chatsLoading, setChatsLoading] = useState(false);

  // Message Actions Sheet state
  const [actionsOpen, setActionsOpen] = useState(false);
  const [actionsMsg, setActionsMsg] = useState<{ id: string; body: Payload } | null>(null);

  // Attach sheet
  const [attachOpen, setAttachOpen] = useState(false);

  // Inputs
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const cameraPhotoRef = useRef<HTMLInputElement | null>(null);
  const cameraVideoRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Long-press support
  const longPressTimer = useRef<number | null>(null);

  // Load chats for forward (once)
  useEffect(() => {
    let alive = true;
    async function load() {
      setChatsLoading(true);
      try {
        const list = await listChats();
        if (!alive) return;
        setChats(list);
      } finally {
        if (alive) setChatsLoading(false);
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, []);

  // Load members (no embeds)
  useEffect(() => {
    let alive = true;

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

    loadMembers();
    return () => {
      alive = false;
    };
  }, [chatId, supabase]);

  const items = useMemo(() => messages.map((m) => ({ ...m, body: parseCipher(m.ciphertext) })), [messages]);

  // autoscroll
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [items.length]);

  function extractAllPaths(body: Payload): string[] {
    const arr: string[] = [];
    if (body.imagePath) arr.push(body.imagePath);
    if (Array.isArray(body.imagePaths)) for (const p of body.imagePaths) if (p) arr.push(p);
    if (body.videoPath) arr.push(body.videoPath);
    return Array.from(new Set(arr));
  }

  // Resolve signed URLs for incoming / realtime
  useEffect(() => {
    let cancelled = false;

    async function resolveMissing() {
      const allPaths = new Set<string>();
      for (const m of items) for (const p of extractAllPaths(m.body)) allPaths.add(p);

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
        if (!cancelled) setErr(e?.message ?? String(e));
      }
    }

    resolveMissing();
    return () => {
      cancelled = true;
    };
  }, [items, signedUrls]);

  // -------- Forward
  async function confirmForward(destChatIds: string[]) {
    if (!forwardBody) return;
    await forwardMessageToChats(destChatIds, forwardBody);
  }

  // -------- Actions Sheet
  function openActions(messageId: string, body: Payload) {
    setActionsMsg({ id: messageId, body });
    setActionsOpen(true);
  }

  function clearLongPress() {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  function startLongPress(messageId: string, body: Payload) {
    clearLongPress();
    longPressTimer.current = window.setTimeout(() => {
      openActions(messageId, body);
      clearLongPress();
    }, 450);
  }

  async function doCopy(body: Payload) {
    const t = body.text?.trim();
    if (t) {
      await navigator.clipboard.writeText(t);
      return;
    }
    const parts: string[] = [];
    if (body.videoPath) parts.push(body.videoPath);
    if (body.imagePath) parts.push(body.imagePath);
    if (body.imagePaths?.length) parts.push(...body.imagePaths);
    if (parts.length) await navigator.clipboard.writeText(parts.join('\n'));
  }

  function toast(msg: string) {
    setErr(msg);
    setTimeout(() => setErr(''), 2500);
  }

  // -------- Pending cleanup
  function clearPendingImages() {
    for (const u of previewImages) URL.revokeObjectURL(u);
    setPreviewImages([]);
    setPendingImages([]);
    if (imageInputRef.current) imageInputRef.current.value = '';
  }

  function clearPendingVideo() {
    if (previewVideo) URL.revokeObjectURL(previewVideo);
    setPreviewVideo('');
    setPendingVideo(null);
    if (videoInputRef.current) videoInputRef.current.value = '';
    if (cameraVideoRef.current) cameraVideoRef.current.value = '';
  }

  // -------- Pick handlers (sheet -> inputs)
  function pickPhotos() {
    setErr('');
    imageInputRef.current?.click();
  }
  function pickVideo() {
    setErr('');
    videoInputRef.current?.click();
  }
  function cameraPhoto() {
    setErr('');
    cameraPhotoRef.current?.click();
  }
  function cameraVideo() {
    setErr('');
    cameraVideoRef.current?.click();
  }
  function pickFile() {
    toast('File: pendiente (siguiente paso).');
    fileInputRef.current?.click();
  }

  // -------- Input change: images
  async function onImagesChange(e: React.ChangeEvent<HTMLInputElement>) {
    setErr('');
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    const allowed = new Set(['image/jpeg', 'image/png', 'image/webp']);
    const maxSize = 5 * 1024 * 1024;
    const MAX_FILES = 6;

    const picked = files.slice(0, MAX_FILES);

    for (const f of picked) {
      if (!allowed.has(f.type)) {
        setErr('Solo JPG, PNG o WEBP.');
        e.target.value = '';
        return;
      }
      if (f.size > maxSize) {
        setErr('Máximo 5MB por imagen.');
        e.target.value = '';
        return;
      }
      const safeName = sanitizeFilename(f.name);
      if (!safeName || safeName.length < 3) {
        setErr('Nombre de archivo inválido.');
        e.target.value = '';
        return;
      }
    }

    if (pendingVideo) clearPendingVideo();

    const normalized = picked.map((f) => new File([f], sanitizeFilename(f.name), { type: f.type }));
    const urls = normalized.map((f) => URL.createObjectURL(f));

    setPendingImages((prev) => [...prev, ...normalized].slice(0, MAX_FILES));
    setPreviewImages((prev) => [...prev, ...urls].slice(0, MAX_FILES));

    e.target.value = '';
  }

  // -------- Input change: video (library)
  async function onVideoChange(e: React.ChangeEvent<HTMLInputElement>) {
    setErr('');
    const file = e.target.files?.[0];
    if (!file) return;

    const maxSize = 200 * 1024 * 1024;
    if (file.size > maxSize) {
      setErr('Máximo 200MB por video.');
      e.target.value = '';
      return;
    }

    const safeName = sanitizeFilename(file.name);
    if (!safeName || safeName.length < 3) {
      setErr('Nombre de archivo inválido.');
      e.target.value = '';
      return;
    }

    if (pendingImages.length) clearPendingImages();

    const normalized = new File([file], safeName, { type: file.type });

    if (previewVideo) URL.revokeObjectURL(previewVideo);
    setPreviewVideo(URL.createObjectURL(normalized));
    setPendingVideo(normalized);

    e.target.value = '';
  }

  // -------- Input change: camera photo
  async function onCameraPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    // camera photo returns an image file
    await onImagesChange(e as any);
  }

  // -------- Input change: camera video
  async function onCameraVideoChange(e: React.ChangeEvent<HTMLInputElement>) {
    await onVideoChange(e as any);
  }

  // cleanup on unmount
  useEffect(() => {
    return () => {
      for (const u of previewImages) URL.revokeObjectURL(u);
      if (previewVideo) URL.revokeObjectURL(previewVideo);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -------- Send
  async function onSend() {
    setErr('');
    const t = text.trim();

    if (!t && pendingImages.length === 0 && !pendingVideo) return;

    setBusy(true);

    try {
      // VIDEO
      if (pendingVideo) {
        const { path } = await uploadChatMedia({ chatId, file: pendingVideo, kind: 'video' });

        // Prefetch signed url for instant render
        try {
          const url = await createSignedChatMediaUrl(path, 300);
          setSignedUrls((prev) => ({ ...prev, [path]: url }));
        } catch {}

        const payload: { text?: string; videoPath: string } = t ? { text: t, videoPath: path } : { videoPath: path };

        const temp: MessageRow = {
          id: `local-${crypto.randomUUID()}`,
          chat_id: chatId,
          sender_device_id: 'local',
          ciphertext: JSON.stringify({ v: 1, ...payload }),
          nonce: `local-${crypto.randomUUID()}`,
          message_type: 'whisper',
          created_at: new Date().toISOString(),
        };
        appendLocal(temp);

        setText('');
        clearPendingVideo();

        await sendMessage(chatId, payload as any);
        return;
      }

      // IMAGES (multi)
      if (pendingImages.length > 0) {
        const results = await Promise.all(pendingImages.map((file) => uploadChatImage(chatId, file)));
        const paths = results.map((r) => r.path);

        // Prefetch signed urls
        try {
          const pairs = await Promise.all(paths.map(async (p) => [p, await createSignedChatMediaUrl(p, 300)] as const));
          setSignedUrls((prev) => {
            const next = { ...prev };
            for (const [p, u] of pairs) next[p] = u;
            return next;
          });
        } catch {}

        const payload: { text?: string; imagePaths: string[] } = t ? { text: t, imagePaths: paths } : { imagePaths: paths };

        const temp: MessageRow = {
          id: `local-${crypto.randomUUID()}`,
          chat_id: chatId,
          sender_device_id: 'local',
          ciphertext: JSON.stringify({ v: 1, ...payload }),
          nonce: `local-${crypto.randomUUID()}`,
          message_type: 'whisper',
          created_at: new Date().toISOString(),
        };
        appendLocal(temp);

        setText('');
        clearPendingImages();

        await sendMessage(chatId, payload as any);
        return;
      }

      // TEXT
      const temp: MessageRow = {
        id: `local-${crypto.randomUUID()}`,
        chat_id: chatId,
        sender_device_id: 'local',
        ciphertext: JSON.stringify({ v: 1, text: t }),
        nonce: `local-${crypto.randomUUID()}`,
        message_type: 'whisper',
        created_at: new Date().toISOString(),
      };
      appendLocal(temp);

      setText('');
      await sendMessage(chatId, { text: t } as any);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
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

      <MessageActionsSheet
        open={actionsOpen}
        onClose={() => setActionsOpen(false)}
        title={actionsMsg?.id}
        actions={[
          { key: 'reply', label: 'Reply', icon: '↩️', onClick: () => toast('Reply: pendiente (siguiente paso).') },
          {
            key: 'forward',
            label: 'Forward',
            icon: '↪️',
            onClick: () => {
              if (!actionsMsg) return;
              setForwardBody(toForwardPayload(actionsMsg.body));
              setForwardOpen(true);
            },
          },
          {
            key: 'copy',
            label: 'Copy',
            icon: '📄',
            onClick: async () => {
              if (!actionsMsg) return;
              await doCopy(actionsMsg.body);
              toast('Copiado.');
            },
          },
          { key: 'save', label: 'Save', icon: '💾', onClick: () => toast('Save: pendiente (siguiente paso).') },
          { key: 'delete', label: 'Delete', icon: '🗑️', tone: 'danger', onClick: () => toast('Delete: pendiente (siguiente paso).') },
        ]}
        moreActions={[
          { key: 'pin', label: 'Pin', icon: '📌', onClick: () => toast('Pin: pendiente (siguiente paso).') },
          { key: 'report', label: 'Report', icon: '🚩', onClick: () => toast('Report: pendiente (siguiente paso).') },
        ]}
      />

      <AttachSheet
        open={attachOpen}
        onClose={() => setAttachOpen(false)}
        onPickPhotos={pickPhotos}
        onPickVideo={pickVideo}
        onCameraPhoto={cameraPhoto}
        onCameraVideo={cameraVideo}
        onPickFile={pickFile}
      />

      {/* Hidden inputs */}
      <input
        ref={imageInputRef}
        type="file"
        hidden
        multiple
        accept="image/jpeg,image/png,image/webp"
        onChange={onImagesChange}
      />
      <input ref={videoInputRef} type="file" hidden accept="video/*" onChange={onVideoChange} />

      {/* Camera capture inputs (mobile) */}
      <input
        ref={cameraPhotoRef}
        type="file"
        hidden
        accept="image/*"
        capture="environment"
        onChange={onCameraPhotoChange}
      />
      <input
        ref={cameraVideoRef}
        type="file"
        hidden
        accept="video/*"
        capture="environment"
        onChange={onCameraVideoChange}
      />

      <input ref={fileInputRef} type="file" hidden />

      {loading ? (
        <p className="text-sm text-slate-300">Loading…</p>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="text-xs text-slate-400">
            Members: {membersLoading ? 'Loading…' : members.length ? members.join(', ') : '—'}
          </div>

          {err ? <p className="text-sm text-red-300">{err}</p> : null}

          <div
            ref={scrollRef}
            className="h-[55vh] overflow-auto rounded-xl border border-slate-900 bg-slate-950/40 p-3"
          >
            {items.length === 0 ? (
              <p className="text-sm text-slate-400">No messages yet.</p>
            ) : (
              <ul className="space-y-2">
                {items.map((m) => {
                  const imgPaths: string[] = [];
                  if (m.body.imagePath) imgPaths.push(m.body.imagePath);
                  if (Array.isArray(m.body.imagePaths)) imgPaths.push(...m.body.imagePaths.filter(Boolean));
                  const videoPath = m.body.videoPath;

                  return (
                    <li
                      key={m.id}
                      className="rounded-lg border border-slate-900 bg-slate-950/60 p-2"
                      onContextMenu={(e) => {
                        e.preventDefault();
                        openActions(m.id, m.body);
                      }}
                      onPointerDown={() => startLongPress(m.id, m.body)}
                      onPointerUp={clearLongPress}
                      onPointerCancel={clearLongPress}
                      onPointerMove={clearLongPress}
                      onDoubleClick={() => openActions(m.id, m.body)}
                    >
                      <div className="text-xs text-slate-500">{new Date(m.created_at).toLocaleString()}</div>

                      {m.body.text ? <div className="text-sm">{m.body.text}</div> : null}

                      {imgPaths.length ? (
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          {Array.from(new Set(imgPaths)).map((path) => {
                            const url = signedUrls[path] || '';
                            return url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                key={path}
                                src={url}
                                alt="chat image"
                                className="max-h-80 w-auto rounded-lg border border-slate-900"
                              />
                            ) : (
                              <div
                                key={path}
                                className="h-28 w-full animate-pulse rounded-lg border border-slate-900 bg-slate-800"
                              />
                            );
                          })}
                        </div>
                      ) : null}

                      {videoPath ? (
                        <div className="mt-2">
                          {signedUrls[videoPath] ? (
                            <>
                              <video
                                src={signedUrls[videoPath]}
                                controls
                                className="max-h-96 w-full rounded-lg border border-slate-900"
                                onError={() => setVideoPlayError((prev) => ({ ...prev, [videoPath]: true }))}
                                onCanPlay={() => setVideoPlayError((prev) => ({ ...prev, [videoPath]: false }))}
                              />
                              {videoPlayError[videoPath] ? (
                                <div className="mt-2 text-xs text-slate-400">
                                  No se pudo reproducir inline.{' '}
                                  <a
                                    className="text-blue-400 underline"
                                    href={signedUrls[videoPath]}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    Abrir video
                                  </a>
                                </div>
                              ) : null}
                            </>
                          ) : (
                            <div className="h-40 w-full animate-pulse rounded-lg border border-slate-900 bg-slate-800" />
                          )}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Preview images */}
          {previewImages.length ? (
            <div className="rounded border border-slate-900 bg-slate-950/40 p-2">
              <div className="mb-2 text-xs text-slate-400">Preview imágenes:</div>
              <div className="grid grid-cols-3 gap-2">
                {previewImages.map((u) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={u}
                    src={u}
                    alt="preview"
                    className="h-24 w-full rounded border border-slate-900 object-cover"
                  />
                ))}
              </div>
              <div className="mt-2 flex justify-end">
                <button
                  className="rounded bg-slate-800 px-3 py-1.5 text-xs hover:bg-slate-700"
                  onClick={clearPendingImages}
                  disabled={busy}
                >
                  Remove all
                </button>
              </div>
            </div>
          ) : null}

          {/* Preview video */}
          {previewVideo ? (
            <div className="rounded border border-slate-900 bg-slate-950/40 p-2">
              <div className="mb-2 text-xs text-slate-400">Preview video:</div>
              <video src={previewVideo} controls className="max-h-72 w-full rounded border border-slate-900" />
              <div className="mt-2 flex justify-end">
                <button
                  className="rounded bg-slate-800 px-3 py-1.5 text-xs hover:bg-slate-700"
                  onClick={clearPendingVideo}
                  disabled={busy}
                >
                  Remove
                </button>
              </div>
            </div>
          ) : null}

          <div className="flex items-center gap-2">
            {/* + button */}
            <button
              className="rounded bg-slate-800 px-3 py-2 text-sm hover:bg-slate-700"
              onClick={() => setAttachOpen(true)}
              type="button"
              title="Attach"
              disabled={busy}
            >
              +
            </button>

            <input
              className="flex-1 rounded border border-slate-800 bg-slate-950 px-3 py-2 text-slate-100"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type a message…"
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSend();
              }}
            />

            <button
              className="rounded bg-blue-600 px-3 py-2 text-sm hover:bg-blue-500 disabled:opacity-60"
              onClick={onSend}
              disabled={busy}
            >
              Send
            </button>
          </div>
        </div>
      )}
    </PageShell>
  );
}
