import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Server-side Supabase client using the service-role key.
// NEVER import this from a client component — it would leak the key.
//
// Lazy-initialized so `next build` doesn't crash during page-data collection
// when env vars aren't injected yet (e.g. building from cache, type-only passes).
// The actual createClient call only runs on first .from()/.rpc()/etc access.

let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Supabase env not configured: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY",
    );
  }
  _client = createClient(url, serviceKey, { auth: { persistSession: false } });
  return _client;
}

export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getClient() as object, prop, receiver);
  },
});
