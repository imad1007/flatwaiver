import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.pexels.com",
      },
    ],
  },
  // The per-post OG image route reads content/blog/*.mdx via fs at request
  // time; computed paths aren't picked up by output file tracing, so include
  // them explicitly for every blog route (keys are picomatch route globs).
  outputFileTracingIncludes: {
    "/blog/**": ["./content/blog/*.mdx"],
  },
  // Safety-net apex -> www redirect. Next anchors `has` host values (^...$),
  // so "flatwaiver.com" matches the apex only, never www — no redirect loop,
  // and preview *.vercel.app hosts are unaffected. The cleanest place to
  // enforce this is Vercel's domain settings (assign www as primary); this
  // guarantees it even if that's ever misconfigured.
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "flatwaiver.com" }],
        destination: "https://www.flatwaiver.com/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
