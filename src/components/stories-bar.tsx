'use client';

import { useCallback, useEffect, useState } from 'react';
import { browserSupabase } from '@/lib/supabase/client';
import { listStoryGroups, createSignedStoryUrl } from '@/lib/db/stories';
import { StoryComposer } from '@/components/story-composer';
import { StoryViewer } from '@/components/story-viewer';
import { useT } from '@/lib/i18n/context';
import type { StoryGroup } from '@/lib/db/types';

// Preview of a group's most recent story shown inside its ring: the image for
// photo stories, the coloured card for text stories, else the avatar/initial.
function StoryThumb({ group }: { group: StoryGroup }) {
  const first = group.stories[0];
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    if (first?.media_path) {
      createSignedStoryUrl(first.media_path).then((u) => alive && setUrl(u)).catch(() => {});
    }
    return () => {
      alive = false;
    };
  }, [first?.media_path]);

  if (first?.media_path) {
    return url ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt="" className="h-full w-full rounded-full object-cover" />
    ) : (
      <span className="h-full w-full animate-pulse rounded-full bg-slate-700" />
    );
  }
  if (first && (first.text_content || first.background)) {
    return (
      <span
        className="grid h-full w-full place-items-center overflow-hidden rounded-full p-1 text-center text-[8px] font-semibold leading-tight text-white"
        style={{ background: first.background || '#1e293b' }}
      >
        {(first.text_content || '').slice(0, 14)}
      </span>
    );
  }
  const initial = (group.display_name || group.username || '?').trim().charAt(0).toUpperCase();
  return group.avatar_url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={group.avatar_url} alt="" className="h-full w-full rounded-full object-cover" />
  ) : (
    <span className="text-lg font-semibold text-slate-300">{initial}</span>
  );
}

function Ring({
  group,
  onClick,
  label,
}: {
  group: StoryGroup;
  onClick: () => void;
  label: string;
}) {
  return (
    <button type="button" onClick={onClick} className="flex w-16 shrink-0 flex-col items-center gap-1">
      <span
        className={`grid h-16 w-16 place-items-center rounded-full p-[2px] ${
          group.allViewed ? 'bg-slate-700' : 'bg-gradient-to-tr from-indigo-500 via-fuchsia-500 to-amber-400'
        }`}
      >
        <span className="grid h-full w-full place-items-center overflow-hidden rounded-full border-2 border-slate-950 bg-slate-800">
          <StoryThumb group={group} />
        </span>
      </span>
      <span className="w-full truncate text-center text-[11px] text-slate-400">{label}</span>
    </button>
  );
}

export function StoriesBar() {
  const t = useT();
  const [groups, setGroups] = useState<StoryGroup[]>([]);
  const [composerOpen, setComposerOpen] = useState(false);
  const [viewerStart, setViewerStart] = useState<number | null>(null);

  const load = useCallback(() => {
    listStoryGroups()
      .then(setGroups)
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const supabase = browserSupabase();
    const channel = supabase
      .channel('public:stories')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stories' }, () => load())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load]);

  const myGroup = groups.find((g) => g.isMe) ?? null;
  const others = groups.filter((g) => !g.isMe);

  return (
    <div className="mb-2 border-b border-slate-900 pb-3">
      <div className="flex gap-3 overflow-x-auto pb-1">
        {/* Your story: previews the posted status; the + badge adds a new one */}
        <div className="relative flex w-16 shrink-0 flex-col items-center gap-1">
          {myGroup ? (
            <>
              <button
                type="button"
                onClick={() => setViewerStart(groups.indexOf(myGroup))}
                aria-label={t('stories.you')}
                className={`grid h-16 w-16 place-items-center rounded-full p-[2px] ${
                  myGroup.allViewed ? 'bg-slate-700' : 'bg-gradient-to-tr from-indigo-500 via-fuchsia-500 to-amber-400'
                }`}
              >
                <span className="grid h-full w-full place-items-center overflow-hidden rounded-full border-2 border-slate-950 bg-slate-800">
                  <StoryThumb group={myGroup} />
                </span>
              </button>
              <button
                type="button"
                onClick={() => setComposerOpen(true)}
                aria-label={t('stories.addTitle')}
                className="absolute right-1 top-11 grid h-5 w-5 place-items-center rounded-full border-2 border-slate-950 toky-grad text-sm text-white"
              >
                +
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setComposerOpen(true)}
              aria-label={t('stories.addTitle')}
              className="grid h-16 w-16 place-items-center rounded-full border-2 border-dashed border-slate-700 bg-slate-900 text-2xl text-slate-400 hover:bg-slate-800"
            >
              +
            </button>
          )}
          <span className="w-full truncate text-center text-[11px] text-slate-400">{t('stories.yourStory')}</span>
        </div>

        {/* Contacts' stories */}
        {others.map((g) => (
          <Ring
            key={g.user_id}
            group={g}
            label={g.display_name || g.username || '—'}
            onClick={() => setViewerStart(groups.indexOf(g))}
          />
        ))}
      </div>

      <StoryComposer open={composerOpen} onClose={() => setComposerOpen(false)} onPosted={load} />

      {viewerStart !== null && groups[viewerStart] && (
        <StoryViewer
          groups={groups}
          startIndex={viewerStart}
          onClose={() => setViewerStart(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}
