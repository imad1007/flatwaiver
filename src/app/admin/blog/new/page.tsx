import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BlogEditor } from "@/components/admin/blog-editor";

export const dynamic = "force-dynamic";

export default function NewBlogPostPage() {
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
        <h1 className="mt-2 text-2xl font-bold tracking-tight">New post</h1>
      </div>

      <BlogEditor
        initial={{
          title: "",
          slug: "",
          description: "",
          author: "FlatWaiver Team",
          tags: [],
          keywords: [],
          body: "",
          contentType: "html",
          status: "draft",
        }}
      />
    </div>
  );
}
