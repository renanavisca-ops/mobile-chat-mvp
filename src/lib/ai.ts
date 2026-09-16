'use client';

import { apiFetch } from '@/lib/api/client';
import { browserSupabase } from '@/lib/supabase/client';

/**
 * Client wrappers for the /api/ai endpoint (smart replies + translation).
 * Both degrade to a "not configured" signal when ANTHROPIC_API_KEY is unset on
 * the server, so callers can hide AI affordances instead of erroring.
 */

type AIResult = { configured: boolean; error: string | null; data: any };

async function callAI(body: Record<string, unknown>): Promise<AIResult> {
  const supabase = browserSupabase();
  const { data: sess } = await supabase.auth.getSession();
  const res = await apiFetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sess.session?.access_token}` },
    body: JSON.stringify(body),
  });
  if (res.status === 501) return { configured: false, error: null, data: null };
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = json?.detail || json?.error || `Error ${res.status}`;
    return { configured: true, error: String(detail), data: null };
  }
  return { configured: true, error: null, data: json };
}

export async function suggestReplies(
  context: string
): Promise<{ configured: boolean; error: string | null; replies: string[] }> {
  const r = await callAI({ type: 'replies', context });
  return { configured: r.configured, error: r.error, replies: r.data?.replies ?? [] };
}

export async function translateText(
  text: string,
  targetLang: string
): Promise<{ configured: boolean; error: string | null; text: string | null }> {
  const r = await callAI({ type: 'translate', text, targetLang });
  return { configured: r.configured, error: r.error, text: r.data?.text ?? null };
}
