export const APP = {
  name: "FlatWaiver",            // rename here only
  priceMonthlyUsd: 39,
  trialDays: 14,
  supportEmail: "contact@flatwaiver.com",
  /**
   * Functional base URL for the current deployment (emails, QR codes, signing
   * links, auth redirects). Comes from the environment, so it's the preview
   * URL on preview and the real domain in production.
   */
  url: process.env.NEXT_PUBLIC_APP_URL!,
  /**
   * Canonical, indexable production origin — always www, hardcoded so every
   * canonical/OG/sitemap/JSON-LD URL resolves to the one true host regardless
   * of which deployment is rendering. Never point SEO metadata at a preview.
   */
  siteUrl: "https://www.flatwaiver.com",
};
