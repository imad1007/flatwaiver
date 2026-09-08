/** App access requires an active subscription or an unexpired trial. */
export function hasAppAccess(
  subscription: { status: string; trial_ends_at: string | null } | null,
  now = Date.now(),
): boolean {
  if (subscription?.status === "active") return true;
  if (subscription?.status !== "trialing" || !subscription.trial_ends_at) return false;
  return Date.parse(subscription.trial_ends_at) > now;
}

export function requiresAppAccess(pathname: string): boolean {
  if (pathname === "/settings/billing") return false;
  return ["/dashboard", "/help", "/checkin", "/waivers", "/signatures", "/settings"]
    .some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
