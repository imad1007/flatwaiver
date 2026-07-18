import "server-only";

import { getAllPosts, getPost, type BlogPost } from "@/lib/blog";
import {
  getPublishedDbPosts,
  getPublishedDbPost,
  htmlReadingMinutes,
  isoDate,
  type DbBlogPost,
} from "@/lib/blog-db";

/**
 * The hybrid blog: MDX cornerstone posts (git) + admin-authored posts (DB),
 * merged into one stream for the public index, sitemap, RSS, and [slug] route.
 * Everything here is async because the DB half requires a query.
 */

export interface BlogListItem {
  slug: string;
  title: string;
  description: string;
  datePublished: string; // YYYY-MM-DD
  dateModified: string;
  author: string;
  tags: string[];
  keywords: string[];
  readingMinutes: number;
  source: "mdx" | "db";
}

export type RenderablePost = {
  slug: string;
  title: string;
  description: string;
  keywords: string[];
  author: string;
  datePublished: string;
  dateModified: string;
  tags: string[];
  readingMinutes: number;
  canonical?: string;
  ogImage?: string;
} & ({ source: "mdx"; content: string } | { source: "db"; bodyHtml: string });

function mdxToItem(p: BlogPost): BlogListItem {
  return {
    slug: p.slug,
    title: p.title,
    description: p.description,
    datePublished: p.datePublished,
    dateModified: p.dateModified,
    author: p.author,
    tags: p.tags,
    keywords: p.keywords,
    readingMinutes: p.readingMinutes,
    source: "mdx",
  };
}

function dbToItem(p: DbBlogPost): BlogListItem {
  return {
    slug: p.slug,
    title: p.title,
    description: p.description,
    datePublished: isoDate(p.published_at ?? p.created_at),
    dateModified: isoDate(p.updated_at),
    author: p.author,
    tags: p.tags,
    keywords: p.keywords,
    readingMinutes: htmlReadingMinutes(p.body_html),
    source: "db",
  };
}

const byNewest = (a: BlogListItem, b: BlogListItem) =>
  a.datePublished < b.datePublished ? 1 : a.datePublished > b.datePublished ? -1 : 0;

/** All published posts (both sources), newest first. */
export async function getAllBlogListItems(): Promise<BlogListItem[]> {
  const db = await getPublishedDbPosts();
  return [...getAllPosts().map(mdxToItem), ...db.map(dbToItem)].sort(byNewest);
}

/** Slugs for generateStaticParams (both sources). */
export async function getAllBlogSlugs(): Promise<string[]> {
  const items = await getAllBlogListItems();
  return items.map((p) => p.slug);
}

/** Full post for the [slug] route — MDX body or sanitized DB HTML. */
export async function getRenderablePost(
  slug: string
): Promise<RenderablePost | null> {
  const mdx = getPost(slug);
  if (mdx) {
    return {
      slug: mdx.slug,
      title: mdx.title,
      description: mdx.description,
      keywords: mdx.keywords,
      author: mdx.author,
      datePublished: mdx.datePublished,
      dateModified: mdx.dateModified,
      tags: mdx.tags,
      readingMinutes: mdx.readingMinutes,
      canonical: mdx.canonical,
      ogImage: mdx.ogImage,
      source: "mdx",
      content: mdx.content,
    };
  }
  const db = await getPublishedDbPost(slug);
  if (db) {
    return {
      slug: db.slug,
      title: db.title,
      description: db.description,
      keywords: db.keywords,
      author: db.author,
      datePublished: isoDate(db.published_at ?? db.created_at),
      dateModified: isoDate(db.updated_at),
      tags: db.tags,
      readingMinutes: htmlReadingMinutes(db.body_html),
      source: "db",
      bodyHtml: db.body_html,
    };
  }
  return null;
}

/** Related posts across both sources — shared-tag overlap, then recency. */
export async function getRelatedListItems(
  current: { slug: string; tags: string[] },
  limit = 2
): Promise<BlogListItem[]> {
  const others = (await getAllBlogListItems()).filter(
    (p) => p.slug !== current.slug
  );
  return others
    .map((p) => ({
      post: p,
      score: p.tags.filter((t) => current.tags.includes(t)).length,
    }))
    .sort((a, b) => b.score - a.score || byNewest(a.post, b.post))
    .slice(0, limit)
    .map((s) => s.post);
}
