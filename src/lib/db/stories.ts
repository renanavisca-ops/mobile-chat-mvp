'use client';

import { browserSupabase } from '@/lib/supabase/client';
import type { Story, StoryGroup } from '@/lib/db/types';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function extFor(type: string): string {
  if (type === 'image/png') return 'png';
  if (type === 'image/webp') return 'webp';
  return 'jpg';
}

/** Upload an image and publish it as a 24h story. */
export async function createImageStory(file: File): Promise<void> {
  const supabase = browserSupabase();
  const { data: me } = await supabase.auth.getUser();
  if (!me.user) throw new Error('Not authenticated');

  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Only JPG, PNG or WEBP.');
  }
  if (file.size > MAX_IMAGE_BYTES) throw new Error('Maximum 5MB per image.');

  const path = `${me.user.id}/${Date.now()}_${crypto.randomUUID()}.${extFor(file.type)}`;
  const { error: upErr } = await supabase.storage.from('stories').upload(path, file, {
    upsert: false,
    contentType: file.type,
    cacheControl: '3600',
  });
  if (upErr) throw upErr;

  const { error } = await supabase.from('stories').insert({ user_id: me.user.id, media_path: path });
  if (error) throw error;
}

/** Publish a text-card story with a background color. */
export async function createTextStory(text: string, background: string): Promise<void> {
  const supabase = browserSupabase();
  const { data: me } = await supabase.auth.getUser();
  if (!me.user) throw new Error('Not authenticated');

  const trimmed = text.trim();
  if (!trimmed) throw new Error('Write something first.');

  const { error } = await supabase
    .from('stories')
    .insert({ user_id: me.user.id, text_content: trimmed.slice(0, 280), background });
  if (error) throw error;
}

export async function createSignedStoryUrl(path: string, expiresSeconds = 60 * 10): Promise<string> {
  const supabase = browserSupabase();
  const { data, error } = await supabase.storage.from('stories').createSignedUrl(path, expiresSeconds);
  if (error) throw error;
  return data.signedUrl;
}

/**
 * Fetch all visible, non-expired stories (mine + contacts') and group them by
 * author for the rings strip. Groups are ordered: me first, then authors with
 * unseen stories, then the rest — each by most recent story.
 */
export async function listStoryGroups(): Promise<StoryGroup[]> {
  const supabase = browserSupabase();
  const { data: me } = await supabase.auth.getUser();
  if (!me.user) return [];
  const myId = me.user.id;

  // Only show my own status plus statuses from people in my contacts — not every
  // user on the platform.
  const { data: contactRows } = await supabase
    .from('contacts')
    .select('contact_id')
    .eq('owner_id', myId);
  const contactIds = (contactRows ?? []).map((r) => r.contact_id).filter(Boolean);
  const allowedAuthors = Array.from(new Set([myId, ...contactIds]));

  const { data: stories, error } = await supabase
    .from('stories')
    .select('id, user_id, media_path, text_content, background, created_at, expires_at')
    .in('user_id', allowedAuthors)
    .order('created_at', { ascending: true });
  if (error) throw error;

  const rows = (stories ?? []) as Story[];
  if (rows.length === 0) return [];

  const authorIds = Array.from(new Set(rows.map((s) => s.user_id)));

  const [profilesRes, viewsRes] = await Promise.all([
    supabase.from('profiles').select('id, username, display_name, avatar_url').in('id', authorIds),
    supabase.from('story_views').select('story_id').eq('viewer_id', myId),
  ]);

  const profById = new Map<string, { username: string | null; display_name: string | null; avatar_url: string | null }>();
  for (const p of profilesRes.data ?? []) {
    profById.set(p.id, { username: p.username, display_name: p.display_name, avatar_url: p.avatar_url });
  }
  const viewedIds = new Set((viewsRes.data ?? []).map((v) => v.story_id));

  const byUser = new Map<string, Story[]>();
  for (const s of rows) {
    const arr = byUser.get(s.user_id) ?? [];
    arr.push(s);
    byUser.set(s.user_id, arr);
  }

  const groups: StoryGroup[] = [];
  for (const [userId, userStories] of byUser) {
    const prof = profById.get(userId);
    groups.push({
      user_id: userId,
      username: prof?.username ?? null,
      display_name: prof?.display_name ?? null,
      avatar_url: prof?.avatar_url ?? null,
      stories: userStories,
      allViewed: userStories.every((s) => viewedIds.has(s.id)),
      isMe: userId === myId,
    });
  }

  groups.sort((a, b) => {
    if (a.isMe !== b.isMe) return a.isMe ? -1 : 1;
    if (a.allViewed !== b.allViewed) return a.allViewed ? 1 : -1;
    const aLast = a.stories[a.stories.length - 1]?.created_at ?? '';
    const bLast = b.stories[b.stories.length - 1]?.created_at ?? '';
    return bLast.localeCompare(aLast);
  });

  return groups;
}

export async function markStoryViewed(storyId: string): Promise<void> {
  const supabase = browserSupabase();
  const { data: me } = await supabase.auth.getUser();
  if (!me.user) return;
  await supabase
    .from('story_views')
    .upsert({ story_id: storyId, viewer_id: me.user.id }, { onConflict: 'story_id,viewer_id' });
}

/** Count of distinct viewers for one of your own stories (the "seen by" tally). */
export async function countStoryViews(storyId: string): Promise<number> {
  const supabase = browserSupabase();
  const { count, error } = await supabase
    .from('story_views')
    .select('*', { count: 'exact', head: true })
    .eq('story_id', storyId);
  if (error) throw error;
  return count ?? 0;
}

export async function deleteStory(storyId: string): Promise<void> {
  const supabase = browserSupabase();
  const { error } = await supabase.from('stories').delete().eq('id', storyId);
  if (error) throw error;
}
