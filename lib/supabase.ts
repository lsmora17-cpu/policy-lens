import { createClient } from "@supabase/supabase-js";

// Server-side only: the service_role key bypasses RLS and must never reach the
// browser. This app has no auth/multi-tenancy, so every DB/Storage access goes
// through this one server-side client from within API routes.
export function getSupabaseServerClient() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set in .env");
  }
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });
}
