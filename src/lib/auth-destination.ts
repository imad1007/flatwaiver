import "server-only";
import { isPlatformAdmin } from "@/lib/admin";
import { safeInternalPath } from "@/lib/safe-redirect";

/** Only call with the email from a server-verified authentication result. */
export function authDestination(email: string | null | undefined, next?: string | null) {
  if (isPlatformAdmin(email)) return "/admin";
  const target = safeInternalPath(next);
  const pathname = new URL(target, "https://flatwaiver.invalid").pathname;
  // Auth entry points must not redirect back into themselves.
  if (/^\/(?:auth|login|signup)(?:\/|$)/.test(pathname)) return "/dashboard";
  return target;
}
