import { getAllBlogListItems } from "@/lib/blog-merge";
import { APP } from "@/lib/config";

// ISR so admin-authored posts appear in the feed without a redeploy.
export const revalidate = 600;

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** RSS 2.0 feed for the blog (both MDX and admin-authored posts). */
export async function GET() {
  const base = (APP.url || "http://localhost:3000").replace(/\/$/, "");
  const posts = await getAllBlogListItems();

  const items = posts
    .map(
      (post) => `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${base}/blog/${post.slug}</link>
      <guid isPermaLink="true">${base}/blog/${post.slug}</guid>
      <description>${escapeXml(post.description)}</description>
      <pubDate>${new Date(`${post.datePublished}T00:00:00Z`).toUTCString()}</pubDate>
    </item>`
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(`${APP.name} Blog`)}</title>
    <link>${base}/blog</link>
    <description>${escapeXml(
      "Guides for high-volume waiver collection: software pricing, honest comparisons, and e-sign law."
    )}</description>
    <language>en-us</language>
    <atom:link href="${base}/blog/rss.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}
