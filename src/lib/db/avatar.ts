'use client';

import { apiFetch } from '@/lib/api/client';
import { browserSupabase } from '@/lib/supabase/client';

/**
 * Upload a profile avatar. The actual write happens in the `/api/avatar` route
 * with the service role — uploading straight from the browser intermittently
 * reached Storage as `anon` (session not attached), which the avatars RLS policy
 * rejected with "new row violates row-level security policy". We send the file
 * plus the user's access token; the server verifies it and stores the image in
 * the user's own folder, then returns the public URL.
 */
export async function uploadAvatar(_userId: string, file: File): Promise<string> {
  const supabase = browserSupabase();

  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('You need to be signed in to change your photo.');

  const form = new FormData();
  form.append('file', file);

  const res = await apiFetch('/api/avatar', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  if (!res.ok) {
    let message = 'Could not save your photo. Please try again.';
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      // non-JSON error response — keep the friendly default
    }
    if (res.status === 401) {
      message = 'Your session expired. Please sign out and sign back in, then try again.';
    }
    throw new Error(message);
  }

  const { url } = await res.json();
  return url as string;
}
