'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { PageShell } from '@/components/page-shell';
import { ForwardModal } from '@/components/forward-modal';
import { MessageActionsSheet } from '@/components/message-actions-sheet';
import { AttachSheet } from '@/components/attach-sheet';
import { CameraCapture } from '@/components/camera-capture';
import { ReportModal } from '@/components/report-modal';
import { GroupInfoModal } from '@/components/group-info-modal';
import { getWallpaperId, wallpaperCss, getCustomWallpaperUrl, CUSTOM_WALLPAPER_ID } from '@/lib/wallpaper';
import { blockUser, unblockUser, isBlockedByMe } from '@/lib/db/safety';
import { EmojiPicker } from '@/components/emoji-picker';
import { useRequireAuth } from '@/lib/auth/use-require-auth';
import { listChats, sendMessage, deleteMessage, hideMessageForMe, editMessage, pinMessage, unpinMessage, searchMessages, setChatMuted, getChatMuted, toggleReaction, createPoll, votePoll, setDisappearingMessages } from '@/lib/db/chats';
import { forwardMessageToChats, type ForwardPayload } from '@/lib/db/forward';
import { uploadChatImage, uploadChatMedia, uploadChatAudio, createSignedChatMediaUrl } from '@/lib/storage/upload';
import { useChatRealtime } from '@/lib/realtime/use-chat-realtime';
import { browserSupabase } from '@/lib/supabase/client';
import { useOnlineUsers } from '@/components/presence-provider';
import { useLanguage } from '@/lib/i18n/context';
import { PollComposer } from '@/components/poll-composer';
import { ImageEditor } from '@/components/image-editor';
import { MessageEffects, detectEffect } from '@/components/message-effects';
import { GifPicker } from '@/components/gif-picker';
import type { Gif } from '@/lib/giphy';
import { useCall } from '@/lib/call/call-provider';
import { PhoneIcon, VideoIcon, PlusIcon, SmileIcon, MicIcon } from '@/components/icons';
import type { ChatSummary, MessageRow } from '@/lib/db/types';

type Payload = {
  v?: number;
  text?: string;
  imagePath?: string;
  imagePaths?: string[];
  videoPath?: string;
  audioPath?: string;
  gifUrl?: string;
  reply_to?: string;
  is_deleted?: boolean;
  poll?: { question: string; options: string[] };
};

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
const DISAPPEARING_OPTIONS: { seconds: number; labelKey: string }[] = [
  { seconds: 0, labelKey: 'chat.disappearingOff' },
  { seconds: 86400, labelKey: 'chat.disappearing24h' },
  { seconds: 604800, labelKey: 'chat.disappearing7d' },
  { seconds: 2592000, labelKey: 'chat.disappearing30d' },
];

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
  if (message.content && !parsed.text) {
    parsed.text = message.content;
  }
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

