import type { MetadataRoute } from "next";
import { APP } from "@/lib/config";

/**
 * Production is fully crawlable; every non-production environment
 * (preview / development) disallows everything so *.vercel.app previews are
 * never indexed. We deliberately do NOT disallow app/auth pages in production
 * — they carry noindex meta and are auth-gated, and blocking them in robots
 * would hide that noindex from crawlers (a disallowed URL can still surface as
 * a bare link). CSS/JS and OG image routes are never blocked.
 */
export default function robots(): MetadataRoute.Robots {
  const isProduction = process.env.VERCEL_ENV === "production";

  if (!isProduction) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }

  return {
    rules: [{ userAgent: "*", allow: "/" }],
    sitemap: `${APP.siteUrl}/sitemap.xml`,
    host: APP.siteUrl,
  };
}
