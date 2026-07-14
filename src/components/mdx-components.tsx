import type { MDXComponents } from "mdx/types";
import Link from "next/link";
import Image from "next/image";

/**
 * Element styling for blog MDX so posts read exactly like the rest of the
 * site (security/privacy doc pages): Geist Sans, foreground/90 body copy,
 * bordered card tables, indigo links. Exactly one h1 exists per post — the
 * page renders it from frontmatter — so MDX headings start at h2.
 */

function Anchor({ href = "", children }: { href?: string; children?: React.ReactNode }) {
  const className =
    "font-medium text-primary underline underline-offset-2 hover:opacity-80";
  if (href.startsWith("/")) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }
  const external = href.startsWith("http");
  return (
    <a
      href={href}
      className={className}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {children}
    </a>
  );
}

/** Bordered aside for disclaimers and data-freshness notes. */
export function Callout({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <aside className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-5 py-4 text-sm leading-relaxed text-amber-900 dark:text-amber-200">
      {title && <p className="font-semibold">{title}</p>}
      <div className={title ? "mt-1" : ""}>{children}</div>
    </aside>
  );
}

export const mdxComponents: MDXComponents = {
  h2: (props) => (
    <h2
      className="mt-12 scroll-mt-24 text-2xl font-bold tracking-tight"
      {...props}
    />
  ),
  h3: (props) => (
    <h3 className="mt-8 scroll-mt-24 text-xl font-semibold" {...props} />
  ),
  h4: (props) => <h4 className="mt-6 font-semibold" {...props} />,
  p: (props) => (
    <p className="mt-4 leading-relaxed text-foreground/90" {...props} />
  ),
  ul: (props) => (
    <ul
      className="mt-4 list-disc space-y-2 pl-5 leading-relaxed text-foreground/90"
      {...props}
    />
  ),
  ol: (props) => (
    <ol
      className="mt-4 list-decimal space-y-2 pl-5 leading-relaxed text-foreground/90"
      {...props}
    />
  ),
  li: (props) => <li className="pl-1" {...props} />,
  a: Anchor,
  strong: (props) => <strong className="font-semibold text-foreground" {...props} />,
  blockquote: (props) => (
    <blockquote
      className="mt-6 border-l-2 border-primary/40 pl-4 text-muted-foreground"
      {...props}
    />
  ),
  hr: () => <hr className="my-10 border-border" />,
  code: (props) => (
    <code
      className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em]"
      {...props}
    />
  ),
  table: (props) => (
    <div className="my-6 overflow-x-auto rounded-xl border border-border">
      <table className="w-full border-collapse text-left text-sm" {...props} />
    </div>
  ),
  thead: (props) => (
    <thead
      className="border-b border-border bg-muted/50 text-muted-foreground"
      {...props}
    />
  ),
  th: (props) => (
    <th className="whitespace-nowrap px-4 py-3 font-medium" {...props} />
  ),
  td: (props) => (
    <td
      className="border-b border-border/60 px-4 py-3 align-top text-foreground/90 [tr:last-child>&]:border-0"
      {...props}
    />
  ),
  img: ({ src = "", alt = "" }: { src?: string; alt?: string }) => (
    <Image
      src={src}
      alt={alt}
      width={1200}
      height={675}
      className="mt-6 h-auto w-full rounded-xl border border-border"
    />
  ),
  Callout,
};
