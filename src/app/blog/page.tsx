import type { Metadata } from "next";
import Link from "next/link";
import { MarketingHeader, MarketingFooter } from "@/components/marketing-chrome";
import { formatPostDate } from "@/lib/blog";
import { getAllBlogListItems } from "@/lib/blog-merge";
import { APP } from "@/lib/config";

// ISR so admin-authored posts show up here without a redeploy.
export const revalidate = 600;

export const metadata: Metadata = {
  title: `Blog — waiver software pricing, comparisons & e-sign law | ${APP.name}`,
  description:
    "Practical guides for high-volume waiver collection: software pricing breakdowns, honest comparisons, and what makes digital waivers hold up.",
};

export default async function BlogIndexPage() {
  const posts = await getAllBlogListItems();

  return (
    <>
      <MarketingHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
        <p className="text-sm font-semibold uppercase tracking-wider text-primary">
          Blog
        </p>
        <h1 className="mt-2 text-3xl font-bold">
          Guides for high-volume waiver collection
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">
          Pricing breakdowns, honest software comparisons, and what actually
          makes a digital waiver hold up — written for gyms, parks, and venues
          that sign hundreds of waivers a month.
        </p>

        <div className="mt-10 space-y-5">
          {posts.map((post) => (
            <article
              key={post.slug}
              className="group rounded-2xl border border-border bg-card p-6 shadow-card transition-all hover:-translate-y-0.5 hover:border-ring/50 hover:shadow-pop"
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <time dateTime={post.datePublished}>
                  {formatPostDate(post.datePublished)}
                </time>
                <span aria-hidden>·</span>
                <span>{post.readingMinutes} min read</span>
                <span className="flex flex-wrap gap-1.5">
                  {post.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent-foreground"
                    >
                      {tag}
                    </span>
                  ))}
                </span>
              </div>
              <h2 className="mt-3 text-xl font-bold leading-snug">
                <Link
                  href={`/blog/${post.slug}`}
                  className="transition-colors group-hover:text-primary"
                >
                  {post.title}
                </Link>
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {post.description}
              </p>
              <p className="mt-3 text-sm font-medium text-primary">
                <Link href={`/blog/${post.slug}`}>Read the guide →</Link>
              </p>
            </article>
          ))}
        </div>
      </main>
      <MarketingFooter />
    </>
  );
}
