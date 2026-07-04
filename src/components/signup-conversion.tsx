"use client";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

const CONVERSION_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID;
const CONVERSION_LABEL = process.env.NEXT_PUBLIC_GOOGLE_ADS_SIGNUP_LABEL;

/** Fire the Google Ads signup conversion. Call once, right after account creation. */
export function fireSignupConversion() {
  if (CONVERSION_ID && CONVERSION_LABEL && typeof window.gtag === "function") {
    window.gtag("event", "conversion", {
      send_to: `${CONVERSION_ID}/${CONVERSION_LABEL}`,
    });
  }
}
