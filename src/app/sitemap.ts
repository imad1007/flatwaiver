import type { MetadataRoute } from "next";
import { APP } from "@/lib/config";
import { getAllBlogListItems } from "@/lib/blog-merge";

// Revalidate so admin-authored posts enter the sitemap without a redeploy.
export const revalidate = 600;

/**
 * Public, INDEXABLE pages only. Deliberately excludes /signup: it serves
 * `<meta robots="noindex">` and canonicalizes to /dashboard, so listing it
 * sends contradictory signals and wastes discovery crawl. /login and all
 * (app) routes are noindex too and likewise omitted. Always the canonical www
 * origin, with no trailing slash — matching Next's normalized page canonicals.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = APP.siteUrl;
  // `lastModified` is set only on static pages whose content actually changed,
  // so the sitemap reports real freshness (bump the date when you edit one).
  const pages: { path: string; priority: number; lastModified?: string }[] = [
    { path: "/", priority: 1 },
    { path: "/security", priority: 0.8 },
    { path: "/blog", priority: 0.7 },
    { path: "/support", priority: 0.4, lastModified: "2026-07-30" },
    { path: "/privacy", priority: 0.3 },
    { path: "/terms", priority: 0.3 },
  ];

  const staticEntries: MetadataRoute.Sitemap = pages.map(
    ({ path, priority, lastModified }) => ({
      url: path === "/" ? base : `${base}${path}`,
      ...(lastModified
        ? { lastModified: new Date(`${lastModified}T00:00:00Z`) }
        : {}),
      changeFrequency:
        path === "/" || path === "/blog"
          ? ("weekly" as const)
          : ("monthly" as const),
      priority,
    })
  );

  const postEntries: MetadataRoute.Sitemap = (await getAllBlogListItems()).map(
    (post) => ({
      url: `${base}/blog/${post.slug}`,
      lastModified: new Date(`${post.dateModified}T00:00:00Z`),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })
  );

  return [...staticEntries, ...postEntries];
}
