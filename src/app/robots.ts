import type { MetadataRoute } from "next";
import { APP } from "@/lib/config";

export default function robots(): MetadataRoute.Robots {
  const base = (APP.url || "http://localhost:3000").replace(/\/$/, "");
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // App-internal and API routes. /w/ and /kiosk/ stay crawlable on
        // purpose: they carry a noindex meta tag, which crawlers can only
        // obey if they're allowed to fetch the page.
        disallow: [
          "/api/",
          "/auth/",
          "/dashboard",
          "/checkin",
          "/waivers",
          "/signatures",
          "/settings",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
