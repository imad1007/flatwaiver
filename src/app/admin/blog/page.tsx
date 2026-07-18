import Link from "next/link";
import { ExternalLink, FileText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminSetupNotice } from "@/components/admin-setup-notice";
import { BlogPostActions } from "@/components/admin/blog-post-actions";
import { getAllPosts, formatPostDate } from "@/lib/blog";
import { getAllDbPosts, isBlogCmsReady, isoDate } from "@/lib/blog-db";

export const dynamic = "force-dynamic";

export default async function AdminBlogPage() {
  const ready = await isBlogCmsReady();
  const dbPosts = ready ? await getAllDbPosts() : [];
  const gitPosts = getAllPosts();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Blog</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create posts by pasting HTML (e.g. from Claude Fable) or plain
            paragraphs. They publish to the same blog as the built-in posts.
          </p>
        </div>
        <Button render={<Link href="/admin/blog/new" />} className="gap-1.5">
          <Plus className="size-4" />
          New post
        </Button>
      </div>

      {!ready ? (
        <AdminSetupNotice />
      ) : (
        <>
          <section className="rounded-2xl border border-border bg-card shadow-card">
            <div className="border-b border-border px-5 py-3.5">
              <h2 className="text-sm font-semibold">
                Your posts{" "}
                <span className="font-normal text-muted-foreground">
                  ({dbPosts.length})
                </span>
              </h2>
            </div>
            {dbPosts.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <FileText className="mx-auto size-8 text-muted-foreground/50" />
                <p className="mt-2 text-sm text-muted-foreground">
                  No posts yet. Create your first one.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {dbPosts.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-3 px-5 py-3.5"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/admin/blog/${p.id}/edit`}
                          className="truncate font-medium hover:text-primary"
                        >
                          {p.title}
                        </Link>
                        <StatusPill status={p.status} />
                      </div>
                      <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
                        /blog/{p.slug} · updated {formatPostDate(isoDate(p.updated_at))}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {p.status === "published" && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="View live"
                          title="View live"
                          render={<Link href={`/blog/${p.slug}`} target="_blank" />}
                        >
                          <ExternalLink className="size-4" />
                        </Button>
                      )}
                      <BlogPostActions id={p.id} title={p.title} status={p.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border border-border bg-card shadow-card">
            <div className="border-b border-border px-5 py-3.5">
              <h2 className="text-sm font-semibold">
                Built-in posts{" "}
                <span className="font-normal text-muted-foreground">
                  ({gitPosts.length})
                </span>
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Authored as MDX files in the codebase — edited by deploying, not
                here.
              </p>
            </div>
            <ul className="divide-y divide-border">
              {gitPosts.map((p) => (
                <li
                  key={p.slug}
                  className="flex items-center justify-between gap-3 px-5 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{p.title}</p>
                    <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
                      /blog/{p.slug}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="View live"
                    title="View live"
                    render={<Link href={`/blog/${p.slug}`} target="_blank" />}
                  >
                    <ExternalLink className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: "draft" | "published" }) {
  return (
    <span
      className={
        "inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize " +
        (status === "published"
          ? "bg-success/15 text-success"
          : "bg-muted text-muted-foreground")
      }
    >
      {status}
    </span>
  );
}
