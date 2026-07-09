import { createClient, type SupabaseClient } from '@supabase/supabase-js'

type BrowserSupabaseClient = SupabaseClient<any>

let supabaseInstance: BrowserSupabaseClient | null = null

export function browserSupabase(): BrowserSupabaseClient {
  if (supabaseInstance) return supabaseInstance

  supabaseInstance = createClient<any>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    }
  )

  return supabaseInstance
}
