import "server-only";

import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPublicNetworkAddress } from "@/lib/network-address";
import { countryCode } from "@/lib/country";

/** Only trust forwarding/location headers when running behind Vercel. */
export function accountLocationFromHeaders(
  requestHeaders: Pick<Headers, "get">,
  onVercel = process.env.VERCEL === "1",
) {
  if (!onVercel) return null;
  const ip = requestHeaders.get("x-vercel-forwarded-for")?.split(",")[0]?.trim();
  if (!ip || !isPublicNetworkAddress(ip)) return null;
  return { ip, country_code: countryCode(requestHeaders.get("x-vercel-ip-country")) };
}

/** One latest observation per authenticated user; never an authentication gate. */
export async function recordAccountLocation(userId: string): Promise<void> {
  try {
    const location = accountLocationFromHeaders(await headers());
    if (!location) return;
    const admin = createAdminClient();
    const { error } = await admin.from("account_locations").upsert({
      user_id: userId,
      ...location,
      observed_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    if (error) console.warn("Account location could not be recorded");
  } catch {
    console.warn("Account location could not be recorded");
  }
}
