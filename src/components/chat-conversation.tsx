'use client';

import { apiFetch } from '@/lib/api/client';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronLeftIcon, SearchIcon, InfoIcon, MoreVerticalIcon, XIcon } from '@/components/icons';
import { ForwardModal } from '@/components/forward-modal';
import { AudioMessage } from '@/components/audio-message';
import { MessageActionsSheet } from '@/components/message-actions-sheet';
import { AttachSheet } from '@/components/attach-sheet';
import { ScheduleMessageModal } from '@/components/schedule-message-modal';
import { CameraCapture } from '@/components/camera-capture';
import { ReportModal } from '@/components/report-modal';
import { sendQueued, flushQueue } from '@/lib/send-queue';
import { GroupInfoModal } from '@/components/group-info-modal';
import { UserInfoModal } from '@/components/user-info-modal';
import { ChatMediaGallery } from '@/components/chat-media-gallery';
import { getWallpaperId, wallpaperCss, getCustomWallpaperUrl, CUSTOM_WALLPAPER_ID } from '@/lib/wallpaper';
import { blockUser, unblockUser, isBlockedByMe } from '@/lib/db/safety';
import { EmojiPicker } from '@/components/emoji-picker';
import { useRequireAuth } from '@/lib/auth/use-require-auth';
import { listChats, sendMessage, deleteMessage, hideMessageForMe, editMessage, pinMessage, unpinMessage, searchMessages, getChatMuted, setChatMuteUntil, toggleReaction, createPoll, votePoll, setDisappearingMessages, enableChatEncryption, chatMustEncrypt, clearChatForMe, getGroupMeta, markMessageViewed, getChatMessageViews, setEventRsvp, getChatEventRsvps, type EventRsvpStatus, EncryptionRequiredError, type GroupMeta } from '@/lib/db/chats';
import { initKeystore, isUnlocked } from '@/lib/crypto/keystore';
import { uploadChatImage, uploadChatMedia, uploadChatAudio, uploadChatFile, createSignedChatMediaUrl, fetchCachedMediaUrl, uploadEncryptedChatMedia, fetchDecryptedMediaUrl } from '@/lib/storage/upload';
import { decryptMedia, type MediaEnc } from '@/lib/crypto/media';
import { useChatRealtime } from '@/lib/realtime/use-chat-realtime';
import { browserSupabase } from '@/lib/supabase/client';
import { useOnlineUsers } from '@/components/presence-provider';
import { useLanguage } from '@/lib/i18n/context';
import { PollComposer } from '@/components/poll-composer';
import { EventComposer, type NewEvent } from '@/components/event-composer';
import { addToCalendar, googleCalendarUrl } from '@/lib/calendar';
import { MessagesSkeleton } from '@/components/skeleton';
import { ImageLightbox } from '@/components/image-lightbox';
import { ViewOnceViewer } from '@/components/view-once-viewer';
import { DocumentPreview } from '@/components/document-preview';
import { MessageText } from '@/components/message-text';
import { extractMentionIds } from '@/lib/mentions';
import { tap, impact } from '@/lib/haptics';
import { LinkPreview, firstUrl } from '@/components/link-preview';
import { SafetyNumberModal } from '@/components/safety-number-modal';
import { peerFingerprint } from '@/lib/crypto/keystore';
import { isChatLocked, isChatLockAvailable, lockChat, unlockChat, verifyChatPin } from '@/lib/chat-lock';
import { starMessage, unstarMessage, getStarredIdsForChat } from '@/lib/db/stars';
import { ImageEditor } from '@/components/image-editor';
import { MessageEffects, detectEffect } from '@/components/message-effects';
import { wasCelebrated, markCelebrated } from '@/lib/effects-seen';
import { useTheme } from '@/lib/theme';
import { GifPicker } from '@/components/gif-picker';
import { StickerPicker } from '@/components/sticker-picker';
import { ContactPicker } from '@/components/contact-picker';
import { getCurrentLocation, mapsUrlFor } from '@/lib/geolocation';
import type { Gif } from '@/lib/giphy';
import { useCall } from '@/lib/call/call-provider';
import { VideoTrimmer, TrimmedVideo } from '@/components/video-trimmer';
import { suggestReplies, translateText } from '@/lib/ai';
import { avatarBg, initials } from '@/lib/ui/avatar';
import { highlightSnippet } from '@/lib/ui/highlight';
import { PhoneIcon, VideoIcon, PlusIcon, SmileIcon, MicIcon, PencilIcon, ReplyIcon, ForwardIcon, CopyIcon, DownloadIcon, EyeIcon, EyeOffIcon, TrashIcon, PinIcon, FlagIcon, PaperclipIcon, SparklesIcon, GlobeIcon, SendIcon, CheckIcon, ExternalLinkIcon } from '@/components/icons';
import { SeenBySheet } from '@/components/seen-by-sheet';
import { canNativeFiles, shareNativeFile, saveNativeFile, saveMediaToGallery } from '@/lib/native-files';
import { isAutoSaveOn, setAutoSaveOn, isMediaSaved, markMediaSaved } from '@/lib/media-autosave';
import { getAutoDownloadSettings, getNetworkClass, onNetworkChange, isAutoDownloadAllowed, type MediaKind, type NetworkClass, type AutoDownloadSettings } from '@/lib/media-autodownload';
import { compressImageForSend, type SendQuality } from '@/lib/image-compress';
import type { ChatSummary, MessageRow } from '@/lib/db/types';

type Payload = {
  v?: number;
  encrypted?: boolean;
  text?: string;
  imagePath?: string;
  imagePaths?: string[];
  videoPath?: string;
  videoTrimStart?: number;
  videoTrimEnd?: number;
  audioPath?: string;
  gifUrl?: string;
  stickerUrl?: string;
  filePath?: string;
  fileName?: string;
  fileSize?: number;
  fileMime?: string;
  reply_to?: string;
  is_deleted?: boolean;
  /** "Ver una vez": photo/video the recipient can open exactly once. */
  viewOnce?: boolean;
  /** User ids mentioned in `text` (groups). */
  mentions?: string[];
  poll?: { question: string; options: string[] };
  /** An in-chat event (date/time + optional place/note). */
  event?: { title: string; startsAt: string; endsAt?: string; location?: string; note?: string };
  /** A shared contact card. */
  contact?: { userId: string; name: string; username: string | null; avatarUrl: string | null };
  /** A shared one-time location. */
  location?: { lat: number; lng: number };
  /** In-chat call log entry (WhatsApp-style). */
  call?: { video: boolean; outcome: 'answered' | 'no_answer' | 'declined' | 'cancelled'; duration?: number; isGroup?: boolean };
  /** Per-path media encryption metadata (toky-media-v1) for encrypted chats. */
  enc?: Record<string, MediaEnc>;
};

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

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

/** Compact talk-time for a call log: "45s", "9:05", "1:02:30". */
function formatCallDuration(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
  if (m > 0) return `${m}:${String(r).padStart(2, '0')}`;
  return `${r}s`;
}

function getMessagePayload(message: MessageRow): Payload {
  const parsed = parseCipher(message.ciphertext);
  if (message.content && !parsed.text) {
    parsed.text = message.content;
  }
  return parsed;
}

