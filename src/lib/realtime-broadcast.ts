// Server-side Supabase Realtime broadcast over HTTP (no websocket needed in a
// serverless function). Lets an API route push a 'broadcast' message to a
// channel that browser/app clients are subscribed to — e.g. telling a caller
// that a callee declined from a killed app.
//
// Uses the Realtime REST endpoint: POST /realtime/v1/api/broadcast with the
// service-role key. The `topic` is the channel name exactly as clients pass to
// `supabase.channel(name)` (here, `call-user:<userId>`).

type BroadcastMsg = { topic: string; event: string; payload: Record<string, unknown> };

export async function realtimeBroadcast(messages: BroadcastMsg[]): Promise<boolean> {
  if (messages.length === 0) return true;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://tjlyrgvdqgyafamiwyus.supabase.co';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return false;
  try {
    const res = await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({ messages }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
