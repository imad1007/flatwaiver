import "server-only";

import sanitizeHtml from "sanitize-html";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * DB-backed blog posts (created from the admin CMS), the runtime-editable half
 * of the hybrid blog. The 5 cornerstone posts remain MDX files in git; these
 * live in the `blog_posts` table and are merged into the public blog by
 * src/lib/blog-merge.ts. Public reads use the service role here because this is
 * server-side rendering of PUBLIC content — not an anonymous browser touching
 * Supabase — so it stays inside the service-role boundary. Draft rows are only
 * ever returned by the admin-scoped helpers.
 */

export interface DbBlogPost {
  id: string;
  slug: string;
  title: string;
  description: string;
  body_html: string;
  tags: string[];
  keywords: string[];
  author: string;
  status: "draft" | "published";
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

const COLUMNS =
  "id, slug, title, description, body_html, tags, keywords, author, status, published_at, created_at, updated_at";

/** True when the blog_posts table hasn't been created yet (migration 0008). */
export function isMissingTableError(error: { code?: string } | null): boolean {
  // 42P01 = undefined_table
  return error?.code === "42P01";
}

/** False when migration 0008 hasn't been applied (blog_posts missing). */
export async function isBlogCmsReady(): Promise<boolean> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("blog_posts")
    .select("id", { head: true, count: "exact" })
    .limit(1);
  return error ? !isMissingTableError(error) : true;
}

/**
 * Published posts, newest first. Public path: degrade gracefully to [] on ANY
 * error (missing table, unreachable DB) so the public blog always renders at
 * least the git posts and never 500s over the DB half.
 */
export async function getPublishedDbPosts(): Promise<DbBlogPost[]> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("blog_posts")
      .select(COLUMNS)
      .eq("status", "published")
      .order("published_at", { ascending: false });
    if (error) {
      if (!isMissingTableError(error)) {
        console.error("[blog] getPublishedDbPosts failed:", error.message);
      }
      return [];
    }
    return (data ?? []) as DbBlogPost[];
  } catch (e) {
    console.error("[blog] getPublishedDbPosts threw:", e);
    return [];
  }
}

export async function getPublishedDbPost(slug: string): Promise<DbBlogPost | null> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("blog_posts")
      .select(COLUMNS)
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle();
    if (error) {
      if (!isMissingTableError(error)) {
        console.error("[blog] getPublishedDbPost failed:", error.message);
      }
      return null;
    }
    return (data as DbBlogPost) ?? null;
  } catch (e) {
    console.error("[blog] getPublishedDbPost threw:", e);
    return null;
  }
}

/** Admin-only: every post including drafts, newest activity first. */
export async function getAllDbPosts(): Promise<DbBlogPost[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("blog_posts")
    .select(COLUMNS)
    .order("updated_at", { ascending: false });
  if (error) {
    if (isMissingTableError(error)) return [];
    throw error;
  }
  return (data ?? []) as DbBlogPost[];
}

export async function getDbPostById(id: string): Promise<DbBlogPost | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("blog_posts")
    .select(COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) {
    if (isMissingTableError(error)) return null;
    throw error;
  }
  return (data as DbBlogPost) ?? null;
}

// ── Content helpers ──────────────────────────────────────────

const ALLOWED_TAGS = [
  "h2", "h3", "h4", "h5", "h6", "p", "ul", "ol", "li", "a", "strong", "em",
  "b", "i", "u", "s", "blockquote", "hr", "br", "code", "pre", "table",
  "thead", "tbody", "tfoot", "tr", "th", "td", "img", "figure", "figcaption",
  "span", "sup", "sub",
];

/**
 * Clean pasted HTML into a safe, style-consistent subset. Even though authors
 * are trusted admins, this is defense-in-depth: pasted HTML (e.g. AI-generated)
 * is an XSS vector on the public site, so scripts/styles/event handlers are
 * stripped. `<h1>` is downgraded to `<h2>` so the page keeps exactly one h1
 * (the title). Class/style/id attributes are dropped — styling comes from the
 * .blog-html rules, not inline attributes.
 */
export function sanitizeBlogHtml(dirty: string): string {
  return sanitizeHtml(dirty, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ["href", "target", "rel"],
      img: ["src", "alt", "width", "height", "loading"],
      th: ["colspan", "rowspan", "scope"],
      td: ["colspan", "rowspan"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      // Keep the single-h1 invariant no matter what gets pasted.
      h1: "h2",
      a: (tagName, attribs) => ({
        tagName,
        attribs: {
          ...attribs,
          ...(attribs.target === "_blank"
            ? { rel: "noopener noreferrer" }
            : {}),
        },
      }),
    },
  }).trim();
}

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/**
 * Convert plain-text paragraphs (blank-line separated) into <p> blocks. Single
 * newlines within a block become <br>. Everything is HTML-escaped — this path
 * never emits markup the author didn't intend.
 */
export function paragraphsToHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, "<br />")}</p>`)
    .join("\n");
}

/** Rounded-up minutes at ~220 wpm from the visible text of an HTML body. */
export function htmlReadingMinutes(html: string): number {
  const text = html.replace(/<[^>]+>/g, " ");
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 220));
}

/** ISO calendar date (YYYY-MM-DD, UTC) from a timestamptz string. */
export function isoDate(ts: string | null | undefined): string {
  return new Date(ts ?? Date.now()).toISOString().slice(0, 10);
}
