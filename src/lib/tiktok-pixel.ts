export const TIKTOK_PIXEL_ID = "DB02IERC77U04C8LUG70";
export const TIKTOK_EVENTS = { registration: "CompleteRegistration", payment: "Purchase" } as const;
export type TikTokEvent = {
  eventId: string;
  event: "CompleteRegistration" | "Purchase";
  properties: { value?: number; currency?: string };
};
export interface TikTokQueue {
  page(): void;
  track(event: TikTokEvent["event"], properties: TikTokEvent["properties"], options: { event_id: string }): void;
  grantConsent(): void;
  revokeConsent(): void;
  disableCookie(): void;
  ready(callback: () => void): void;
}
declare global { interface Window { ttq?: TikTokQueue } }

export function tiktokEnabled(environment?: string, flag?: string) {
  return environment === "production" && flag === "true";
}

// Root-mounted, but never allowed to inspect signer or document content.
export function tiktokPageAllowed(path: string) {
  return ["/", "/signup", "/dashboard", "/settings/billing", "/waivers/new"].includes(path) ||
    /^\/(blog|industries)\/[a-z0-9-]+$/.test(path);
}
export function tiktokConversionPage(path: string) {
  return ["/dashboard", "/settings/billing", "/waivers/new"].includes(path);
}
export function tiktokBrowserPermitted() {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  if (!/(?:^|;\s*)fw-consent=granted(?:;|$)/.test(document.cookie)) return false;
  return tiktokPageAllowed(window.location.pathname) && tiktokUrlAllowed(window.location.href);
}
export function tiktokUrlAllowed(href: string) {
  const url = new URL(href);
  if (url.hash) return false;
  // Auth codes, invitation emails, search terms and arbitrary return parameters
  // must not become part of an SDK-collected URL.
  return [...url.searchParams].every(([key, value]) =>
    (key === "ttclid" && /^[a-zA-Z0-9_-]{1,512}$/.test(value)) ||
    (key === "checkout" && value === "success")
  );
}

const queued = new Set<string>();
const inFlight = new Set<string>();
/** Ack means SDK accepted a call, not proof that TikTok received the request. */
export async function deliverTikTokEvent(
  item: TikTokEvent,
  permitted: () => boolean,
  queue: TikTokQueue,
  acknowledge: (id: string) => Promise<void>,
) {
  if (!permitted() || inFlight.has(item.eventId)) return;
  inFlight.add(item.eventId);
  try {
    if (!queued.has(item.eventId)) {
      queue.track(item.event, item.properties, { event_id: item.eventId });
      queued.add(item.eventId);
    }
    if (permitted()) await acknowledge(item.eventId);
  } catch { /* A retry uses the same logical ID. Never interrupt the app. */ }
  finally { inFlight.delete(item.eventId); }
}

/** Only a verified live subscription.paid webhook can create payment work. */
export function tiktokPaymentCandidate(type: string, object: Record<string, unknown>) {
  if (type !== "subscription.paid" || object.mode !== "prod" ||
      typeof object.id !== "string" || typeof object.lastTransactionId !== "string") return null;
  return { subscriptionId: object.id, transactionId: object.lastTransactionId };
}

/** Creem amounts are cents; use actual amount paid, never the catalogue price. */
export function tiktokPaymentProperties(transaction: {
  mode?: string; status?: string; amountPaid?: number | null; currency?: string;
}) {
  const amount = transaction.amountPaid;
  if (transaction.mode !== "prod" || transaction.status !== "paid" ||
      typeof amount !== "number" || !Number.isSafeInteger(amount) || amount <= 0 ||
      transaction.currency !== "USD") return null;
  return { value: amount / 100, currency: transaction.currency };
}
