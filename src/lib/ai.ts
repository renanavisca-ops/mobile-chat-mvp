'use client';

import { browserSupabase } from '@/lib/supabase/client';

/**
 * Client wrappers for the /api/ai endpoint (smart replies + translation).
 * Both degrade to a "not configured" signal when ANTHROPIC_API_KEY is unset on
 * the server, so callers can hide AI affordances instead of erroring.
 */

async function callAI(body: Record<string, unknown>): Promise<{ ok: boolean; configured: boolean; data: any }> {
  const supabase = browserSupabase();
  const { data: sess } = await supabase.auth.getSession();
  const res = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sess.session?.access_token}` },
    body: JSON.stringify(body),
  });
  if (res.status === 501) return { ok: false, configured: false, data: null };
  if (!res.ok) return { ok: false, configured: true, data: null };
  return { ok: true, configured: true, data: await res.json() };
}

export async function suggestReplies(context: string): Promise<{ configured: boolean; replies: string[] }> {
  const r = await callAI({ type: 'replies', context });
  return { configured: r.configured, replies: r.data?.replies ?? [] };
}

export async function translateText(
  text: string,
  targetLang: string
): Promise<{ configured: boolean; text: string | null }> {
  const r = await callAI({ type: 'translate', text, targetLang });
  return { configured: r.configured, text: r.data?.text ?? null };
}
