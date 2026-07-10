import type { MetadataRoute } from "next";
import { APP } from "@/lib/config";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = (APP.url || "http://localhost:3000").replace(/\/$/, "");
  const pages: { path: string; priority: number }[] = [
    { path: "/", priority: 1 },
    { path: "/security", priority: 0.8 },
    { path: "/signup", priority: 0.7 },
    { path: "/privacy", priority: 0.3 },
    { path: "/terms", priority: 0.3 },
  ];
  return pages.map(({ path, priority }) => ({
    url: path === "/" ? base : `${base}${path}`,
    changeFrequency: path === "/" ? ("weekly" as const) : ("monthly" as const),
    priority,
  }));
}
