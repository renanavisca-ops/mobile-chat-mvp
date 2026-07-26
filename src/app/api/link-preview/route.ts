import { NextResponse } from 'next/server';

/**
 * Server-side Open Graph fetcher for chat link previews. Runs on the server so
 * the browser dodges CORS, and so we can keep basic SSRF guards in one place.
 *
 * GET /api/link-preview?url=<encoded url>
 *   -> { url, title, description, image, siteName } (fields may be null)
 *
 * Guards: https/http only, no credentials in the URL, and a blocklist of
 * loopback / link-local / private hostnames so the endpoint can't be pointed at
 * internal services. Response is size- and time-capped.
 */

export const runtime = 'nodejs';

const MAX_BYTES = 512 * 1024; // only need the <head>; cap the download
const TIMEOUT_MS = 6000;

function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal')) return true;
  // IPv6 loopback / IPv4-mapped
  if (h === '::1' || h === '[::1]') return true;
  // Private / loopback / link-local IPv4 ranges
  if (/^127\./.test(h)) return true;
  if (/^10\./.test(h)) return true;
  if (/^192\.168\./.test(h)) return true;
  if (/^169\.254\./.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
  if (h === '0.0.0.0') return true;
  return false;
}

function pickMeta(html: string, keys: string[]): string | null {
  for (const key of keys) {
    // property="og:title" content="..."  (either attribute order)
    const patterns = [
      new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]*content=["']([^"']*)["']`, 'i'),
      new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${key}["']`, 'i'),
    ];
    for (const re of patterns) {
      const m = html.match(re);
      if (m?.[1]) return decodeEntities(m[1].trim());
    }
  }
  return null;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'");
}

export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get('url');
  if (!raw) return NextResponse.json({ error: 'Missing url' }, { status: 400 });

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return NextResponse.json({ error: 'Invalid url' }, { status: 400 });
  }
  if (target.protocol !== 'http:' && target.protocol !== 'https:') {
    return NextResponse.json({ error: 'Unsupported protocol' }, { status: 400 });
  }
  if (target.username || target.password || isBlockedHost(target.hostname)) {
    return NextResponse.json({ error: 'Blocked host' }, { status: 400 });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(target.toString(), {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        // Some sites gate OG tags behind a real UA / accept header.
        'user-agent': 'Mozilla/5.0 (compatible; TokyBot/1.0; +link-preview)',
        accept: 'text/html,application/xhtml+xml',
      },
    });
    const ctype = res.headers.get('content-type') || '';
    if (!res.ok || !ctype.includes('text/html') || !res.body) {
      return NextResponse.json({ url: target.toString(), title: null, description: null, image: null, siteName: null });
    }

    // Read at most MAX_BYTES so a huge page can't exhaust memory.
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (total < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      total += value.length;
    }
    reader.cancel().catch(() => {});
    const html = new TextDecoder('utf-8').decode(concat(chunks, total));

    const title =
      pickMeta(html, ['og:title', 'twitter:title']) ||
      decodeEntities((html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] || '').trim()) ||
      null;
    let image = pickMeta(html, ['og:image', 'og:image:url', 'twitter:image', 'twitter:image:src']);
    if (image) {
      try {
        image = new URL(image, target).toString(); // resolve relative image paths
      } catch {
        image = null;
      }
    }

    const data = {
      url: target.toString(),
      title: title || null,
      description: pickMeta(html, ['og:description', 'twitter:description', 'description']),
      image: image || null,
      siteName: pickMeta(html, ['og:site_name']) || target.hostname.replace(/^www\./, ''),
    };

    return NextResponse.json(data, {
      // Preview data is stable; let the CDN/browser cache it.
      headers: { 'cache-control': 'public, max-age=86400, s-maxage=86400' },
    });
  } catch {
    return NextResponse.json({ url: target.toString(), title: null, description: null, image: null, siteName: null });
  } finally {
    clearTimeout(timer);
  }
}

function concat(chunks: Uint8Array[], total: number): Uint8Array {
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    if (off + c.length > total) {
      out.set(c.subarray(0, total - off), off);
      break;
    }
    out.set(c, off);
    off += c.length;
  }
  return out;
}