export default function ChatPage({ params }: { params: { chatId: string } }) {
  const { loading: authLoading, user } = useRequireAuth();
  const { t, lang } = useLanguage();
  const myId = user?.id ?? null;
  const chatId = params.chatId;

  function fmtTime(ts: string) {
    return new Date(ts).toLocaleString(lang);
  }

  const supabase = browserSupabase();
  const { startCall, busy: callBusy } = useCall();
  const { messages, loading: msgLoading, appendLocal, loadMore, hasMore, loadingMore, typingUsers, setMeTyping, reactions, pollVotes, hiddenIds } = useChatRealtime(chatId);

  // chat details
  const [chat, setChat] = useState<ChatSummary | null>(null);
  const [chatLoading, setChatLoading] = useState(true);

  // members
  const [members, setMembers] = useState<string[]>([]);
  const [memberProfiles, setMemberProfiles] = useState<{ id: string; username: string | null }[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);

  const onlineUsers = useOnlineUsers();

  // Load chat details
  useEffect(() => {
    let alive = true;
    async function loadChat() {
      setChatLoading(true);
      const { data, error } = await supabase
        .from('chats')
        .select('*, store_id, assigned_to, status')
        .eq('id', chatId)
        .single();

      if (!alive) return;
      if (error) {
        setErr(error.message);
      } else {
        setChat(data as unknown as ChatSummary);
      }
      setChatLoading(false);
    }
    loadChat();
    return () => { alive = false; };
  }, [chatId, supabase]);

  async function updateStatus(newStatus: 'in_progress' | 'closed') {
    setBusy(true);
    try {
      const { data: { session } } = await browserSupabase().auth.getSession();
      const res = await fetch(`/api/chat/${chatId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || t('chat.errorUpdatingStatus'));
      }

      setChat(prev => prev ? { ...prev, status: newStatus } : null);
      const statusLabel = newStatus === 'in_progress' ? t('common.statusInProgress') : t('common.statusClosed');
      toast(t('chat.statusUpdated', { status: statusLabel }));
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  // compose
  const [text, setText] = useState('');
  const [pendingImages, setPendingImages] = useState<File[]>([]);
  const [pendingVideo, setPendingVideo] = useState<File | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [wallpaperStyle, setWallpaperStyle] = useState<React.CSSProperties | undefined>(undefined);

  useEffect(() => {
    const id = getWallpaperId();
    if (id === CUSTOM_WALLPAPER_ID) {
      getCustomWallpaperUrl()
        .then((url) => {
          if (url) setWallpaperStyle({ backgroundImage: `url(${url})`, backgroundSize: 'cover', backgroundPosition: 'center' });
        })
        .catch(() => {});
    } else {
      const css = wallpaperCss(id);
      setWallpaperStyle(css ? { background: css } : undefined);
    }
  }, []);

  // Safety: block / report (direct chats only — a "menu" for the other person).
  const [safetyMenuOpen, setSafetyMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportMessageId, setReportMessageId] = useState<string | null>(null);
  const [groupInfoOpen, setGroupInfoOpen] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [blockBusy, setBlockBusy] = useState(false);
  const [muted, setMuted] = useState(false);
  const [muteBusy, setMuteBusy] = useState(false);
  const [disappearingMenuOpen, setDisappearingMenuOpen] = useState(false);
  const [disappearingBusy, setDisappearingBusy] = useState(false);

  useEffect(() => {
    getChatMuted(chatId).then(setMuted).catch(() => {});
  }, [chatId]);

  async function chooseDisappearing(seconds: number) {
    setDisappearingBusy(true);
    try {
      await setDisappearingMessages(chatId, seconds);
      setChat((prev) => (prev ? { ...prev, disappearing_seconds: seconds || null } : prev));
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setDisappearingBusy(false);
      setDisappearingMenuOpen(false);
      setSafetyMenuOpen(false);
    }
  }

  async function toggleMute() {
    const next = !muted;
    setMuteBusy(true);
    try {
      await setChatMuted(chatId, next);
      setMuted(next);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setMuteBusy(false);
      setSafetyMenuOpen(false);
    }
  }

  // In-chat search
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MessageRow[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!searchOpen) return;
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    const timer = setTimeout(() => {
      searchMessages(chatId, q)
        .then(setSearchResults)
        .catch(() => setSearchResults([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, searchOpen, chatId]);

  function scrollToMessage(messageId: string) {
    setSearchOpen(false);
    setSearchQuery('');
    const el = document.getElementById(`msg-${messageId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-amber-400');
      setTimeout(() => el.classList.remove('ring-2', 'ring-amber-400'), 1500);
    } else {
      toast(t('chat.messageNotLoaded'));
    }
  }

  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [replyingTo, setReplyingTo] = useState<MessageRow | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Local previews
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [previewVideo, setPreviewVideo] = useState<string>('');

  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  // Signed URL cache (path -> url)
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  // Video play error -> only shows the "Open video" link
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

  // Emoji picker
  const [emojiOpen, setEmojiOpen] = useState(false);

  // Reactions quick-picker
  const [reactionPickerFor, setReactionPickerFor] = useState<string | null>(null);

  // Poll composer
  const [pollComposerOpen, setPollComposerOpen] = useState(false);

  // GIF picker
  const [gifPickerOpen, setGifPickerOpen] = useState(false);

  // Image editor (crop/rotate/filter/draw before sending)
  const [editorIndex, setEditorIndex] = useState<number | null>(null);

  // Animated message effects (iMessage-style emoji burst on trigger emojis)
  const [effectTrigger, setEffectTrigger] = useState<string | null>(null);
  const lastEffectMsgId = useRef<string | null>(null);

  // Inputs
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const cameraPhotoRef = useRef<HTMLInputElement | null>(null);
  const cameraVideoRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textInputRef = useRef<HTMLInputElement | null>(null);

  const composerRef = useRef<HTMLDivElement | null>(null);
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

  const [membersReloadKey, setMembersReloadKey] = useState(0);

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
      setMemberProfiles((profs ?? []).map((p: any) => ({ id: p.id, username: p.username ?? null })));
      setMembersLoading(false);
    }

    loadMembers();
    return () => {
      alive = false;
    };
  }, [chatId, supabase, membersReloadKey]);

  const items = useMemo(
    () => messages.filter((m) => !hiddenIds.has(m.id)).map((m) => ({ ...m, body: getMessagePayload(m) })),
    [messages, hiddenIds]
  );

  const reactionsByMessage = useMemo(() => {
    const map = new Map<string, { emoji: string; count: number; mine: boolean }[]>();
    for (const r of reactions) {
      const list = map.get(r.message_id) ?? [];
      const existing = list.find((g) => g.emoji === r.emoji);
      if (existing) {
        existing.count += 1;
        if (r.user_id === myId) existing.mine = true;
      } else {
        list.push({ emoji: r.emoji, count: 1, mine: r.user_id === myId });
      }
      map.set(r.message_id, list);
    }
    return map;
  }, [reactions, myId]);

  const myReactionByMessage = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of reactions) if (r.user_id === myId) map.set(r.message_id, r.emoji);
    return map;
  }, [reactions, myId]);

  const pollTallyByMessage = useMemo(() => {
    const map = new Map<string, { counts: number[]; myVote: number | null }>();
    for (const v of pollVotes) {
      const entry = map.get(v.message_id) ?? { counts: [], myVote: null };
      entry.counts[v.option_index] = (entry.counts[v.option_index] ?? 0) + 1;
      if (v.user_id === myId) entry.myVote = v.option_index;
      map.set(v.message_id, entry);
    }
    return map;
  }, [pollVotes, myId]);

  async function onToggleReaction(messageId: string, emoji: string) {
    setReactionPickerFor(null);
    try {
      await toggleReaction(messageId, chatId, emoji);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }

  async function onCreatePoll(question: string, options: string[]) {
    await createPoll(chatId, question, options);
  }

  async function onVotePoll(messageId: string, optionIndex: number) {
    try {
      await votePoll(messageId, chatId, optionIndex);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }

  async function onPickGif(gif: Gif) {
    setGifPickerOpen(false);
    const payload: Payload = { gifUrl: gif.sendUrl };
    if (replyingTo) payload.reply_to = replyingTo.id;
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
    setReplyingTo(null);
    try {
      await sendMessage(chatId, payload as any);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }

  const usernameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of memberProfiles) if (p.username) m.set(p.id, p.username);
    return m;
  }, [memberProfiles]);

  const otherMemberIds = useMemo(
    () => memberProfiles.map((p) => p.id).filter((id) => id !== myId),
    [memberProfiles, myId]
  );
  const someoneOnline = otherMemberIds.some((id) => onlineUsers.has(id));
  const isGroup = chat?.kind === 'group';
  const otherUserId = !isGroup ? otherMemberIds[0] ?? null : null;
  const isGroupCreator = isGroup && chat?.created_by === myId;

  useEffect(() => {
    if (!otherUserId) return;
    isBlockedByMe(otherUserId).then(setBlocked).catch(() => {});
  }, [otherUserId]);

  async function toggleBlock() {
    if (!otherUserId) return;
    setBlockBusy(true);
    try {
      if (blocked) {
        await unblockUser(otherUserId);
        setBlocked(false);
      } else {
        await blockUser(otherUserId);
        setBlocked(true);
      }
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setBlockBusy(false);
      setSafetyMenuOpen(false);
    }
  }

  function isMine(m: MessageRow) {
    return (!!myId && m.sender_id === myId) || m.sender_device_id === 'local';
  }
  function senderName(m: MessageRow) {
    if (!m.sender_id) return '';
    return usernameById.get(m.sender_id) || shortId(m.sender_id);
  }

  // autoscroll (only if we're already near the bottom)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 150) {
      el.scrollTop = el.scrollHeight;
    }
  }, [items.length]);

  // Fire an animated effect when the newest message contains a trigger emoji.
  // Seeds silently on first load so history doesn't replay effects.
  useEffect(() => {
    if (items.length === 0) return;
    const newest = items[items.length - 1];
    if (lastEffectMsgId.current === null) {
      lastEffectMsgId.current = newest.id;
      return;
    }
    if (newest.id === lastEffectMsgId.current) return;
    lastEffectMsgId.current = newest.id;
    if (newest.body.is_deleted) return;
    const trigger = detectEffect(newest.body.text);
    if (trigger) setEffectTrigger(trigger);
  }, [items]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollTop === 0 && hasMore && !loadingMore) {
      loadMore();
    }
  };

  // Typing detection
  useEffect(() => {
    const typingTimeout = setTimeout(() => setMeTyping(text.length > 0), 300);
    return () => clearTimeout(typingTimeout);
  }, [text, setMeTyping]);

  useEffect(() => {
    const clearTyping = setTimeout(() => setMeTyping(false), 3000);
    return () => clearTimeout(clearTyping);
  }, [text, setMeTyping]);

  // Audio recording
  async function startRecording() {
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
        stream.getTracks().forEach(t => t.stop());
        await sendAudioMessage(blob);
      };

      recorder.start();
      setIsRecording(true);
    } catch (e: any) {
      setErr(t('chat.micError', { error: e.message }));
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }

  async function sendAudioMessage(blob: Blob) {
    setBusy(true);
    try {
      const { path } = await uploadChatAudio(chatId, blob);
      const payload: Payload = { audioPath: path };
      if (replyingTo) payload.reply_to = replyingTo.id;

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
      setReplyingTo(null);
      await sendMessage(chatId, payload as any);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  function extractAllPaths(body: Payload): string[] {
    const arr: string[] = [];
    if (body.imagePath) arr.push(body.imagePath);
    if (Array.isArray(body.imagePaths)) for (const p of body.imagePaths) if (p) arr.push(p);
    if (body.videoPath) arr.push(body.videoPath);
    if (body.audioPath) arr.push(body.audioPath);
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

  // -------- Emoji insert at cursor
  function insertEmoji(emoji: string) {
    const input = textInputRef.current;
    if (!input) {
      setText((prev) => prev + emoji);
      return;
    }
    const start = input.selectionStart ?? text.length;
    const end = input.selectionEnd ?? text.length;

    const next = text.slice(0, start) + emoji + text.slice(end);
    setText(next);

    // restore cursor after state commit
    requestAnimationFrame(() => {
      input.focus();
      const pos = start + emoji.length;
      try {
        input.setSelectionRange(pos, pos);
      } catch {}
    });
  }

  // -------- Pending cleanup
  function clearPendingImages() {
    for (const u of previewImages) URL.revokeObjectURL(u);
    setPreviewImages([]);
    setPendingImages([]);
    if (imageInputRef.current) imageInputRef.current.value = '';
  }

  function onImageEdited(edited: File) {
    if (editorIndex === null) return;
    const idx = editorIndex;
    setPendingImages((prev) => prev.map((f, i) => (i === idx ? edited : f)));
    setPreviewImages((prev) => {
      const old = prev[idx];
      if (old) URL.revokeObjectURL(old);
      const next = [...prev];
      next[idx] = URL.createObjectURL(edited);
      return next;
    });
    setEditorIndex(null);
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
    // Live in-page webcam capture (works on desktop too, where the file-input
    // `capture` attribute is ignored and only opens a file picker).
    setCameraOpen(true);
  }

  // Feed a webcam-captured photo through the exact same validation/normalization
  // path as a picked image file.
  async function onCapturedPhoto(file: File) {
    const dt = new DataTransfer();
    dt.items.add(file);
    await onImagesChange({ target: { files: dt.files, value: '' } } as any);
  }
  function cameraVideo() {
    setErr('');
    cameraVideoRef.current?.click();
  }
  function pickFile() {
    toast(t('chat.fileFeaturePending'));
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
        setErr(t('chat.onlyJpgPngWebp'));
        e.target.value = '';
        return;
      }
      if (f.size > maxSize) {
        setErr(t('chat.maxImageSize'));
        e.target.value = '';
        return;
      }
      const safeName = sanitizeFilename(f.name);
      if (!safeName || safeName.length < 3) {
        setErr(t('chat.invalidFilename'));
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
      setErr(t('chat.maxVideoSize'));
      e.target.value = '';
      return;
    }

    const safeName = sanitizeFilename(file.name);
    if (!safeName || safeName.length < 3) {
      setErr(t('chat.invalidFilename'));
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
    const t2 = text.trim();

    if (editingId) {
      if (!t2) return;
      setBusy(true);
      try {
        await editMessage(editingId, t2);
        setEditingId(null);
        setText('');
      } catch (e: any) {
        setErr(e?.message ?? String(e));
      } finally {
        setBusy(false);
      }
      return;
    }

    if (!t2 && pendingImages.length === 0 && !pendingVideo) return;

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

        const payload: Payload = t2 ? { text: t2, videoPath: path } : { videoPath: path };
        if (replyingTo) payload.reply_to = replyingTo.id;

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
        setReplyingTo(null);

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

        const payload: Payload = t2 ? { text: t2, imagePaths: paths } : { imagePaths: paths };
        if (replyingTo) payload.reply_to = replyingTo.id;

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
      const payload: Payload = { text: t2 };
      if (replyingTo) payload.reply_to = replyingTo.id;

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
      setReplyingTo(null);

      setText('');
      await sendMessage(chatId, payload as any);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  const loading = authLoading || msgLoading;

  return (
    <PageShell title={t('chat.title')}>
      <MessageEffects trigger={effectTrigger} onDone={() => setEffectTrigger(null)} />

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
          ...(actionsMsg && items.find((m) => m.id === actionsMsg.id)?.sender_id === myId && !actionsMsg.body.imagePath && !actionsMsg.body.imagePaths?.length && !actionsMsg.body.videoPath && !actionsMsg.body.audioPath
            ? [{
                key: 'edit',
                label: t('chat.actionEdit'),
                icon: '✏️',
                onClick: () => {
                  if (!actionsMsg) return;
                  setEditingId(actionsMsg.id);
                  setText(actionsMsg.body.text || '');
                  setReplyingTo(null);
                  textInputRef.current?.focus();
                },
              }]
            : []),
          { key: 'reply', label: t('chat.actionReply'), icon: '↩️', onClick: () => {
            const found = items.find(m => m.id === actionsMsg?.id);
            if (found) setReplyingTo(found as any);
            setActionsOpen(false);
          }},
          {
            key: 'forward',
            label: t('chat.actionForward'),
            icon: '↪️',
            onClick: () => {
              if (!actionsMsg) return;
              setForwardBody(toForwardPayload(actionsMsg.body));
              setForwardOpen(true);
            },
          },
          {
            key: 'copy',
            label: t('chat.actionCopy'),
            icon: '📄',
            onClick: async () => {
              if (!actionsMsg) return;
              await doCopy(actionsMsg.body);
              toast(t('chat.copied'));
            },
          },
          { key: 'save', label: t('chat.actionSave'), icon: '💾', onClick: () => toast(t('chat.savePending')) },
          {
            key: 'delete-me',
            label: t('chat.actionDeleteForMe'),
            icon: '🙈',
            tone: 'danger',
            onClick: async () => {
              if (!actionsMsg) return;
              setActionsOpen(false);
              setBusy(true);
              try {
                await hideMessageForMe(actionsMsg.id, chatId);
              } catch (e: any) {
                setErr(e.message);
              } finally {
                setBusy(false);
              }
            },
          },
          ...(actionsMsg && items.find((m) => m.id === actionsMsg.id)?.sender_id === myId
            ? [{
                key: 'delete-all',
                label: t('chat.actionDeleteForEveryone'),
                icon: '🗑️',
                tone: 'danger' as const,
                onClick: async () => {
                  if (!actionsMsg) return;
                  setActionsOpen(false);
                  setBusy(true);
                  try {
                    await deleteMessage(actionsMsg.id, chatId);
                  } catch (e: any) {
                    setErr(e.message);
                  } finally {
                    setBusy(false);
                  }
                },
              }]
            : []),
        ]}
        moreActions={[
          {
            key: 'pin',
            label: chat?.pinned_message_id === actionsMsg?.id ? t('chat.actionUnpin') : t('chat.actionPin'),
            icon: '📌',
            onClick: async () => {
              if (!actionsMsg) return;
              try {
                if (chat?.pinned_message_id === actionsMsg.id) {
                  await unpinMessage(chatId);
                  setChat((prev) => (prev ? { ...prev, pinned_message_id: null } : prev));
                } else {
                  await pinMessage(chatId, actionsMsg.id);
                  setChat((prev) => (prev ? { ...prev, pinned_message_id: actionsMsg.id } : prev));
                }
              } catch (e: any) {
                setErr(e?.message ?? String(e));
              }
            },
          },
          {
            key: 'report',
            label: t('chat.actionReport'),
            icon: '🚩',
            onClick: () => {
              if (!actionsMsg) return;
              setReportMessageId(actionsMsg.id);
              setReportOpen(true);
            },
          },
        ]}
      />

      <AttachSheet
        open={attachOpen}
        onClose={() => setAttachOpen(false)}
        onPickPhotos={() => {
          setEmojiOpen(false);
          pickPhotos();
        }}
        onPickVideo={() => {
          setEmojiOpen(false);
          pickVideo();
        }}
        onCameraPhoto={() => {
          setEmojiOpen(false);
          cameraPhoto();
        }}
        onCameraVideo={() => {
          setEmojiOpen(false);
          cameraVideo();
        }}
        onPickFile={() => {
          setEmojiOpen(false);
          pickFile();
        }}
        onPoll={() => {
          setEmojiOpen(false);
          setPollComposerOpen(true);
        }}
        onGif={() => {
          setEmojiOpen(false);
          setGifPickerOpen(true);
        }}
      />

      <GifPicker open={gifPickerOpen} onClose={() => setGifPickerOpen(false)} onPick={onPickGif} />

      <PollComposer
        open={pollComposerOpen}
        onClose={() => setPollComposerOpen(false)}
        onCreate={onCreatePoll}
      />

      <ImageEditor
        open={editorIndex !== null}
        file={editorIndex !== null ? pendingImages[editorIndex] ?? null : null}
        onClose={() => setEditorIndex(null)}
        onSave={onImageEdited}
      />

      <CameraCapture
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={onCapturedPhoto}
      />

      <ReportModal
        open={reportOpen}
        onClose={() => {
          setReportOpen(false);
          setReportMessageId(null);
        }}
        reportedUserId={otherUserId}
        chatId={chatId}
        messageId={reportMessageId}
      />

      {isGroup && (
        <GroupInfoModal
          open={groupInfoOpen}
          onClose={() => setGroupInfoOpen(false)}
          chatId={chatId}
          title={chat?.title ?? null}
          description={chat?.description ?? null}
          avatarUrl={chat?.avatar_url ?? null}
          isCreator={isGroupCreator}
          members={memberProfiles}
          disappearingSeconds={chat?.disappearing_seconds}
          onUpdated={(patch) => setChat((prev) => (prev ? { ...prev, ...patch } : prev))}
          onMembersChanged={() => setMembersReloadKey((k) => k + 1)}
          onLeft={() => {
            setGroupInfoOpen(false);
            window.location.href = '/chats';
          }}
        />
      )}

      {/* Hidden inputs */}
      <input ref={imageInputRef} type="file" hidden multiple accept="image/jpeg,image/png,image/webp" onChange={onImagesChange} />
      <input ref={videoInputRef} type="file" hidden accept="video/*" onChange={onVideoChange} />
      <input ref={cameraPhotoRef} type="file" hidden accept="image/*" capture="environment" onChange={onCameraPhotoChange} />
      <input ref={cameraVideoRef} type="file" hidden accept="video/*" capture="environment" onChange={onCameraVideoChange} />
      <input ref={fileInputRef} type="file" hidden />

      {loading ? (
        <p className="text-sm text-slate-300">{t('chat.loading')}</p>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <span>{t('chat.members')}: {membersLoading ? t('chat.loading') : members.length ? members.join(', ') : '—'}</span>
              {!membersLoading && otherMemberIds.length > 0 && (
                someoneOnline ? (
                  <span className="text-emerald-400">{t('chat.online')}</span>
                ) : (
                  <span className="text-slate-500">{t('chat.offline')}</span>
                )
              )}
              <button
                type="button"
                onClick={() => setSearchOpen((v) => !v)}
                className="rounded px-1.5 py-0.5 text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                aria-label={t('chat.searchInChat')}
                title={t('chat.searchInChat')}
              >
                🔍
              </button>
              {otherUserId && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      startCall({
                        peerId: otherUserId,
                        peerName: usernameById.get(otherUserId) || chat?.title || t('chat.someone'),
                        video: false,
                      })
                    }
                    disabled={callBusy}
                    className="rounded px-1.5 py-1 text-slate-400 hover:bg-slate-900 hover:text-slate-200 disabled:opacity-40"
                    aria-label={t('call.startAudio')}
                    title={t('call.startAudio')}
                  >
                    <PhoneIcon size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      startCall({
                        peerId: otherUserId,
                        peerName: usernameById.get(otherUserId) || chat?.title || t('chat.someone'),
                        video: true,
                      })
                    }
                    disabled={callBusy}
                    className="rounded px-1.5 py-1 text-slate-400 hover:bg-slate-900 hover:text-slate-200 disabled:opacity-40"
                    aria-label={t('call.startVideo')}
                    title={t('call.startVideo')}
                  >
                    <VideoIcon size={16} />
                  </button>
                </>
              )}
              {isGroup && (
                <button
                  type="button"
                  onClick={() => setGroupInfoOpen(true)}
                  className="rounded px-1.5 py-0.5 text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                  aria-label={t('chat.groupInfo')}
                  title={t('chat.groupInfo')}
                >
                  ⓘ
                </button>
              )}
              {otherUserId && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setSafetyMenuOpen((v) => !v)}
                    className="rounded px-1.5 py-0.5 text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                    aria-label={t('chat.chatOptions')}
                  >
                    ⋯
                  </button>
                  {safetyMenuOpen && (
                    <div
                      className="absolute left-0 top-6 z-20 w-52 overflow-hidden rounded-lg border border-slate-800 bg-slate-950 text-sm shadow-xl"
                      onMouseLeave={() => {
                        setSafetyMenuOpen(false);
                        setDisappearingMenuOpen(false);
                      }}
                    >
                      <button
                        type="button"
                        onClick={toggleMute}
                        disabled={muteBusy}
                        className="block w-full px-3 py-2 text-left text-slate-200 hover:bg-slate-900 disabled:opacity-50"
                      >
                        {muted ? t('common.unmute') : t('common.mute')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setDisappearingMenuOpen((v) => !v)}
                        disabled={disappearingBusy}
                        className="flex w-full items-center justify-between px-3 py-2 text-left text-slate-200 hover:bg-slate-900 disabled:opacity-50"
                      >
                        <span>{t('chat.disappearingMenu')}</span>
                        <span className="text-xs text-slate-500">
                          {DISAPPEARING_OPTIONS.find((o) => o.seconds === (chat?.disappearing_seconds ?? 0))
                            ? t(DISAPPEARING_OPTIONS.find((o) => o.seconds === (chat?.disappearing_seconds ?? 0))!.labelKey)
                            : ''}
                        </span>
                      </button>
                      {disappearingMenuOpen && (
                        <div className="border-t border-slate-900 bg-slate-950/60">
                          {DISAPPEARING_OPTIONS.map((opt) => (
                            <button
                              key={opt.seconds}
                              type="button"
                              onClick={() => chooseDisappearing(opt.seconds)}
                              disabled={disappearingBusy}
                              className={`block w-full px-4 py-1.5 text-left text-xs hover:bg-slate-900 disabled:opacity-50 ${
                                (chat?.disappearing_seconds ?? 0) === opt.seconds ? 'text-blue-400' : 'text-slate-300'
                              }`}
                            >
                              {t(opt.labelKey)}
                            </button>
                          ))}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={toggleBlock}
                        disabled={blockBusy}
                        className="block w-full px-3 py-2 text-left text-slate-200 hover:bg-slate-900 disabled:opacity-50"
                      >
                        {blocked ? t('common.unblock') : t('common.block')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSafetyMenuOpen(false);
                          setReportOpen(true);
                        }}
                        className="block w-full px-3 py-2 text-left text-red-400 hover:bg-slate-900"
                      >
                        {t('common.report')}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
            {/* Support-console status controls only apply to store chats.
                Personal 1:1 / group chats have no store_id, and hitting the
                staff-only status API from them returns 403 ("Forbidden"). */}
            {chat && chat.store_id && (
              <div className="flex items-center gap-2">
                <span className={`rounded px-1.5 py-0.5 uppercase ${
                  chat.status === 'open' ? 'bg-green-900/40 text-green-400' :
                  chat.status === 'in_progress' ? 'bg-blue-900/40 text-blue-400' :
                  'bg-slate-800 text-slate-400'
                }`}>
                  {chat.status === 'open' ? t('common.statusOpen') : chat.status === 'in_progress' ? t('common.statusInProgress') : t('common.statusClosed')}
                </span>

                {chat.status === 'open' && (
                  <button
                    onClick={() => updateStatus('in_progress')}
                    className="rounded bg-blue-600 px-2 py-1 text-white hover:bg-blue-500"
                  >
                    {t('chat.take')}
                  </button>
                )}

                {chat.status !== 'closed' && (
                  <button
                    onClick={() => updateStatus('closed')}
                    className="rounded bg-slate-700 px-2 py-1 text-white hover:bg-slate-600"
                  >
                    {t('chat.closeChat')}
                  </button>
                )}
              </div>
            )}
          </div>


          {err ? <p className="text-sm text-red-300">{err}</p> : null}

          {searchOpen && (
            <div className="rounded-xl border border-slate-900 bg-slate-950/60 p-3">
              <input
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('chat.searchPlaceholder')}
                className="w-full rounded border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              />
              {searching ? (
                <p className="mt-2 text-xs text-slate-500">{t('chat.searching')}</p>
              ) : searchQuery.trim() && searchResults.length === 0 ? (
                <p className="mt-2 text-xs text-slate-500">{t('chat.noResults')}</p>
              ) : searchResults.length > 0 ? (
                <ul className="mt-2 max-h-52 space-y-1 overflow-auto">
                  {searchResults.map((r) => (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => scrollToMessage(r.id)}
                        className="block w-full truncate rounded px-2 py-1.5 text-left text-sm text-slate-200 hover:bg-slate-900"
                      >
                        {r.content}
                        <span className="ml-2 text-xs text-slate-500">{fmtTime(r.created_at)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          )}

          {chat?.pinned_message_id && (
            <button
              type="button"
              onClick={() => scrollToMessage(chat.pinned_message_id!)}
              className="flex items-center gap-2 truncate rounded-lg border border-amber-900/40 bg-amber-950/20 px-3 py-2 text-left text-xs text-amber-200 hover:bg-amber-950/30"
            >
              <span>📌</span>
              <span className="truncate">
                {items.find((m) => m.id === chat.pinned_message_id)?.body.text || t('chat.pinnedFallback')}
              </span>
            </button>
          )}

          <div ref={scrollRef} onScroll={handleScroll} style={wallpaperStyle} className="h-[55vh] overflow-auto rounded-xl border border-slate-900 bg-slate-950/40 p-3">
            {loadingMore && <div className="text-center text-xs text-slate-500 my-2">{t('chat.loadingOlder')}</div>}
            {items.length === 0 ? (
              <p className="text-sm text-slate-400">{t('chat.noMessagesYet')}</p>
            ) : (
              <ul className="space-y-2">
                {items.map((m) => {
                  const imgPaths: string[] = [];
                  if (m.body.imagePath) imgPaths.push(m.body.imagePath);
                  if (Array.isArray(m.body.imagePaths)) imgPaths.push(...m.body.imagePaths.filter(Boolean));
                  const videoPath = m.body.videoPath;
                  const audioPath = m.body.audioPath;

                  return (
                    <li
                      key={m.id}
                      id={`msg-${m.id}`}
                      className={`flex flex-col mb-2 p-2 rounded-lg max-w-[80%] transition-shadow ${
                        m.sender_type === 'system' ? 'mx-auto bg-slate-800 text-center text-xs text-slate-400 border border-slate-700' :
                        isMine(m) ? 'ml-auto bg-blue-900/40 border border-blue-800' :
                        'mr-auto bg-slate-900 border border-slate-800'
                      }`}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        if (!m.body.is_deleted) openActions(m.id, m.body);
                      }}
                      onPointerDown={() => {
                        if (!m.body.is_deleted) startLongPress(m.id, m.body);
                      }}
                      onPointerUp={clearLongPress}
                      onPointerCancel={clearLongPress}
                      onPointerMove={clearLongPress}
                      onDoubleClick={() => {
                        if (!m.body.is_deleted) openActions(m.id, m.body);
                      }}
                    >
                      {isGroup && !isMine(m) && m.sender_type !== 'system' && (
                        <div className="text-[10px] font-semibold text-blue-300 mb-0.5">{senderName(m)}</div>
                      )}
                      <div className="text-[10px] text-slate-500 flex items-center justify-between mb-1">
                        <span>
                          {new Date(m.created_at).toLocaleString(lang)}
                          {m.edited_at && <span className="ml-1 italic text-slate-600">{t('chat.edited')}</span>}
                        </span>
                        {isMine(m) ? (
                          <span className={m.read ? 'text-blue-400 ml-2' : 'text-slate-600 ml-2'}>
                            {m.read ? '✓✓' : '✓'}
                          </span>
                        ) : null}
                      </div>

                      {m.body.is_deleted ? (
                        <div className="text-sm text-slate-500 italic mt-1 flex items-center gap-1">
                          <span>🚫</span> {t('chat.deletedMessage')}
                        </div>
                      ) : (
                        <>
                          {m.body.reply_to && (
                            <div className="mb-1 text-xs border-l-2 border-blue-500 pl-2 text-slate-400 bg-slate-900/50 rounded py-1 pr-2 mt-1">
                              {t('chat.replyToMessage')}
                            </div>
                          )}
                          {m.body.text ? <div className="text-sm mt-1">{m.body.text}</div> : null}

                      {m.body.gifUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.body.gifUrl} alt="GIF" className="mt-2 max-h-72 w-auto rounded-lg border border-slate-900" />
                      ) : null}

                      {m.message_type === 'poll' && m.body.poll ? (
                        <div className="mt-1 space-y-1.5">
                          <div className="text-sm font-medium">{m.body.poll.question}</div>
                          {m.body.poll.options.map((opt, idx) => {
                            const tally = pollTallyByMessage.get(m.id);
                            const count = tally?.counts[idx] ?? 0;
                            const total = (tally?.counts ?? []).reduce((a, b) => a + (b ?? 0), 0);
                            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                            const mine = tally?.myVote === idx;
                            return (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => onVotePoll(m.id, idx)}
                                className={`relative block w-full overflow-hidden rounded-lg border px-3 py-1.5 text-left text-xs transition ${
                                  mine ? 'border-blue-500 bg-blue-950/40' : 'border-slate-800 bg-slate-950/60 hover:bg-slate-900'
                                }`}
                              >
                                <span className="absolute inset-y-0 left-0 bg-blue-900/30" style={{ width: `${pct}%` }} />
                                <span className="relative flex items-center justify-between gap-2">
                                  <span>{opt}</span>
                                  <span className="shrink-0 text-slate-400">
                                    {count} {count === 1 ? t('poll.vote') : t('poll.votes')}
                                  </span>
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      ) : null}

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
                                  {t('chat.cantPlayInline')}{' '}
                                  <a className="text-blue-400 underline" href={signedUrls[videoPath]} target="_blank" rel="noreferrer">
                                    {t('chat.openVideo')}
                                  </a>
                                </div>
                              ) : null}
                            </>
                          ) : (
                            <div className="h-40 w-full animate-pulse rounded-lg border border-slate-900 bg-slate-800" />
                          )}
                        </div>
                      ) : null}

                      {audioPath ? (
                        <div className="mt-2">
                          {signedUrls[audioPath] ? (
                            <audio src={signedUrls[audioPath]} controls className="w-full h-10" />
                          ) : (
                            <div className="h-10 w-full animate-pulse rounded-lg border border-slate-900 bg-slate-800" />
                          )}
                        </div>
                      ) : null}

                      {m.sender_type !== 'system' && (
                        <div className="mt-1.5 flex flex-wrap items-center gap-1">
                          {(reactionsByMessage.get(m.id) ?? []).map((g) => (
                            <button
                              key={g.emoji}
                              type="button"
                              onClick={() => onToggleReaction(m.id, g.emoji)}
                              className={`rounded-full border px-1.5 py-0.5 text-[11px] ${
                                g.mine ? 'border-blue-500 bg-blue-950/40 text-blue-200' : 'border-slate-800 bg-slate-950/60 text-slate-300'
                              }`}
                            >
                              {g.emoji} {g.count}
                            </button>
                          ))}
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setReactionPickerFor(reactionPickerFor === m.id ? null : m.id)}
                              className="rounded-full border border-slate-800 bg-slate-950/60 px-1.5 py-0.5 text-[11px] text-slate-400 hover:bg-slate-900"
                              aria-label={t('chat.react')}
                              title={t('chat.react')}
                            >
                              {myReactionByMessage.get(m.id) ?? '🙂+'}
                            </button>
                            {reactionPickerFor === m.id && (
                              <div
                                className="absolute z-20 mt-1 flex gap-1 rounded-full border border-slate-800 bg-slate-950 p-1 shadow-xl"
                                onMouseLeave={() => setReactionPickerFor(null)}
                              >
                                {QUICK_EMOJIS.map((e) => (
                                  <button
                                    key={e}
                                    type="button"
                                    onClick={() => onToggleReaction(m.id, e)}
                                    className="rounded-full px-1 text-base hover:bg-slate-900"
                                    aria-label={e}
                                  >
                                    {e}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Preview images */}
          {previewImages.length ? (
            <div className="rounded border border-slate-900 bg-slate-950/40 p-2">
              <div className="mb-2 text-xs text-slate-400">{t('chat.previewImages')}</div>
              <div className="grid grid-cols-3 gap-2">
                {previewImages.map((u, i) => (
                  <div key={u} className="group relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={u} alt="preview" className="h-24 w-full rounded border border-slate-900 object-cover" />
                    <button
                      type="button"
                      onClick={() => setEditorIndex(i)}
                      className="absolute bottom-1 right-1 rounded-full bg-black/60 px-2 py-1 text-xs text-white hover:bg-black/80"
                      title={t('chat.editPhoto')}
                      aria-label={t('chat.editPhoto')}
                    >
                      ✏️
                    </button>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex justify-end">
                <button className="rounded bg-slate-800 px-3 py-1.5 text-xs hover:bg-slate-700" onClick={clearPendingImages} disabled={busy}>
                  {t('common.removeAll')}
                </button>
              </div>
            </div>
          ) : null}

          {/* Preview video */}
          {previewVideo ? (
            <div className="rounded border border-slate-900 bg-slate-950/40 p-2">
              <div className="mb-2 text-xs text-slate-400">{t('chat.previewVideo')}</div>
              <video src={previewVideo} controls className="max-h-72 w-full rounded border border-slate-900" />
              <div className="mt-2 flex justify-end">
                <button className="rounded bg-slate-800 px-3 py-1.5 text-xs hover:bg-slate-700" onClick={clearPendingVideo} disabled={busy}>
                  {t('common.remove')}
                </button>
              </div>
            </div>
          ) : null}

          {typingUsers.length > 0 && (
            <div className="text-xs text-blue-400 animate-pulse ml-2">
              {typingUsers.map((id) => usernameById.get(id) || t('chat.someone')).join(', ')} {t('chat.typingSuffix')}
            </div>
          )}

          {editingId && (
            <div className="flex items-center justify-between rounded border border-amber-900 bg-amber-950/30 p-2 text-xs text-amber-200">
              <div className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap pr-2 border-l-2 border-amber-500 pl-2">
                {t('chat.editingMessage')}
              </div>
              <button
                className="text-slate-400 hover:text-white"
                onClick={() => {
                  setEditingId(null);
                  setText('');
                }}
                aria-label={t('common.cancel')}
              >
                ✕
              </button>
            </div>
          )}

          {replyingTo && (
            <div className="flex items-center justify-between rounded border border-blue-900 bg-blue-950/40 p-2 text-xs text-blue-200">
              <div className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap pr-2 border-l-2 border-blue-500 pl-2">
                {t('chat.replyingTo')} {parseCipher(replyingTo.ciphertext).text || t('chat.mediaMessage')}
              </div>
              <button className="text-slate-400 hover:text-white" onClick={() => setReplyingTo(null)} aria-label={t('common.cancel')}>
                ✕
              </button>
            </div>
          )}

          {blocked && (
            <p className="rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-xs text-red-300">
              {t('chat.blockedNotice')}
            </p>
          )}

          <div ref={composerRef} className="relative flex items-center gap-2">
            {/* + button */}
            <button
              className="grid place-items-center rounded bg-slate-800 px-3 py-2 text-slate-200 hover:bg-slate-700"
              onClick={() => {
                setEmojiOpen(false);
                setAttachOpen(true);
              }}
              type="button"
              title={t('chat.attach')}
              aria-label={t('chat.attach')}
              disabled={busy}
            >
              <PlusIcon size={18} />
            </button>

            {/* Emoji button */}
            <div className="relative">
              <button
                className="grid place-items-center rounded bg-slate-800 px-3 py-2 text-slate-200 hover:bg-slate-700"
                onClick={() => {
                  setAttachOpen(false);
                  setEmojiOpen((v) => !v);
                }}
                type="button"
                title={t('chat.emoji')}
                aria-label={t('chat.emoji')}
                disabled={busy}
              >
                <SmileIcon size={18} />
              </button>

              <EmojiPicker
                open={emojiOpen}
                onClose={() => setEmojiOpen(false)}
                onPick={(e) => {
                  insertEmoji(e);
                  setEmojiOpen(false);
                }}
              />
            </div>

            <input
              ref={textInputRef}
              className="flex-1 rounded border border-slate-800 bg-slate-950 px-3 py-2 text-slate-100"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t('chat.composerPlaceholder')}
              onFocus={() => setEmojiOpen(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSend();
              }}
              disabled={blocked}
            />

            <button className="rounded bg-blue-600 px-3 py-2 text-sm hover:bg-blue-500 disabled:opacity-60" onClick={onSend} disabled={busy || isRecording || blocked}>
              {editingId ? t('chat.saveEdit') : t('chat.send')}
            </button>
            <button
              className={`grid place-items-center rounded px-3 py-2 disabled:opacity-60 ${isRecording ? 'bg-red-600 animate-pulse text-white' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'}`}
              onClick={isRecording ? stopRecording : startRecording}
              disabled={busy}
              title={isRecording ? t('chat.stopAndSend') : t('chat.recordAudio')}
              aria-label={isRecording ? t('chat.stopAndSend') : t('chat.recordAudio')}
            >
              <MicIcon size={18} />
            </button>
          </div>
        </div>
      )}
    </PageShell>
  );
}
