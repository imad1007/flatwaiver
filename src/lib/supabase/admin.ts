import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role client. Server code only — bypasses RLS.
 * All public (anonymous signer) operations go through route handlers using
 * this client; anonymous visitors never talk to Supabase directly.
 */
export function createAdminClient(options: { noStore?: boolean } = {}) {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      ...(options.noStore ? { global: { fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, { ...init, cache: "no-store" }) } } : {}),
    }
  );
}
