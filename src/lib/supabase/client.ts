import { createClient } from '@supabase/supabase-js';

let client: any = null;

export function browserSupabase(): any {
  if (!client) {
    client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return client;
}
