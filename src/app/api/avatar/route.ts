import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

// Avatar upload runs server-side on purpose. Uploading straight from the browser
// intermittently reaches Supabase Storage without the user's session attached,
// so the request lands as `anon` and the avatars RLS policy (rightly) rejects it
// with "new row violates row-level security policy". Here we verify the caller's
// bearer token and write with the service role, which is immune to that class of
// client-session flakiness. The path is still scoped to the user's own folder.
export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    if (file.size > 8 * 1024 * 1024) {
      return NextResponse.json({ error: 'Image is too large (max 8 MB).' }, { status: 413 });
    }

    const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
    const path = `${user.id}/${Date.now()}.${ext}`;
    const bytes = Buffer.from(await file.arrayBuffer());

    const { error: upErr } = await supabaseAdmin.storage.from('avatars').upload(path, bytes, {
      contentType: file.type || 'image/png',
      cacheControl: '3600',
      upsert: true,
    });
    if (upErr) throw upErr;

    const { data } = supabaseAdmin.storage.from('avatars').getPublicUrl(path);
    // Keep the profile in sync here too, so a client that only calls this route
    // still ends up with the right avatar_url.
    await supabaseAdmin.from('profiles').update({ avatar_url: data.publicUrl }).eq('id', user.id);

    return NextResponse.json({ url: data.publicUrl });
  } catch (error: any) {
    console.error('Avatar upload failed:', error);
    return NextResponse.json({ error: error?.message || 'Upload failed' }, { status: 500 });
  }
}
