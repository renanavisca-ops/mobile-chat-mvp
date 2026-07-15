import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * AI helper endpoint — smart replies + translation via the Claude API.
 *
 * Configure a server env var (never NEXT_PUBLIC):
 *   ANTHROPIC_API_KEY   — your Anthropic API key
 *   ANTHROPIC_MODEL     — optional, defaults to a fast Haiku model
 *
 * Returns 501 { code: 'not_configured' } when the key is absent, so the UI can
 * hide AI features cleanly instead of erroring.
 */

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';

async function callClaude(system: string, userText: string, maxTokens: number): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY as string,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: userText }],
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Claude API ${res.status}: ${detail.slice(0, 200)}`);
  }
  const data = await res.json();
  return (data?.content?.[0]?.text ?? '').trim();
}

export async function POST(req: Request) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const {
    data: { user },
    error: authError,
  } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'AI not configured', code: 'not_configured' }, { status: 501 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }

  try {
    if (body.type === 'replies') {
      const context = String(body.context ?? '').slice(0, 4000);
      const system =
        'You suggest 3 short, natural reply options the user could send next in a casual chat. ' +
        'Reply in the same language as the conversation. Keep each under ~12 words. ' +
        'Return ONLY a JSON array of exactly 3 strings — no markdown, no extra text.';
      const raw = await callClaude(system, `Conversation (most recent last):\n${context}\n\nSuggest 3 replies I could send.`, 200);
      let replies: string[] = [];
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) replies = parsed.map((x) => String(x)).slice(0, 3);
      } catch {
        replies = raw
          .split('\n')
          .map((l) => l.replace(/^[-*\d.\s"]+/, '').replace(/"$/, '').trim())
          .filter(Boolean)
          .slice(0, 3);
      }
      return NextResponse.json({ replies });
    }

    if (body.type === 'translate') {
      const text = String(body.text ?? '').slice(0, 4000);
      const target = String(body.targetLang ?? 'English').slice(0, 40);
      if (!text) return NextResponse.json({ text: '' });
      const system = `You are a translator. Translate the user's message into ${target}. Return ONLY the translation, with no quotes, notes, or explanation.`;
      const out = await callClaude(system, text, 600);
      return NextResponse.json({ text: out });
    }

    return NextResponse.json({ error: 'Unknown type' }, { status: 400 });
  } catch (e: any) {
    console.error('AI route error:', e);
    return NextResponse.json({ error: 'AI request failed' }, { status: 502 });
  }
}
