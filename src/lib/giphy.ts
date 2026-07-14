'use client';

/**
 * Minimal GIPHY client. The API key is read from NEXT_PUBLIC_GIPHY_API_KEY
 * (GIPHY keys are designed for client-side use and are rate-limited). Add the
 * key to your Vercel project env vars and a local .env.local — it is not
 * committed to the repo.
 */

const API_KEY = process.env.NEXT_PUBLIC_GIPHY_API_KEY ?? '';
const BASE = 'https://api.giphy.com/v1/gifs';

export type Gif = {
  id: string;
  /** Small preview URL for the picker grid. */
  previewUrl: string;
  /** URL sent in the message and rendered in the bubble. */
  sendUrl: string;
  title: string;
};

export function giphyConfigured(): boolean {
  return API_KEY.length > 0;
}

type GiphyItem = {
  id: string;
  title?: string;
  images: {
    fixed_width?: { url: string };
    downsized?: { url: string };
    original?: { url: string };
  };
};

function mapItems(items: GiphyItem[]): Gif[] {
  return items
    .map((g) => {
      const previewUrl = g.images.fixed_width?.url ?? g.images.downsized?.url ?? g.images.original?.url ?? '';
      const sendUrl = g.images.downsized?.url ?? g.images.original?.url ?? previewUrl;
      return { id: g.id, previewUrl, sendUrl, title: g.title ?? '' };
    })
    .filter((g) => g.previewUrl && g.sendUrl);
}

export async function trendingGifs(limit = 24): Promise<Gif[]> {
  if (!API_KEY) return [];
  const url = `${BASE}/trending?api_key=${API_KEY}&limit=${limit}&rating=pg-13`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Could not load GIFs');
  const json = await res.json();
  return mapItems(json.data ?? []);
}

export async function searchGifs(query: string, limit = 24): Promise<Gif[]> {
  if (!API_KEY) return [];
  const q = query.trim();
  if (!q) return trendingGifs(limit);
  const url = `${BASE}/search?api_key=${API_KEY}&q=${encodeURIComponent(q)}&limit=${limit}&rating=pg-13&lang=en`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Could not search GIFs');
  const json = await res.json();
  return mapItems(json.data ?? []);
}
