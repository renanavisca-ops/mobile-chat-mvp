'use client';

import { useEffect, useState } from 'react';
import { useLanguage } from '@/lib/i18n/context';
import { browserSupabase } from '@/lib/supabase/client';
import { peerFingerprint } from '@/lib/crypto/keystore';
import { blockUser, unblockUser, isBlockedByMe } from '@/lib/db/safety';
import { avatarBg, initials } from '@/lib/ui/avatar';
import { PhoneIcon, VideoIcon, ChatBubbleIcon, XIcon, SearchIcon } from '@/components/icons';

const DISAPPEARING_OPTIONS: { seconds: number; labelKey: string }[] = [
  { seconds: 0, labelKey: 'chat.disappearingOff' },
  { seconds: 86400, labelKey: 'chat.disappearing24h' },
  { seconds: 604800, labelKey: 'chat.disappearing7d' },
  { seconds: 2592000, labelKey: 'chat.disappearing30d' },
];

type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  last_seen: string | null;
  show_online: boolean;
  created_at: string | null;
};

function formatSeen(iso: string, lang: string): string {
  const d = new Date(iso);
  const now = Date.now();
  const diffH = (now - d.getTime()) / 36e5;
  if (diffH < 24) return d.toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString(lang, { day: 'numeric', month: 'short' });
}

function formatSince(iso: string, lang: string): string {
  return new Date(iso).toLocaleDateString(lang, { month: 'long', year: 'numeric' });
}

/**
 * Contact-info sheet, like WhatsApp's screen when you tap a name: avatar, name,
 * @username, online / last-seen, member-since, the end-to-end encryption safety
 * number, and quick actions (message / call / block / report). Fetches the full
 * profile by id so it works from a 1:1 header or a group member row.
 */
