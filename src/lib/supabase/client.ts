import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/db/database.types'

let supabaseInstance: SupabaseClient<Database> | null = null

export function browserSupabase(): SupabaseClient<Database> {
  if (supabaseInstance) return supabaseInstance

  supabaseInstance = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        // Use a pass-through lock instead of the cross-tab navigator Web-Lock.
        // supabase-js otherwise serialises every auth call (getUser / getSession
        // / token refresh) on one Web-Lock; under this app's many concurrent
        // auth calls that lock is held long enough to be "stolen" on timeout,
        // throwing "AbortError: Lock broken by another request with the 'steal'
        // option" and failing whichever query was in flight (e.g. the member
        // list). Running each auth op directly is fine for a single browser
        // client and removes that whole class of errors.
        lock: async (_name: string, _acquireTimeout: number, fn) => fn(),
      },
    }
  )

  return supabaseInstance
}