function formatLastSeen(iso: string, lang: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return d.toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' });
  }
  // Short date: weekday + day + month (e.g. "Mon, 12 Aug"); include the year
  // only when it's a different year (e.g. "Mon, 12 Aug 2025").
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString(lang, {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

function shortId(id: string) {
  return id.length > 10 ? `${id.slice(0, 6)}…${id.slice(-4)}` : id;
}

function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
}

export function ChatConversation({ chatId, embedded = false, focusMessageId = null }: { chatId: string; embedded?: boolean; focusMessageId?: string | null }) {
  const { loading: authLoading, user } = useRequireAuth();
  const { t, lang } = useLanguage();
  const myId = user?.id ?? null;

  function fmtTime(ts: string) {
    return new Date(ts).toLocaleString(lang);
  }

  const supabase = browserSupabase();
  const { startCall, busy: callBusy } = useCall();
  const { messages, loading: msgLoading, appendLocal, clearMessages, loadMore, hasMore, loadingMore, typingUsers, erasingUsers, recordingUsers, setMeActivity, reactions, pollVotes, hiddenIds } = useChatRealtime(chatId);

  // chat details
  const [chat, setChat] = useState<ChatSummary | null>(null);
  const [chatLoading, setChatLoading] = useState(true);

  // members
  const [members, setMembers] = useState<string[]>([]);
  const [groupMeta, setGroupMeta] = useState<GroupMeta | null>(null);
  const [memberProfiles, setMemberProfiles] = useState<{ id: string; username: string | null; display_name: string | null; avatar_url: string | null; last_seen: string | null }[]>([]);
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
      const res = await apiFetch(`/api/chat/${chatId}/status`, {
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
  // Active @mention typing context: the '@' index and the query after it.
  const [mentionQuery, setMentionQuery] = useState<{ start: number; query: string } | null>(null);
  const [pendingImages, setPendingImages] = useState<File[]>([]);
  const [pendingVideo, setPendingVideo] = useState<File | null>(null);
  const [pendingVideoTrim, setPendingVideoTrim] = useState<{ start: number; end: number } | null>(null);
  const [trimmerOpen, setTrimmerOpen] = useState(false);
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
  // Contact-info sheet: the user id whose info to show (peer in a 1:1, or a
  // tapped group member). Null = closed.
  const [userInfoId, setUserInfoId] = useState<string | null>(null);
  const [mediaGalleryOpen, setMediaGalleryOpen] = useState(false);
  const [autoSaveMedia, setAutoSaveMedia] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [blockBusy, setBlockBusy] = useState(false);
  const [muted, setMuted] = useState(false);
  const [muteBusy, setMuteBusy] = useState(false);
  const [disappearingMenuOpen, setDisappearingMenuOpen] = useState(false);
  const [muteMenuOpen, setMuteMenuOpen] = useState(false);
  const [disappearingBusy, setDisappearingBusy] = useState(false);
  const [encBusy, setEncBusy] = useState(false);

  useEffect(() => {
    getChatMuted(chatId).then(setMuted).catch(() => {});
  }, [chatId]);

  useEffect(() => {
    initKeystore().catch(() => {});
  }, []);

  async function enableEncryption() {
    setEncBusy(true);
    try {
      await initKeystore();
      if (!isUnlocked()) {
        setErr(t('chat.encryptionSetupFirst'));
        return;
      }
      const res = await enableChatEncryption(chatId);
      if (!res.ok) {
        setErr(t('chat.encryptionMissingMembers'));
        return;
      }
      setChat((prev) => (prev ? { ...prev, encrypted: true } : prev));
    } catch (e: any) {
      setErr(sendErrorMessage(e));
    } finally {
      setEncBusy(false);
      setSafetyMenuOpen(false);
    }
  }

  async function chooseDisappearing(seconds: number) {
    setDisappearingBusy(true);
    try {
      await setDisappearingMessages(chatId, seconds);
      setChat((prev) => (prev ? { ...prev, disappearing_seconds: seconds || null } : prev));
    } catch (e: any) {
      setErr(sendErrorMessage(e));
    } finally {
      setDisappearingBusy(false);
      setDisappearingMenuOpen(false);
      setSafetyMenuOpen(false);
    }
  }

  // Mute for a duration (ms; null = forever) or unmute — used by the richer
  // contact-info control.
  async function muteFor(durationMs: number | null) {
    setMuteBusy(true);
    try {
      await setChatMuteUntil(chatId, durationMs ? new Date(Date.now() + durationMs) : null, true);
      setMuted(true);
    } catch (e: any) {
      setErr(sendErrorMessage(e));
    } finally {
      setMuteBusy(false);
    }
  }

  async function unmute() {
    setMuteBusy(true);
    try {
      await setChatMuteUntil(chatId, null, false);
      setMuted(false);
    } catch (e: any) {
      setErr(sendErrorMessage(e));
    } finally {
      setMuteBusy(false);
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
    // Don't let the auto-pin snap us back to the bottom after jumping.
    stickBottomRef.current = false;
    const el = document.getElementById(`msg-${messageId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-amber-400');
      setTimeout(() => el.classList.remove('ring-2', 'ring-amber-400'), 1500);
    } else {
      toast(t('chat.messageNotLoaded'));
    }
  }

  // Deep-link to a specific message (e.g. opened from the global search on the
  // chat list). The target may be older than the first loaded page, so if it's
  // not in the DOM yet we pull older pages — bounded — until it appears, then
  // scroll to and briefly highlight it. focusDoneRef makes it fire once per
  // requested id, so a later scroll/refetch can't yank the view back.
  const focusTargetRef = useRef<string | null>(null);
  const focusTriesRef = useRef(0);
  useEffect(() => {
    focusTargetRef.current = focusMessageId || null;
    focusTriesRef.current = 0;
  }, [focusMessageId]);
  useEffect(() => {
    const target = focusTargetRef.current;
    if (!target || msgLoading) return;
    const el = document.getElementById(`msg-${target}`);
    if (el) {
      stickBottomRef.current = false;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-amber-400');
      setTimeout(() => el.classList.remove('ring-2', 'ring-amber-400'), 1800);
      focusTargetRef.current = null;
      return;
    }
    // Not loaded yet — page back through history until we find it (bounded so a
    // message that was deleted/hidden can't loop forever).
    if (hasMore && !loadingMore && focusTriesRef.current < 12) {
      focusTriesRef.current += 1;
      loadMore();
    }
  }, [focusMessageId, messages, msgLoading, hasMore, loadingMore, loadMore]);

  const [isRecording, setIsRecording] = useState(false);
  const [isRecPaused, setIsRecPaused] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  // A finished recording waiting for the user to send or discard it (we no
  // longer auto-send the moment recording stops).
  const [pendingAudio, setPendingAudio] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recTimerRef = useRef<number | null>(null);
  const recCanceledRef = useRef(false);
  const [replyingTo, setReplyingTo] = useState<MessageRow | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  // -------- Draft persistence
  // Keep an unsent message around when you leave the chat, per conversation, so
  // it's still there when you come back (mirrors WhatsApp). Restored on chat
  // switch; saved on every keystroke; cleared on send (setText('') empties it).
  const draftKey = `toky:draft:${chatId}`;
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`toky:draft:${chatId}`);
      setText(saved || '');
    } catch {}
    // Only when the conversation changes — not on every text edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]);
  useEffect(() => {
    // Don't treat an in-progress message edit as a draft.
    if (editingId) return;
    try {
      if (text) localStorage.setItem(draftKey, text);
      else localStorage.removeItem(draftKey);
    } catch {}
  }, [text, editingId, draftKey]);

  // Local previews
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [previewVideo, setPreviewVideo] = useState<string>('');

  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  // Synchronous re-entrancy lock for onSend. `busy` is React state and updates
  // only on the next render, so holding Enter (keyboard auto-repeat) or a fast
  // double-tap can re-enter onSend many times before the button is disabled —
  // each re-entry re-uploads the still-pending image and inserts another row,
  // which is how a single image got sent ~10 times. This ref flips
  // synchronously, so the second call bails immediately.
  const sendingRef = useRef(false);

  // Turn a send failure into a clear, localized message. A fail-closed E2EE
  // chat (peer hasn't set up encryption) surfaces an actionable explanation
  // instead of the raw error.
  function sendErrorMessage(e: any): string {
    if (e instanceof EncryptionRequiredError || e?.name === 'EncryptionRequiredError') {
      return t('chat.encryptionRequiredToSend');
    }
    return e?.message ?? String(e);
  }

  // Signed URL cache (path -> url). For encrypted media the value is a decrypted
  // object URL; those are tracked so we can revoke them on unmount.
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  // Paths whose media failed to resolve (missing object, transient RLS/auth
  // race, or decrypt error). Tracked per-path so one bad attachment never
  // blanks the whole conversation; the tile offers a tap-to-retry instead.
  const [failedMedia, setFailedMedia] = useState<Set<string>>(new Set());
  const objectUrlsRef = useRef<string[]>([]);
  function trackObjectUrl(url: string) {
    objectUrlsRef.current.push(url);
  }
  useEffect(() => {
    return () => {
      for (const u of objectUrlsRef.current) {
        try { URL.revokeObjectURL(u); } catch {}
      }
      objectUrlsRef.current = [];
    };
  }, []);

  // Upload one attachment for this chat. In an encrypted chat the bytes are
  // encrypted client-side (toky-media-v1) and only ciphertext is uploaded; a
  // local object URL of the original is cached for instant preview. In a legacy
  // chat the original is uploaded and a signed URL prefetched.
  async function putMedia(
    file: Blob,
    encMode: boolean,
    legacyUpload: () => Promise<{ path: string }>,
  ): Promise<{ path: string; enc?: MediaEnc }> {
    if (encMode) {
      const { path, enc } = await uploadEncryptedChatMedia({ chatId, file });
      const localUrl = URL.createObjectURL(file);
      trackObjectUrl(localUrl);
      setSignedUrls((prev) => ({ ...prev, [path]: localUrl }));
      return { path, enc };
    }
    const { path } = await legacyUpload();
    try {
      const url = await createSignedChatMediaUrl(path, 300);
      setSignedUrls((prev) => ({ ...prev, [path]: url }));
    } catch {}
    return { path };
  }
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  // Auto-download gating: media kinds withheld on the current network show a
  // tap-to-download tile instead of fetching automatically.
  const [deferredMedia, setDeferredMedia] = useState<Set<string>>(new Set());
  const [manualPaths, setManualPaths] = useState<Set<string>>(new Set());
  const [autoDownload, setAutoDownload] = useState<AutoDownloadSettings>(getAutoDownloadSettings);
  const [netClass, setNetClass] = useState<NetworkClass>('wifi');
  useEffect(() => {
    setAutoDownload(getAutoDownloadSettings());
    setNetClass(getNetworkClass());
    const offNet = onNetworkChange(() => setNetClass(getNetworkClass()));
    // Pick up a settings change made on the Settings screen when we return.
    const onFocus = () => setAutoDownload(getAutoDownloadSettings());
    window.addEventListener('focus', onFocus);
    return () => { offNet(); window.removeEventListener('focus', onFocus); };
  }, []);
  // Per-send image quality (remembered across sends).
  const [sendQuality, setSendQuality] = useState<SendQuality>('standard');
  useEffect(() => {
    try {
      const v = localStorage.getItem('toky.sendQuality');
      if (v === 'standard' || v === 'high' || v === 'original') setSendQuality(v);
    } catch {}
  }, []);
  function chooseSendQuality(q: SendQuality) {
    setSendQuality(q);
    try { localStorage.setItem('toky.sendQuality', q); } catch {}
  }
  // "Ver una vez": compose toggle + who has opened which one-time message.
  const [composeViewOnce, setComposeViewOnce] = useState(false);
  const [myViewedIds, setMyViewedIds] = useState<Set<string>>(new Set());
  const [openedByOthers, setOpenedByOthers] = useState<Set<string>>(new Set());
  const [viewOnceOpen, setViewOnceOpen] = useState<{ url: string; kind: 'photo' | 'video'; blob: boolean } | null>(null);
  const [viewOnceLoadingId, setViewOnceLoadingId] = useState<string | null>(null);
  const [showScrollDown, setShowScrollDown] = useState(false);
  // Swipe-to-reply: track the gesture start and the live horizontal pull.
  const optionsMenuRef = useRef<HTMLDivElement>(null);
  const swipeStart = useRef<{ x: number; y: number; id: string; decided: 'none' | 'h' | 'v' } | null>(null);
  const [swipe, setSwipe] = useState<{ id: string; dx: number } | null>(null);
  // Unread divider: freeze the last-read timestamp at mount so the "new
  // messages" line stays put while the chat is open; advance the stored marker
  // as messages arrive (the chat being open counts as reading them).
  const [initialLastRead] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    try { return window.localStorage.getItem(`toky:lastread:${chatId}`); } catch { return null; }
  });

  // Video play error -> only shows the "Open video" link
  const [videoPlayError, setVideoPlayError] = useState<Record<string, boolean>>({});

  // Forward state
  const [safetyOpen, setSafetyOpen] = useState(false);
  // Peer key/device-change warning (direct chats): set when the contact's
  // safety-number fingerprint differs from the last one we saw.
  const [keyChanged, setKeyChanged] = useState(false);
  const [peerFp, setPeerFp] = useState<string | null>(null);
  // Sensitive-chat lock: whether this chat is locked and still needs a PIN to
  // reveal in this view. Re-locks every time the conversation is opened.
  const [chatLocked, setChatLocked] = useState(() => isChatLocked(chatId));
  const [needUnlock, setNeedUnlock] = useState(() => isChatLocked(chatId));
  const [unlockPin, setUnlockPin] = useState('');
  const [unlockError, setUnlockError] = useState(false);
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set());
  const [starredOpen, setStarredOpen] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [forwardOpen, setForwardOpen] = useState(false);
  const [forwardBody, setForwardBody] = useState<Payload | null>(null);
  // Attachment currently open in the document preview sheet (its message body).
  const [docPreview, setDocPreview] = useState<Payload | null>(null);
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [chatsLoading, setChatsLoading] = useState(false);

  // Message Actions Sheet state
  const [actionsOpen, setActionsOpen] = useState(false);
  const [actionsMsg, setActionsMsg] = useState<{ id: string; body: Payload } | null>(null);
  const [seenByMsgId, setSeenByMsgId] = useState<string | null>(null);

  // Attach sheet
  const [attachOpen, setAttachOpen] = useState(false);

  // Emoji picker
  const [emojiOpen, setEmojiOpen] = useState(false);

  // Reactions quick-picker
  const [reactionPickerFor, setReactionPickerFor] = useState<string | null>(null);

  // Poll composer
  const [pollComposerOpen, setPollComposerOpen] = useState(false);
  // Event composer + RSVPs (messageId -> { userId -> status }).
  const [eventComposerOpen, setEventComposerOpen] = useState(false);
  const [rsvps, setRsvps] = useState<{ messageId: string; userId: string; status: EventRsvpStatus }[]>([]);

  // GIF picker
  const [gifPickerOpen, setGifPickerOpen] = useState(false);
  // Sticker picker (collection + create)
  const [stickerPickerOpen, setStickerPickerOpen] = useState(false);
  const [contactPickerOpen, setContactPickerOpen] = useState(false);

  // AI: smart replies + translation
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestBusy, setSuggestBusy] = useState(false);
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [translatingId, setTranslatingId] = useState<string | null>(null);

  // Image editor (crop/rotate/filter/draw before sending)
  const [editorIndex, setEditorIndex] = useState<number | null>(null);

  // Animated message effects (iMessage-style burst on festive triggers)
  const { effects: effectsEnabled } = useTheme();
  const [effectTrigger, setEffectTrigger] = useState<string | null>(null);
  const lastEffectMsgId = useRef<string | null>(null);

  // Inputs
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const cameraPhotoRef = useRef<HTMLInputElement | null>(null);
  const cameraVideoRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textInputRef = useRef<HTMLTextAreaElement | null>(null);
  // Whether the composer is focused — gates typing/erasing activity to real edits.
  const composerFocusedRef = useRef(false);

  const composerRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  // Tracks whether we've already jumped to the newest message for this chat,
  // so opening a chat lands at the bottom but later updates don't yank you down.
  const initialScrollDoneRef = useRef(false);
  // True while the view should stay pinned to the newest message. Set false when
  // the user scrolls up; re-pins as media loads so the latest message isn't left
  // cut off at the bottom of the screen after images finish loading.
  const stickBottomRef = useRef(true);

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
        .select('id, username, display_name, avatar_url, last_seen')
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
      setMemberProfiles((profs ?? []).map((p: any) => ({ id: p.id, username: p.username ?? null, display_name: p.display_name ?? null, avatar_url: p.avatar_url ?? null, last_seen: p.last_seen ?? null })));
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

  // "Guardar en Fotos": load the per-chat preference.
  useEffect(() => {
    setAutoSaveMedia(isAutoSaveOn(chatId));
  }, [chatId]);

  function toggleAutoSaveMedia() {
    const next = !autoSaveMedia;
    setAutoSaveMedia(next);
    setAutoSaveOn(chatId, next);
    // Seed the saved set with the current history so turning it on only
    // auto-saves NEW incoming media, never the whole backlog.
    if (next) markMediaSaved(chatId, items.map((m) => m.id));
  }

  // Auto-save incoming images/videos to the gallery when enabled (native only).
  useEffect(() => {
    if (!autoSaveMedia || !canNativeFiles()) return;
    let cancelled = false;
    (async () => {
      for (const m of items) {
        if (cancelled) return;
        if (isMine(m) || m.body.is_deleted) continue;
        if (isMediaSaved(chatId, m.id)) continue;
        const paths = [
          ...(m.body.imagePath ? [m.body.imagePath] : []),
          ...(m.body.imagePaths ?? []),
          ...(m.body.videoPath ? [m.body.videoPath] : []),
        ].filter(Boolean) as string[];
        if (paths.length === 0) continue;
        try {
          for (const p of paths) {
            const blob = await fetchSourceBlob(p, m.body.enc?.[p]);
            await saveMediaToGallery(blob, m.body.fileName || `toky-${m.id}`);
          }
          markMediaSaved(chatId, [m.id]);
        } catch {
          /* skip this one; try again on a later change */
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSaveMedia, items, chatId]);

  // Human-friendly date label for the day separators between messages.
  function dayLabel(iso: string) {
    const d = new Date(iso);
    const now = new Date();
    const yest = new Date();
    yest.setDate(now.getDate() - 1);
    if (d.toDateString() === now.toDateString()) return t('chat.today');
    if (d.toDateString() === yest.toDateString()) return t('chat.yesterday');
    return d.toLocaleDateString(lang, {
      day: 'numeric',
      month: 'short',
      ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' as const } : {}),
    });
  }

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
      setErr(sendErrorMessage(e));
    }
  }

  async function onCreatePoll(question: string, options: string[]) {
    await createPoll(chatId, question, options);
  }

  async function onVotePoll(messageId: string, optionIndex: number) {
    try {
      await votePoll(messageId, chatId, optionIndex);
    } catch (e: any) {
      setErr(sendErrorMessage(e));
    }
  }

  async function onSuggest() {
    setSuggestBusy(true);
    try {
      const recent = items.slice(-8).filter((m) => !m.body.is_deleted);
      const context = recent
        .map((m) => `${isMine(m) ? 'Me' : senderName(m) || 'Them'}: ${m.body.text || '[media]'}`)
        .join('\n');
      const { configured, error, replies } = await suggestReplies(context);
      if (!configured) {
        toast(t('ai.notConfigured'));
        setSuggestions([]);
        return;
      }
      if (error) {
        toast(error);
        setSuggestions([]);
        return;
      }
      setSuggestions(replies);
      if (replies.length === 0) toast(t('ai.noSuggestions'));
    } catch {
      toast(t('ai.failed'));
    } finally {
      setSuggestBusy(false);
    }
  }

  // Export the (decrypted) conversation to a plain-text file. The user confirms
  // an "unencrypted" warning first (in the info sheet). Media becomes a bracketed
  // marker; system messages are skipped.
  async function handleExportChat() {
    function marker(b: Payload): string {
      if (b.is_deleted) return `[${t('export.deleted')}]`;
      if (b.text) return b.text;
      if (b.imagePath || (b.imagePaths && b.imagePaths.length)) return `[${t('export.image')}]`;
      if (b.videoPath) return `[${t('export.video')}]`;
      if (b.audioPath) return `[${t('export.audio')}]`;
      if (b.gifUrl) return `[${t('export.gif')}]`;
      if (b.filePath) return `[${t('export.file')}: ${b.fileName || ''}]`;
      if (b.poll) return `[${t('export.poll')}: ${b.poll.question}]`;
      if (b.event) return `[${t('chatsList.event')}: ${b.event.title}]`;
      return '';
    }
    const lines = items
      .filter((m) => m.message_type !== 'system')
      .map((m) => {
        const d = new Date(m.created_at);
        const stamp = `${d.toLocaleDateString(lang)} ${d.toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' })}`;
        const who = isMine(m) ? t('export.me') : senderName(m) || headerName;
        return `[${stamp}] ${who}: ${marker(m.body)}`;
      });
    const text = `${t('export.header', { name: headerName })}\n\n${lines.join('\n')}\n`;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const filename = `Toky - ${headerName}.txt`.replace(/[^\w.\- ]+/g, '_');
    if (canNativeFiles()) {
      try {
        await saveNativeFile(blob, filename);
        toast(t('chat.savedToDevice'));
      } catch {
        toast(t('chat.downloadFailed'));
      }
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => {
      try { URL.revokeObjectURL(url); } catch {}
    }, 4000);
  }

  async function onTranslate(messageId: string, text: string) {
    if (!text) return;
    setTranslatingId(messageId);
    try {
      const target = lang === 'es' ? 'Spanish' : 'English';
      const { configured, error, text: out } = await translateText(text, target);
      if (!configured) {
        toast(t('ai.notConfigured'));
        return;
      }
      if (error) {
        toast(error);
        return;
      }
      if (out) setTranslations((prev) => ({ ...prev, [messageId]: out }));
      else toast(t('ai.failed'));
    } catch {
      toast(t('ai.failed'));
    } finally {
      setTranslatingId(null);
    }
  }

  async function onPickSticker(url: string) {
    setStickerPickerOpen(false);
    const payload: Payload = { stickerUrl: url };
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
      await sendQueued(chatId, payload as any);
      setErr('');
    } catch (e: any) {
      setErr(sendErrorMessage(e));
    }
  }

  async function onPickContact(c: { id: string; username: string | null; display_name?: string | null; avatar_url?: string | null }) {
    setContactPickerOpen(false);
    const payload: Payload = {
      contact: {
        userId: c.id,
        name: c.display_name || c.username || c.id.slice(0, 8),
        username: c.username ?? null,
        avatarUrl: c.avatar_url ?? null,
      },
    };
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
      await sendQueued(chatId, payload as any);
      setErr('');
    } catch (e: any) {
      setErr(sendErrorMessage(e));
    }
  }

  async function onShareLocation() {
    setAttachOpen(false);
    let loc: { lat: number; lng: number };
    try {
      loc = await getCurrentLocation();
    } catch {
      setErr(t('chat.locationError'));
      return;
    }
    const payload: Payload = { location: loc };
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
      await sendQueued(chatId, payload as any);
      setErr('');
    } catch (e: any) {
      setErr(sendErrorMessage(e));
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
      await sendQueued(chatId, payload as any);
      setErr('');
    } catch (e: any) {
      setErr(sendErrorMessage(e));
    }
  }

  const usernameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of memberProfiles) if (p.username) m.set(p.id, p.username);
    return m;
  }, [memberProfiles]);

  // @mention maps: lowercased username → id (to resolve on send) and → display
  // info (to render). Built from the group's members.
  const usernameToId = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of memberProfiles) if (p.username) m.set(p.username.toLowerCase(), p.id);
    return m;
  }, [memberProfiles]);
  const mentionNames = useMemo(() => {
    const m = new Map<string, { name: string; me: boolean }>();
    for (const p of memberProfiles) {
      if (p.username) m.set(p.username.toLowerCase(), { name: p.display_name || p.username, me: p.id === myId });
    }
    return m;
  }, [memberProfiles, myId]);

  // Update the @mention autocomplete context from the caret position.
  const computeMentionQuery = (value: string, caret: number) => {
    if (chat?.kind !== 'group') { setMentionQuery(null); return; }
    const before = value.slice(0, caret);
    const m = before.match(/(?:^|[\s(])@([a-zA-Z0-9._]{0,32})$/);
    setMentionQuery(m ? { start: caret - m[1].length - 1, query: m[1] } : null);
  };
  const mentionCandidates = useMemo(() => {
    if (chat?.kind !== 'group' || !mentionQuery) return [];
    const q = mentionQuery.query.toLowerCase();
    return memberProfiles
      .filter((p) => p.id !== myId && p.username)
      .filter((p) => q === '' || (p.username || '').toLowerCase().includes(q) || (p.display_name || '').toLowerCase().includes(q))
      .slice(0, 6);
  }, [chat?.kind, mentionQuery, memberProfiles, myId]);
  const insertMention = (p: { username: string | null }) => {
    if (!mentionQuery || !p.username) return;
    const caret = textInputRef.current?.selectionStart ?? text.length;
    const before = text.slice(0, mentionQuery.start);
    const after = text.slice(caret);
    const insert = `@${p.username} `;
    setText(before + insert + after);
    setMentionQuery(null);
    requestAnimationFrame(() => {
      const el = textInputRef.current;
      if (el) {
        const pos = (before + insert).length;
        el.focus();
        el.setSelectionRange(pos, pos);
      }
    });
  };

  const otherMemberIds = useMemo(
    () => memberProfiles.map((p) => p.id).filter((id) => id !== myId),
    [memberProfiles, myId]
  );
  const someoneOnline = otherMemberIds.some((id) => onlineUsers.has(id));
  const isGroup = chat?.kind === 'group';
  const isChannel = chat?.kind === 'channel';
  const isDirect = chat?.kind === 'direct';
  const otherUserId = isDirect ? otherMemberIds[0] ?? null : null;
  const otherProfile = otherUserId ? memberProfiles.find((p) => p.id === otherUserId) ?? null : null;
  // Header identity: the other person for 1:1, the chat title for groups.
  const headerName = isDirect
    ? otherProfile?.display_name || otherProfile?.username || chat?.title || t('chat.someone')
    : chat?.title || (isGroup ? t('chatsList.group') : t('chat.title'));
  const headerAvatar = isDirect ? otherProfile?.avatar_url ?? null : chat?.avatar_url ?? null;
  const headerStatus = isDirect
    ? someoneOnline
      ? t('chat.online')
      : otherProfile?.last_seen
      ? t('chat.lastSeen', { when: formatLastSeen(otherProfile.last_seen, lang) })
      : t('chat.offline')
    : members.length
    ? members.join(', ')
    : '';
  const isGroupCreator = isGroup && chat?.created_by === myId;
  // In a channel only the owner may post; in a group set to "admins only",
  // non-admins are read-only too. Everyone else can post.
  const groupSendBlocked = isGroup && groupMeta?.perms.send === 'admins' && !groupMeta.amAdmin;
  const canPost = (!isChannel || chat?.created_by === myId) && !groupSendBlocked;

  // Load the group's roles/permissions (for send gating), refreshing when the
  // member list reloads or the group-info sheet opens/closes (perms changed).
  useEffect(() => {
    if (chat?.kind !== 'group') { setGroupMeta(null); return; }
    let alive = true;
    getGroupMeta(chatId).then((m) => { if (alive) setGroupMeta(m); }).catch(() => {});
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId, chat?.kind, membersReloadKey, groupInfoOpen]);

  useEffect(() => {
    if (!otherUserId) return;
    isBlockedByMe(otherUserId).then(setBlocked).catch(() => {});
  }, [otherUserId]);

  // Watch the contact's safety-number fingerprint. The first time we see it we
  // remember it silently; if it later differs (new device / reinstall / someone
  // intercepting), we surface a warning and drop any prior "verified" mark.
  useEffect(() => {
    setKeyChanged(false);
    setPeerFp(null);
    if (!otherUserId) return;
    let alive = true;
    peerFingerprint(otherUserId)
      .then((fp) => {
        if (!alive || !fp) return;
        const key = `toky:peerfp:${otherUserId}`;
        let prev: string | null = null;
        try { prev = localStorage.getItem(key); } catch {}
        if (!prev) {
          try { localStorage.setItem(key, fp); } catch {}
          return;
        }
        if (prev !== fp) {
          setPeerFp(fp);
          setKeyChanged(true);
          try { localStorage.setItem(`toky:verified:${chatId}`, '0'); } catch {}
        }
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [otherUserId, chatId]);

  // Dismiss the key-change warning: trust the new fingerprint going forward.
  function acknowledgeKeyChange() {
    if (otherUserId && peerFp) {
      try { localStorage.setItem(`toky:peerfp:${otherUserId}`, peerFp); } catch {}
    }
    setKeyChanged(false);
  }

  // Lock gate: re-evaluate whenever the open chat changes. A locked chat needs
  // the PIN re-entered each time it's opened.
  useEffect(() => {
    const locked = isChatLocked(chatId);
    setChatLocked(locked);
    setNeedUnlock(locked);
    setUnlockPin('');
    setUnlockError(false);
  }, [chatId]);

  function toggleChatLock() {
    setSafetyMenuOpen(false);
    if (chatLocked) {
      unlockChat(chatId);
      setChatLocked(false);
      return;
    }
    if (!isChatLockAvailable()) {
      toast(t('chatLock.needAppLock'));
      return;
    }
    lockChat(chatId);
    setChatLocked(true);
  }

  async function submitChatUnlock() {
    if (unlockPin.length < 4) return;
    if (await verifyChatPin(unlockPin)) {
      setNeedUnlock(false);
      setUnlockPin('');
      setUnlockError(false);
    } else {
      setUnlockError(true);
      setUnlockPin('');
    }
  }

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
      setErr(sendErrorMessage(e));
    } finally {
      setBlockBusy(false);
      setSafetyMenuOpen(false);
    }
  }

  function isMine(m: MessageRow) {
    return (!!myId && m.sender_id === myId) || m.sender_device_id === 'local';
  }

  // Close the header options (⋮) menu on any tap/click outside it. A document
  // listener is used instead of a fixed-position backdrop because the glass
  // header has `backdrop-filter`, which would contain a `position: fixed`
  // catcher to the header strip rather than the whole viewport.
  useEffect(() => {
    if (!safetyMenuOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!optionsMenuRef.current?.contains(e.target as Node)) {
        setSafetyMenuOpen(false);
        setDisappearingMenuOpen(false);
      }
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [safetyMenuOpen]);

  // Load which messages in this chat I've starred (for the indicator + viewer).
  useEffect(() => {
    let alive = true;
    getStarredIdsForChat(chatId)
      .then((ids) => alive && setStarredIds(new Set(ids)))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [chatId]);

  async function toggleStar(messageId: string) {
    const starred = starredIds.has(messageId);
    // Optimistic update, reverting on failure.
    setStarredIds((prev) => {
      const n = new Set(prev);
      if (starred) n.delete(messageId);
      else n.add(messageId);
      return n;
    });
    try {
      if (starred) await unstarMessage(messageId);
      else {
        await starMessage(messageId, chatId);
        tap();
      }
    } catch (e: any) {
      setErr(sendErrorMessage(e));
      setStarredIds((prev) => {
        const n = new Set(prev);
        if (starred) n.add(messageId);
        else n.delete(messageId);
        return n;
      });
    }
  }

  // Persist the newest message time as "read" while the chat is open.
  useEffect(() => {
    if (typeof window === 'undefined' || messages.length === 0) return;
    const newest = messages[messages.length - 1].created_at;
    try { window.localStorage.setItem(`toky:lastread:${chatId}`, newest); } catch { /* ignore */ }
  }, [messages, chatId]);

  // First incoming message newer than the frozen last-read marker → divider row.
  const firstUnreadIdx = initialLastRead
    ? items.findIndex(
        (mm) =>
          mm.sender_type !== 'system' &&
          !isMine(mm) &&
          new Date(mm.created_at).getTime() > new Date(initialLastRead).getTime(),
      )
    : -1;
  const unreadCount =
    firstUnreadIdx >= 0
      ? items.slice(firstUnreadIdx).filter((mm) => mm.sender_type !== 'system' && !isMine(mm)).length
      : 0;
  function senderName(m: MessageRow) {
    if (!m.sender_id) return '';
    // A sender with no profile among the chat members is a deleted account —
    // their messages stay for everyone else but are shown as anonymous.
    return usernameById.get(m.sender_id) || t('chat.deletedUser');
  }

  // Reset the "landed at bottom" flag when switching chats (the component
  // instance is reused across chat routes, so the ref would otherwise persist).
  useEffect(() => {
    initialScrollDoneRef.current = false;
  }, [chatId]);

  // Scroll behavior: on first open jump straight to the newest message; after
  // that only auto-scroll when you're already near the bottom.
  const chatReady = !authLoading && !msgLoading;
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !chatReady || items.length === 0) return;
    if (!initialScrollDoneRef.current) {
      initialScrollDoneRef.current = true;
      stickBottomRef.current = true;
      // Land at the bottom RELIABLY. A single jump often falls short because the
      // final height isn't settled yet at first paint — images still decoding,
      // the keyboard/safe-area resizing, or catch-up rows arriving a tick later.
      // Re-pin over the first ~600ms (guarded by stickBottom, so it stops the
      // moment the user scrolls up).
      const pin = () => {
        const e = scrollRef.current;
        if (e && stickBottomRef.current) e.scrollTop = e.scrollHeight;
      };
      pin();
      const raf = requestAnimationFrame(pin);
      const timers = [60, 150, 350, 600].map((ms) => window.setTimeout(pin, ms));
      return () => {
        cancelAnimationFrame(raf);
        timers.forEach((t) => window.clearTimeout(t));
      };
    }
    // Re-pin to the newest message whenever content grows (new message OR media
    // finishing loading), as long as the user hasn't scrolled up.
    if (stickBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length, chatReady, signedUrls]);

  // Play a festive celebration the first time you SEE a festive message — i.e.
  // when you read it (open the chat), or live if you're already in the chat —
  // and never more than once (deduped per message id, persisted). Your own sent
  // message celebrates on send. Old history you've already seen doesn't replay.
  useEffect(() => {
    if (items.length === 0 || !effectsEnabled) return;
    const newest = items[items.length - 1];
    if (newest.id === lastEffectMsgId.current) return;
    const firstLoad = lastEffectMsgId.current === null;
    lastEffectMsgId.current = newest.id;
    if (newest.body.is_deleted) return;
    if (wasCelebrated(newest.id)) return;
    const trigger = detectEffect(newest.body.text);
    if (!trigger) return;
    const incoming = newest.sender_id !== myId;
    if (firstLoad) {
      // Opening the chat: celebrate an incoming festive message you're reading
      // now, but don't replay your own messages or old history on reopen.
      const ageMs = Date.now() - new Date(newest.created_at).getTime();
      if (!incoming || ageMs > 24 * 60 * 60 * 1000) return;
    }
    markCelebrated(newest.id);
    setEffectTrigger(trigger);
  }, [items, effectsEnabled]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollTop === 0 && hasMore && !loadingMore) {
      loadMore();
    }
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    // Keep pinning to the newest message only while the user is near the bottom.
    stickBottomRef.current = distanceFromBottom < 120;
    // Show the jump-to-latest button once the user scrolls a screenful up.
    setShowScrollDown(distanceFromBottom > 400);
  };

  function scrollToBottom() {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }

  // Collapse the composer back to one line once it's cleared (e.g. after send).
  useEffect(() => {
    const el = textInputRef.current;
    if (el && text === '') el.style.height = 'auto';
  }, [text]);

  // Activity detection: only signal "typing"/"erasing" on a REAL edit while the
  // composer is focused — not just because text sits in the box or the field has
  // the cursor. Growing text = typing; shrinking text = erasing. Auto-clears to
  // idle ~2s after the last change, and on blur.
  const prevTextLenRef = useRef<number | null>(null);
  useEffect(() => {
    const len = text.length;
    const prev = prevTextLenRef.current;
    prevTextLenRef.current = len;
    // First run (initial mount / draft restore): seed the baseline, don't signal.
    if (prev === null) return;
    // Only a focused composer means the user is actually editing right now.
    if (!composerFocusedRef.current) {
      setMeActivity(null);
      return;
    }
    let act: 'typing' | 'erasing' | null;
    if (len === 0) act = null;
    else if (len < prev) act = 'erasing';
    else act = 'typing'; // grew, or same length with changed content
    setMeActivity(act);
    if (!act) return;
    const clear = setTimeout(() => setMeActivity(null), 2000);
    return () => clearTimeout(clear);
  }, [text, setMeActivity]);

  // Broadcast "recording a voice note" while the mic is active, so the other side
  // sees a live recording indicator (like typing/erasing).
  useEffect(() => {
    if (isRecording) setMeActivity('recording');
    else setMeActivity((a) => (a === 'recording' ? null : a));
  }, [isRecording, setMeActivity]);

  // Audio recording. Recording shows a live timer; stopping produces a preview
  // the user can play, then send or discard — it is NOT sent automatically.
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Don't hardcode webm: many Android devices' MediaRecorder can't produce
      // it and silently record an empty/undecodable blob, so the sender hears
      // nothing back. Negotiate the first format the device actually supports
      // and tag the blob with the recorder's REAL mimeType — that type also
      // becomes enc.mime, so playback works on both ends.
      const preferred = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/aac',
        'audio/mpeg',
        'audio/ogg;codecs=opus',
      ];
      const canCheck = typeof MediaRecorder !== 'undefined' && typeof MediaRecorder.isTypeSupported === 'function';
      const chosen = canCheck ? preferred.find((m) => MediaRecorder.isTypeSupported(m)) : undefined;
      const recorder = chosen ? new MediaRecorder(stream, { mimeType: chosen }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      recCanceledRef.current = false;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        if (recTimerRef.current) {
          window.clearInterval(recTimerRef.current);
          recTimerRef.current = null;
        }
        setIsRecording(false);
        setIsRecPaused(false);
        if (recCanceledRef.current) {
          audioChunksRef.current = [];
          return; // discarded — nothing to preview
        }
        const type = recorder.mimeType || chosen || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type });
        setPendingAudio(blob);
      };

      recorder.start();
      setIsRecording(true);
      setIsRecPaused(false);
      setRecSeconds(0);
      startRecTimer();
    } catch (e: any) {
      setErr(t('chat.micError', { error: e.message }));
    }
  }

  function startRecTimer() {
    if (recTimerRef.current) window.clearInterval(recTimerRef.current);
    recTimerRef.current = window.setInterval(() => setRecSeconds((s) => s + 1), 1000);
  }
  function stopRecTimer() {
    if (recTimerRef.current) {
      window.clearInterval(recTimerRef.current);
      recTimerRef.current = null;
    }
  }

  // Pause/resume while recording: MediaRecorder keeps the take, and the timer
  // freezes so the clock reflects only recorded audio.
  function pauseRecording() {
    const r = mediaRecorderRef.current;
    if (r && isRecording && r.state === 'recording') {
      try { r.pause(); } catch { return; }
      stopRecTimer();
      setIsRecPaused(true);
    }
  }
  function resumeRecording() {
    const r = mediaRecorderRef.current;
    if (r && isRecording && r.state === 'paused') {
      try { r.resume(); } catch { return; }
      startRecTimer();
      setIsRecPaused(false);
    }
  }

  // Stop and keep the take (moves to the send/discard preview).
  function stopRecording() {
    if (mediaRecorderRef.current && isRecording) {
      recCanceledRef.current = false;
      mediaRecorderRef.current.stop();
    }
  }

  // Stop and throw the take away (the trash button while recording).
  function cancelRecording() {
    if (mediaRecorderRef.current && isRecording) {
      recCanceledRef.current = true;
      mediaRecorderRef.current.stop();
    }
  }

  // Discard a finished-but-unsent take.
  function discardPendingAudio() {
    setPendingAudio(null);
    audioChunksRef.current = [];
  }

  // Send the finished take, then clear the preview.
  async function sendPendingAudio() {
    const blob = pendingAudio;
    if (!blob) return;
    setPendingAudio(null);
    await sendAudioMessage(blob);
  }

  function fmtRecTime(s: number): string {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  }

  // Object URL for playing back a finished-but-unsent take; revoked when it
  // changes or the component unmounts.
  const pendingAudioUrl = useMemo(
    () => (pendingAudio ? URL.createObjectURL(pendingAudio) : null),
    [pendingAudio]
  );
  useEffect(() => {
    return () => {
      if (pendingAudioUrl) URL.revokeObjectURL(pendingAudioUrl);
    };
  }, [pendingAudioUrl]);
  // Stop the recording timer if we unmount mid-record.
  useEffect(() => {
    return () => {
      if (recTimerRef.current) window.clearInterval(recTimerRef.current);
    };
  }, []);

  async function sendAudioMessage(blob: Blob) {
    // Same re-entrancy lock as onSend: never let a double-tap send the clip twice.
    if (sendingRef.current) return;
    sendingRef.current = true;
    setBusy(true);
    try {
      const encMode = await chatMustEncrypt(chatId);
      const { path, enc } = await putMedia(blob, encMode, () => uploadChatAudio(chatId, blob));
      const payload: Payload = { audioPath: path };
      if (enc) payload.enc = { [path]: enc };
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
      await sendQueued(chatId, payload as any);
      setErr('');
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
      sendingRef.current = false;
    }
  }

  function extractAllPaths(body: Payload): string[] {
    // View-once media is never prefetched or rendered inline — it's resolved on
    // demand only when the recipient taps to open it exactly once.
    if (body.viewOnce) return [];
    const arr: string[] = [];
    if (body.imagePath) arr.push(body.imagePath);
    if (Array.isArray(body.imagePaths)) for (const p of body.imagePaths) if (p) arr.push(p);
    if (body.videoPath) arr.push(body.videoPath);
    if (body.audioPath) arr.push(body.audioPath);
    if (body.filePath) arr.push(body.filePath);
    return Array.from(new Set(arr));
  }

  // Resolve signed URLs for incoming / realtime
  useEffect(() => {
    let cancelled = false;

    async function resolveMissing() {
      // Map each media path to its per-object encryption metadata (if any).
      const encByPath = new Map<string, MediaEnc | undefined>();
      // Track which paths are videos so we can give the decrypter a MIME fallback
      // — older/camera-recorded videos were stored without a usable video type,
      // which mobile WebViews won't play from a blob URL.
      const videoPaths = new Set<string>();
      // Classify each path by media kind for auto-download gating. Unclassified
      // paths (e.g. documents) are never gated — they open on tap already.
      const kindByPath = new Map<string, MediaKind>();
      for (const m of items) {
        const b = m.body;
        for (const p of extractAllPaths(b)) {
          if (!encByPath.has(p)) encByPath.set(p, b.enc?.[p]);
        }
        if (b.imagePath) kindByPath.set(b.imagePath, 'photos');
        if (Array.isArray(b.imagePaths)) for (const p of b.imagePaths) if (p) kindByPath.set(p, 'photos');
        if (b.videoPath) { videoPaths.add(b.videoPath); kindByPath.set(b.videoPath, 'video'); }
        if (b.audioPath) kindByPath.set(b.audioPath, 'audio');
      }

      // Skip paths already resolved or already marked failed (tap-to-retry
      // clears the failed mark, which re-admits the path here).
      const candidates = Array.from(encByPath.keys()).filter(
        (p) => !signedUrls[p] && !failedMedia.has(p)
      );

      // Withhold media the current network/settings don't auto-download, unless
      // the user tapped to fetch it (manualPaths). The rest auto-resolve.
      const nextDeferred = new Set<string>();
      const missing: string[] = [];
      for (const p of candidates) {
        const kind = kindByPath.get(p);
        if (kind && !manualPaths.has(p) && !isAutoDownloadAllowed(kind, netClass, autoDownload)) {
          nextDeferred.add(p);
        } else {
          missing.push(p);
        }
      }
      // Replace the deferred set (drops paths now allowed/resolved); only when
      // it actually changed, to avoid a render loop.
      setDeferredMedia((prev) => {
        if (prev.size === nextDeferred.size && Array.from(prev).every((p) => nextDeferred.has(p))) return prev;
        return nextDeferred;
      });

      if (missing.length === 0) return;

      // Resolve a single attachment. On the first failure we refresh the auth
      // session once and retry: on native cold-start the storage request can
      // fire before the Supabase session is attached, which the RLS layer sees
      // as anon and answers "Object not found" even though the object exists
      // and the viewer is a member.
      async function resolveOne(path: string): Promise<string> {
        const enc = encByPath.get(path);
        const fallbackMime = videoPaths.has(path) ? 'video/mp4' : undefined;
        const attempt = () =>
          enc ? fetchDecryptedMediaUrl(path, enc, fallbackMime) : fetchCachedMediaUrl(path, 300);
        try {
          return await attempt();
        } catch {
          try {
            await browserSupabase().auth.getSession();
          } catch {}
          return attempt();
        }
      }

      // Resolve independently so one bad attachment can't reject the batch or
      // surface a raw "Object not found" banner over the whole conversation.
      const results = await Promise.allSettled(
        missing.map(async (path) => {
          const url = await resolveOne(path);
          // Encrypted media and cached plain media both return blob: object
          // URLs that must be revoked on unmount; streamed video returns an
          // https signed URL that must not be revoked.
          if (url.startsWith('blob:')) trackObjectUrl(url);
          return [path, url] as const;
        })
      );

      if (cancelled) return;

      const resolved: Array<readonly [string, string]> = [];
      const failed: string[] = [];
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') resolved.push(r.value);
        else failed.push(missing[i]);
      });

      if (resolved.length) {
        setSignedUrls((prev) => {
          const next = { ...prev };
          for (const [p, u] of resolved) next[p] = u;
          return next;
        });
      }
      if (failed.length) {
        setFailedMedia((prev) => {
          const next = new Set(prev);
          for (const p of failed) next.add(p);
          return next;
        });
      }
    }

    resolveMissing();
    return () => {
      cancelled = true;
    };
  }, [items, signedUrls, failedMedia, autoDownload, netClass, manualPaths]);

  // User tapped a withheld media tile: fetch it now (overrides auto-download).
  function downloadDeferred(path: string) {
    setManualPaths((prev) => new Set(prev).add(path));
    setDeferredMedia((prev) => {
      if (!prev.has(path)) return prev;
      const next = new Set(prev);
      next.delete(path);
      return next;
    });
  }

  // "Ver una vez": load who has opened which one-time message, and keep it live.
  // My own opens lock the bubble for me; others' opens tell me (the sender) it
  // was seen. RLS scopes rows to chat members.
  useEffect(() => {
    if (!chatId || !myId) return;
    let alive = true;
    const load = () =>
      getChatMessageViews(chatId).then((rows) => {
        if (!alive) return;
        const mine = new Set<string>();
        const others = new Set<string>();
        for (const r of rows) (r.userId === myId ? mine : others).add(r.messageId);
        setMyViewedIds(mine);
        setOpenedByOthers(others);
      });
    load();
    const supabase = browserSupabase();
    const ch = supabase
      .channel(`views:${chatId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'message_views', filter: `chat_id=eq.${chatId}` },
        (payload: any) => {
          const row = payload.new;
          if (!row) return;
          if (row.user_id === myId) setMyViewedIds((p) => new Set(p).add(row.message_id));
          else setOpenedByOthers((p) => new Set(p).add(row.message_id));
        },
      )
      .subscribe();
    return () => {
      alive = false;
      supabase.removeChannel(ch);
    };
  }, [chatId, myId]);

  // Event RSVPs: load the chat's RSVPs and keep them live (own isolated channel,
  // like message_views, to avoid threading through the shared realtime hook).
  useEffect(() => {
    if (!chatId) return;
    let alive = true;
    const load = () => getChatEventRsvps(chatId).then((rows) => { if (alive) setRsvps(rows); });
    load();
    const supabase = browserSupabase();
    const ch = supabase
      .channel(`rsvps:${chatId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_rsvps', filter: `chat_id=eq.${chatId}` }, load)
      .subscribe();
    return () => { alive = false; supabase.removeChannel(ch); };
  }, [chatId]);

  // Opening a chat is a good moment to flush any offline-queued sends.
  useEffect(() => { void flushQueue(); }, [chatId]);

  const rsvpByMessage = useMemo(() => {
    const map = new Map<string, { going: number; maybe: number; no: number; mine: EventRsvpStatus | null }>();
    for (const r of rsvps) {
      const e = map.get(r.messageId) ?? { going: 0, maybe: 0, no: 0, mine: null };
      e[r.status] += 1;
      if (r.userId === myId) e.mine = r.status;
      map.set(r.messageId, e);
    }
    return map;
  }, [rsvps, myId]);

  async function onCreateEvent(ev: NewEvent) {
    const payload: Payload = { event: ev };
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
    await sendQueued(chatId, payload as any);
  }

  async function onSetRsvp(messageId: string, status: EventRsvpStatus) {
    // Optimistic: reflect my choice immediately, then persist.
    setRsvps((prev) => {
      const without = prev.filter((r) => !(r.messageId === messageId && r.userId === myId));
      return myId ? [...without, { messageId, userId: myId, status }] : without;
    });
    try {
      await setEventRsvp(messageId, chatId, status);
    } catch (e: any) {
      setErr(sendErrorMessage(e));
    }
  }

  // Open a view-once photo/video: resolve its URL on demand (so it isn't
  // prefetched), record the open, then show the one-time viewer. Re-opening is
  // blocked by myViewedIds once recorded.
  async function openViewOnce(m: MessageRow & { body: Payload }) {
    const body = m.body;
    const path = body.videoPath || body.imagePaths?.[0] || body.imagePath;
    if (!path || viewOnceLoadingId) return;
    const kind: 'photo' | 'video' = body.videoPath ? 'video' : 'photo';
    setViewOnceLoadingId(m.id);
    try {
      const enc = body.enc?.[path];
      const url = enc
        ? await fetchDecryptedMediaUrl(path, enc, kind === 'video' ? 'video/mp4' : undefined)
        : await fetchCachedMediaUrl(path, 300);
      // Record the open first so a reload can't re-reveal it; ignore failures so
      // a flaky write never blocks the one view the recipient is owed.
      try { await markMessageViewed(m.id); } catch {}
      setMyViewedIds((p) => new Set(p).add(m.id));
      setViewOnceOpen({ url, kind, blob: url.startsWith('blob:') });
    } catch {
      setErr(t('viewOnce.openError'));
    } finally {
      setViewOnceLoadingId(null);
    }
  }
  function closeViewOnce() {
    setViewOnceOpen((cur) => {
      if (cur?.blob) { try { URL.revokeObjectURL(cur.url); } catch {} }
      return null;
    });
  }

  // Tap-to-retry: drop the failed mark so the resolver effect re-admits it.
  function retryMedia(path: string) {
    setFailedMedia((prev) => {
      if (!prev.has(path)) return prev;
      const next = new Set(prev);
      next.delete(path);
      return next;
    });
  }

  // Auto-retry transient failures so the user doesn't have to tap. The first
  // resolve can fail on a cold-start auth/session race; retry each failed path
  // a couple of times a short moment later (by clearing its failed mark, which
  // re-admits it to the resolver). Bounded per-path so a genuinely unreadable
  // object settles on the manual tap-to-retry tile instead of spinning.
  const autoRetryCountRef = useRef<Map<string, number>>(new Map());
  useEffect(() => {
    if (failedMedia.size === 0) return;
    const retriable = Array.from(failedMedia).filter(
      (p) => (autoRetryCountRef.current.get(p) ?? 0) < 2
    );
    if (retriable.length === 0) return;
    const id = window.setTimeout(() => {
      for (const p of retriable) {
        autoRetryCountRef.current.set(p, (autoRetryCountRef.current.get(p) ?? 0) + 1);
      }
      setFailedMedia((prev) => {
        const next = new Set(prev);
        for (const p of retriable) next.delete(p);
        return next;
      });
    }, 1500);
    return () => window.clearTimeout(id);
  }, [failedMedia]);

  // -------- Multi-select
  function enterSelect(id: string) {
    setSelectMode(true);
    setSelectedIds(new Set([id]));
  }
  function exitSelect() {
    setSelectMode(false);
    setSelectedIds(new Set());
  }
  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      if (n.size === 0) setSelectMode(false);
      return n;
    });
  }
  async function bulkDelete() {
    const ids = Array.from(selectedIds);
    exitSelect();
    setBusy(true);
    try {
      for (const id of ids) await hideMessageForMe(id, chatId);
    } catch (e: any) {
      setErr(sendErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  // -------- Forward
  //
  // Forwarding must RE-MATERIALIZE media into the destination chat. The stored
  // object's read access is scoped by storage RLS to the SOURCE chat's members,
  // and the per-object decryption key lives only inside the source message — so
  // copying the payload verbatim (the old behavior) handed the new recipient a
  // path they can't read and, in encrypted chats, no key: it rendered as
  // "object not found". Instead we fetch + decrypt the source bytes and
  // re-upload (re-encrypting for the destination chat's mode) to mint a fresh
  // path + enc for every attachment.
  async function fetchSourceBlob(path: string, enc?: MediaEnc): Promise<Blob> {
    const signed = await createSignedChatMediaUrl(path, 300);
    const res = await fetch(signed);
    if (!res.ok) throw new Error(t('chat.forwardMediaUnavailable'));
    if (enc) return decryptMedia(await res.arrayBuffer(), enc);
    return res.blob();
  }

  // The primary shareable attachment of a message (document, image, video or
  // audio), if any.
  function primaryMediaPath(body: Payload): string | undefined {
    return body.filePath || body.imagePath || body.imagePaths?.[0] || body.videoPath || body.audioPath;
  }
  function shareFileName(body: Payload, blob: Blob): string {
    if (body.fileName) return body.fileName;
    const ext = ((blob.type.split('/')[1] || 'bin').split(';')[0]) || 'bin';
    const base = body.filePath ? 'file' : body.videoPath ? 'video' : body.audioPath ? 'audio' : 'image';
    return `${base}.${ext}`;
  }

  // Share a message's attachment out to another app. In the native app the
  // decrypted bytes go through the OS share sheet (@capacitor/share); on the web
  // we use the Web Share API when available, else fall back to a download.
  async function shareMessageMedia(body: Payload) {
    const path = primaryMediaPath(body);
    if (!path) return;
    try {
      const blob = await fetchSourceBlob(path, body.enc?.[path]);
      const name = shareFileName(body, blob);
      if (canNativeFiles()) {
        await shareNativeFile(blob, name);
        return;
      }
      const file = new File([blob], name, { type: blob.type || 'application/octet-stream' });
      const nav = navigator as Navigator & { canShare?: (d?: any) => boolean };
      if (nav.canShare?.({ files: [file] }) && typeof navigator.share === 'function') {
        await navigator.share({ files: [file] });
        return;
      }
      // Fallback: hand the file to the browser as a download.
      const u = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = u;
      a.download = name;
      a.click();
      setTimeout(() => { try { URL.revokeObjectURL(u); } catch {} }, 4000);
    } catch (e: any) {
      // A user-cancelled share sheet rejects too — don't surface that as an error.
      if (e?.name !== 'AbortError') setErr(sendErrorMessage(e));
    }
  }

  async function reuploadForForward(
    path: string,
    srcEnc: MediaEnc | undefined,
    destChatId: string,
    destEnc: boolean,
    kind: 'image' | 'video' | 'audio' | 'file',
    name?: string,
  ): Promise<{ path: string; enc?: MediaEnc }> {
    const blob = await fetchSourceBlob(path, srcEnc);
    if (destEnc) return uploadEncryptedChatMedia({ chatId: destChatId, file: blob });
    if (kind === 'file') {
      const f = new File([blob], name || 'file', { type: blob.type || 'application/octet-stream' });
      const u = await uploadChatFile(destChatId, f);
      return { path: u.path };
    }
    const u = await uploadChatMedia({ chatId: destChatId, file: blob, kind, name });
    return { path: u.path };
  }

  async function buildForwardPayload(body: Payload, destChatId: string): Promise<Payload> {
    const destEnc = await chatMustEncrypt(destChatId);
    const out: Payload = {};
    if (body.text) out.text = body.text;
    const encMap: Record<string, MediaEnc> = {};
    const srcEncAt = (p: string) => body.enc?.[p];

    const imgs =
      Array.isArray(body.imagePaths) && body.imagePaths.length
        ? body.imagePaths.filter(Boolean)
        : body.imagePath
        ? [body.imagePath]
        : [];
    if (imgs.length) {
      const newPaths: string[] = [];
      for (const p of imgs) {
        const r = await reuploadForForward(p, srcEncAt(p), destChatId, destEnc, 'image');
        newPaths.push(r.path);
        if (r.enc) encMap[r.path] = r.enc;
      }
      out.imagePaths = newPaths;
    }
    if (body.videoPath) {
      const r = await reuploadForForward(body.videoPath, srcEncAt(body.videoPath), destChatId, destEnc, 'video');
      out.videoPath = r.path;
      if (r.enc) encMap[r.path] = r.enc;
      if (body.videoTrimStart != null) out.videoTrimStart = body.videoTrimStart;
      if (body.videoTrimEnd != null) out.videoTrimEnd = body.videoTrimEnd;
    }
    if (body.audioPath) {
      const r = await reuploadForForward(body.audioPath, srcEncAt(body.audioPath), destChatId, destEnc, 'audio');
      out.audioPath = r.path;
      if (r.enc) encMap[r.path] = r.enc;
    }
    if (body.filePath) {
      const r = await reuploadForForward(body.filePath, srcEncAt(body.filePath), destChatId, destEnc, 'file', body.fileName);
      out.filePath = r.path;
      if (r.enc) encMap[r.path] = r.enc;
      if (body.fileName) out.fileName = body.fileName;
      if (body.fileSize) out.fileSize = body.fileSize;
      if (body.fileMime) out.fileMime = body.fileMime;
    }
    if (Object.keys(encMap).length) out.enc = encMap;
    return out;
  }

  async function confirmForward(destChatIds: string[]) {
    const bodies: Payload[] =
      selectMode && selectedIds.size
        ? items.filter((m) => selectedIds.has(m.id) && !m.body.is_deleted).map((m) => m.body)
        : forwardBody
        ? [forwardBody]
        : [];
    if (!bodies.length) {
      if (selectMode) exitSelect();
      return;
    }
    for (const dest of destChatIds) {
      for (const body of bodies) {
        const payload = await buildForwardPayload(body, dest);
        await sendMessage(dest, payload as any);
      }
    }
    if (selectMode) exitSelect();
  }

  // -------- Actions Sheet
  function openActions(messageId: string, body: Payload) {
    impact();
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

  // ----- Swipe-to-reply (drag a bubble right to quote it) -----
  const SWIPE_TRIGGER = 56; // px pull that commits to a reply
  function onMsgPointerDown(e: React.PointerEvent, m: MessageRow & { body: Payload }) {
    if (selectMode || m.body.is_deleted || m.sender_type === 'system') return;
    swipeStart.current = { x: e.clientX, y: e.clientY, id: m.id, decided: 'none' };
    // NOTE: do NOT setPointerCapture here. Capturing on pointerdown redirects the
    // eventual `click` to the bubble instead of the inner button that was tapped
    // (attachment card, reaction, etc.), so those buttons stopped working. We
    // capture only once the gesture is confirmed HORIZONTAL (in onMsgPointerMove).
    startLongPress(m.id, m.body);
  }
  function onMsgPointerMove(e: React.PointerEvent, m: MessageRow & { body: Payload }) {
    const s = swipeStart.current;
    if (!s || s.id !== m.id) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (s.decided === 'none') {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      s.decided = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
      // Now that it's a real horizontal swipe, capture the pointer so the drag
      // keeps getting events even if the finger leaves the bubble. Done here (not
      // on pointerdown) so a plain tap never captures and inner buttons still fire.
      if (s.decided === 'h') {
        try {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        } catch {
          /* not all pointers support capture */
        }
      }
    }
    if (s.decided !== 'h') {
      clearLongPress(); // vertical → let the list scroll, no reply
      return;
    }
    clearLongPress();
    setSwipe({ id: m.id, dx: Math.max(0, Math.min(80, dx)) }); // rightward pull only
  }
  function onMsgPointerUp(e: React.PointerEvent, m: MessageRow & { body: Payload }) {
    const s = swipeStart.current;
    clearLongPress();
    if (s && s.id === m.id && s.decided === 'h' && e.clientX - s.x >= SWIPE_TRIGGER) {
      setReplyingTo(m);
      tap();
    }
    swipeStart.current = null;
    setSwipe(null);
  }
  function onMsgPointerCancel() {
    clearLongPress();
    swipeStart.current = null;
    setSwipe(null);
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
    setComposeViewOnce(false);
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
    setPendingVideoTrim(null);
    setComposeViewOnce(false);
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
    setErr('');
    fileInputRef.current?.click();
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setErr('');
    setBusy(true);
    try {
      const encMode = await chatMustEncrypt(chatId);
      let payload: Payload;
      if (encMode) {
        const { path, enc } = await uploadEncryptedChatMedia({ chatId, file });
        const localUrl = URL.createObjectURL(file);
        trackObjectUrl(localUrl);
        setSignedUrls((prev) => ({ ...prev, [path]: localUrl }));
        payload = {
          filePath: path,
          fileName: sanitizeFilename(file.name),
          fileSize: file.size,
          fileMime: file.type || 'application/octet-stream',
          enc: { [path]: enc },
        };
      } else {
        const uploaded = await uploadChatFile(chatId, file);
        payload = {
          filePath: uploaded.path,
          fileName: uploaded.name,
          fileSize: uploaded.size,
          fileMime: uploaded.mime,
        };
        try {
          const url = await createSignedChatMediaUrl(uploaded.path, 300);
          setSignedUrls((prev) => ({ ...prev, [uploaded.path]: url }));
        } catch {}
      }
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
      await sendQueued(chatId, payload as any);
      setErr('');
    } catch (e: any) {
      setErr(sendErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  // -------- Input change: images
  async function onImagesChange(e: React.ChangeEvent<HTMLInputElement>) {
    setErr('');
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    const allowed = new Set(['image/jpeg', 'image/png', 'image/webp']);
    // Generous cap on the picked original: 'standard'/'high' downscale well
    // under this, and 'original' uploads up to the storage image limit.
    const maxSize = 16 * 1024 * 1024;
    const MAX_FILES = 6;

    const picked = files.slice(0, MAX_FILES);

    // Validate the picked types up front.
    for (const f of picked) {
      if (!allowed.has(f.type)) {
        setErr(t('chat.onlyJpgPngWebp'));
        e.target.value = '';
        return;
      }
    }
    e.target.value = '';

    // Copy the picked files into memory RIGHT AWAY. On some Android WebViews the
    // File points at a content:// reference whose read permission is revoked
    // shortly after the picker returns — later reads (preview, encrypt, upload)
    // then fail with "The requested file could not be read…". Reading the bytes
    // now, into a stable in-memory File, sidesteps that for preview + send.
    // We keep the ORIGINAL bytes here; the chosen send quality is applied at
    // send time, so the per-send quality toggle stays instant and lossless
    // until the user actually sends.
    const inMemory: File[] = [];
    for (const f of picked) {
      try {
        const buf = await f.arrayBuffer();
        const safe = sanitizeFilename(f.name) || `image_${Date.now()}.jpg`;
        inMemory.push(new File([buf], safe, { type: f.type || 'image/jpeg' }));
      } catch {
        setErr(t('chat.imageReadFailed'));
      }
    }
    if (inMemory.length === 0) return;

    for (const f of inMemory) {
      if (f.size > maxSize) {
        setErr(t('chat.maxImageSize'));
        return;
      }
    }

    if (pendingVideo) clearPendingVideo();

    const urls = inMemory.map((f) => URL.createObjectURL(f));

    setPendingImages((prev) => [...prev, ...inMemory].slice(0, MAX_FILES));
    setPreviewImages((prev) => [...prev, ...urls].slice(0, MAX_FILES));
  }

  // Paste a screenshot / copied image straight into the composer (mainly the web
  // build, where users copy-paste captures). Turns any image on the clipboard
  // into an attachment through the same pipeline as picking a file; plain-text
  // pastes fall through untouched.
  async function onComposerPaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const items = e.clipboardData?.items;
    if (!items) return;
    const images: File[] = [];
    for (const it of Array.from(items)) {
      if (it.kind === 'file' && it.type.startsWith('image/')) {
        const f = it.getAsFile();
        if (f) {
          images.push(
            f.name ? f : new File([f], `pegado_${Date.now()}.png`, { type: f.type || 'image/png' })
          );
        }
      }
    }
    if (images.length === 0) return; // ordinary text paste — leave it alone
    e.preventDefault();
    try {
      const dt = new DataTransfer();
      images.forEach((f) => dt.items.add(f));
      await onImagesChange({ target: { files: dt.files, value: '' } } as unknown as React.ChangeEvent<HTMLInputElement>);
    } catch {
      setErr(t('chat.imageReadFailed'));
    }
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

    // Copy the bytes into memory RIGHT AWAY. On Android the picked File is backed
    // by a content:// reference whose read permission is revoked shortly after the
    // picker returns — reading it later (preview, trim, encrypt, upload) then
    // fails with "The requested file could not be read…". Reading now, into a
    // stable in-memory File, sidesteps that for both preview and send. (Mirrors
    // what onImagesChange already does.)
    let normalized: File;
    try {
      const buf = await file.arrayBuffer();
      // Force a real video MIME. Phone cameras often hand back a File whose type
      // is empty or "application/octet-stream"; if we keep that, the attachment is
      // stored/encrypted without a video type and the recipient's Android/iOS
      // WebView refuses to play it (desktop browsers sniff, so it works there).
      const rawType = (file.type || '').toLowerCase();
      const videoType = rawType.startsWith('video/') ? rawType : 'video/mp4';
      normalized = new File([buf], safeName, { type: videoType });
    } catch {
      setErr(t('chat.videoReadFailed'));
      e.target.value = '';
      return;
    }

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
    // Re-entrancy guard: bail if a send is already in flight (see sendingRef).
    if (sendingRef.current) return;
    setErr('');
    const t2 = text.trim();
    if (t2) tap();

    if (editingId) {
      if (!t2) return;
      sendingRef.current = true;
      setBusy(true);
      try {
        await editMessage(editingId, t2);
        setEditingId(null);
        setText('');
      } catch (e: any) {
        setErr(sendErrorMessage(e));
      } finally {
        setBusy(false);
        sendingRef.current = false;
      }
      return;
    }

    if (!t2 && pendingImages.length === 0 && !pendingVideo) return;

    sendingRef.current = true;
    setBusy(true);

    try {
      // VIDEO
      if (pendingVideo) {
        const encMode = await chatMustEncrypt(chatId);
        const { path, enc } = await putMedia(pendingVideo, encMode, () =>
          uploadChatMedia({ chatId, file: pendingVideo, kind: 'video' }),
        );

        const payload: Payload = t2 ? { text: t2, videoPath: path } : { videoPath: path };
        if (enc) payload.enc = { [path]: enc };
        if (composeViewOnce) payload.viewOnce = true;
        if (pendingVideoTrim) {
          payload.videoTrimStart = Math.round(pendingVideoTrim.start * 10) / 10;
          payload.videoTrimEnd = Math.round(pendingVideoTrim.end * 10) / 10;
        }
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

        await sendQueued(chatId, payload as any);
        setErr('');
        return;
      }

      // IMAGES (multi)
      if (pendingImages.length > 0) {
        const encMode = await chatMustEncrypt(chatId);
        // Apply the chosen send quality just before upload (originals are kept
        // in pendingImages so the toggle stays lossless until send).
        const toSend = await Promise.all(
          pendingImages.map((file) => compressImageForSend(file, sendQuality)),
        );
        const results = await Promise.all(
          toSend.map((file) => putMedia(file, encMode, () => uploadChatImage(chatId, file))),
        );
        const paths = results.map((r) => r.path);

        const payload: Payload = t2 ? { text: t2, imagePaths: paths } : { imagePaths: paths };
        const encMap: Record<string, MediaEnc> = {};
        for (const r of results) if (r.enc) encMap[r.path] = r.enc;
        if (Object.keys(encMap).length) payload.enc = encMap;
        if (composeViewOnce) payload.viewOnce = true;
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

        await sendQueued(chatId, payload as any);
        setErr('');
        return;
      }

      // TEXT
      const payload: Payload = { text: t2 };
      if (replyingTo) payload.reply_to = replyingTo.id;
      if (isGroup) {
        const mentions = extractMentionIds(t2, usernameToId, myId ?? undefined);
        if (mentions.length) payload.mentions = mentions;
      }

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
      setMentionQuery(null);
      await sendQueued(chatId, payload as any);
      setErr('');
    } catch (e: any) {
      setErr(sendErrorMessage(e));
    } finally {
      setBusy(false);
      sendingRef.current = false;
    }
  }

  const loading = authLoading || msgLoading;

  return (
    <div className={`relative flex ${embedded ? 'h-full w-full' : 'h-[100dvh]'} flex-col overflow-hidden bg-slate-950 text-slate-50`}>
      {selectMode && (
        <div className={`toky-glass absolute inset-x-0 top-0 z-40 flex items-center gap-2 border-b border-slate-800/70 px-2 py-2 ${embedded ? '' : 'pt-safe'}`}>
          <button
            type="button"
            onClick={exitSelect}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-300 hover:bg-slate-900 hover:text-white"
            aria-label={t('common.cancel')}
          >
            <XIcon size={20} />
          </button>
          <span className="flex-1 text-sm font-semibold">{selectedIds.size} {t('chat.selected')}</span>
          <button
            type="button"
            onClick={() => setForwardOpen(true)}
            disabled={selectedIds.size === 0}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-300 hover:bg-slate-900 hover:text-white disabled:opacity-40"
            aria-label={t('chat.actionForward')}
            title={t('chat.actionForward')}
          >
            <ForwardIcon size={20} />
          </button>
          <button
            type="button"
            onClick={bulkDelete}
            disabled={selectedIds.size === 0 || busy}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-rose-300 hover:bg-rose-950/40 disabled:opacity-40"
            aria-label={t('chat.actionDeleteForMe')}
            title={t('chat.actionDeleteForMe')}
          >
            <TrashIcon size={20} />
          </button>
        </div>
      )}
      <header className={`toky-glass relative z-40 flex items-center gap-1.5 border-b border-slate-800/70 px-2 py-2 ${embedded ? '' : 'pt-safe'}`}>
        {!embedded && (
          <Link
            href="/chats"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-300 hover:bg-slate-900 hover:text-white"
            aria-label={t('messageActions.back')}
          >
            <ChevronLeftIcon size={24} />
          </Link>
        )}

        {/* Rounded-square avatar of the person/group you're chatting with */}
        <button
          type="button"
          onClick={() => { if (isGroup) setGroupInfoOpen(true); else if (otherUserId) setUserInfoId(otherUserId); }}
          className="shrink-0"
          aria-label={headerName}
        >
          {headerAvatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={headerAvatar} alt="" className="h-10 w-10 rounded-xl border border-slate-800 object-cover" />
          ) : (
            <span
              className="grid h-10 w-10 place-items-center rounded-xl text-sm font-bold text-white shadow-sm shadow-black/25 ring-1 ring-white/20"
              style={{ backgroundImage: avatarBg(headerName) }}
            >
              {initials(headerName)}
            </span>
          )}
        </button>

        {/* Name + connection status */}
        <button
          type="button"
          onClick={() => { if (isGroup) setGroupInfoOpen(true); else if (otherUserId) setUserInfoId(otherUserId); }}
          className="min-w-0 flex-1 px-1 text-left"
        >
          <div className="truncate text-base font-semibold leading-tight">{headerName}</div>
          {headerStatus && (
            <div className={`truncate text-xs leading-tight ${isDirect && someoneOnline ? 'text-emerald-400' : 'text-slate-400'}`}>
              {headerStatus}
            </div>
          )}
        </button>

        {/* Actions: audio call, video call, search, options */}
        {otherUserId && (
          <>
            <button
              type="button"
              onClick={() => startCall({ chatId, peerIds: [otherUserId], label: headerName, video: false, isGroup: false })}
              disabled={callBusy}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-300 hover:bg-slate-900 hover:text-white disabled:opacity-40"
              aria-label={t('call.startAudio')}
              title={t('call.startAudio')}
            >
              <PhoneIcon size={20} />
            </button>
            <button
              type="button"
              onClick={() => startCall({ chatId, peerIds: [otherUserId], label: headerName, video: true, isGroup: false })}
              disabled={callBusy}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-300 hover:bg-slate-900 hover:text-white disabled:opacity-40"
              aria-label={t('call.startVideo')}
              title={t('call.startVideo')}
            >
              <VideoIcon size={20} />
            </button>
          </>
        )}
        {isGroup && otherMemberIds.length > 0 && (
          <>
            <button
              type="button"
              onClick={() => startCall({ chatId, peerIds: otherMemberIds, label: chat?.title || t('chatsList.group'), video: false, isGroup: true })}
              disabled={callBusy}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-300 hover:bg-slate-900 hover:text-white disabled:opacity-40"
              aria-label={t('call.startGroupAudio')}
              title={t('call.startGroupAudio')}
            >
              <PhoneIcon size={20} />
            </button>
            <button
              type="button"
              onClick={() => startCall({ chatId, peerIds: otherMemberIds, label: chat?.title || t('chatsList.group'), video: true, isGroup: true })}
              disabled={callBusy}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-300 hover:bg-slate-900 hover:text-white disabled:opacity-40"
              aria-label={t('call.startGroupVideo')}
              title={t('call.startGroupVideo')}
            >
              <VideoIcon size={20} />
            </button>
          </>
        )}
        <div className="relative" ref={optionsMenuRef}>
            <button
              type="button"
              onClick={() => setSafetyMenuOpen((v) => !v)}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-300 hover:bg-slate-900 hover:text-white"
              aria-label={t('chat.chatOptions')}
            >
              <MoreVerticalIcon size={20} />
            </button>
            {safetyMenuOpen && (
              <>
              <div
                className="absolute right-0 top-11 z-50 w-56 overflow-hidden rounded-xl border border-slate-700 bg-slate-900 text-sm shadow-2xl ring-1 ring-black/50"
                onMouseLeave={() => {
                  setSafetyMenuOpen(false);
                  setDisappearingMenuOpen(false);
                }}
              >
                {/* Moved out of the header to keep the title readable */}
                <button
                  type="button"
                  onClick={() => { setSafetyMenuOpen(false); setSearchOpen(true); }}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-slate-200 hover:bg-slate-900"
                >
                  <SearchIcon size={16} /> {t('chat.searchInChat')}
                </button>
                <button
                  type="button"
                  onClick={() => { setSafetyMenuOpen(false); setStarredOpen(true); }}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-slate-200 hover:bg-slate-900"
                >
                  <StarGlyph size={16} /> {t('chat.starredTitle')}
                </button>
                {isGroup && (
                  <button
                    type="button"
                    onClick={() => { setSafetyMenuOpen(false); setGroupInfoOpen(true); }}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-slate-200 hover:bg-slate-900"
                  >
                    <InfoIcon size={16} /> {t('chat.groupInfo')}
                  </button>
                )}
                {otherUserId && (
                  <button
                    type="button"
                    onClick={() => { setSafetyMenuOpen(false); setSafetyOpen(true); }}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-slate-200 hover:bg-slate-900"
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      <path d="m9 12 2 2 4-4" />
                    </svg>
                    {t('safety.title')}
                  </button>
                )}
                <button
                  type="button"
                  onClick={toggleChatLock}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-slate-200 hover:bg-slate-900"
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="4" y="11" width="16" height="9" rx="2" />
                    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                  </svg>
                  {chatLocked ? t('chatLock.unlockChat') : t('chatLock.lockChat')}
                </button>
                <div className="my-1 border-t border-slate-800/70" />
                {otherUserId && (<>
                <button
                  type="button"
                  onClick={() => (muted ? unmute() : setMuteMenuOpen((v) => !v))}
                  disabled={muteBusy}
                  className="block w-full px-3 py-2 text-left text-slate-200 hover:bg-slate-900 disabled:opacity-50"
                >
                  {muted ? t('userInfo.unmuteNotifs') : t('userInfo.mute')}
                </button>
                {!muted && muteMenuOpen && (
                  <div className="border-t border-slate-900 bg-slate-950/60">
                    {[
                      { ms: 8 * 3600e3, key: 'mute8h' },
                      { ms: 7 * 24 * 3600e3, key: 'mute1w' },
                      { ms: null as number | null, key: 'muteForever' },
                    ].map((opt) => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => { muteFor(opt.ms); setMuteMenuOpen(false); }}
                        disabled={muteBusy}
                        className="block w-full px-4 py-1.5 text-left text-xs text-slate-300 hover:bg-slate-900 disabled:opacity-50"
                      >
                        {t(`userInfo.${opt.key}`)}
                      </button>
                    ))}
                  </div>
                )}
                </>)}
                {otherUserId && (<>
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
                  onClick={enableEncryption}
                  disabled={encBusy || !!chat?.encrypted}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-slate-200 hover:bg-slate-900 disabled:opacity-100"
                >
                  <span>{t('chat.encryptionMenu')}</span>
                  <span className="text-xs text-slate-400">
                    {chat?.encrypted ? `🔒 ${t('chat.encryptionOn')}` : t('chat.encryptionOff')}
                  </span>
                </button>
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
                </>)}
              </div>
              </>
            )}
          </div>
      </header>

      <MessageEffects trigger={effectTrigger} onDone={() => setEffectTrigger(null)} />

      <ForwardModal
        open={forwardOpen}
        chats={chats}
        loading={chatsLoading}
        onClose={() => setForwardOpen(false)}
        onConfirm={confirmForward}
      />

      <DocumentPreview
        open={!!docPreview}
        onClose={() => setDocPreview(null)}
        srcKey={docPreview?.filePath}
        load={docPreview?.filePath
          ? () => fetchSourceBlob(docPreview.filePath!, docPreview.enc?.[docPreview.filePath!])
          : undefined}
        httpUrl={docPreview?.filePath && !docPreview.enc?.[docPreview.filePath]
          ? (opts) => createSignedChatMediaUrl(
              docPreview.filePath!,
              300,
              opts?.download ? { download: docPreview.fileName || true } : undefined,
            )
          : undefined}
        fileName={docPreview?.fileName}
        fileSize={docPreview?.fileSize}
        fileMime={docPreview?.fileMime}
        onResend={docPreview ? () => {
          setForwardBody(docPreview);
          setForwardOpen(true);
        } : undefined}
      />

      {seenByMsgId && (
        <SeenBySheet
          messageId={seenByMsgId}
          members={memberProfiles}
          myId={myId}
          onClose={() => setSeenByMsgId(null)}
        />
      )}

      <MessageActionsSheet
        open={actionsOpen}
        onClose={() => setActionsOpen(false)}
        title={actionsMsg?.id}
        actions={[
          ...(actionsMsg && items.find((m) => m.id === actionsMsg.id)?.sender_id === myId && !actionsMsg.body.imagePath && !actionsMsg.body.imagePaths?.length && !actionsMsg.body.videoPath && !actionsMsg.body.audioPath
            ? [{
                key: 'edit',
                label: t('chat.actionEdit'),
                icon: <PencilIcon size={18} />,
                onClick: () => {
                  if (!actionsMsg) return;
                  setEditingId(actionsMsg.id);
                  setText(actionsMsg.body.text || '');
                  setReplyingTo(null);
                  textInputRef.current?.focus();
                },
              }]
            : []),
          ...(actionsMsg && isGroup
            && items.find((m) => m.id === actionsMsg.id)?.sender_id === myId
            && items.find((m) => m.id === actionsMsg.id)?.sender_type !== 'system'
            ? [{
                key: 'seenBy',
                label: t('chat.seenBy'),
                icon: <EyeIcon size={18} />,
                onClick: () => {
                  if (actionsMsg) setSeenByMsgId(actionsMsg.id);
                  setActionsOpen(false);
                },
              }]
            : []),
          { key: 'reply', label: t('chat.actionReply'), icon: <ReplyIcon size={18} />, onClick: () => {
            const found = items.find(m => m.id === actionsMsg?.id);
            if (found) setReplyingTo(found as any);
            setActionsOpen(false);
          }},
          ...(actionsMsg && !actionsMsg.body.viewOnce
            ? [{
                key: 'forward',
                label: t('chat.actionForward'),
                icon: <ForwardIcon size={18} />,
                onClick: () => {
                  if (!actionsMsg) return;
                  setForwardBody(actionsMsg.body);
                  setForwardOpen(true);
                },
              }]
            : []),
          ...(actionsMsg && primaryMediaPath(actionsMsg.body) && !actionsMsg.body.viewOnce
            ? [{
                key: 'share',
                label: t('chat.actionShare'),
                icon: <ExternalLinkIcon size={18} />,
                onClick: () => {
                  const body = actionsMsg?.body;
                  setActionsOpen(false);
                  if (body) shareMessageMedia(body);
                },
              }]
            : []),
          {
            key: 'copy',
            label: t('chat.actionCopy'),
            icon: <CopyIcon size={18} />,
            onClick: async () => {
              if (!actionsMsg) return;
              await doCopy(actionsMsg.body);
              toast(t('chat.copied'));
            },
          },
          {
            key: 'star',
            label: starredIds.has(actionsMsg?.id ?? '') ? t('chat.actionUnstar') : t('chat.actionStar'),
            icon: <StarGlyph filled={starredIds.has(actionsMsg?.id ?? '')} />,
            onClick: () => {
              if (!actionsMsg) return;
              setActionsOpen(false);
              void toggleStar(actionsMsg.id);
            },
          },
          {
            key: 'select',
            label: t('chat.actionSelect'),
            icon: <CheckIcon size={18} />,
            onClick: () => {
              if (!actionsMsg) return;
              setActionsOpen(false);
              enterSelect(actionsMsg.id);
            },
          },
          { key: 'save', label: t('chat.actionSave'), icon: <DownloadIcon size={18} />, onClick: () => toast(t('chat.savePending')) },
          {
            key: 'delete-me',
            label: t('chat.actionDeleteForMe'),
            icon: <EyeOffIcon size={18} />,
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
                icon: <TrashIcon size={18} />,
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
            icon: <PinIcon size={18} />,
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
                setErr(sendErrorMessage(e));
              }
            },
          },
          {
            key: 'report',
            label: t('chat.actionReport'),
            icon: <FlagIcon size={18} />,
            onClick: () => {
              if (!actionsMsg) return;
              setReportMessageId(actionsMsg.id);
              setReportOpen(true);
            },
          },
          ...(actionsMsg?.body.text
            ? [{
                key: 'translate',
                label: t('ai.translate'),
                icon: <GlobeIcon size={18} />,
                onClick: () => {
                  if (!actionsMsg?.body.text) return;
                  onTranslate(actionsMsg.id, actionsMsg.body.text);
                },
              }]
            : []),
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
        onSticker={() => {
          setEmojiOpen(false);
          setStickerPickerOpen(true);
        }}
        onContact={() => {
          setEmojiOpen(false);
          setAttachOpen(false);
          setContactPickerOpen(true);
        }}
        onLocation={() => {
          setEmojiOpen(false);
          onShareLocation();
        }}
        onEvent={() => {
          setEmojiOpen(false);
          setAttachOpen(false);
          setEventComposerOpen(true);
        }}
        onSchedule={() => {
          setEmojiOpen(false);
          setAttachOpen(false);
          setScheduleOpen(true);
        }}
      />

      <ScheduleMessageModal
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        chatId={chatId}
        chatLabel={headerName}
      />

      <GifPicker open={gifPickerOpen} onClose={() => setGifPickerOpen(false)} onPick={onPickGif} />

      <StickerPicker open={stickerPickerOpen} onClose={() => setStickerPickerOpen(false)} onPick={onPickSticker} />

      <ContactPicker open={contactPickerOpen} onClose={() => setContactPickerOpen(false)} onPick={onPickContact} />

      <VideoTrimmer
        open={trimmerOpen}
        fileUrl={previewVideo || null}
        onClose={() => setTrimmerOpen(false)}
        onApply={(start, end) => {
          setPendingVideoTrim({ start, end });
          setTrimmerOpen(false);
        }}
      />

      <PollComposer
        open={pollComposerOpen}
        onClose={() => setPollComposerOpen(false)}
        onCreate={onCreatePoll}
      />

      <EventComposer
        open={eventComposerOpen}
        onClose={() => setEventComposerOpen(false)}
        onCreate={onCreateEvent}
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

      {userInfoId && (() => {
        const uid = userInfoId;
        const isPeer = uid === otherUserId;
        return (
          <UserInfoModal
            open
            onClose={() => setUserInfoId(null)}
            userId={uid}
            onAudioCall={isPeer ? () => startCall({ chatId, peerIds: [uid], label: headerName, video: false, isGroup: false }) : undefined}
            onVideoCall={isPeer ? () => startCall({ chatId, peerIds: [uid], label: headerName, video: true, isGroup: false }) : undefined}
            onReport={isPeer ? () => { setReportMessageId(null); setReportOpen(true); } : undefined}
            onSearch={isPeer ? () => setSearchOpen(true) : undefined}
            onStarred={isPeer ? () => setStarredOpen(true) : undefined}
            onMedia={isPeer ? () => setMediaGalleryOpen(true) : undefined}
            muted={isPeer ? muted : undefined}
            onMuteFor={isPeer ? muteFor : undefined}
            onUnmute={isPeer ? unmute : undefined}
            autoSave={isPeer && canNativeFiles() ? autoSaveMedia : undefined}
            onToggleAutoSave={isPeer && canNativeFiles() ? toggleAutoSaveMedia : undefined}
            disappearingSeconds={isPeer ? chat?.disappearing_seconds : undefined}
            onChangeDisappearing={isPeer ? chooseDisappearing : undefined}
            onExport={isPeer ? handleExportChat : undefined}
            onClearChat={isPeer ? async () => { try { await clearChatForMe(chatId); clearMessages(); } catch {} } : undefined}
          />
        );
      })()}

      <ChatMediaGallery
        open={mediaGalleryOpen}
        onClose={() => setMediaGalleryOpen(false)}
        messages={items}
        resolveUrl={(p) => signedUrls[p]}
        onOpenImage={(url) => setLightboxUrl(url)}
        onOpenDoc={(body) => setDocPreview(body)}
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
          onMemberClick={(id) => { setGroupInfoOpen(false); setUserInfoId(id); }}
          onMedia={() => { setGroupInfoOpen(false); setMediaGalleryOpen(true); }}
          onExport={handleExportChat}
          onClearChat={async () => { try { await clearChatForMe(chatId); clearMessages(); } catch {} }}
          autoSave={canNativeFiles() ? autoSaveMedia : undefined}
          onToggleAutoSave={canNativeFiles() ? toggleAutoSaveMedia : undefined}
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
      <input ref={fileInputRef} type="file" hidden onChange={onFileChange} />

      {loading && messages.length === 0 ? (
        <MessagesSkeleton />
      ) : (
        <div className="relative flex min-h-0 flex-1 flex-col gap-2 px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          {/* Support-console status controls only apply to store chats. */}
          {chat && chat.store_id && (
            <div className="flex items-center gap-2 px-1 text-xs">
              <span className={`rounded px-1.5 py-0.5 uppercase ${
                chat.status === 'open' ? 'bg-green-900/40 text-green-400' :
                chat.status === 'in_progress' ? 'bg-blue-900/40 text-blue-400' :
                'bg-slate-800 text-slate-400'
              }`}>
                {chat.status === 'open' ? t('common.statusOpen') : chat.status === 'in_progress' ? t('common.statusInProgress') : t('common.statusClosed')}
              </span>
              {chat.status === 'open' && (
                <button onClick={() => updateStatus('in_progress')} className="toky-grad rounded-lg px-2.5 py-1 text-white">
                  {t('chat.take')}
                </button>
              )}
              {chat.status !== 'closed' && (
                <button onClick={() => updateStatus('closed')} className="rounded bg-slate-700 px-2 py-1 text-white hover:bg-slate-600">
                  {t('chat.closeChat')}
                </button>
              )}
            </div>
          )}

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
                        {highlightSnippet(r.content, searchQuery)}
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
              <PinIcon size={14} />
              <span className="truncate">
                {items.find((m) => m.id === chat.pinned_message_id)?.body.text || t('chat.pinnedFallback')}
              </span>
            </button>
          )}

          {keyChanged && (
            <div className="mb-2 flex flex-col gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-100 sm:flex-row sm:items-center">
              <span className="flex-1">
                ⚠️ {t('safety.keyChanged', { name: headerName })}
              </span>
              <span className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => setSafetyOpen(true)}
                  className="rounded-lg bg-amber-500/20 px-2.5 py-1 font-medium text-amber-100 hover:bg-amber-500/30"
                >
                  {t('safety.viewNumber')}
                </button>
                <button
                  type="button"
                  onClick={acknowledgeKeyChange}
                  className="rounded-lg bg-slate-800 px-2.5 py-1 text-slate-200 hover:bg-slate-700"
                >
                  {t('safety.gotIt')}
                </button>
              </span>
            </div>
          )}

          <div ref={scrollRef} onScroll={handleScroll} style={wallpaperStyle} className="-mx-3 min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain border-y border-slate-900 bg-slate-950/40 px-3 py-3">
            {loadingMore && <div className="text-center text-xs text-slate-500 my-2">{t('chat.loadingOlder')}</div>}
            {items.length === 0 ? (
              <p className="text-sm text-slate-400">{t('chat.noMessagesYet')}</p>
            ) : (
              <ul className="space-y-2">
                {items.map((m, idx) => {
                  const imgPaths: string[] = [];
                  if (m.body.imagePath) imgPaths.push(m.body.imagePath);
                  if (Array.isArray(m.body.imagePaths)) imgPaths.push(...m.body.imagePaths.filter(Boolean));
                  const videoPath = m.body.videoPath;
                  const audioPath = m.body.audioPath;

                  // Insert a centered day separator whenever the calendar day
                  // changes from the previous message.
                  const prev = idx > 0 ? items[idx - 1] : null;
                  const showDay =
                    !prev ||
                    new Date(m.created_at).toDateString() !== new Date(prev.created_at).toDateString();

                  // Group consecutive messages from the same sender (same side,
                  // within 5 min, no day break between): tighten the spacing and
                  // drop the repeated sender name.
                  const grouped =
                    !!prev &&
                    !showDay &&
                    m.sender_type !== 'system' &&
                    prev.sender_type !== 'system' &&
                    prev.sender_id === m.sender_id &&
                    isMine(prev) === isMine(m) &&
                    new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() < 5 * 60 * 1000;

                  return (
                    <Fragment key={m.id}>
                    {idx === firstUnreadIdx && unreadCount > 0 && (
                      <li className="my-2 flex items-center gap-3 px-1 text-[11px] font-semibold uppercase tracking-wide text-blue-300">
                        <span className="h-px flex-1 bg-blue-400/30" />
                        {unreadCount} {t('chat.newMessages')}
                        <span className="h-px flex-1 bg-blue-400/30" />
                      </li>
                    )}
                    {showDay && (
                      <li className="mx-auto my-1 rounded-full bg-slate-800/70 px-3 py-1 text-[11px] font-medium text-slate-400">
                        {dayLabel(m.created_at)}
                      </li>
                    )}
                    <li
                      id={`msg-${m.id}`}
                      className={`relative flex flex-col mb-1.5 px-3.5 py-2 rounded-[1.25rem] w-fit max-w-[80%] transition-shadow touch-pan-y ${grouped ? '-mt-1' : ''} ${
                        selectMode && selectedIds.has(m.id) ? 'ring-2 ring-blue-400 ring-offset-2 ring-offset-slate-950' : ''
                      } ${
                        m.sender_type === 'system' ? 'mx-auto bg-slate-800/80 text-center text-xs text-slate-400' :
                        m.body.stickerUrl ? `${isMine(m) ? 'ml-auto' : 'mr-auto'} !p-0 bg-transparent shadow-none text-slate-300` :
                        isMine(m) ? `ml-auto toky-grad text-white shadow-[0_4px_14px_-6px_rgba(79,70,229,0.7)] ${grouped ? 'rounded-tr-md rounded-br-md' : 'rounded-br-md'}` :
                        `mr-auto bg-slate-800 text-slate-100 shadow-sm ${grouped ? 'rounded-tl-md rounded-bl-md' : 'rounded-bl-md'}`
                      } ${!isMine(m) && myId && m.body.mentions?.includes(myId) ? 'ring-1 ring-amber-400/50' : ''}`}
                      style={swipe?.id === m.id
                        ? { transform: `translateX(${swipe.dx}px)`, transition: 'none' }
                        : { transition: 'transform .18s ease-out' }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        if (!selectMode && !m.body.is_deleted && m.sender_type !== 'system') openActions(m.id, m.body);
                      }}
                      onClick={() => {
                        if (selectMode && m.sender_type !== 'system') toggleSelect(m.id);
                      }}
                      onPointerDown={(e) => onMsgPointerDown(e, m)}
                      onPointerMove={(e) => onMsgPointerMove(e, m)}
                      onPointerUp={(e) => onMsgPointerUp(e, m)}
                      onPointerCancel={onMsgPointerCancel}
                      onDoubleClick={() => {
                        if (!selectMode && !m.body.is_deleted && m.sender_type !== 'system') openActions(m.id, m.body);
                      }}
                    >
                      {selectMode && m.sender_type !== 'system' && (
                        <span className={`pointer-events-none absolute -top-1.5 ${isMine(m) ? '-left-1.5' : '-right-1.5'} grid h-5 w-5 place-items-center rounded-full text-white ${selectedIds.has(m.id) ? 'toky-grad' : 'bg-slate-700 ring-1 ring-slate-500'}`}>
                          {selectedIds.has(m.id) && <CheckIcon size={12} />}
                        </span>
                      )}
                      {swipe?.id === m.id && m.sender_type !== 'system' && (
                        <span
                          className="pointer-events-none absolute top-1/2 -left-9 -translate-y-1/2 grid h-7 w-7 place-items-center rounded-full bg-slate-800 text-blue-300"
                          style={{ opacity: Math.min(1, swipe.dx / SWIPE_TRIGGER), transform: `translateY(-50%) scale(${Math.min(1, 0.5 + swipe.dx / SWIPE_TRIGGER / 2)})` }}
                        >
                          <ReplyIcon size={15} />
                        </span>
                      )}
                      {isGroup && !isMine(m) && m.sender_type !== 'system' && !grouped && (
                        <div className="text-[10px] font-semibold text-blue-300 mb-0.5">{senderName(m)}</div>
                      )}
                      {m.sender_type !== 'system' && (
                      <div className={`text-[10px] flex items-center justify-between mb-1 ${isMine(m) ? 'text-blue-100/70' : 'text-slate-500'}`}>
                        <span className="flex items-center gap-1">
                          {new Date(m.created_at).toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' })}
                          {m.edited_at && <span className="ml-1 italic">{t('chat.edited')}</span>}
                          {starredIds.has(m.id) && <StarGlyph filled size={11} />}
                        </span>
                        {isMine(m) ? (
                          m.read ? (
                            // Read — double GREEN tick (distinct colour = seen).
                            <span className="ml-2 font-bold tracking-tighter text-emerald-300" title={t('chat.receiptRead')}>✓✓</span>
                          ) : m.delivery_status === 'delivered' || m.delivery_status === 'read' ? (
                            // Delivered to their device — double solid-white tick.
                            <span className="ml-2 font-bold tracking-tighter text-white" title={t('chat.receiptDelivered')}>✓✓</span>
                          ) : (
                            // Sent to the server — single dim tick.
                            <span className="ml-2 text-white/45" title={t('chat.receiptSent')}>✓</span>
                          )
                        ) : null}
                      </div>
                      )}

                      {m.body.call ? (() => {
                        const call = m.body.call;
                        const outgoing = isMine(m);
                        const answered = call.outcome === 'answered';
                        const missed = !answered && !outgoing; // incoming + unanswered = missed
                        const label = answered
                          ? call.isGroup
                            ? (call.video ? t('call.logGroupVideoCall') : t('call.logGroupCall'))
                            : (call.video ? t('call.logVideoCall') : t('call.logCall'))
                          : call.outcome === 'declined'
                          ? t('call.logDeclined')
                          : outgoing
                          ? t('call.logNoAnswer')
                          : t('call.logMissed');
                        const dur = answered && call.duration ? formatCallDuration(call.duration) : '';
                        return (
                          <div className="mt-0.5 flex items-center gap-2.5 py-0.5">
                            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${missed ? 'bg-rose-500/15 text-rose-400' : 'bg-slate-700/60 text-slate-100'}`}>
                              {call.video ? <VideoIcon size={16} /> : <PhoneIcon size={16} />}
                            </span>
                            <div className="min-w-0 text-left">
                              <div className={`text-sm font-medium ${missed ? 'text-rose-300' : 'text-slate-100'}`}>{label}</div>
                              {dur ? <div className="text-xs text-slate-400">{dur}</div> : null}
                            </div>
                          </div>
                        );
                      })() : m.body.is_deleted ? (
                        <div className="text-sm text-slate-500 italic mt-1 flex items-center gap-1">
                          <span>🚫</span> {t('chat.deletedMessage')}
                        </div>
                      ) : m.body.encrypted ? (
                        <div className="text-sm text-slate-500 italic mt-1 flex items-center gap-1">
                          <span>🔒</span> {t('chat.encryptedLocked')}
                        </div>
                      ) : (
                        <>
                          {m.body.reply_to && (() => {
                            const target = items.find((x) => x.id === m.body.reply_to);
                            const tb = target?.body;
                            const preview = !target
                              ? t('chat.replyToMessage')
                              : tb?.text
                              ? tb.text
                              : tb?.imagePaths?.length || tb?.imagePath
                              ? `📷 ${t('chatsList.photo')}`
                              : tb?.audioPath
                              ? `🎤 ${t('chat.mediaMessage')}`
                              : tb?.videoPath
                              ? `🎬 ${t('chat.mediaMessage')}`
                              : tb?.filePath
                              ? `📎 ${tb.fileName || t('chat.file')}`
                              : t('chat.mediaMessage');
                            return (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (m.body.reply_to) scrollToMessage(m.body.reply_to);
                                }}
                                className="mb-1 mt-1 block w-full truncate rounded border-l-2 border-blue-400 bg-slate-900/50 py-1 pl-2 pr-2 text-left text-xs text-slate-300 hover:bg-slate-900/80"
                                title={t('chat.replyToMessage')}
                              >
                                {preview}
                              </button>
                            );
                          })()}
                          {m.body.text ? <div className="text-sm mt-1 whitespace-pre-wrap break-words"><MessageText text={m.body.text} mentions={mentionNames} /></div> : null}
                          {(() => {
                            const link = m.body.text ? firstUrl(m.body.text) : null;
                            return link ? <LinkPreview url={link} mine={isMine(m)} /> : null;
                          })()}

                      {translatingId === m.id && !translations[m.id] ? (
                        <div className="mt-1 text-xs italic text-slate-500">{t('ai.translating')}</div>
                      ) : null}
                      {translations[m.id] ? (
                        <div className="mt-1 border-l-2 border-blue-500 pl-2 text-sm text-slate-300">
                          <span className="mr-1 text-[10px] uppercase text-slate-500">{t('ai.translated')}</span>
                          {translations[m.id]}
                        </div>
                      ) : null}

                      {m.body.gifUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.body.gifUrl} alt="GIF" className="mt-2 max-h-72 w-auto rounded-lg border border-slate-900" />
                      ) : null}

                      {m.body.stickerUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.body.stickerUrl} alt="sticker" className="max-h-40 w-auto select-none" draggable={false} />
                      ) : null}

                      {m.body.contact ? (() => {
                        const ct = m.body.contact;
                        return (
                          <button
                            type="button"
                            onClick={() => setUserInfoId(ct.userId)}
                            className="mt-1 flex w-56 max-w-full items-center gap-3 rounded-xl border border-white/10 bg-black/10 p-2 text-left hover:bg-black/20"
                          >
                            {ct.avatarUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={ct.avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
                            ) : (
                              <span className="grid h-10 w-10 place-items-center rounded-full text-sm font-semibold text-white" style={{ backgroundImage: avatarBg(ct.name) }}>
                                {initials(ct.name)}
                              </span>
                            )}
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium">{ct.name}</span>
                              <span className="block truncate text-xs opacity-70">{t('chat.viewContact')}</span>
                            </span>
                          </button>
                        );
                      })() : null}

                      {m.body.location ? (() => {
                        const loc = m.body.location;
                        return (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); window.open(mapsUrlFor(loc.lat, loc.lng), '_blank', 'noopener,noreferrer'); }}
                            className="mt-1 flex w-56 max-w-full items-center gap-3 rounded-xl border border-white/10 bg-black/10 p-2 text-left hover:bg-black/20"
                          >
                            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-rose-500/20 text-xl">📍</span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium">{t('chat.locationShared')}</span>
                              <span className="block truncate text-xs opacity-70">{t('chat.openInMaps')}</span>
                            </span>
                          </button>
                        );
                      })() : null}

                      {m.body.event ? (() => {
                        const ev = m.body.event;
                        const d = new Date(ev.startsAt);
                        const dateStr = isNaN(d.getTime())
                          ? ''
                          : d.toLocaleString(lang, { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
                        const tally = rsvpByMessage.get(m.id) ?? { going: 0, maybe: 0, no: 0, mine: null as EventRsvpStatus | null };
                        return (
                          <div className="mt-1 w-64 max-w-full space-y-2 rounded-xl border border-white/15 bg-black/15 p-3">
                            <div className="flex items-start gap-2">
                              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-indigo-500/25 text-lg">📅</span>
                              <div className="min-w-0">
                                <div className="truncate text-sm font-semibold">{ev.title}</div>
                                {dateStr && <div className="text-xs opacity-80">{dateStr}</div>}
                              </div>
                            </div>
                            {ev.location && <div className="truncate text-xs opacity-80">📍 {ev.location}</div>}
                            {ev.note && <div className="whitespace-pre-wrap break-words text-xs opacity-70">{ev.note}</div>}
                            <div className="flex gap-1">
                              {(['going', 'maybe', 'no'] as EventRsvpStatus[]).map((s) => (
                                <button
                                  key={s}
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); onSetRsvp(m.id, s); }}
                                  aria-pressed={tally.mine === s}
                                  className={`flex-1 rounded-lg px-1.5 py-1 text-[11px] ${tally.mine === s ? 'bg-indigo-600 text-white' : 'bg-black/20 hover:bg-black/30'}`}
                                >
                                  {t(`event.rsvp_${s}`)}{tally[s] > 0 ? ` ${tally[s]}` : ''}
                                </button>
                              ))}
                            </div>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); void addToCalendar(ev); }}
                                className="flex-1 rounded-lg border border-white/20 px-2 py-1 text-[11px] hover:bg-black/20"
                              >
                                {t('event.addToCalendar')}
                              </button>
                              <a
                                href={googleCalendarUrl(ev)}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="rounded-lg border border-white/20 px-2 py-1 text-[11px] hover:bg-black/20"
                              >
                                {t('event.google')}
                              </a>
                            </div>
                          </div>
                        );
                      })() : null}

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

                      {m.body.viewOnce && (imgPaths.length > 0 || videoPath) ? (() => {
                        const voKind: 'photo' | 'video' = videoPath ? 'video' : 'photo';
                        const label = voKind === 'video' ? t('viewOnce.video') : t('viewOnce.photo');
                        const loadingThis = viewOnceLoadingId === m.id;
                        if (isMine(m)) {
                          return (
                            <div className="mt-1 flex items-center gap-2 text-sm">
                              <EyeIcon size={16} />
                              <span>{label}</span>
                              <span className="text-xs opacity-70">· {openedByOthers.has(m.id) ? t('viewOnce.opened') : t('viewOnce.sent')}</span>
                            </div>
                          );
                        }
                        if (myViewedIds.has(m.id)) {
                          return (
                            <div className="mt-1 flex items-center gap-2 text-sm text-slate-400">
                              <EyeOffIcon size={16} />
                              <span>{t('viewOnce.opened')}</span>
                            </div>
                          );
                        }
                        return (
                          <button
                            type="button"
                            disabled={loadingThis}
                            onClick={(e) => { e.stopPropagation(); if (!selectMode) openViewOnce(m); }}
                            className="mt-1 flex items-center gap-2 rounded-xl border border-white/25 bg-black/20 px-3 py-2 text-sm hover:bg-black/30 disabled:opacity-60"
                          >
                            <EyeIcon size={16} />
                            <span>{loadingThis ? t('viewOnce.opening') : (voKind === 'video' ? t('viewOnce.tapToViewVideo') : t('viewOnce.tapToViewPhoto'))}</span>
                          </button>
                        );
                      })() : null}

                      {imgPaths.length && !m.body.viewOnce ? (() => {
                        const uniqueImgs = Array.from(new Set(imgPaths));
                        const single = uniqueImgs.length === 1;
                        // A single image fills the bubble width (object-cover);
                        // multiples tile in a square grid. Negative margins let
                        // the media reach the bubble edges instead of sitting in
                        // a big padded bubble with a small picture inside.
                        return (
                        <div className={`-mx-2 mt-1 overflow-hidden rounded-2xl ${single ? '' : 'grid grid-cols-2 gap-1'}`}>
                          {uniqueImgs.map((path) => {
                            const url = signedUrls[path] || '';
                            if (url) {
                              return (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  key={path}
                                  src={url}
                                  alt="chat image"
                                  onLoad={() => {
                                    if (stickBottomRef.current && scrollRef.current) {
                                      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
                                    }
                                  }}
                                  onClick={() => {
                                    if (selectMode) toggleSelect(m.id);
                                    else setLightboxUrl(url);
                                  }}
                                  className={
                                    single
                                      ? 'max-h-96 w-full cursor-zoom-in object-cover transition-opacity hover:opacity-90'
                                      : 'aspect-square w-full cursor-zoom-in object-cover transition-opacity hover:opacity-90'
                                  }
                                />
                              );
                            }
                            if (failedMedia.has(path)) {
                              return (
                                <button
                                  key={path}
                                  type="button"
                                  onClick={() => retryMedia(path)}
                                  className={`flex ${single ? 'h-56' : 'aspect-square'} w-full flex-col items-center justify-center gap-1 bg-slate-900/60 text-xs text-slate-400 hover:bg-slate-800`}
                                >
                                  <DownloadIcon size={18} />
                                  <span>{t('chat.mediaRetry')}</span>
                                </button>
                              );
                            }
                            if (deferredMedia.has(path)) {
                              return (
                                <button
                                  key={path}
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); downloadDeferred(path); }}
                                  className={`flex ${single ? 'h-56' : 'aspect-square'} w-full flex-col items-center justify-center gap-1 bg-slate-900/60 text-xs text-slate-300 hover:bg-slate-800`}
                                >
                                  <DownloadIcon size={20} />
                                  <span>{t('autoDownload.tapToDownload')}</span>
                                </button>
                              );
                            }
                            return (
                              <div key={path} className={`${single ? 'h-56' : 'aspect-square'} w-full animate-pulse bg-slate-800`} />
                            );
                          })}
                        </div>
                        );
                      })() : null}

                      {videoPath && !m.body.viewOnce ? (
                        <div className="mt-2">
                          {signedUrls[videoPath] ? (
                            <>
                              <TrimmedVideo
                                src={signedUrls[videoPath]}
                                start={m.body.videoTrimStart}
                                end={m.body.videoTrimEnd}
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
                          ) : deferredMedia.has(videoPath) ? (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); downloadDeferred(videoPath); }}
                              className="flex h-40 w-full flex-col items-center justify-center gap-1 rounded-lg border border-slate-900 bg-slate-900/60 text-xs text-slate-300 hover:bg-slate-800"
                            >
                              <DownloadIcon size={22} />
                              <span>{t('autoDownload.tapToDownloadVideo')}</span>
                            </button>
                          ) : (
                            <div className="h-40 w-full animate-pulse rounded-lg border border-slate-900 bg-slate-800" />
                          )}
                        </div>
                      ) : null}

                      {audioPath ? (
                        <div className="mt-1 w-56 max-w-full">
                          {signedUrls[audioPath] ? (
                            <AudioMessage src={signedUrls[audioPath]} mine={isMine(m)} />
                          ) : deferredMedia.has(audioPath) ? (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); downloadDeferred(audioPath); }}
                              className="flex h-10 w-full items-center justify-center gap-2 rounded-full border border-slate-800 bg-slate-900/60 text-xs text-slate-300 hover:bg-slate-800"
                            >
                              <DownloadIcon size={16} />
                              <span>{t('autoDownload.tapToDownloadAudio')}</span>
                            </button>
                          ) : (
                            <div className="h-10 w-full animate-pulse rounded-full border border-slate-900 bg-slate-800" />
                          )}
                        </div>
                      ) : null}

                      {m.body.filePath ? (
                        <button
                          type="button"
                          onClick={() => { tap(); setDocPreview(m.body); }}
                          className="mt-2 flex w-full items-center gap-3 rounded-lg border border-slate-800 bg-slate-950/60 p-2 text-left hover:bg-slate-900"
                        >
                          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-slate-800 text-slate-300">
                            <PaperclipIcon size={18} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm text-slate-100">{m.body.fileName || t('chat.file')}</span>
                            {m.body.fileSize ? <span className="block text-xs text-slate-500">{formatBytes(m.body.fileSize)}</span> : null}
                          </span>
                          <span className="shrink-0 text-slate-400">
                            <DownloadIcon size={18} />
                          </span>
                        </button>
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
                    </Fragment>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Jump to latest */}
          {showScrollDown && (
            <button
              type="button"
              onClick={scrollToBottom}
              aria-label={t('chat.scrollToBottom')}
              title={t('chat.scrollToBottom')}
              className="toky-glass absolute bottom-24 right-4 z-10 grid h-10 w-10 place-items-center rounded-full border border-slate-700 text-slate-100 shadow-lg"
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M19 12l-7 7-7-7" />
              </svg>
            </button>
          )}

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
                      className="absolute bottom-1 right-1 grid place-items-center rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80"
                      title={t('chat.editPhoto')}
                      aria-label={t('chat.editPhoto')}
                    >
                      <PencilIcon size={14} />
                    </button>
                  </div>
                ))}
              </div>
              {/* Per-send quality */}
              <div className="mt-2 flex items-center gap-1.5">
                <span className="text-[11px] text-slate-500">{t('sendQuality.label')}</span>
                {(['standard', 'high', 'original'] as SendQuality[]).map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => chooseSendQuality(q)}
                    aria-pressed={sendQuality === q}
                    title={t(`sendQuality.${q}Hint`)}
                    className={`rounded px-2.5 py-1 text-xs ${sendQuality === q ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                  >
                    {t(`sendQuality.${q}`)}
                  </button>
                ))}
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setComposeViewOnce((v) => !v)}
                  aria-pressed={composeViewOnce}
                  title={t('viewOnce.toggleHint')}
                  className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-xs ${composeViewOnce ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                >
                  <EyeIcon size={14} /> {t('viewOnce.toggle')}
                </button>
                <button className="rounded bg-slate-800 px-3 py-1.5 text-xs hover:bg-slate-700" onClick={clearPendingImages} disabled={busy}>
                  {t('common.removeAll')}
                </button>
              </div>
            </div>
          ) : null}

          {/* Preview video */}
          {previewVideo ? (
            <div className="rounded border border-slate-900 bg-slate-950/40 p-2">
              <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
                <span>{t('chat.previewVideo')}</span>
                {pendingVideoTrim && (
                  <span className="text-blue-400">
                    {t('videoTrim.trimmedTo', { seconds: String(Math.round(pendingVideoTrim.end - pendingVideoTrim.start)) })}
                  </span>
                )}
              </div>
              <video src={previewVideo} controls className="max-h-72 w-full rounded border border-slate-900" />
              <div className="mt-2 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setComposeViewOnce((v) => !v)}
                  aria-pressed={composeViewOnce}
                  title={t('viewOnce.toggleHint')}
                  className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-xs ${composeViewOnce ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                >
                  <EyeIcon size={14} /> {t('viewOnce.toggle')}
                </button>
                <div className="flex gap-2">
                  <button className="rounded bg-slate-800 px-3 py-1.5 text-xs hover:bg-slate-700" onClick={() => setTrimmerOpen(true)} disabled={busy}>
                    ✂️ {t('videoTrim.trim')}
                  </button>
                  <button className="rounded bg-slate-800 px-3 py-1.5 text-xs hover:bg-slate-700" onClick={clearPendingVideo} disabled={busy}>
                    {t('common.remove')}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {erasingUsers.length > 0 && (
            <div className="ml-2 flex items-center gap-2">
              <div className="flex items-center rounded-2xl rounded-bl-md bg-slate-800 px-3 py-2">
                <span className="toky-eraser" aria-hidden="true">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M16.2 3.8a2 2 0 0 1 2.8 0l1.2 1.2a2 2 0 0 1 0 2.8L10 18H5.5L3.8 16.3a2 2 0 0 1 0-2.8z"
                      fill="#f9a8d4" stroke="#be185d" strokeWidth="1.3" strokeLinejoin="round" />
                    <path d="M12.5 7.5 16.5 11.5" stroke="#be185d" strokeWidth="1.3" strokeLinecap="round" />
                  </svg>
                  <span className="toky-eraser-crumbs" />
                </span>
              </div>
              <span className="text-xs text-slate-400">
                {erasingUsers.map((id) => usernameById.get(id) || t('chat.someone')).join(', ')} {t('chat.erasingSuffix')}
              </span>
            </div>
          )}
          {recordingUsers.length > 0 && (
            <div className="ml-2 flex items-center gap-2">
              <div className="flex items-center gap-2 rounded-2xl rounded-bl-md bg-slate-800 px-3 py-2">
                <span className="toky-rec-mic" aria-hidden="true">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <rect x="9" y="3" width="6" height="11" rx="3" fill="#f87171" />
                    <path d="M6 11a6 6 0 0 0 12 0" stroke="#f87171" strokeWidth="1.6" strokeLinecap="round" />
                    <path d="M12 17v3" stroke="#f87171" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                </span>
                <span className="toky-rec-wave" aria-hidden="true">
                  <span /><span /><span /><span /><span />
                </span>
              </div>
              <span className="text-xs text-slate-400">
                {recordingUsers.map((id) => usernameById.get(id) || t('chat.someone')).join(', ')} {t('chat.recordingSuffix')}
              </span>
            </div>
          )}
          {typingUsers.length > 0 && (
            <div className="ml-2 flex items-center gap-2">
              <div className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-slate-800 px-3 py-2.5">
                <span className="toky-typing-dot" />
                <span className="toky-typing-dot" />
                <span className="toky-typing-dot" />
              </div>
              <span className="text-xs text-slate-400">
                {typingUsers.map((id) => usernameById.get(id) || t('chat.someone')).join(', ')} {t('chat.typingSuffix')}
              </span>
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

          {canPost && suggestions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setText(s);
                    setSuggestions([]);
                    textInputRef.current?.focus();
                  }}
                  className="rounded-full border border-blue-800 bg-blue-950/40 px-3 py-1.5 text-xs text-blue-200 hover:bg-blue-900/50"
                >
                  {s}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setSuggestions([])}
                aria-label={t('common.close')}
                className="rounded-full border border-slate-800 bg-slate-950/60 px-2 py-1.5 text-xs text-slate-400 hover:bg-slate-900"
              >
                ✕
              </button>
            </div>
          )}

          {canPost ? (
          <div ref={composerRef} className="toky-glass relative -mx-3 flex items-end gap-2 border-t border-slate-800/70 px-2 py-2">
            {/* @mention autocomplete (groups) — floats above the input. */}
            {mentionQuery && mentionCandidates.length > 0 && (
              <div className="absolute inset-x-2 bottom-full z-30 mb-2 overflow-hidden rounded-2xl border border-slate-700 bg-slate-900/95 shadow-2xl backdrop-blur">
                <div className="max-h-56 overflow-y-auto py-1">
                  {mentionCandidates.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); insertMention(p); }}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-slate-800"
                    >
                      {p.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                      ) : (
                        <span className="grid h-8 w-8 place-items-center rounded-full bg-slate-700 text-xs font-semibold text-slate-200">
                          {(p.display_name || p.username || '?').trim().charAt(0).toUpperCase()}
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-slate-100">{p.display_name || p.username}</span>
                        {p.username && <span className="block truncate text-xs text-slate-500">@{p.username}</span>}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {/* Rounded input pill — replaced by a live recording strip while
                recording, or an audio preview (play / discard) once stopped. */}
            {isRecording ? (
              <div className="flex min-w-0 flex-1 items-center gap-2.5 rounded-3xl border border-red-500/40 bg-red-500/10 px-3 py-2.5">
                <button
                  type="button"
                  onClick={cancelRecording}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-red-300 hover:bg-red-500/20"
                  title={t('common.cancel')}
                  aria-label={t('common.cancel')}
                >
                  <TrashIcon size={18} />
                </button>
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full bg-red-500 ${isRecPaused ? '' : 'animate-pulse'}`} />
                <span className="text-sm font-medium text-red-200">{isRecPaused ? t('chat.recordingPaused') : t('chat.recording')}</span>
                <span className="ml-auto text-sm tabular-nums text-red-200/90">{fmtRecTime(recSeconds)}</span>
                <button
                  type="button"
                  onClick={isRecPaused ? resumeRecording : pauseRecording}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-red-200 hover:bg-red-500/20"
                  title={isRecPaused ? t('chat.resumeRecording') : t('chat.pauseRecording')}
                  aria-label={isRecPaused ? t('chat.resumeRecording') : t('chat.pauseRecording')}
                >
                  {isRecPaused ? <PlayGlyph /> : <PauseGlyph />}
                </button>
              </div>
            ) : pendingAudio ? (
              <div className="flex min-w-0 flex-1 items-center gap-2 rounded-3xl border border-slate-800 bg-slate-900 px-2 py-1.5">
                <button
                  type="button"
                  onClick={discardPendingAudio}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-slate-400 hover:bg-slate-800 hover:text-rose-300"
                  title={t('common.delete')}
                  aria-label={t('common.delete')}
                >
                  <TrashIcon size={18} />
                </button>
                <div className="min-w-0 flex-1">
                  {pendingAudioUrl && <AudioMessage src={pendingAudioUrl} />}
                </div>
              </div>
            ) : (
            <div className="flex min-w-0 flex-1 items-center gap-0.5 rounded-3xl border border-slate-800 bg-slate-900 px-1.5">
              <div className="relative shrink-0">
                <button
                  className="grid h-9 w-9 place-items-center rounded-full text-slate-400 hover:text-slate-200 disabled:opacity-40"
                  onClick={() => {
                    setAttachOpen(false);
                    setEmojiOpen((v) => !v);
                  }}
                  type="button"
                  title={t('chat.emoji')}
                  aria-label={t('chat.emoji')}
                  disabled={busy}
                >
                  <SmileIcon size={22} />
                </button>

                <EmojiPicker
                  open={emojiOpen}
                  onClose={() => setEmojiOpen(false)}
                  onPick={(e) => {
                    insertEmoji(e);
                    setEmojiOpen(false);
                  }}
                  onGif={() => {
                    setEmojiOpen(false);
                    setGifPickerOpen(true);
                  }}
                />
              </div>

              <textarea
                ref={textInputRef}
                rows={1}
                className="min-w-0 flex-1 resize-none bg-transparent px-1 py-2.5 text-[15px] leading-snug text-slate-100 placeholder:text-slate-500 focus:outline-none max-h-32 overflow-y-auto"
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  computeMentionQuery(e.target.value, e.target.selectionStart ?? e.target.value.length);
                  // Grow the box with the text, up to the max-height (then scroll).
                  const el = e.currentTarget;
                  el.style.height = 'auto';
                  el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
                }}
                onKeyUp={(e) => computeMentionQuery(e.currentTarget.value, e.currentTarget.selectionStart ?? 0)}
                onClick={(e) => computeMentionQuery(e.currentTarget.value, e.currentTarget.selectionStart ?? 0)}
                placeholder={t('chat.composerPlaceholder')}
                onFocus={() => { composerFocusedRef.current = true; setEmojiOpen(false); }}
                onBlur={() => { composerFocusedRef.current = false; setMeActivity(null); }}
                onPaste={onComposerPaste}
                onKeyDown={(e) => {
                  // While the @mention list is open, Enter/Tab picks the first
                  // match instead of sending; Escape closes it.
                  if (mentionQuery && mentionCandidates.length > 0) {
                    if (e.key === 'Enter' || e.key === 'Tab') {
                      e.preventDefault();
                      insertMention(mentionCandidates[0]);
                      return;
                    }
                    if (e.key === 'Escape') {
                      e.preventDefault();
                      setMentionQuery(null);
                      return;
                    }
                  }
                  // Enter sends; Shift+Enter inserts a newline.
                  // Ignore keyboard auto-repeat (e.repeat) and in-flight sends so
                  // that holding Enter can't fire onSend dozens of times and send
                  // the same image/message repeatedly.
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (e.repeat || busy || sendingRef.current) return;
                    onSend();
                  }
                }}
                disabled={blocked}
              />

              <button
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-400 hover:text-slate-200 disabled:opacity-40"
                onClick={onSuggest}
                type="button"
                title={t('ai.suggest')}
                aria-label={t('ai.suggest')}
                disabled={busy || suggestBusy || items.length === 0}
              >
                <SparklesIcon size={20} />
              </button>

              <button
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-400 hover:text-slate-200 disabled:opacity-40"
                onClick={() => {
                  setEmojiOpen(false);
                  setAttachOpen(true);
                }}
                type="button"
                title={t('chat.attach')}
                aria-label={t('chat.attach')}
                disabled={busy}
              >
                <PlusIcon size={22} />
              </button>
            </div>
            )}

            {/* Right button: stop-recording · send-audio · send · mic */}
            {isRecording ? (
              <button
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-red-600 text-white disabled:opacity-60"
                onClick={stopRecording}
                type="button"
                title={t('chat.stopRecording')}
                aria-label={t('chat.stopRecording')}
              >
                <span className="h-4 w-4 rounded-[3px] bg-white" />
              </button>
            ) : pendingAudio ? (
              <button
                className="toky-grad toky-ring-brand grid h-11 w-11 shrink-0 place-items-center rounded-full text-white disabled:opacity-60"
                onClick={sendPendingAudio}
                type="button"
                disabled={busy || blocked}
                title={t('chat.send')}
                aria-label={t('chat.send')}
              >
                <SendIcon size={20} />
              </button>
            ) : text.trim() || editingId || pendingImages.length > 0 || pendingVideo ? (
              <button
                className="toky-grad toky-ring-brand grid h-11 w-11 shrink-0 place-items-center rounded-full text-white disabled:opacity-60"
                onClick={onSend}
                type="button"
                disabled={busy || blocked}
                title={editingId ? t('chat.saveEdit') : t('chat.send')}
                aria-label={editingId ? t('chat.saveEdit') : t('chat.send')}
              >
                {editingId ? <CheckIcon size={20} /> : <SendIcon size={20} />}
              </button>
            ) : (
              <button
                className="toky-grad toky-ring-brand grid h-11 w-11 shrink-0 place-items-center rounded-full text-white disabled:opacity-60"
                onClick={startRecording}
                type="button"
                disabled={busy}
                title={t('chat.recordAudio')}
                aria-label={t('chat.recordAudio')}
              >
                <MicIcon size={20} />
              </button>
            )}
          </div>
          ) : (
            <p className="rounded-lg border border-slate-900 bg-slate-950/60 px-3 py-3 text-center text-xs text-slate-400">
              {groupSendBlocked ? t('groupInfo.onlyAdminsCanSend') : t('channels.readOnlyNotice')}
            </p>
          )}
        </div>
      )}

      {lightboxUrl && (
        <ImageLightbox url={lightboxUrl} alt={t('chatsList.photo')} onClose={() => setLightboxUrl(null)} />
      )}

      {viewOnceOpen && (
        <ViewOnceViewer url={viewOnceOpen.url} kind={viewOnceOpen.kind} onClose={closeViewOnce} />
      )}

      <SafetyNumberModal
        open={safetyOpen}
        onClose={() => setSafetyOpen(false)}
        chatId={chatId}
        peerName={headerName}
        peerUserId={otherUserId}
      />

      {needUnlock && (
        <div className="fixed inset-0 z-[110] flex flex-col items-center justify-center gap-5 bg-slate-950 px-6 text-center">
          <div className="toky-grad grid h-14 w-14 place-items-center rounded-3xl text-white">
            <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="11" width="16" height="9" rx="2" />
              <path d="M8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
          </div>
          <div>
            <h2 className="font-display text-lg font-bold text-slate-100">{t('chatLock.lockedTitle')}</h2>
            <p className="mt-1 text-sm text-slate-400">{t('chatLock.lockedSubtitle')}</p>
          </div>
          <input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={12}
            autoFocus
            value={unlockPin}
            onChange={(e) => { setUnlockPin(e.target.value.replace(/\D/g, '')); setUnlockError(false); }}
            onKeyDown={(e) => { if (e.key === 'Enter') void submitChatUnlock(); }}
            placeholder="••••"
            className={`w-44 rounded-2xl border bg-slate-900 px-4 py-3 text-center text-2xl tracking-[0.4em] text-slate-100 focus:outline-none ${
              unlockError ? 'border-rose-500 focus:ring-2 focus:ring-rose-500/40' : 'border-slate-700 focus:ring-2 focus:ring-indigo-500/40'
            }`}
          />
          {unlockError && <p className="-mt-3 text-xs text-rose-400">{t('appLock.wrongPin')}</p>}
          <div className="flex w-44 flex-col gap-2">
            <button
              type="button"
              onClick={submitChatUnlock}
              disabled={unlockPin.length < 4}
              className="toky-grad toky-ring-brand rounded-2xl px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {t('appLock.unlock')}
            </button>
            <button
              type="button"
              onClick={() => { try { window.history.back(); } catch { /* ignore */ } }}
              className="rounded-2xl border border-slate-800 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800/40"
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}

      {starredOpen && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={() => setStarredOpen(false)}>
          <div
            className="toky-glass toky-elev flex max-h-[80vh] w-full max-w-md flex-col rounded-t-3xl border border-slate-800 sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center gap-2 border-b border-slate-800/70 px-4 py-3">
              <StarGlyph filled size={18} />
              <h2 className="font-display text-base font-bold">{t('chat.starredTitle')}</h2>
            </div>
            {(() => {
              const starred = items.filter((m) => starredIds.has(m.id));
              if (starred.length === 0) {
                return <p className="px-4 py-8 text-center text-sm text-slate-400">{t('chat.noStarred')}</p>;
              }
              return (
                <ul className="min-h-0 flex-1 overflow-y-auto p-2">
                  {starred.map((m) => (
                    <li key={m.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setStarredOpen(false);
                          scrollToMessage(m.id);
                        }}
                        className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-slate-800/50"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block text-[11px] font-semibold text-blue-300">
                            {isMine(m) ? t('chat.you') : senderName(m) || t('chatsList.directChat')}
                          </span>
                          <span className="mt-0.5 block truncate text-sm text-slate-200">
                            {m.body.is_deleted ? t('chat.deletedMessage') : m.body.text || t('chatsList.photo')}
                          </span>
                        </span>
                        <span className="shrink-0 text-[10px] text-slate-500">
                          {new Date(m.created_at).toLocaleDateString(lang, { month: 'short', day: 'numeric' })}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              );
            })()}
            <button
              type="button"
              onClick={() => setStarredOpen(false)}
              className="border-t border-slate-800/70 px-4 py-3 text-sm text-slate-300 hover:bg-slate-800/40 pb-safe"
            >
              {t('common.close')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function PauseGlyph({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden fill="currentColor">
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  );
}

function PlayGlyph({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden fill="currentColor">
      <path d="M8 5.5v13l11-6.5z" />
    </svg>
  );
}

function StarGlyph({ filled, size = 18 }: { filled?: boolean; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden
      fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.9 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z" />
    </svg>
  );
}
