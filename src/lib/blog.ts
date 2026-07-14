import "server-only";

import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { z } from "zod";

/**
 * Blog content loader. Posts are MDX files in content/blog/*.mdx with typed
 * frontmatter (zod-validated — a malformed post fails the build loudly rather
 * than shipping broken metadata). Everything is read synchronously at build
 * time; all blog routes are statically generated.
 */

const CONTENT_DIR = path.join(process.cwd(), "content", "blog");

const frontmatterSchema = z.object({
  title: z.string().min(1).max(120),
  /** Meta description — hard SEO ceiling of 155 chars. */
  description: z.string().min(50).max(155),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "kebab-case slugs only"),
  datePublished: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dateModified: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  author: z.string().min(1),
  tags: z.array(z.string().min(1)).min(1).max(6),
  keywords: z.array(z.string().min(1)).min(1).max(10),
  /** Optional override; when absent the per-slug generated OG image is used. */
  ogImage: z.string().optional(),
  /** Optional canonical override (absolute or site-relative). */
  canonical: z.string().optional(),
});

export type BlogFrontmatter = z.infer<typeof frontmatterSchema>;

export interface BlogPost extends BlogFrontmatter {
  /** Raw MDX body (without frontmatter). */
  content: string;
  /** Rounded-up minutes at ~220 wpm. */
  readingMinutes: number;
}

function parsePostFile(filePath: string): BlogPost {
  const raw = fs.readFileSync(filePath, "utf8");
  const { data, content } = matter(raw);
  const parsed = frontmatterSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(
      `Invalid frontmatter in ${path.basename(filePath)}: ${parsed.error.issues
        .map((i) => `${i.path.join(".")} — ${i.message}`)
        .join("; ")}`
    );
  }
  const words = content.split(/\s+/).filter(Boolean).length;
  return {
    ...parsed.data,
    content,
    readingMinutes: Math.max(1, Math.ceil(words / 220)),
  };
}

/** All published posts, newest first. */
export function getAllPosts(): BlogPost[] {
  if (!fs.existsSync(CONTENT_DIR)) return [];
  return fs
    .readdirSync(CONTENT_DIR)
    .filter((f) => f.endsWith(".mdx"))
    .map((f) => parsePostFile(path.join(CONTENT_DIR, f)))
    .sort((a, b) => (a.datePublished < b.datePublished ? 1 : -1));
}

export function getPost(slug: string): BlogPost | null {
  return getAllPosts().find((p) => p.slug === slug) ?? null;
}

/**
 * Related posts by shared-tag overlap (then recency). Falls back to the most
 * recent other posts so the block never renders empty.
 */
export function getRelatedPosts(post: BlogPost, limit = 2): BlogPost[] {
  const others = getAllPosts().filter((p) => p.slug !== post.slug);
  const scored = others
    .map((p) => ({
      post: p,
      score: p.tags.filter((t) => post.tags.includes(t)).length,
    }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        (a.post.datePublished < b.post.datePublished ? 1 : -1)
    );
  return scored.slice(0, limit).map((s) => s.post);
}

/** "July 14, 2026" — fixed locale so static output is deterministic. */
export function formatPostDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}
