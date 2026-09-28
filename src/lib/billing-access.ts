/**
 * Billing never hides an organization's existing records. Creation, publishing,
 * and public signing have their own server-side gates.
 */
export function hasAppAccess(
  subscription: { status: string; trial_ends_at: string | null } | null,
  now = Date.now(),
): boolean {
  void now;
  return subscription !== null;
}

export function requiresAppAccess(pathname: string): boolean {
  if (pathname === "/settings/billing") return false;
  return ["/dashboard", "/help", "/checkin", "/waivers", "/signatures", "/settings"]
    .some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
