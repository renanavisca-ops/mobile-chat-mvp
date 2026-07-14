'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createSignedStoryUrl, markStoryViewed, countStoryViews, deleteStory } from '@/lib/db/stories';
import { useT, useLanguage } from '@/lib/i18n/context';
import type { StoryGroup } from '@/lib/db/types';

const DURATION = 5000;

export function StoryViewer({
  groups,
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
  const [groupIndex, setGroupIndex] = useState(startIndex);
  const [storyIndex, setStoryIndex] = useState(0);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [viewCount, setViewCount] = useState<number | null>(null);
  const timerRef = useRef<number | null>(null);

  const group = groups[groupIndex];
  const story = group?.stories[storyIndex];

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

    markStoryViewed(story.id).then(onChanged).catch(() => {});

    if (story.media_path) {
      createSignedStoryUrl(story.media_path).then((u) => alive && setMediaUrl(u)).catch(() => {});
    }
    if (group?.isMe) {
      countStoryViews(story.id).then((n) => alive && setViewCount(n)).catch(() => {});
    }

    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(next, DURATION);

    return () => {
      alive = false;
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupIndex, storyIndex]);

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
      onChanged();
      // If that was the group's only story, leave; else re-clamp.
      if (group.stories.length <= 1) {
        onClose();
      } else {
        setStoryIndex((si) => Math.max(0, Math.min(si, group.stories.length - 2)));
      }
    } catch {
      onClose();
    }
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
                    : i === storyIndex
                    ? { animation: `storyProgress ${DURATION}ms linear forwards` }
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
            className="rounded-full bg-black/40 px-2 py-1 text-white hover:bg-black/60"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="relative flex flex-1 items-center justify-center overflow-hidden">
          {story.media_path ? (
            mediaUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mediaUrl} alt="" className="max-h-full max-w-full object-contain" />
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
            onClick={prev}
            aria-label={t('stories.previous')}
            className="absolute inset-y-0 left-0 w-1/3"
          />
          <button
            type="button"
            onClick={next}
            aria-label={t('stories.nextStory')}
            className="absolute inset-y-0 right-0 w-2/3"
          />
        </div>

        {/* Footer (own story: views + delete) */}
        {group.isMe && (
          <div className="absolute bottom-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-3">
            <span className="text-xs text-white/80">
              👁️ {viewCount ?? 0} {viewCount === 1 ? t('stories.view') : t('stories.views')}
            </span>
            <button
              type="button"
              onClick={onDelete}
              className="rounded-lg bg-black/50 px-3 py-1.5 text-xs text-rose-300 hover:bg-black/70"
            >
              🗑️ {t('common.delete')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
