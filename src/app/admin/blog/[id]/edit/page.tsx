import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { BlogEditor } from "@/components/admin/blog-editor";
import { getDbPostById } from "@/lib/blog-db";

export const dynamic = "force-dynamic";

export default async function EditBlogPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const post = await getDbPostById(id);
  if (!post) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/blog"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Blog
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Edit post</h1>
      </div>

      <BlogEditor
        initial={{
          id: post.id,
          title: post.title,
          slug: post.slug,
          description: post.description,
          author: post.author,
          tags: post.tags,
          keywords: post.keywords,
          // Stored body is already sanitized HTML; edit it as HTML.
          body: post.body_html,
          contentType: "html",
          status: post.status,
        }}
      />
    </div>
  );
}
