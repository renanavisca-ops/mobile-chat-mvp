'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { PageShell } from '@/components/page-shell';
import { useRequireAuth } from '@/lib/auth/use-require-auth';
import { sendMessage } from '@/lib/db/chats';
import { uploadChatImage } from '@/lib/storage/upload';
import { useChatRealtime } from '@/lib/realtime/use-chat-realtime';
import { browserSupabase } from '@/lib/supabase/client';
import type { MessageRow } from '@/lib/db/types';

type Payload = { v?: number; text?: string; imagePath?: string };

function parseCipher(ciphertext: string): Payload {
  try {
    const obj = JSON.parse(ciphertext);
    if (obj && typeof obj === 'object') return obj;
  } catch {}
  return {};
}

function shortId(id: string) {
  return id.length > 10 ? `${id.slice(0, 6)}…${id.slice(-4)}` : id;
}

function sanitizeFilename(name: string) {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]/g, '_');
  return cleaned.slice(0, 120);
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
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Signed URL cache: path -> url
  const [signedByPath, setSignedByPath] = useState<Record<string, string>>({});
  const signedByPathRef = useRef<Record<string, string>>({});
  useEffect(() => {
    signedByPathRef.current = signedByPath;
  }, [signedByPath]);

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
      for (const p of profs ?? []) {
        byId.set((p as any).id, (p as any).username ?? '');
      }

      const names = userIds.map((id: string) => byId.get(id) || shortId(id));
      setMembers(names);
      setMembersLoading(false);
    }

    loadMembers();

    return () => {
      alive = false;
    };
  }, [chatId, supabase]);

  const items = useMemo(() => {
    return messages.map((m) => ({ ...m, body: parseCipher(m.ciphertext) }));
  }, [messages]);

  // Auto-scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [items.length]);

  // Fetch signed URLs for any imagePath that is not cached yet
  useEffect(() => {
    let cancelled = false;

    async function ensureSignedUrls() {
      const paths = Array.from(
        new Set(
          items
            .map((m) => m.body.imagePath)
            .filter((p): p is string => typeof p === 'string' && p.length > 0)
        )
      );

      const missing = paths.filter((p) => !signedByPathRef.current[p]);
      if (missing.length === 0) return;

      const updates: Record<string, string> = {};

      for (const path of missing) {
        const { data, error } = await supabase.storage.from('chat-media').createSignedUrl(path, 300); // 5 min
        if (cancelled) return;

        if (error) {
          // no rompas la UI si una falla; solo log y sigue
          console.warn('createSignedUrl failed for', path, error.message);
          continue;
        }

        if (data?.signedUrl) updates[path] = data.signedUrl;
      }

      if (Object.keys(updates).length) {
        setSignedByPath((prev) => ({ ...prev, ...updates }));
      }
    }

    ensureSignedUrls();

    return () => {
      cancelled = true;
    };
  }, [items, supabase]);

  function onPickFile() {
    setErr('');
    fileInputRef.current?.click();
  }

  function clearPendingFile() {
    setPendingFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setErr('');
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = new Set(['image/jpeg', 'image/png', 'image/webp']);
    const maxSize = 5 * 1024 * 1024; // 5MB

    if (!allowed.has(file.type)) {
      setErr('Solo JPG, PNG o WEBP.');
      e.target.value = '';
      return;
    }

    if (file.size > maxSize) {
      setErr('Máximo 5MB.');
      e.target.value = '';
      return;
    }

    const safeName = sanitizeFilename(file.name);
    if (!safeName || safeName.length < 3) {
      setErr('Nombre de archivo inválido.');
      e.target.value = '';
      return;
    }

    setPendingFile(new File([file], safeName, { type: file.type }));
  }

  async function onSend() {
    setErr('');
    const t = text.trim();

    // allow text-only, image-only, image+caption
    if (!t && !pendingFile) return;

    setBusy(true);

    try {
      // IMAGE: upload -> send only imagePath
      if (pendingFile) {
        const file = pendingFile;
        const { path } = await uploadChatImage(chatId, file);

        const payload: { text?: string; imagePath: string } = t
          ? { text: t, imagePath: path }
          : { imagePath: path };

        // optimistic message (already has imagePath)
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
        clearPendingFile();

        await sendMessage(chatId, payload);
        return;
      }

      // TEXT
      if (!t) return;

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

      await sendMessage(chatId, { text: t });
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  const loading = authLoading || msgLoading;

  return (
    <PageShell title="Chat">
      {loading ? (
        <p className="text-sm text-slate-300">Loading…</p>
      ) : (
        <div className="flex flex-col gap-3">
          {/* Members */}
          <div className="text-xs text-slate-400">
            Members: {membersLoading ? 'Loading…' : members.length ? members.join(', ') : '
