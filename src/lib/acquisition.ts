export const ACQUISITION_KEY = "fw-acquisition-v1";
const TTL = 30 * 24 * 60 * 60 * 1000;
const surfaces = ["dashboard", "waivers", "signatures", "data", "settings", "help"];

export function audienceForPath(path: string): "marketing" | "prospect" | "account" | "admin" | "participant" | "other" {
  if (/^\/admin(?:\/|$)/.test(path)) return "admin";
  if (/^\/(?:w|kiosk)(?:\/|$)/.test(path)) return "participant";
  if (/^\/(?:signup|login|onboarding)(?:\/|$)/.test(path)) return "prospect";
  if (surfaces.some(prefix => path === `/${prefix}` || path.startsWith(`/${prefix}/`))) return "account";
  if (["/", "/pricing", "/industries", "/blog", "/security", "/support", "/terms", "/privacy"].includes(path) || /^\/(?:blog|industries|features)\/[a-z0-9-]+$/.test(path)) return "marketing";
  return "other";
}

export function analyticsPermitted(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined" && /(?:^|;\s*)fw-consent=granted(?:;|$)/.test(document.cookie) && ["marketing", "prospect", "account"].includes(audienceForPath(window.location.pathname));
}

type Acquisition = { landing_page: string; acquisition_source: string; acquisition_medium: string; captured: number };
const sources = ["google", "bing", "newsletter", "other_campaign", "other_referral", "direct"];
const media = ["organic", "paid", "email", "campaign", "referral", "direct"];

/** Positive allowlists: no raw query parameters, referrer paths or customer IDs. */
export function acquisitionFromUrl(href: string, referrer: string, now: number): Acquisition | null {
  const url = new URL(href);
  if (audienceForPath(url.pathname) !== "marketing") return null;
  let source = "direct", medium = "direct";
  const tagged = url.searchParams.get("utm_source");
  if (tagged) {
    source = ["google", "bing", "newsletter"].includes(tagged) ? tagged : "other_campaign";
    medium = /^(cpc|ppc|paid)$/.test(url.searchParams.get("utm_medium") ?? "") ? "paid" : url.searchParams.get("utm_medium") === "email" ? "email" : "campaign";
  } else if (url.searchParams.has("gclid") || url.searchParams.has("gbraid") || url.searchParams.has("wbraid")) {
    source = "google"; medium = "paid";
  } else {
    try {
      const ref = new URL(referrer);
      if (ref.hostname !== url.hostname && !["flatwaiver.com", "www.flatwaiver.com"].includes(ref.hostname)) {
        source = ["google.com", "www.google.com", "google.co.uk", "www.google.co.uk", "google.ca", "www.google.ca", "google.fr", "www.google.fr"].includes(ref.hostname) ? "google" : /^(?:www\.)?bing\.com$/.test(ref.hostname) ? "bing" : "other_referral";
        medium = source === "google" || source === "bing" ? "organic" : "referral";
      }
    } catch { /* Missing referrer is direct/unknown, not proof of organic. */ }
  }
  return { landing_page: url.pathname, acquisition_source: source, acquisition_medium: medium, captured: now };
}

export function acquisitionContext(): Record<string, string> {
  if (!analyticsPermitted()) return {};
  try {
    const now = Date.now();
    let value: Acquisition | null = JSON.parse(localStorage.getItem(ACQUISITION_KEY) ?? "null");
    if (!value || !Number.isFinite(value.captured) || value.captured > now || now - value.captured > TTL || audienceForPath(value.landing_page) !== "marketing" || !sources.includes(value.acquisition_source) || !media.includes(value.acquisition_medium)) {
      localStorage.removeItem(ACQUISITION_KEY);
      value = acquisitionFromUrl(window.location.href, document.referrer, now);
      if (value) localStorage.setItem(ACQUISITION_KEY, JSON.stringify(value));
    }
    return value ? { landing_page: value.landing_page, acquisition_source: value.acquisition_source, acquisition_medium: value.acquisition_medium } : {};
  } catch { return {}; }
}

export function coarseAnalyticsPath(path: string): string {
  return audienceForPath(path) === "account" ? `/${path.split("/")[1]}` : audienceForPath(path) === "prospect" ? `/${path.split("/")[1]}` : path;
}
