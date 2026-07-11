// lib/supabase/admin.ts

import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/db/database.types"

let _client: SupabaseClient<Database> | null = null

function getClient(): SupabaseClient<Database> {
  if (_client) return _client

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL")
  if (!key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY")

  _client = createClient<Database>(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  return _client
}

/**
 * Service-role Supabase client for server-only code (API routes).
 * Lazily instantiated via a Proxy so that merely importing this module during
 * `next build` page-data collection does not require env vars to be present /
 * throw — the client (and the env check) is only created on first use.
 */
export const supabaseAdmin: SupabaseClient<Database> = new Proxy(
  {} as SupabaseClient<Database>,
  {
    get(_target, prop) {
      const client = getClient()
      const value = (client as any)[prop]
      return typeof value === "function" ? value.bind(client) : value
    },
  }
)
