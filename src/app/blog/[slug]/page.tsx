import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";
import { MarketingHeader, MarketingFooter } from "@/components/marketing-chrome";
import { mdxComponents } from "@/components/mdx-components";
import { Button } from "@/components/ui/button";
import {
  getAllPosts,
  getPost,
  getRelatedPosts,
  formatPostDate,
} from "@/lib/blog";
import { APP } from "@/lib/config";

export const dynamicParams = false;

export function generateStaticParams() {
  return getAllPosts().map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return {};
  return {
    title: `${post.title} | ${APP.name}`,
    description: post.description,
    keywords: post.keywords,
    alternates: { canonical: post.canonical ?? `/blog/${post.slug}` },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.description,
      url: `/blog/${post.slug}`,
      publishedTime: `${post.datePublished}T00:00:00Z`,
      modifiedTime: `${post.dateModified}T00:00:00Z`,
      authors: [post.author],
      tags: post.tags,
      // When no explicit ogImage is set, the per-slug generated
      // opengraph-image.tsx in this segment is used automatically.
      ...(post.ogImage ? { images: [post.ogImage] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
    },
  };
}

const SITE_URL = (APP.url || "http://localhost:3000").replace(/\/$/, "");

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  const related = getRelatedPosts(post);

  // BlogPosting + BreadcrumbList; publisher/author reference the Organization
  // node already published in the homepage JSON-LD graph.
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BlogPosting",
        "@id": `${SITE_URL}/blog/${post.slug}#article`,
        headline: post.title,
        description: post.description,
        datePublished: `${post.datePublished}T00:00:00Z`,
        dateModified: `${post.dateModified}T00:00:00Z`,
        author: {
          "@type": "Organization",
          "@id": `${SITE_URL}/#organization`,
          name: APP.name,
        },
        publisher: { "@id": `${SITE_URL}/#organization` },
        image: post.ogImage || `${SITE_URL}/blog/${post.slug}/opengraph-image`,
        mainEntityOfPage: `${SITE_URL}/blog/${post.slug}`,
        keywords: post.keywords.join(", "),
        url: `${SITE_URL}/blog/${post.slug}`,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
          {
            "@type": "ListItem",
            position: 2,
            name: "Blog",
            item: `${SITE_URL}/blog`,
          },
          {
            "@type": "ListItem",
            position: 3,
            name: post.title,
            item: `${SITE_URL}/blog/${post.slug}`,
          },
        ],
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <MarketingHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
        <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li>
              <Link href="/" className="transition-colors hover:text-foreground">
                Home
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li>
              <Link
                href="/blog"
                className="transition-colors hover:text-foreground"
              >
                Blog
              </Link>
            </li>
          </ol>
        </nav>

        <article>
          <header className="mt-6">
            <div className="flex flex-wrap gap-1.5">
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-accent px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
            <h1 className="mt-4 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
              {post.title}
            </h1>
            <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span>{post.author}</span>
              <span aria-hidden>·</span>
              <time dateTime={post.datePublished}>
                {formatPostDate(post.datePublished)}
              </time>
              <span aria-hidden>·</span>
              <span>{post.readingMinutes} min read</span>
            </p>
          </header>

          <div className="mt-2">
            <MDXRemote
              source={post.content}
              components={mdxComponents}
              options={{ mdxOptions: { remarkPlugins: [remarkGfm] } }}
            />
          </div>
        </article>

        {/* Soft CTA */}
        <div className="mt-14 rounded-2xl border border-brand-500/40 bg-card p-8 text-center shadow-card">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">
            Try it on your own waiver
          </p>
          <h2 className="mt-2 text-2xl font-bold">
            Unlimited waivers. ${APP.priceMonthlyUsd}/month, flat.
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Upload the waiver you already use — AI converts it into a signable
            form in minutes. Free {APP.trialDays}-day trial, no card required.
          </p>
          <div className="mt-5">
            <Button size="lg" render={<Link href="/signup" />}>
              Start your free trial
            </Button>
          </div>
        </div>

        {/* Related posts */}
        {related.length > 0 && (
          <section className="mt-12">
            <h2 className="text-lg font-bold">Keep reading</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {related.map((r) => (
                <Link
                  key={r.slug}
                  href={`/blog/${r.slug}`}
                  className="group rounded-2xl border border-border bg-card p-5 shadow-card transition-all hover:-translate-y-0.5 hover:border-ring/50 hover:shadow-pop"
                >
                  <p className="text-xs text-muted-foreground">
                    {formatPostDate(r.datePublished)} · {r.readingMinutes} min
                    read
                  </p>
                  <p className="mt-2 font-semibold leading-snug transition-colors group-hover:text-primary">
                    {r.title}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
      <MarketingFooter />
    </>
  );
}
