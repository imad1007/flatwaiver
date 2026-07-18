"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { savePost } from "@/app/admin/blog/actions";

export interface EditorInitial {
  id?: string;
  title: string;
  slug: string;
  description: string;
  author: string;
  tags: string[];
  keywords: string[];
  body: string;
  contentType: "html" | "text";
  status: "draft" | "published";
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export function BlogEditor({ initial }: { initial: EditorInitial }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [title, setTitle] = useState(initial.title);
  const [slug, setSlug] = useState(initial.slug);
  const [slugTouched, setSlugTouched] = useState(Boolean(initial.slug));
  const [description, setDescription] = useState(initial.description);
  const [author, setAuthor] = useState(initial.author);
  const [tags, setTags] = useState(initial.tags.join(", "));
  const [keywords, setKeywords] = useState(initial.keywords.join(", "));
  const [contentType, setContentType] = useState(initial.contentType);
  const [body, setBody] = useState(initial.body);
  const [status, setStatus] = useState(initial.status);

  const descLen = description.trim().length;
  const descOk = descLen >= 50 && descLen <= 155;

  function onTitleChange(value: string) {
    setTitle(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  function submit() {
    startTransition(async () => {
      const res = await savePost({
        id: initial.id,
        title,
        slug,
        description,
        author,
        tagsRaw: tags,
        keywordsRaw: keywords,
        contentType,
        body,
        status,
      });
      if (res.ok) {
        toast.success(
          status === "published" ? "Post published" : "Draft saved"
        );
        router.push("/admin/blog");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
      {/* Main content */}
      <div className="space-y-5">
        <Field label="Title">
          <Input
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="FlatWaiver vs …"
          />
        </Field>

        <Field
          label="Meta description"
          hint={
            <span className={cn(descOk ? "text-muted-foreground" : "text-destructive")}>
              {descLen}/155 {descLen < 50 ? "(min 50)" : ""}
            </span>
          }
        >
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="One or two sentences for search results (50–155 chars)."
          />
        </Field>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <Label>Body</Label>
            <div className="flex rounded-md border border-border p-0.5">
              {(["html", "text"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setContentType(t)}
                  className={cn(
                    "rounded px-2.5 py-1 text-xs font-medium transition-colors",
                    contentType === t
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {t === "html" ? "HTML" : "Paragraphs"}
                </button>
              ))}
            </div>
          </div>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={20}
            className="font-mono text-xs"
            placeholder={
              contentType === "html"
                ? "<h2>Section heading</h2>\n<p>Paste HTML (e.g. from Claude Fable). Start headings at H2 — the title is the H1.</p>"
                : "Write or paste plain paragraphs.\n\nBlank lines separate paragraphs."
            }
          />
          <p className="mt-1.5 text-xs text-muted-foreground">
            {contentType === "html"
              ? "Pasted HTML is sanitized on save — scripts, styles, and inline attributes are stripped; an H1 becomes H2 to keep one title."
              : "Plain text is escaped and wrapped in paragraphs. Blank lines start a new paragraph."}
          </p>
        </div>
      </div>

      {/* Sidebar: publish + SEO meta */}
      <aside className="space-y-5 lg:sticky lg:top-20 lg:self-start">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
          <div className="mb-3 flex rounded-md border border-border p-0.5">
            {(["draft", "published"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className={cn(
                  "flex-1 rounded px-2 py-1.5 text-xs font-semibold capitalize transition-colors",
                  status === s
                    ? s === "published"
                      ? "bg-success/15 text-success"
                      : "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {s}
              </button>
            ))}
          </div>
          <Button className="w-full" onClick={submit} disabled={pending}>
            {pending
              ? "Saving…"
              : status === "published"
                ? initial.id
                  ? "Update & publish"
                  : "Publish"
                : "Save draft"}
          </Button>
          {initial.id && status === "published" && (
            <Link
              href={`/blog/${slug}`}
              target="_blank"
              className="mt-2 flex items-center justify-center gap-1 text-xs font-medium text-primary hover:opacity-80"
            >
              View live <ExternalLink className="size-3" />
            </Link>
          )}
        </div>

        <div className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-card">
          <Field label="Slug" hint={<span className="text-muted-foreground">/blog/…</span>}>
            <Input
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value);
              }}
              placeholder="post-url-slug"
              className="font-mono text-xs"
            />
          </Field>
          <Field label="Author">
            <Input value={author} onChange={(e) => setAuthor(e.target.value)} />
          </Field>
          <Field label="Tags" hint={<span className="text-muted-foreground">comma-separated</span>}>
            <Input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="comparisons, pricing"
            />
          </Field>
          <Field
            label="SEO keywords"
            hint={<span className="text-muted-foreground">comma-separated</span>}
          >
            <Input
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="digital waiver software, …"
            />
          </Field>
        </div>
      </aside>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <Label>{label}</Label>
        {hint && <span className="text-xs">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
