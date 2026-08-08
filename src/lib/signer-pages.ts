/**
 * Public signing (/w/*) and kiosk (/kiosk/*) pages are white-labeled to the
 * customer's own business — FlatWaiver's own overlays (chat, analytics, the
 * cookie banner) shouldn't appear on them, and they set only strictly-necessary
 * cookies. (/waivers is the app, not a signer page — don't match it.)
 */
export function isSignerPage(pathname: string): boolean {
  return (
    pathname === "/w" ||
    pathname.startsWith("/w/") ||
    pathname.startsWith("/kiosk")
  );
}
