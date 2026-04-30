import { createClient } from '@supabase/supabase-js'

export function browserSupabase() {
  console.log('SUPABASE URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}