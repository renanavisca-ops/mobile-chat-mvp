'use client';

import { useCallback, useEffect, useState } from 'react';
import { browserSupabase } from '@/lib/supabase/client';
import { listStoryGroups } from '@/lib/db/stories';
import { StoryComposer } from '@/components/story-composer';
import { StoryViewer } from '@/components/story-viewer';
import { useT } from '@/lib/i18n/context';
import type { StoryGroup } from '@/lib/db/types';

function Ring({
  group,
  onClick,
  label,
}: {
  group: StoryGroup;
  onClick: () => void;
  label: string;
}) {
  const initial = (group.display_name || group.username || '?').trim().charAt(0).toUpperCase();
  return (
    <button type="button" onClick={onClick} className="flex w-16 shrink-0 flex-col items-center gap-1">
      <span
        className={`grid h-16 w-16 place-items-center rounded-full p-[2px] ${
          group.allViewed ? 'bg-slate-700' : 'bg-gradient-to-tr from-indigo-500 via-fuchsia-500 to-amber-400'
        }`}
      >
        <span className="grid h-full w-full place-items-center overflow-hidden rounded-full border-2 border-slate-950 bg-slate-800">
          {group.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={group.avatar_url} alt="" className="h-full w-full rounded-full object-cover" />
          ) : (
            <span className="text-lg font-semibold text-slate-300">{initial}</span>
          )}
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
        {/* Your story / add */}
        <div className="flex w-16 shrink-0 flex-col items-center gap-1">
          <button
            type="button"
            onClick={() => setComposerOpen(true)}
            aria-label={t('stories.addTitle')}
            className="relative grid h-16 w-16 place-items-center rounded-full border-2 border-dashed border-slate-700 bg-slate-900 text-2xl text-slate-400 hover:bg-slate-800"
          >
            {myGroup?.avatar_url ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={myGroup.avatar_url} alt="" className="h-full w-full rounded-full object-cover opacity-70" />
                <span className="absolute bottom-0 right-0 grid h-5 w-5 place-items-center rounded-full bg-indigo-600 text-xs text-white">
                  +
                </span>
              </>
            ) : (
              '+'
            )}
          </button>
          <span className="w-full truncate text-center text-[11px] text-slate-400">{t('stories.yourStory')}</span>
        </div>

        {/* My existing story ring (tap to view) */}
        {myGroup && (
          <Ring
            group={myGroup}
            label={t('stories.you')}
            onClick={() => setViewerStart(groups.indexOf(myGroup))}
          />
        )}

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
