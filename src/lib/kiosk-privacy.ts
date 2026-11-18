/** Timing is independent of React so fake-clock tests exercise the real policy. */
export const KIOSK_IDLE_MS = 3 * 60 * 1000;
export const KIOSK_WARNING_MS = 30 * 1000;
export function kioskIdleState(lastActivity: number, now: number) {
  const remaining = Math.max(0, KIOSK_IDLE_MS - (now - lastActivity));
  return { expired: remaining === 0, warning: remaining <= KIOSK_WARNING_MS, seconds: Math.ceil(remaining / 1000) };
}
