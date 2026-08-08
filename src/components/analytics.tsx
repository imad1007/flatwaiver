import { AnalyticsScripts } from "@/components/analytics-scripts";

// GA4 Measurement ID. Prefer the env var (lets you override or repoint later);
// otherwise fall back to the production property so analytics works without any
// Vercel env config. Gated to production so preview/dev never send into the
// live property. IDs are resolved here (server) and loaded by the client child
// only after cookie consent is granted.
const GA_ID =
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ||
  (process.env.VERCEL_ENV === "production" ? "G-G5NQ493KE5" : undefined);
const ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID; // e.g. AW-XXXXXXXXXX
const CLARITY_ID = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID;

/**
 * Google Analytics 4 + Google Ads (one shared gtag.js) + Microsoft Clarity.
 * Each product loads only when its id is set AND the visitor has accepted
 * cookies (see AnalyticsScripts). GA4 Enhanced Measurement captures SPA route
 * changes via History events, so no manual page_view wiring is needed.
 */
export function Analytics() {
  if (!GA_ID && !ADS_ID && !CLARITY_ID) return null;
  return (
    <AnalyticsScripts
      gaId={GA_ID ?? null}
      adsId={ADS_ID ?? null}
      clarityId={CLARITY_ID ?? null}
    />
  );
}
