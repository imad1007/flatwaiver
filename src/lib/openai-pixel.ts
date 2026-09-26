/** Public constants only. No user identifiers or document data belong here. */
export const OPENAI_PIXEL_ID = "Wdj4prj2rJhsBuYu2cLejz";
export const OPENAI_ATTRIBUTION_COOKIE = "fw-openai-oppref";

export interface OpenAIQueue {
  (command: "consent", granted: boolean): void;
  (command: "measure", event: "registration_completed", data: { type: "customer_action" }, options: { event_id: string }): void;
}

/** The database candidate, not a page view, establishes registration eligibility. */
export async function measureSdkRegistration(
  reserve: () => Promise<{ eventId?: string } | null>,
  acknowledge: (eventId: string) => Promise<void>,
  permitted: () => boolean,
  queue: OpenAIQueue,
) {
  try {
    if (!permitted()) return;
    const result = await reserve();
    if (!permitted() || !result?.eventId || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(result.eventId)) return;
    queue("measure", "registration_completed", { type: "customer_action" }, { event_id: result.eventId });
    await acknowledge(result.eventId);
  } catch { /* Tracking must never interrupt registration or navigation. */ }
}

export function pixelEnabled(environment: string | undefined, enabled: string | undefined) {
  return environment === "production" && enabled === "true";
}

// Positive allowlist: never track signing or signed-document pages.
export function pixelPageMode(path: string): "landing" | "conversion" | null {
  if (path === "/dashboard" || path === "/settings/billing") return "conversion";
  // Google onboarding can finish at the new-template screen or draft editor.
  if (/^\/waivers\/(?:new|[a-f0-9-]{36})$/.test(path)) return "conversion";
  if (path === "/" || path === "/signup" || path === "/pricing" || path.startsWith("/blog/") || path.startsWith("/industries/")) return "landing";
  return null;
}

export function safeClickReference(value: string | null): string | null {
  // Treat the documented identifier as opaque; reject control characters and
  // cap input size. Encode with URLSearchParams, never interpolate into HTML.
  return value && value.length <= 2048 && !/[\u0000-\u0020\u007f]/.test(value) ? value : null;
}

/** Official Image Tag protocol: explicit allowlist, no SDK or matching code. */
export function registrationPixelUrl(eventId: string, click: string | null): string {
  if (!/^[a-f0-9-]{36}$/i.test(eventId)) throw new Error("Invalid measurement event ID");
  const params = new URLSearchParams({
    pid: OPENAI_PIXEL_ID,
    event: "registration_completed",
    event_id: eventId,
    "data[type]": "customer_action",
  });
  const reference = safeClickReference(click);
  if (reference) params.set("oppref", reference);
  return `https://bzr.openai.com/v1/sdk/events?${params}`;
}

export function readClickCookie(cookies: string): string | null {
  const value = cookies.split(/;\s*/).find(c => c.startsWith(`${OPENAI_ATTRIBUTION_COOKIE}=`))?.slice(OPENAI_ATTRIBUTION_COOKIE.length + 1);
  try { return value ? safeClickReference(decodeURIComponent(value)) : null; } catch { return null; }
}

/** The caller rechecks consent and route lifetime after the asynchronous claim. */
export async function measureRegistration(
  claim: () => Promise<{ eventId?: string } | null>,
  permitted: () => boolean,
  click: () => string | null,
  send: (url: string) => void,
) {
  try {
    if (!permitted()) return;
    const result = await claim();
    if (!permitted() || !result?.eventId) return;
    send(registrationPixelUrl(result.eventId, click()));
  } catch { /* Measurement must never interrupt signup or navigation. */ }
}
