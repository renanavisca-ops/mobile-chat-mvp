'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createSignedStoryUrl, markStoryViewed, countStoryViews, deleteStory } from '@/lib/db/stories';
import { useT, useLanguage } from '@/lib/i18n/context';
import { XIcon, TrashIcon, EyeIcon } from '@/components/icons';
import type { StoryGroup } from '@/lib/db/types';

const DURATION = 5000;

export function StoryViewer({
  groups: groupsProp,
  startIndex,
  onClose,
  onChanged,
}: {
  groups: StoryGroup[];
  startIndex: number;
  onClose: () => void;
  onChanged: () => void;
}) {
  const t = useT();
  const { lang } = useLanguage();
  // Freeze the group list for the lifetime of the viewer. Marking stories viewed
  // reorders the live list (seen groups sink), which would shift the indices out
  // from under us mid-view — causing the wrong story to show, the close button to
  // miss, and every group to look "seen". We navigate the snapshot and refresh
  // the bar only once, on close.
  const [groups] = useState(groupsProp);
  const [groupIndex, setGroupIndex] = useState(startIndex);
  const [storyIndex, setStoryIndex] = useState(0);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [viewCount, setViewCount] = useState<number | null>(null);
  // Only start the auto-advance countdown once the story's content is actually
  // on screen — otherwise a slow-loading image gets skipped before it appears.
  const [loaded, setLoaded] = useState(false);
  // Press-and-hold to pause: hold the story to freeze it, release to continue.
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<number | null>(null);
  const startRef = useRef<number>(0); // when the current run segment started
  const remainingRef = useRef<number>(DURATION); // ms left on the current story
  const holdTimer = useRef<number | null>(null);
  const wasHold = useRef(false);

  const group = groups[groupIndex];
  const story = group?.stories[storyIndex];

  // Refresh the bar exactly once, when the viewer unmounts, so seen/unseen rings
  // update to reflect everything viewed this session.
  const onChangedRef = useRef(onChanged);
  onChangedRef.current = onChanged;
  useEffect(() => {
    return () => onChangedRef.current();
  }, []);

  const goNextGroup = useCallback(() => {
    setStoryIndex(0);
    setGroupIndex((gi) => {
      if (gi + 1 >= groups.length) {
        onClose();
        return gi;
      }
      return gi + 1;
    });
  }, [groups.length, onClose]);

  const next = useCallback(() => {
    if (!group) return;
    if (storyIndex + 1 < group.stories.length) {
      setStoryIndex((si) => si + 1);
    } else {
      goNextGroup();
    }
  }, [group, storyIndex, goNextGroup]);

  const prev = useCallback(() => {
    if (storyIndex > 0) {
      setStoryIndex((si) => si - 1);
    } else if (groupIndex > 0) {
      const pg = groups[groupIndex - 1];
      setGroupIndex(groupIndex - 1);
      setStoryIndex(Math.max(0, pg.stories.length - 1));
    }
  }, [storyIndex, groupIndex, groups]);

  // Per-story side effects: mark viewed, resolve media, fetch own view count,
  // and arm the auto-advance timer.
  useEffect(() => {
    if (!story) return;
    let alive = true;
    setMediaUrl(null);
    setViewCount(null);
    // Fresh story: full duration, not paused.
    remainingRef.current = DURATION;
    setPaused(false);
    // Text stories have nothing to download, so they're "loaded" right away.
    setLoaded(!story.media_path);

    // Persist the view, but DON'T refresh the bar now — that would re-sort the
    // live list mid-view. The bar is refreshed once when the viewer closes.
    markStoryViewed(story.id).catch(() => {});

    if (story.media_path) {
      createSignedStoryUrl(story.media_path).then((u) => alive && setMediaUrl(u)).catch(() => {});
    }
    if (group?.isMe) {
      countStoryViews(story.id).then((n) => alive && setViewCount(n)).catch(() => {});
    }

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupIndex, storyIndex]);

  // Arm the auto-advance timer only once the content is loaded (see `loaded`).
  // While paused (finger held down) we don't arm it; on release we re-arm for
  // just the time that was left, so the story resumes where it froze.
  useEffect(() => {
    if (!story || !loaded || paused) return;
    if (timerRef.current) window.clearTimeout(timerRef.current);
    startRef.current = Date.now();
    timerRef.current = window.setTimeout(next, remainingRef.current);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, groupIndex, storyIndex, paused]);

  // Pause/resume helpers for press-and-hold.
  const pause = useCallback(() => {
    setPaused((p) => {
      if (p) return p;
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      remainingRef.current = Math.max(0, remainingRef.current - (Date.now() - startRef.current));
      return true;
    });
  }, []);
  const resume = useCallback(() => {
    setPaused(false);
  }, []);

  function onHoldStart() {
    wasHold.current = false;
    if (holdTimer.current) window.clearTimeout(holdTimer.current);
    // A short delay distinguishes a hold from a quick tap (which pages the story).
    holdTimer.current = window.setTimeout(() => {
      wasHold.current = true;
      pause();
    }, 200);
  }
  function onHoldEnd() {
    if (holdTimer.current) {
      window.clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    if (wasHold.current) resume();
  }
  // Tap zones: ignore the click that ends a press-and-hold (don't page).
  function onTapPrev() {
    if (wasHold.current) { wasHold.current = false; return; }
    prev();
  }
  function onTapNext() {
    if (wasHold.current) { wasHold.current = false; return; }
    next();
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev, onClose]);

  async function onDelete() {
    if (!story) return;
    if (timerRef.current) window.clearTimeout(timerRef.current);
    try {
      await deleteStory(story.id);
    } catch {
      // fall through — close either way; the bar refresh on unmount reconciles.
    }
    // Close after delete; the frozen snapshot still holds the removed story, so
    // re-clamping in place would show a stale item. The unmount effect refreshes.
    onClose();
  }

  if (!group || !story) return null;

  const name = group.isMe ? t('stories.you') : group.display_name || group.username || t('chat.someone');

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black">
      <div className="relative flex h-full w-full max-w-md flex-col">
        {/* Progress bars */}
        <div className="absolute left-0 right-0 top-0 z-20 flex gap-1 p-2">
          {group.stories.map((s, i) => (
            <div key={s.id} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/30">
              <div
                className="h-full bg-white"
                style={
                  i < storyIndex
                    ? { width: '100%' }
                    : i === storyIndex && loaded
                    ? { animation: `storyProgress ${DURATION}ms linear forwards`, animationPlayState: paused ? 'paused' : 'running' }
                    : { width: '0%' }
                }
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="absolute left-0 right-0 top-3 z-20 flex items-center justify-between px-3 pt-2">
          <div className="flex items-center gap-2">
            {group.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={group.avatar_url} alt="" className="h-8 w-8 rounded-full border border-white/40 object-cover" />
            ) : (
              <span className="grid h-8 w-8 place-items-center rounded-full bg-white/20 text-sm font-semibold text-white">
                {name.charAt(0).toUpperCase()}
              </span>
            )}
            <div className="text-sm font-medium text-white">{name}</div>
            <div className="text-xs text-white/70">
              {new Date(story.created_at).toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="grid place-items-center rounded-full bg-black/40 p-1.5 text-white hover:bg-black/60"
          >
            <XIcon size={18} />
          </button>
        </div>

        {/* Content */}
        <div
          className="relative flex flex-1 items-center justify-center overflow-hidden"
          onPointerDown={onHoldStart}
          onPointerUp={onHoldEnd}
          onPointerLeave={onHoldEnd}
          onPointerCancel={onHoldEnd}
        >
          {story.media_path ? (
            mediaUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={mediaUrl}
                alt=""
                className="max-h-full max-w-full object-contain"
                onLoad={() => setLoaded(true)}
                onError={() => setLoaded(true)}
              />
            ) : (
              <div className="h-16 w-16 animate-pulse rounded-full bg-white/10" />
            )
          ) : (
            <div
              className="grid h-full w-full place-items-center p-8 text-center text-2xl font-semibold text-white"
              style={{ background: story.background || '#1e293b' }}
            >
              {story.text_content}
            </div>
          )}

          {/* Tap zones */}
          <button
            type="button"
            onClick={onTapPrev}
            aria-label={t('stories.previous')}
            className="absolute inset-y-0 left-0 w-1/3"
          />
          <button
            type="button"
            onClick={onTapNext}
            aria-label={t('stories.nextStory')}
            className="absolute inset-y-0 right-0 w-2/3"
          />
        </div>

        {/* Footer (own story: views + delete) */}
        {group.isMe && (
          <div className="absolute bottom-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-3">
            <span className="flex items-center gap-1.5 text-xs text-white/80">
              <EyeIcon size={16} /> {viewCount ?? 0} {viewCount === 1 ? t('stories.view') : t('stories.views')}
            </span>
            <button
              type="button"
              onClick={onDelete}
              className="flex items-center gap-1.5 rounded-lg bg-black/50 px-3 py-1.5 text-xs text-rose-300 hover:bg-black/70"
            >
              <TrashIcon size={16} /> {t('common.delete')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
