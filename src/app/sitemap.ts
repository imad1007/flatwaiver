import type { MetadataRoute } from "next";
import { APP } from "@/lib/config";
import { getAllPosts } from "@/lib/blog";

/**
 * Public, indexable pages only — no app/auth routes, no /login, no thin
 * utility pages beyond /support. Always the canonical www origin.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = APP.siteUrl;
  const pages: { path: string; priority: number }[] = [
    { path: "/", priority: 1 },
    { path: "/security", priority: 0.8 },
    { path: "/blog", priority: 0.7 },
    { path: "/signup", priority: 0.7 },
    { path: "/support", priority: 0.4 },
    { path: "/privacy", priority: 0.3 },
    { path: "/terms", priority: 0.3 },
  ];

  const staticEntries: MetadataRoute.Sitemap = pages.map(
    ({ path, priority }) => ({
      url: path === "/" ? base : `${base}${path}`,
      changeFrequency:
        path === "/" || path === "/blog"
          ? ("weekly" as const)
          : ("monthly" as const),
      priority,
    })
  );

  const postEntries: MetadataRoute.Sitemap = getAllPosts().map((post) => ({
    url: `${base}/blog/${post.slug}`,
    lastModified: new Date(`${post.dateModified}T00:00:00Z`),
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  return [...staticEntries, ...postEntries];
}