export function UserInfoModal({
  open,
  onClose,
  userId,
  onMessage,
  onAudioCall,
  onVideoCall,
  onReport,
  onSearch,
  onStarred,
  muted,
  onToggleMute,
  disappearingSeconds,
  onChangeDisappearing,
}: {
  open: boolean;
  onClose: () => void;
  userId: string | null;
  onMessage?: () => void;
  onAudioCall?: () => void;
  onVideoCall?: () => void;
  onReport?: () => void;
  // Chat-level options (only for the current 1:1 chat's peer) — WhatsApp-style.
  onSearch?: () => void;
  onStarred?: () => void;
  muted?: boolean;
  onToggleMute?: () => void;
  disappearingSeconds?: number | null;
  onChangeDisappearing?: (seconds: number) => void;
}) {
  const { t, lang } = useLanguage();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [fingerprint, setFingerprint] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [blockBusy, setBlockBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [disappearingOpen, setDisappearingOpen] = useState(false);

  useEffect(() => {
    if (!open || !userId) return;
    let cancelled = false;
    setLoading(true);
    setError(false);
    setProfile(null);
    setFingerprint(null);
    (async () => {
      try {
        const supabase = browserSupabase();
        const { data, error: err } = await supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url, last_seen, show_online, created_at')
          .eq('id', userId)
          .maybeSingle();
        if (cancelled) return;
        if (err || !data) {
          setError(true);
        } else {
          setProfile(data as Profile);
        }
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
      // These are best-effort; failures shouldn't block the info sheet.
      isBlockedByMe(userId).then((b) => !cancelled && setBlocked(b)).catch(() => {});
      peerFingerprint(userId).then((f) => !cancelled && setFingerprint(f)).catch(() => {});
    })();
    return () => {
      cancelled = true;
    };
  }, [open, userId]);

  if (!open || !userId) return null;

  async function toggleBlock() {
    if (!userId) return;
    setBlockBusy(true);
    try {
      if (blocked) {
        await unblockUser(userId);
        setBlocked(false);
      } else {
        await blockUser(userId);
        setBlocked(true);
      }
    } catch {
      /* ignore — leave the previous state */
    } finally {
      setBlockBusy(false);
    }
  }

  const name = profile?.display_name || profile?.username || userId.slice(0, 8);
  const online = !!profile?.show_online && !!profile?.last_seen && Date.now() - new Date(profile.last_seen).getTime() < 60_000;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="max-h-[90vh] w-full max-w-sm overflow-auto rounded-3xl border border-slate-800 toky-glass toky-elev p-4">
        <div className="flex items-center justify-between">
          <div className="text-base font-semibold text-slate-100">{t('userInfo.title')}</div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="grid h-8 w-8 place-items-center rounded-full bg-slate-800 text-slate-300 hover:bg-slate-700"
          >
            <XIcon size={18} />
          </button>
        </div>

        {loading ? (
          <div className="mt-6 flex flex-col items-center gap-3">
            <div className="h-24 w-24 animate-pulse rounded-full bg-slate-800" />
            <div className="h-4 w-32 animate-pulse rounded bg-slate-800" />
          </div>
        ) : error ? (
          <p className="mt-6 text-center text-sm text-red-400">{t('userInfo.loadError')}</p>
        ) : (
          <>
            {/* Identity */}
            <div className="mt-4 flex flex-col items-center text-center">
              {profile?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatar_url} alt="" className="h-24 w-24 rounded-full border border-slate-800 object-cover" />
              ) : (
                <span
                  className="grid h-24 w-24 place-items-center rounded-full text-2xl font-bold text-white ring-1 ring-white/20"
                  style={{ backgroundImage: avatarBg(name) }}
                >
                  {initials(name)}
                </span>
              )}
              <div className="mt-3 text-lg font-semibold text-slate-100">{name}</div>
              {profile?.username && <div className="text-sm text-slate-400">@{profile.username}</div>}
              <div className={`mt-1 text-xs ${online ? 'text-emerald-400' : 'text-slate-500'}`}>
                {online
                  ? t('chat.online')
                  : profile?.show_online && profile?.last_seen
                    ? t('chat.lastSeen', { when: formatSeen(profile.last_seen, lang) })
                    : ''}
              </div>
            </div>

            {/* Quick actions */}
            {(onMessage || onAudioCall || onVideoCall) && (
              <div className="mt-5 flex items-center justify-center gap-6">
                {onMessage && (
                  <ActionCircle label={t('userInfo.message')} icon={<ChatBubbleIcon size={22} />} onClick={() => { onMessage(); onClose(); }} />
                )}
                {onAudioCall && (
                  <ActionCircle label={t('userInfo.audioCall')} icon={<PhoneIcon size={22} />} onClick={() => { onAudioCall(); onClose(); }} />
                )}
                {onVideoCall && (
                  <ActionCircle label={t('userInfo.videoCall')} icon={<VideoIcon size={22} />} onClick={() => { onVideoCall(); onClose(); }} />
                )}
              </div>
            )}

            {/* Chat options (only for the current 1:1 chat's peer) */}
            {(onSearch || onStarred || onToggleMute || onChangeDisappearing) && (
              <div className="mt-5 overflow-hidden rounded-lg border border-slate-900 bg-slate-950/60">
                {onSearch && (
                  <button
                    type="button"
                    onClick={() => { onSearch(); onClose(); }}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm text-slate-200 hover:bg-slate-900"
                  >
                    <SearchIcon size={18} /> {t('chat.searchInChat')}
                  </button>
                )}
                {onStarred && (
                  <button
                    type="button"
                    onClick={() => { onStarred(); onClose(); }}
                    className="flex w-full items-center gap-3 border-t border-slate-900 px-3 py-2.5 text-left text-sm text-slate-200 hover:bg-slate-900"
                  >
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
                      <path d="M12 2l2.9 6.26L22 9.27l-5 4.87L18.18 21 12 17.27 5.82 21 7 14.14l-5-4.87 7.1-1.01L12 2z" />
                    </svg>
                    {t('chat.starredTitle')}
                  </button>
                )}
                {onToggleMute && (
                  <div className="flex items-center justify-between border-t border-slate-900 px-3 py-2.5">
                    <span className="text-sm text-slate-200">{muted ? t('common.unmute') : t('common.mute')}</span>
                    <button
                      type="button"
                      onClick={onToggleMute}
                      role="switch"
                      aria-checked={!!muted}
                      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${muted ? 'bg-emerald-600' : 'bg-slate-700'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${muted ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                )}
                {onChangeDisappearing && (
                  <>
                    <button
                      type="button"
                      onClick={() => setDisappearingOpen((v) => !v)}
                      className="flex w-full items-center justify-between border-t border-slate-900 px-3 py-2.5 text-left text-sm text-slate-200 hover:bg-slate-900"
                    >
                      <span>{t('chat.disappearingMenu')}</span>
                      <span className="text-xs text-slate-500">
                        {t(
                          (DISAPPEARING_OPTIONS.find((o) => o.seconds === (disappearingSeconds ?? 0)) ??
                            DISAPPEARING_OPTIONS[0]).labelKey,
                        )}
                      </span>
                    </button>
                    {disappearingOpen && (
                      <div className="border-t border-slate-900 bg-slate-950/80">
                        {DISAPPEARING_OPTIONS.map((opt) => (
                          <button
                            key={opt.seconds}
                            type="button"
                            onClick={() => { onChangeDisappearing(opt.seconds); setDisappearingOpen(false); }}
                            className={`block w-full px-4 py-1.5 text-left text-xs hover:bg-slate-900 ${
                              (disappearingSeconds ?? 0) === opt.seconds ? 'text-blue-400' : 'text-slate-300'
                            }`}
                          >
                            {t(opt.labelKey)}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Member since */}
            {profile?.created_at && (
              <div className="mt-5 rounded-lg border border-slate-900 bg-slate-950/60 p-3 text-sm text-slate-300">
                {t('userInfo.memberSince', { when: formatSince(profile.created_at, lang) })}
              </div>
            )}

            {/* Safety number (E2EE) */}
            {fingerprint && (
              <div className="mt-3 rounded-lg border border-slate-900 bg-slate-950/60 p-3">
                <div className="text-sm font-medium text-slate-200">{t('userInfo.safetyNumber')}</div>
                <div className="mt-1 break-all font-mono text-xs tracking-wide text-slate-400">{fingerprint}</div>
                <div className="mt-1.5 text-[11px] text-slate-500">{t('userInfo.safetyNumberDesc')}</div>
              </div>
            )}

            {blocked && (
              <p className="mt-3 text-center text-xs text-amber-400">{t('userInfo.blockedNotice')}</p>
            )}

            {/* Danger actions */}
            <div className="mt-5 space-y-2 border-t border-slate-900 pt-4">
              <button
                type="button"
                onClick={toggleBlock}
                disabled={blockBusy}
                className="w-full rounded-lg border border-rose-900/50 bg-rose-950/20 px-4 py-2 text-sm text-rose-300 hover:bg-rose-950/30 disabled:opacity-50"
              >
                {blocked ? t('userInfo.unblock') : t('userInfo.block')}
              </button>
              {onReport && (
                <button
                  type="button"
                  onClick={() => { onReport(); onClose(); }}
                  className="w-full rounded-lg border border-slate-800 bg-slate-900 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
                >
                  {t('userInfo.report')}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ActionCircle({ label, icon, onClick }: { label: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex flex-col items-center gap-1.5 text-slate-200">
      <span className="grid h-12 w-12 place-items-center rounded-full toky-grad toky-ring-brand text-white">{icon}</span>
      <span className="text-xs">{label}</span>
    </button>
  );
}
