'use client';

import { browserSupabase } from '@/lib/supabase/client';
import { LEGAL } from '@/lib/legal';

/** Has this user accepted the CURRENT Terms + Privacy versions? */
export async function hasAcceptedCurrentLegal(userId: string): Promise<boolean> {
  const supabase = browserSupabase();
  const { data } = await supabase
    .from('legal_acceptances')
    .select('id')
    .eq('user_id', userId)
    .eq('terms_version', LEGAL.termsVersion)
    .eq('privacy_version', LEGAL.privacyVersion)
    .limit(1)
    .maybeSingle();
  return !!data;
}

/** Write a durable acceptance record for the current document versions. */
export async function recordLegalAcceptance(userId: string, language: string): Promise<void> {
  const supabase = browserSupabase();
  await supabase.from('legal_acceptances').insert({
    user_id: userId,
    terms_version: LEGAL.termsVersion,
    privacy_version: LEGAL.privacyVersion,
    min_age: LEGAL.minAge,
    language,
  });
}
