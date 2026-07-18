"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAllPosts } from "@/lib/blog";
import { paragraphsToHtml, sanitizeBlogHtml } from "@/lib/blog-db";

/**
 * Blog CMS mutations. All admin-gated. Pasted HTML and plain paragraphs both
 * pass through sanitizeBlogHtml before storage, so the DB never holds unsafe
 * markup. Public blog surfaces are ISR — revalidate the affected paths so
 * changes appear without a redeploy.
 */

const saveSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1, "Title is required").max(120),
  slug: z
    .string()
    .trim()
    .min(1)
    .transform((s) =>
      s
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
    )
    .refine((s) => s.length > 0, "Slug is required"),
  description: z
    .string()
    .trim()
    .min(50, "Meta description should be at least 50 characters")
    .max(155, "Meta description must be 155 characters or fewer"),
  author: z.string().trim().min(1).max(80).default("FlatWaiver Team"),
  tagsRaw: z.string().default(""),
  keywordsRaw: z.string().default(""),
  contentType: z.enum(["html", "text"]),
  body: z.string().trim().min(1, "Post body is required"),
  status: z.enum(["draft", "published"]),
});

export type SavePostInput = z.input<typeof saveSchema>;
type SaveResult = { ok: true; slug: string; id: string } | { ok: false; error: string };

function splitList(raw: string, max: number): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, max);
}

function revalidateBlog(...slugs: string[]) {
  revalidatePath("/blog");
  revalidatePath("/sitemap.xml");
  revalidatePath("/blog/rss.xml");
  revalidatePath("/admin/blog");
  for (const s of slugs) if (s) revalidatePath(`/blog/${s}`);
}

export async function savePost(input: SavePostInput): Promise<SaveResult> {
  await assertAdmin();

  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const v = parsed.data;

  // Slug must be globally unique across git posts and other DB posts.
  if (getAllPosts().some((p) => p.slug === v.slug)) {
    return { ok: false, error: `Slug “${v.slug}” is already used by a built-in post.` };
  }

  const admin = createAdminClient();
  const { data: clash } = await admin
    .from("blog_posts")
    .select("id")
    .eq("slug", v.slug)
    .maybeSingle();
  if (clash && clash.id !== v.id) {
    return { ok: false, error: `Slug “${v.slug}” is already used by another post.` };
  }

  const body_html =
    v.contentType === "html"
      ? sanitizeBlogHtml(v.body)
      : sanitizeBlogHtml(paragraphsToHtml(v.body));
  if (!body_html.trim()) {
    return { ok: false, error: "Body is empty after sanitizing." };
  }

  const fields = {
    slug: v.slug,
    title: v.title,
    description: v.description,
    author: v.author,
    tags: splitList(v.tagsRaw, 6),
    keywords: splitList(v.keywordsRaw, 10),
    body_html,
    status: v.status,
    updated_at: new Date().toISOString(),
  };

  let oldSlug: string | undefined;
  let savedId: string;

  if (v.id) {
    const { data: existing } = await admin
      .from("blog_posts")
      .select("slug, published_at, status")
      .eq("id", v.id)
      .maybeSingle();
    if (!existing) return { ok: false, error: "Post not found." };
    oldSlug = existing.slug;

    // Stamp published_at the first time a post goes live; keep it thereafter.
    const published_at =
      v.status === "published"
        ? existing.published_at ?? new Date().toISOString()
        : existing.published_at;

    const { error } = await admin
      .from("blog_posts")
      .update({ ...fields, published_at })
      .eq("id", v.id);
    if (error) return { ok: false, error: error.message };
    savedId = v.id;
  } else {
    const { data, error } = await admin
      .from("blog_posts")
      .insert({
        ...fields,
        published_at: v.status === "published" ? new Date().toISOString() : null,
      })
      .select("id")
      .single();
    if (error) return { ok: false, error: error.message };
    savedId = data.id;
  }

  revalidateBlog(v.slug, oldSlug ?? "");
  return { ok: true, slug: v.slug, id: savedId };
}

export async function setPostStatus(
  id: string,
  status: "draft" | "published"
): Promise<{ ok: boolean; error?: string }> {
  await assertAdmin();
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("blog_posts")
    .select("slug, published_at")
    .eq("id", id)
    .maybeSingle();
  if (!existing) return { ok: false, error: "Post not found." };

  const published_at =
    status === "published"
      ? existing.published_at ?? new Date().toISOString()
      : existing.published_at;

  const { error } = await admin
    .from("blog_posts")
    .update({ status, published_at, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidateBlog(existing.slug);
  return { ok: true };
}

export async function deletePost(
  id: string
): Promise<{ ok: boolean; error?: string }> {
  await assertAdmin();
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("blog_posts")
    .select("slug")
    .eq("id", id)
    .maybeSingle();

  const { error } = await admin.from("blog_posts").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidateBlog(existing?.slug ?? "");
  return { ok: true };
}
