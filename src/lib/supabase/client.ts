import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/db/database.types'

let supabaseInstance: SupabaseClient<Database> | null = null

// Public Supabase config for THIS project, hardcoded on purpose. The anon key
// is a *public* client key — every access is gated by RLS — so embedding it is
// safe (it already ships in the client bundle). Hardcoding both the URL and the
// key means a mis-typed build-time env var can never point the app at a
// wrong/nonexistent project, which is exactly what showed up as "Failed to
// fetch" on login in the bundled mobile app. To change projects, edit here.
const SUPABASE_URL = 'https://tjlyrgvdqgyafamiwyus.supabase.co'
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRqbHlyZ3ZkcWd5YWZhbWl3eXVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NzkwNTcsImV4cCI6MjA4NzU1NTA1N30.6NWSfYcu5NWl5GabSLpz3-5XkFFH4XCxy2FpxBVtJEU'

export function browserSupabase(): SupabaseClient<Database> {
  if (supabaseInstance) return supabaseInstance

  supabaseInstance = createClient<Database>(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
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
